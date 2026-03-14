import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import db from '../db/client';
import { executeSchedule } from '../services/scheduler';

const historyRouter = Router();

interface HistoryRow {
  id: number;
  report_id: number;
  schedule_id: number | null;
  trigger_type: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  output_path: string | null;
  email_status: string | null;
  error_message: string | null;
}

// GET /api/history — List all execution history
historyRouter.get('/', (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
  const offset = parseInt(req.query.offset as string) || 0;
  const status = req.query.status as string | undefined;
  const reportId = req.query.report_id as string | undefined;

  let sql = `
    SELECT h.*, r.name as report_name
    FROM execution_history h
    LEFT JOIN reports r ON r.id = h.report_id
  `;
  const conditions: string[] = [];
  const params: any[] = [];

  if (status) {
    conditions.push('h.status = ?');
    params.push(status);
  }
  if (reportId) {
    conditions.push('h.report_id = ?');
    params.push(parseInt(reportId, 10));
  }

  if (conditions.length) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY h.started_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rows = db.prepare(sql).all(...params) as (HistoryRow & { report_name: string })[];

  // Get total count for pagination
  let countSql = 'SELECT COUNT(*) as total FROM execution_history h';
  if (conditions.length) {
    countSql += ' WHERE ' + conditions.slice(0, -0).join(' AND ');
  }
  // Rebuild count without limit/offset params
  const countParams = params.slice(0, params.length - 2);
  const total = (db.prepare(countSql).get(...countParams) as { total: number }).total;

  res.json({ rows, total, limit, offset });
});

// GET /api/history/:id — Get single execution
historyRouter.get('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }

  const row = db.prepare(`
    SELECT h.*, r.name as report_name
    FROM execution_history h
    LEFT JOIN reports r ON r.id = h.report_id
    WHERE h.id = ?
  `).get(id) as (HistoryRow & { report_name: string }) | undefined;

  if (!row) { res.status(404).json({ error: 'History entry not found' }); return; }

  res.json(row);
});

// POST /api/history/:id/retry — Retry a failed execution
historyRouter.post('/:id/retry', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }

  const row = db.prepare('SELECT * FROM execution_history WHERE id = ?').get(id) as HistoryRow | undefined;
  if (!row) { res.status(404).json({ error: 'History entry not found' }); return; }

  if (row.status !== 'failed') {
    res.status(400).json({ error: 'Only failed executions can be retried' });
    return;
  }

  // If it was triggered by a schedule, re-run the schedule
  if (row.schedule_id) {
    try {
      await executeSchedule(row.schedule_id);
      res.json({ success: true, message: 'Schedule re-executed successfully' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
    return;
  }

  // Manual trigger — we can't fully re-run without more context,
  // but we mark it as retriable info
  res.status(400).json({ error: 'Manual executions cannot be retried. Please export the report again.' });
});

// GET /api/history/:id/download — Download the output file
historyRouter.get('/:id/download', (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }

  const row = db.prepare('SELECT * FROM execution_history WHERE id = ?').get(id) as HistoryRow | undefined;
  if (!row) { res.status(404).json({ error: 'History entry not found' }); return; }

  if (!row.output_path) {
    res.status(404).json({ error: 'No output file for this execution' });
    return;
  }

  // output_path may be comma-separated (for both pdf+excel)
  const files = row.output_path.split(',').map((f) => f.trim());
  const requestedFormat = req.query.format as string | undefined;

  let filePath: string | undefined;
  if (requestedFormat && files.length > 1) {
    filePath = files.find((f) => f.endsWith(`.${requestedFormat}`));
  }
  if (!filePath) filePath = files[0];

  // Try as absolute path first, then relative to reports/generated
  let resolvedPath = filePath;
  if (!fs.existsSync(resolvedPath)) {
    const reportsDir = process.env.REPORTS_DIR
      ? path.resolve(process.env.REPORTS_DIR)
      : path.resolve(__dirname, '..', '..', '..', 'reports', 'generated');
    resolvedPath = path.join(reportsDir, path.basename(filePath));
  }

  if (!fs.existsSync(resolvedPath)) {
    res.status(404).json({ error: 'Output file not found on disk' });
    return;
  }

  res.download(resolvedPath, path.basename(resolvedPath));
});

// DELETE /api/history/:id — Delete a history entry
historyRouter.delete('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }

  const row = db.prepare('SELECT * FROM execution_history WHERE id = ?').get(id) as HistoryRow | undefined;
  if (!row) { res.status(404).json({ error: 'History entry not found' }); return; }

  db.prepare('DELETE FROM execution_history WHERE id = ?').run(id);
  res.json({ success: true });
});

// DELETE /api/history — Clear all history
historyRouter.delete('/', (_req: Request, res: Response) => {
  db.prepare('DELETE FROM execution_history').run();
  res.json({ success: true });
});

export default historyRouter;
