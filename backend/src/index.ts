import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import healthRouter from './api/health';
import connectionsRouter from './api/connections';
import queriesRouter from './api/queries';
import reportsRouter from './api/reports';
import exportsRouter from './api/exports';
import schedulesRouter from './api/schedules';
import distributionRouter from './api/distribution';
import historyRouter from './api/history';
import aiRouter from './api/ai';
import { initScheduler } from './services/scheduler';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/health', healthRouter);
app.use('/api/connections', connectionsRouter);
app.use('/api/queries', queriesRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/reports', exportsRouter);
app.use('/api/schedules', schedulesRouter);
app.use('/api/distribution', distributionRouter);
app.use('/api/history', historyRouter);
app.use('/api/ai', aiRouter);

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  // Load and register all active cron schedules
  initScheduler();
});
