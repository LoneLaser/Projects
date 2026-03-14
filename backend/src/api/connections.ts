import { Router, Request, Response } from 'express';
import {
  createConnection,
  getAllConnections,
  deleteConnection,
  testConnection,
  ConnectionConfig,
} from '../services/sql-connector';

const connectionsRouter = Router();

// List all connections (passwords excluded)
connectionsRouter.get('/', (_req: Request, res: Response) => {
  const connections = getAllConnections();
  res.json(connections);
});

// Create a new connection
connectionsRouter.post('/', (req: Request, res: Response) => {
  const { name, server, database_name, username, password, port, encrypt } = req.body;

  if (!name || !server || !database_name || !username || !password) {
    res.status(400).json({ error: 'Missing required fields: name, server, database_name, username, password' });
    return;
  }

  const config: ConnectionConfig = { name, server, database_name, username, password, port, encrypt };
  const connection = createConnection(config);
  const { password_encrypted, password_iv, password_tag, ...safe } = connection;
  res.status(201).json(safe);
});

// Delete a connection
connectionsRouter.delete('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid connection ID' });
    return;
  }

  const deleted = deleteConnection(id);
  if (!deleted) {
    res.status(404).json({ error: 'Connection not found' });
    return;
  }
  res.json({ success: true });
});

// Test a connection
connectionsRouter.post('/:id/test', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid connection ID' });
    return;
  }

  const result = await testConnection(id);
  res.json(result);
});

export default connectionsRouter;
