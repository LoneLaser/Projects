import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

const REPORTS_DIR = process.env.REPORTS_DIR
  ? path.resolve(process.env.REPORTS_DIR)
  : path.resolve(__dirname, '..', '..', '..', '..', 'reports', 'generated');

if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

export interface PdfOptions {
  format?: 'A4' | 'Letter';
  landscape?: boolean;
  marginTop?: string;
  marginBottom?: string;
  marginLeft?: string;
  marginRight?: string;
}

export async function generatePdf(
  htmlContent: string,
  filename: string,
  options: PdfOptions = {}
): Promise<string> {
  const outputPath = path.join(REPORTS_DIR, filename);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0', timeout: 30000 });

    // Give charts time to render
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await page.pdf({
      path: outputPath,
      format: options.format || 'A4',
      landscape: options.landscape || false,
      printBackground: true,
      margin: {
        top: options.marginTop || '20mm',
        bottom: options.marginBottom || '20mm',
        left: options.marginLeft || '15mm',
        right: options.marginRight || '15mm',
      },
    });

    return outputPath;
  } finally {
    await browser.close();
  }
}

/**
 * Builds a full HTML document from report layout data for PDF rendering.
 */
export function buildReportHtml(
  report: { name: string; settings: any; layout: any[] },
  widgetData: Record<string, { columns: string[]; rows: any[] }>
): string {
  const settings = report.settings || {};
  const headerText = settings.headerText || report.name;
  const footerText = settings.footerText || '';
  const logoUrl = settings.logoUrl || '';

  const widgetHtmlParts = (report.layout || []).map((widget: any) => {
    const data = widgetData[widget.i] || { columns: [], rows: [] };
    return renderWidgetHtml(widget, data);
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', 'Helvetica', Arial, sans-serif; color: #333; background: #fff; padding: 0; }
    .report-header { display: flex; align-items: center; gap: 16px; padding: 20px 0; border-bottom: 2px solid #1976d2; margin-bottom: 24px; }
    .report-header img { max-height: 48px; }
    .report-header h1 { font-size: 22px; color: #1976d2; }
    .report-footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 11px; color: #888; text-align: center; }
    .widget { margin-bottom: 24px; break-inside: avoid; }
    .widget-title { font-size: 14px; font-weight: 600; margin-bottom: 8px; color: #444; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    table th { background: #1976d2; color: #fff; padding: 8px 10px; text-align: left; font-weight: 600; }
    table td { padding: 6px 10px; border-bottom: 1px solid #eee; }
    table tr:nth-child(even) td { background: #f8f9fa; }
    .kpi-card { display: inline-block; border: 1px solid #ddd; border-radius: 8px; padding: 16px 24px; min-width: 160px; text-align: center; }
    .kpi-value { font-size: 28px; font-weight: 700; color: #1976d2; }
    .kpi-label { font-size: 12px; color: #888; margin-top: 4px; }
    .chart-placeholder { background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; padding: 20px; text-align: center; color: #999; min-height: 200px; display: flex; align-items: center; justify-content: center; }
    .chart-img { max-width: 100%; height: auto; }
    .text-block { font-size: 13px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="report-header">
    ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="Logo" />` : ''}
    <h1>${escapeHtml(headerText)}</h1>
  </div>

  ${widgetHtmlParts.join('\n')}

  ${footerText ? `<div class="report-footer">${escapeHtml(footerText)}</div>` : ''}
</body>
</html>`;
}

function renderWidgetHtml(widget: any, data: { columns: string[]; rows: any[] }): string {
  const config = widget.config || {};
  const title = config.title || '';

  switch (widget.type) {
    case 'table':
      return renderTableWidget(title, data);
    case 'kpi':
      return renderKpiWidget(title, config, data);
    case 'bar':
    case 'line':
    case 'pie':
      return renderChartWidget(title, widget.type, config, data);
    case 'text':
      return renderTextWidget(config);
    case 'image':
      return renderImageWidget(config);
    default:
      return '';
  }
}

function renderTableWidget(title: string, data: { columns: string[]; rows: any[] }): string {
  if (data.rows.length === 0) return `<div class="widget"><div class="widget-title">${escapeHtml(title)}</div><p>No data</p></div>`;

  const cols = data.columns.length > 0 ? data.columns : Object.keys(data.rows[0] || {});
  const headerRow = cols.map((c) => `<th>${escapeHtml(c)}</th>`).join('');
  const bodyRows = data.rows
    .map(
      (row) =>
        `<tr>${cols.map((c) => `<td>${escapeHtml(String(row[c] ?? ''))}</td>`).join('')}</tr>`
    )
    .join('');

  return `<div class="widget">
    ${title ? `<div class="widget-title">${escapeHtml(title)}</div>` : ''}
    <table><thead><tr>${headerRow}</tr></thead><tbody>${bodyRows}</tbody></table>
  </div>`;
}

function renderKpiWidget(title: string, config: any, data: { columns: string[]; rows: any[] }): string {
  const valueCol = config.valueColumn || data.columns[0] || Object.keys(data.rows[0] || {})[0];
  const value = data.rows[0] ? data.rows[0][valueCol] : '—';
  const label = config.label || title || valueCol;

  return `<div class="widget">
    <div class="kpi-card">
      <div class="kpi-value">${escapeHtml(String(value ?? '—'))}</div>
      <div class="kpi-label">${escapeHtml(label)}</div>
    </div>
  </div>`;
}

function renderChartWidget(title: string, chartType: string, config: any, _data: { columns: string[]; rows: any[] }): string {
  // If a base64 chart image was captured client-side, embed it
  if (config.chartImage) {
    return `<div class="widget">
      ${title ? `<div class="widget-title">${escapeHtml(title)}</div>` : ''}
      <img class="chart-img" src="${config.chartImage}" alt="${escapeHtml(title)}" />
    </div>`;
  }

  return `<div class="widget">
    ${title ? `<div class="widget-title">${escapeHtml(title)}</div>` : ''}
    <div class="chart-placeholder">${escapeHtml(chartType.toUpperCase())} chart — image not captured</div>
  </div>`;
}

function renderTextWidget(config: any): string {
  return `<div class="widget"><div class="text-block">${config.content || ''}</div></div>`;
}

function renderImageWidget(config: any): string {
  const src = config.src || '';
  if (!src) return '';
  return `<div class="widget"><img class="chart-img" src="${escapeHtml(src)}" alt="" /></div>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
