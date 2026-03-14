import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import db from '../db/client';
import { generatePdf, buildReportHtml, PdfOptions } from '../services/report-engine/pdf';
import { generateExcel } from '../services/report-engine/excel';
import { getMssqlPool } from '../services/sql-connector';
import sql from 'mssql';

const exportsRouter = Router();

interface ReportRow {
  id: number;
  name: string;
  description: string | null;
  layout: string;
  settings: string;
}

interface QueryRow {
  id: number;
  connection_id: number;
  sql_text: string;
}

/**
 * Fetch live data for every widget that references a query.
 */
async function fetchWidgetData(
  layout: any[]
): Promise<Record<string, { columns: string[]; rows: any[] }>> {
  const result: Record<string, { columns: string[]; rows: any[] }> = {};

  for (const widget of layout) {
    const config = widget.config || {};
    const queryId = config.queryId;
    if (!queryId) {
      result[widget.i] = { columns: [], rows: [] };
      continue;
    }

    const queryRow = db.prepare('SELECT * FROM queries WHERE id = ?').get(queryId) as QueryRow | undefined;
    if (!queryRow) {
      result[widget.i] = { columns: [], rows: [] };
      continue;
    }

    let pool: sql.ConnectionPool | undefined;
    try {
      pool = await getMssqlPool(queryRow.connection_id);
      const queryResult = await pool.request().query(queryRow.sql_text);
      const rows = queryResult.recordset || [];
      const columns = queryResult.recordset?.columns
        ? Object.keys(queryResult.recordset.columns)
        : Object.keys(rows[0] || {});

      result[widget.i] = { columns, rows };
    } catch {
      result[widget.i] = { columns: [], rows: [] };
    } finally {
      if (pool) {
        try { await pool.close(); } catch { /* ignore */ }
      }
    }
  }

  return result;
}

// Export report as PDF
exportsRouter.post('/:id/export/pdf', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid report ID' });
    return;
  }

  const reportRow = db.prepare('SELECT * FROM reports WHERE id = ?').get(id) as ReportRow | undefined;
  if (!reportRow) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }

  const report = {
    ...reportRow,
    layout: JSON.parse(reportRow.layout),
    settings: JSON.parse(reportRow.settings),
  };

  // Accept optional chart images from the client (captured via ECharts getDataURL)
  const chartImages: Record<string, string> = req.body?.chartImages || {};

  // Inject chart images into widget configs
  for (const widget of report.layout) {
    if (chartImages[widget.i]) {
      widget.config = widget.config || {};
      widget.config.chartImage = chartImages[widget.i];
    }
  }

  const pdfOptions: PdfOptions = {
    format: req.body?.format || report.settings.pageFormat || 'A4',
    landscape: req.body?.landscape ?? report.settings.landscape ?? false,
  };

  try {
    const widgetData = await fetchWidgetData(report.layout);
    const html = buildReportHtml(report, widgetData);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${report.name.replace(/[^a-zA-Z0-9-_ ]/g, '')}-${timestamp}.pdf`;

    const outputPath = await generatePdf(html, filename, pdfOptions);

    // Log to execution history
    db.prepare(`
      INSERT INTO execution_history (report_id, trigger_type, status, finished_at, duration_ms, output_path)
      VALUES (?, 'manual', 'success', datetime('now'), 0, ?)
    `).run(id, filename);

    res.json({ success: true, filename, path: outputPath });
  } catch (err: any) {
    db.prepare(`
      INSERT INTO execution_history (report_id, trigger_type, status, finished_at, error_message)
      VALUES (?, 'manual', 'failed', datetime('now'), ?)
    `).run(id, err.message || 'Unknown error');

    res.status(500).json({ error: err.message || 'PDF generation failed' });
  }
});

// Export report as Excel
exportsRouter.post('/:id/export/excel', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid report ID' });
    return;
  }

  const reportRow = db.prepare('SELECT * FROM reports WHERE id = ?').get(id) as ReportRow | undefined;
  if (!reportRow) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }

  const report = {
    ...reportRow,
    layout: JSON.parse(reportRow.layout),
    settings: JSON.parse(reportRow.settings),
  };

  // Accept chart images from client
  const chartImages: Record<string, string> = req.body?.chartImages || {};
  for (const widget of report.layout) {
    if (chartImages[widget.i]) {
      widget.config = widget.config || {};
      widget.config.chartImage = chartImages[widget.i];
    }
  }

  try {
    const widgetData = await fetchWidgetData(report.layout);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${report.name.replace(/[^a-zA-Z0-9-_ ]/g, '')}-${timestamp}.xlsx`;

    const outputPath = await generateExcel(report, widgetData, filename);

    db.prepare(`
      INSERT INTO execution_history (report_id, trigger_type, status, finished_at, duration_ms, output_path)
      VALUES (?, 'manual', 'success', datetime('now'), 0, ?)
    `).run(id, filename);

    res.json({ success: true, filename, path: outputPath });
  } catch (err: any) {
    db.prepare(`
      INSERT INTO execution_history (report_id, trigger_type, status, finished_at, error_message)
      VALUES (?, 'manual', 'failed', datetime('now'), ?)
    `).run(id, err.message || 'Unknown error');

    res.status(500).json({ error: err.message || 'Excel generation failed' });
  }
});

// Download generated file
exportsRouter.get('/download/:filename', (req: Request, res: Response) => {
  const filename = req.params.filename as string;

  // Prevent path traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    res.status(400).json({ error: 'Invalid filename' });
    return;
  }

  const reportsDir = process.env.REPORTS_DIR
    ? path.resolve(process.env.REPORTS_DIR)
    : path.resolve(__dirname, '..', '..', '..', 'reports', 'generated');
  const filePath = path.join(reportsDir, filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  res.download(filePath);
});

export default exportsRouter;
