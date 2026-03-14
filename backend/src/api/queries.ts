import { Router, Request, Response } from 'express';
import db from '../db/client';
import { getMssqlPool, getConnectionById } from '../services/sql-connector';
import sql from 'mssql';

const queriesRouter = Router();

interface SavedQuery {
  id: number;
  connection_id: number;
  name: string;
  sql_text: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

// List all saved queries
queriesRouter.get('/', (_req: Request, res: Response) => {
  const stmt = db.prepare(`
    SELECT q.*, c.name as connection_name
    FROM queries q
    LEFT JOIN connections c ON c.id = q.connection_id
    ORDER BY q.updated_at DESC
  `);
  res.json(stmt.all());
});

// Save a query
queriesRouter.post('/', (req: Request, res: Response) => {
  const { connection_id, name, sql_text, description } = req.body;

  if (!connection_id || !name || !sql_text) {
    res.status(400).json({ error: 'Missing required fields: connection_id, name, sql_text' });
    return;
  }

  const stmt = db.prepare(`
    INSERT INTO queries (connection_id, name, sql_text, description)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(connection_id, name, sql_text, description || null);

  const saved = db.prepare('SELECT * FROM queries WHERE id = ?').get(result.lastInsertRowid) as SavedQuery;
  res.status(201).json(saved);
});

// Update a query
queriesRouter.put('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  const { name, sql_text, description, connection_id } = req.body;

  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid query ID' });
    return;
  }

  const stmt = db.prepare(`
    UPDATE queries SET name = COALESCE(?, name), sql_text = COALESCE(?, sql_text),
    description = COALESCE(?, description), connection_id = COALESCE(?, connection_id),
    updated_at = datetime('now')
    WHERE id = ?
  `);
  const result = stmt.run(name, sql_text, description, connection_id, id);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Query not found' });
    return;
  }

  const updated = db.prepare('SELECT * FROM queries WHERE id = ?').get(id);
  res.json(updated);
});

// Delete a query
queriesRouter.delete('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid query ID' });
    return;
  }

  const result = db.prepare('DELETE FROM queries WHERE id = ?').run(id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Query not found' });
    return;
  }
  res.json({ success: true });
});

// Run ad-hoc SQL against a connection
queriesRouter.post('/run', async (req: Request, res: Response) => {
  const { connection_id, sql_text } = req.body;

  if (!connection_id || !sql_text) {
    res.status(400).json({ error: 'Missing required fields: connection_id, sql_text' });
    return;
  }

  // Basic SQL injection guard: only allow SELECT statements
  const trimmed = sql_text.trim().toUpperCase();
  if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('WITH') && !trimmed.startsWith('EXEC')) {
    res.status(400).json({ error: 'Only SELECT, WITH (CTE), and EXEC queries are allowed' });
    return;
  }

  let pool: sql.ConnectionPool | undefined;
  try {
    pool = await getMssqlPool(connection_id);
    const result = await pool.request().query(sql_text);

    const rows = result.recordset?.slice(0, 1000) || [];
    const columns = result.recordset?.columns
      ? Object.entries(result.recordset.columns).map(([name, meta]: [string, any]) => ({
          name,
          type: meta.type?.declaration || 'unknown',
        }))
      : [];

    res.json({
      columns,
      rows,
      totalRows: result.recordset?.length || 0,
      truncated: (result.recordset?.length || 0) > 1000,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Query execution failed' });
  } finally {
    if (pool) {
      try { await pool.close(); } catch { /* ignore */ }
    }
  }
});

// Get tables & columns for a connection (for visual query builder)
queriesRouter.get('/tables/:connectionId', async (req: Request, res: Response) => {
  const connectionId = parseInt(req.params.connectionId as string, 10);
  if (isNaN(connectionId)) {
    res.status(400).json({ error: 'Invalid connection ID' });
    return;
  }

  let pool: sql.ConnectionPool | undefined;
  try {
    pool = await getMssqlPool(connectionId);

    const tablesResult = await pool.request().query(`
      SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE
      FROM INFORMATION_SCHEMA.TABLES
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `);

    const columnsResult = await pool.request().query(`
      SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION
    `);

    // Group columns by table
    const tables = tablesResult.recordset.map((table: any) => ({
      schema: table.TABLE_SCHEMA,
      name: table.TABLE_NAME,
      type: table.TABLE_TYPE,
      columns: columnsResult.recordset
        .filter((c: any) => c.TABLE_SCHEMA === table.TABLE_SCHEMA && c.TABLE_NAME === table.TABLE_NAME)
        .map((c: any) => ({
          name: c.COLUMN_NAME,
          type: c.DATA_TYPE,
          nullable: c.IS_NULLABLE === 'YES',
          default: c.COLUMN_DEFAULT,
        })),
    }));

    res.json(tables);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch table metadata' });
  } finally {
    if (pool) {
      try { await pool.close(); } catch { /* ignore */ }
    }
  }
});

export default queriesRouter;
