import { Router, Request, Response } from 'express';
import db from '../db/client';
import { verifySmtpConnection, EmailProvider, SmtpConfig } from '../services/email';

const distributionRouter = Router();

interface DistributionRow {
  id: number;
  schedule_id: number;
  provider: string;
  config: string;
  recipients: string;
  subject_template: string | null;
  body_template: string | null;
  created_at: string;
  updated_at: string;
}

function parseRow(row: DistributionRow) {
  return {
    ...row,
    config: JSON.parse(row.config),
    recipients: JSON.parse(row.recipients),
  };
}

// GET /api/distribution — List all distribution configs
distributionRouter.get('/', (_req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT d.*, s.report_id, r.name as report_name
    FROM distribution_lists d
    LEFT JOIN schedules s ON s.id = d.schedule_id
    LEFT JOIN reports r ON r.id = s.report_id
    ORDER BY d.created_at DESC
  `).all() as (DistributionRow & { report_id: number; report_name: string })[];

  res.json(rows.map((row) => ({
    ...parseRow(row),
    report_id: row.report_id,
    report_name: row.report_name,
  })));
});

// GET /api/distribution/:id — Get single config
distributionRouter.get('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }

  const row = db.prepare('SELECT * FROM distribution_lists WHERE id = ?').get(id) as DistributionRow | undefined;
  if (!row) { res.status(404).json({ error: 'Distribution config not found' }); return; }

  res.json(parseRow(row));
});

// POST /api/distribution — Create distribution config
distributionRouter.post('/', (req: Request, res: Response) => {
  const { schedule_id, provider, config, recipients, subject_template, body_template } = req.body;

  if (!schedule_id) {
    res.status(400).json({ error: 'schedule_id is required' });
    return;
  }

  // Verify schedule exists
  const schedule = db.prepare('SELECT id FROM schedules WHERE id = ?').get(schedule_id);
  if (!schedule) {
    res.status(400).json({ error: 'Schedule not found' });
    return;
  }

  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    res.status(400).json({ error: 'At least one recipient is required' });
    return;
  }

  const result = db.prepare(`
    INSERT INTO distribution_lists (schedule_id, provider, config, recipients, subject_template, body_template)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    schedule_id,
    provider || 'smtp',
    JSON.stringify(config || {}),
    JSON.stringify(recipients),
    subject_template || null,
    body_template || null
  );

  const id = result.lastInsertRowid as number;
  const row = db.prepare('SELECT * FROM distribution_lists WHERE id = ?').get(id) as DistributionRow;
  res.status(201).json(parseRow(row));
});

// PUT /api/distribution/:id — Update distribution config
distributionRouter.put('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }

  const existing = db.prepare('SELECT * FROM distribution_lists WHERE id = ?').get(id) as DistributionRow | undefined;
  if (!existing) { res.status(404).json({ error: 'Distribution config not found' }); return; }

  const { schedule_id, provider, config, recipients, subject_template, body_template } = req.body;

  db.prepare(`
    UPDATE distribution_lists
    SET schedule_id = ?,
        provider = ?,
        config = ?,
        recipients = ?,
        subject_template = ?,
        body_template = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    schedule_id ?? existing.schedule_id,
    provider ?? existing.provider,
    config ? JSON.stringify(config) : existing.config,
    recipients ? JSON.stringify(recipients) : existing.recipients,
    subject_template !== undefined ? subject_template : existing.subject_template,
    body_template !== undefined ? body_template : existing.body_template,
    id
  );

  const row = db.prepare('SELECT * FROM distribution_lists WHERE id = ?').get(id) as DistributionRow;
  res.json(parseRow(row));
});

// DELETE /api/distribution/:id — Delete distribution config
distributionRouter.delete('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }

  const existing = db.prepare('SELECT * FROM distribution_lists WHERE id = ?').get(id) as DistributionRow | undefined;
  if (!existing) { res.status(404).json({ error: 'Distribution config not found' }); return; }

  db.prepare('DELETE FROM distribution_lists WHERE id = ?').run(id);
  res.json({ success: true });
});

// POST /api/distribution/test-smtp — Test SMTP connection
distributionRouter.post('/test-smtp', async (req: Request, res: Response) => {
  const { provider, config } = req.body as { provider: EmailProvider; config: SmtpConfig };

  if (!config?.host && provider === 'smtp') {
    res.status(400).json({ error: 'SMTP host is required' });
    return;
  }

  const result = await verifySmtpConnection(provider || 'smtp', config);
  res.json(result);
});

export default distributionRouter;
