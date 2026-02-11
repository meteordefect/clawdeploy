import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/client';
import { agentAuth, AuthenticatedRequest } from '../middleware/agentAuth';

const router = Router();

interface Agent {
  id: string;
  name: string;
  token: string;
  description: string | null;
  last_heartbeat: Date | null;
  health: any;
  status: string;
  ip_address: string | null;
  openclaw_version: string | null;
  created_at: Date;
  updated_at: Date;
}

router.post('/agents/register', async (req: Request, res: Response) => {
  const { name, description } = req.body;
  
  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'Agent name is required' });
    return;
  }
  
  const token = uuidv4();
  const ip = req.ip || req.socket.remoteAddress;
  
  try {
    const result = await query<Agent>(
      `INSERT INTO agents (name, token, description, ip_address, status)
       VALUES ($1, $2, $3, $4, 'offline')
       RETURNING id, name, token, description, status, created_at`,
      [name, token, description || null, ip]
    );
    
    await query(
      `INSERT INTO events (type, agent_id, data)
       VALUES ($1, $2, $3)`,
      ['agent.registered', result[0].id, { name, ip }]
    );
    
    res.status(201).json({
      agent_id: result[0].id,
      token: result[0].token,
      name: result[0].name,
      status: result[0].status,
      created_at: result[0].created_at,
    });
  } catch (err) {
    console.error('Agent registration error:', err);
    res.status(500).json({ error: 'Failed to register agent' });
  }
});

router.post('/agents/heartbeat', agentAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { health, openclaw_version } = req.body;
  const agent = req.agent!;
  const ip = req.ip || req.socket.remoteAddress;
  
  try {
    await query(
      `UPDATE agents 
       SET last_heartbeat = now(), 
           health = $1, 
           openclaw_version = $2,
           ip_address = $3,
           status = 'online',
           updated_at = now()
       WHERE id = $4`,
      [JSON.stringify(health || {}), openclaw_version || null, ip, agent.id]
    );
    
    await query(
      `INSERT INTO events (type, agent_id, data)
       VALUES ($1, $2, $3)`,
      ['agent.heartbeat', agent.id, { health, openclaw_version }]
    );
    
    res.json({ 
      status: 'ok', 
      agent_id: agent.id,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Heartbeat error:', err);
    res.status(500).json({ error: 'Failed to process heartbeat' });
  }
});

router.get('/agents', async (req: Request, res: Response) => {
  try {
    const agents = await query<Agent>(
      `SELECT id, name, description, last_heartbeat, health, status, 
              ip_address, openclaw_version, created_at, updated_at
       FROM agents
       ORDER BY created_at DESC`
    );
    
    res.json(agents);
  } catch (err) {
    console.error('Error fetching agents:', err);
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

router.get('/agents/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  
  try {
    const agents = await query<Agent>(
      `SELECT id, name, description, last_heartbeat, health, status,
              ip_address, openclaw_version, created_at, updated_at
       FROM agents
       WHERE id = $1`,
      [id]
    );
    
    if (agents.length === 0) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    
    const commands = await query(
      `SELECT id, type, status, created_at, completed_at
       FROM commands
       WHERE agent_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [id]
    );
    
    res.json({
      ...agents[0],
      recent_commands: commands,
    });
  } catch (err) {
    console.error('Error fetching agent:', err);
    res.status(500).json({ error: 'Failed to fetch agent' });
  }
});

export default router;
