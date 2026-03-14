import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

const REPORTS_DIR = process.env.REPORTS_DIR
  ? path.resolve(process.env.REPORTS_DIR)
  : path.resolve(__dirname, '..', '..', '..', '..', 'reports', 'generated');

if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

export async function generateExcel(
  report: { name: string; settings: any; layout: any[] },
  widgetData: Record<string, { columns: string[]; rows: any[] }>,
  filename: string
): Promise<string> {
  const outputPath = path.join(REPORTS_DIR, filename);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Data Report Generator';
  workbook.created = new Date();

  // Summary sheet with KPIs
  const kpiWidgets = (report.layout || []).filter((w: any) => w.type === 'kpi');
  if (kpiWidgets.length > 0) {
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 25 },
    ];
    styleHeaderRow(summarySheet);

    for (const widget of kpiWidgets) {
      const config = widget.config || {};
      const data = widgetData[widget.i] || { columns: [], rows: [] };
      const valueCol = config.valueColumn || data.columns[0] || Object.keys(data.rows[0] || {})[0];
      const value = data.rows[0] ? data.rows[0][valueCol] : '—';
      summarySheet.addRow({ metric: config.label || config.title || valueCol || 'KPI', value });
    }
  }

  // One sheet per table/data widget
  const dataWidgets = (report.layout || []).filter(
    (w: any) => w.type === 'table' || w.type === 'bar' || w.type === 'line' || w.type === 'pie'
  );

  let sheetIndex = 1;
  for (const widget of dataWidgets) {
    const config = widget.config || {};
    const data = widgetData[widget.i] || { columns: [], rows: [] };
    if (data.rows.length === 0) continue;

    const cols = data.columns.length > 0 ? data.columns : Object.keys(data.rows[0] || {});
    // Sanitize sheet name (max 31 chars, no special chars)
    const rawName = config.title || `Data ${sheetIndex}`;
    const sheetName = rawName.replace(/[\\/*?[\]:]/g, '').substring(0, 31);
    const sheet = workbook.addWorksheet(sheetName);

    // Set columns
    sheet.columns = cols.map((col) => ({
      header: col,
      key: col,
      width: Math.max(col.length + 4, 14),
    }));

    styleHeaderRow(sheet);

    // Add rows with alternating colors
    data.rows.forEach((row, idx) => {
      const excelRow = sheet.addRow(cols.map((c) => row[c] ?? ''));
      if (idx % 2 === 1) {
        excelRow.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8F9FA' },
          };
        });
      }
    });

    // Auto-fit column widths (approximate)
    sheet.columns.forEach((col) => {
      let maxLen = String(col.header || '').length;
      if (col.key) {
        data.rows.forEach((row) => {
          const val = String(row[col.key as string] ?? '');
          if (val.length > maxLen) maxLen = val.length;
        });
      }
      col.width = Math.min(Math.max(maxLen + 2, 10), 50);
    });

    // Embed chart image if available
    if (config.chartImage && (widget.type === 'bar' || widget.type === 'line' || widget.type === 'pie')) {
      try {
        const base64Data = config.chartImage.replace(/^data:image\/\w+;base64,/, '');
        const imageId = workbook.addImage({
          base64: base64Data,
          extension: 'png',
        });
        // Place chart image below the data
        const startRow = data.rows.length + 3;
        sheet.addImage(imageId, {
          tl: { col: 0, row: startRow },
          ext: { width: 600, height: 350 },
        });
      } catch {
        // Skip chart embedding on error
      }
    }

    sheetIndex++;
  }

  // Ensure at least one sheet exists
  if (workbook.worksheets.length === 0) {
    const emptySheet = workbook.addWorksheet('Report');
    emptySheet.addRow(['No data widgets in this report']);
  }

  await workbook.xlsx.writeFile(outputPath);
  return outputPath;
}

function styleHeaderRow(sheet: ExcelJS.Worksheet): void {
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1976D2' },
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'left' };
  headerRow.height = 28;
}
