import { Router, Request, Response } from 'express';
import db from '../db/client';

const reportsRouter = Router();

interface ReportRow {
  id: number;
  name: string;
  description: string | null;
  layout: string;
  settings: string;
  created_at: string;
  updated_at: string;
}

// List all reports
reportsRouter.get('/', (_req: Request, res: Response) => {
  const stmt = db.prepare('SELECT * FROM reports ORDER BY updated_at DESC');
  const reports = stmt.all() as ReportRow[];
  res.json(reports.map((r) => ({
    ...r,
    layout: JSON.parse(r.layout),
    settings: JSON.parse(r.settings),
  })));
});

// Get single report
reportsRouter.get('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid report ID' });
    return;
  }

  const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(id) as ReportRow | undefined;
  if (!report) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }

  res.json({
    ...report,
    layout: JSON.parse(report.layout),
    settings: JSON.parse(report.settings),
  });
});

// Create new report
reportsRouter.post('/', (req: Request, res: Response) => {
  const { name, description, layout, settings } = req.body;

  if (!name) {
    res.status(400).json({ error: 'Report name is required' });
    return;
  }

  const stmt = db.prepare(`
    INSERT INTO reports (name, description, layout, settings)
    VALUES (?, ?, ?, ?)
  `);

  const result = stmt.run(
    name,
    description || null,
    JSON.stringify(layout || []),
    JSON.stringify(settings || {})
  );

  const created = db.prepare('SELECT * FROM reports WHERE id = ?').get(result.lastInsertRowid) as ReportRow;
  res.status(201).json({
    ...created,
    layout: JSON.parse(created.layout),
    settings: JSON.parse(created.settings),
  });
});

// Update report
reportsRouter.put('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid report ID' });
    return;
  }

  const { name, description, layout, settings } = req.body;

  const existing = db.prepare('SELECT * FROM reports WHERE id = ?').get(id) as ReportRow | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }

  const stmt = db.prepare(`
    UPDATE reports SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      layout = COALESCE(?, layout),
      settings = COALESCE(?, settings),
      updated_at = datetime('now')
    WHERE id = ?
  `);

  stmt.run(
    name ?? null,
    description ?? null,
    layout ? JSON.stringify(layout) : null,
    settings ? JSON.stringify(settings) : null,
    id
  );

  const updated = db.prepare('SELECT * FROM reports WHERE id = ?').get(id) as ReportRow;
  res.json({
    ...updated,
    layout: JSON.parse(updated.layout),
    settings: JSON.parse(updated.settings),
  });
});

// Delete report
reportsRouter.delete('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid report ID' });
    return;
  }

  const result = db.prepare('DELETE FROM reports WHERE id = ?').run(id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }
  res.json({ success: true });
});

export default reportsRouter;
