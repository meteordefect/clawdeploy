import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { runMigrations } from './db/migrate';
import { startAgentStatusMonitor } from './lib/agentStatus';

import healthRouter from './routes/health';
import agentsRouter from './routes/agents';
import commandsRouter from './routes/commands';
import missionsRouter from './routes/missions';
import eventsRouter from './routes/events';
import filesRouter from './routes/files';
import sessionsRouter from './routes/sessions';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

app.use('/api', healthRouter);
app.use('/api', agentsRouter);
app.use('/api', commandsRouter);
app.use('/api', missionsRouter);
app.use('/api', eventsRouter);
app.use('/api', filesRouter);
app.use('/api', sessionsRouter);

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function startServer() {
  try {
    console.log('ClawDeploy Control API v3.0');
    console.log('Running database migrations...');
    await runMigrations();
    
    console.log('Starting agent status monitor...');
    startAgentStatusMonitor(30000);
    
    app.listen(PORT, () => {
      console.log(`✓ Control API listening on port ${PORT}`);
      console.log(`  Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
