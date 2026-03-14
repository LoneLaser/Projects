import { Router, Request, Response } from 'express';
import db from '../db/client';
import { syncSchedule, removeSchedule, executeSchedule, describeCron } from '../services/scheduler';
import cron from 'node-cron';

const schedulesRouter = Router();

interface ScheduleRow {
  id: number;
  report_id: number;
  cron_expression: string;
  export_format: string;
  active: number;
  distribution_list_id: number | null;
  created_at: string;
  updated_at: string;
}

interface ReportRow {
  id: number;
  name: string;
}

// GET /api/schedules — List all schedules
schedulesRouter.get('/', (_req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT s.*, r.name as report_name
    FROM schedules s
    LEFT JOIN reports r ON r.id = s.report_id
    ORDER BY s.created_at DESC
  `).all() as (ScheduleRow & { report_name: string })[];

  const result = rows.map((row) => ({
    ...row,
    active: !!row.active,
    cron_description: describeCron(row.cron_expression),
  }));

  res.json(result);
});

// GET /api/schedules/:id — Get single schedule
schedulesRouter.get('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }

  const row = db.prepare(`
    SELECT s.*, r.name as report_name
    FROM schedules s
    LEFT JOIN reports r ON r.id = s.report_id
    WHERE s.id = ?
  `).get(id) as (ScheduleRow & { report_name: string }) | undefined;

  if (!row) { res.status(404).json({ error: 'Schedule not found' }); return; }

  res.json({ ...row, active: !!row.active, cron_description: describeCron(row.cron_expression) });
});

// POST /api/schedules — Create schedule
schedulesRouter.post('/', (req: Request, res: Response) => {
  const { report_id, cron_expression, export_format, active } = req.body;

  if (!report_id || !cron_expression) {
    res.status(400).json({ error: 'report_id and cron_expression are required' });
    return;
  }

  if (!cron.validate(cron_expression)) {
    res.status(400).json({ error: 'Invalid cron expression' });
    return;
  }

  // Verify report exists
  const report = db.prepare('SELECT id FROM reports WHERE id = ?').get(report_id) as ReportRow | undefined;
  if (!report) {
    res.status(400).json({ error: 'Report not found' });
    return;
  }

  const result = db.prepare(`
    INSERT INTO schedules (report_id, cron_expression, export_format, active)
    VALUES (?, ?, ?, ?)
  `).run(report_id, cron_expression, export_format || 'pdf', active !== false ? 1 : 0);

  const id = result.lastInsertRowid as number;

  // Register the cron job
  syncSchedule(id);

  const row = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id) as ScheduleRow;
  res.status(201).json({ ...row, active: !!row.active, cron_description: describeCron(row.cron_expression) });
});

// PUT /api/schedules/:id — Update schedule
schedulesRouter.put('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }

  const existing = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id) as ScheduleRow | undefined;
  if (!existing) { res.status(404).json({ error: 'Schedule not found' }); return; }

  const { report_id, cron_expression, export_format, active } = req.body;

  if (cron_expression && !cron.validate(cron_expression)) {
    res.status(400).json({ error: 'Invalid cron expression' });
    return;
  }

  db.prepare(`
    UPDATE schedules
    SET report_id = ?,
        cron_expression = ?,
        export_format = ?,
        active = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    report_id ?? existing.report_id,
    cron_expression ?? existing.cron_expression,
    export_format ?? existing.export_format,
    active !== undefined ? (active ? 1 : 0) : existing.active,
    id
  );

  // Re-register the cron job
  syncSchedule(id);

  const row = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id) as ScheduleRow;
  res.json({ ...row, active: !!row.active, cron_description: describeCron(row.cron_expression) });
});

// DELETE /api/schedules/:id — Delete schedule
schedulesRouter.delete('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }

  const existing = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id) as ScheduleRow | undefined;
  if (!existing) { res.status(404).json({ error: 'Schedule not found' }); return; }

  // Remove cron job first
  removeSchedule(id);

  db.prepare('DELETE FROM schedules WHERE id = ?').run(id);
  res.json({ success: true });
});

// POST /api/schedules/:id/run-now — Trigger immediately
schedulesRouter.post('/:id/run-now', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }

  const existing = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id) as ScheduleRow | undefined;
  if (!existing) { res.status(404).json({ error: 'Schedule not found' }); return; }

  try {
    await executeSchedule(id);
    res.json({ success: true, message: 'Schedule executed successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default schedulesRouter;
