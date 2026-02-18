import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/client';
import { agentAuth, AuthenticatedRequest } from '../middleware/agentAuth';

const router = Router();

const OPENCLAW_DATA_PATH = process.env.OPENCLAW_DATA_PATH || path.join(process.env.HOME || '/root', '.openclaw');
const SUBAGENT_REGISTRY_PATH = path.join(OPENCLAW_DATA_PATH, 'subagents', 'runs.json');

type SubagentRunRecord = {
  runId: string;
  childSessionKey: string;
  task: string;
  label?: string;
  createdAt?: number;
  startedAt?: number;
  endedAt?: number;
  cleanupCompletedAt?: number;
};

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
  
  const ip = req.ip || req.socket.remoteAddress;
  
  try {
    // Prefer synced agent: if one exists with matching name (from OpenClaw sync), reuse it
    const syncedByName = await query<Agent & { openclaw_agent_id: string | null }>(
      `SELECT id, name, token, description, status, created_at, openclaw_agent_id
       FROM agents WHERE name = $1 AND openclaw_agent_id IS NOT NULL
       ORDER BY created_at DESC LIMIT 1`,
      [name]
    );
    if (syncedByName.length > 0) {
      await query(
        `UPDATE agents SET description = $1, ip_address = $2, status = 'offline', updated_at = now() WHERE id = $3`,
        [description || syncedByName[0].description, ip, syncedByName[0].id]
      );
      await query(
        `INSERT INTO events (type, agent_id, data) VALUES ($1, $2, $3)`,
        ['agent.reconnected', syncedByName[0].id, { name, ip }]
      );
      res.json({
        agent_id: syncedByName[0].id,
        token: syncedByName[0].token,
        name: syncedByName[0].name,
        status: 'offline',
        created_at: syncedByName[0].created_at,
        reconnected: true,
      });
      return;
    }
    
    // Check if agent with same name and IP already exists
    const existingAgents = await query<Agent>(
      `SELECT id, name, token, description, status, created_at
       FROM agents
       WHERE name = $1 AND ip_address = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [name, ip]
    );
    
    if (existingAgents.length > 0) {
      // Reuse existing agent - update its description and mark as offline (will come online on heartbeat)
      await query(
        `UPDATE agents 
         SET description = $1, 
             status = 'offline',
             updated_at = now()
         WHERE id = $2`,
        [description || existingAgents[0].description, existingAgents[0].id]
      );
      
      await query(
        `INSERT INTO events (type, agent_id, data)
         VALUES ($1, $2, $3)`,
        ['agent.reconnected', existingAgents[0].id, { name, ip }]
      );
      
      res.json({
        agent_id: existingAgents[0].id,
        token: existingAgents[0].token,
        name: existingAgents[0].name,
        status: 'offline',
        created_at: existingAgents[0].created_at,
        reconnected: true,
      });
      return;
    }
    
    // Create new agent
    const token = uuidv4();
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
      reconnected: false,
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
              ip_address, openclaw_version, openclaw_agent_id, created_at, updated_at
       FROM agents
       ORDER BY created_at DESC`
    );
    
    res.json(agents);
  } catch (err) {
    console.error('Error fetching agents:', err);
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

// Must be before /agents/:id or these would be matched as agent ids
// Returns agents and subagents from OpenClaw only (no DB)
router.get('/agents/mentionables', async (req: Request, res: Response) => {
  try {
    const openclawAgents = loadOpenClawAgentsList();
    const allRuns = loadSubagentsFromRegistry();
    const subagents = allRuns.map((r) => {
      const parentId = parseParentAgentId(r.childSessionKey);
      return {
        sessionKey: r.childSessionKey,
        label: r.label,
        task: r.task,
        runId: r.runId,
        parentAgentId: parentId,
      };
    });

    res.json({
      agents: openclawAgents.map((a) => ({
        id: a.id,
        name: a.name,
        token: a.id,
        kind: 'agent' as const,
      })),
      subagents: subagents.map((s) => ({
        sessionKey: s.sessionKey,
        label: s.label || s.task || s.runId,
        token: s.sessionKey,
        runId: s.runId,
        parentAgentId: s.parentAgentId,
        kind: 'subagent' as const,
      })),
    });
  } catch (err) {
    console.error('Mentionables error:', err);
    res.status(500).json({ error: 'Failed to load mentionables' });
  }
});

router.get('/agents/subagents-registry', async (req: Request, res: Response) => {
  try {
    const allRuns = loadSubagentsFromRegistry();
    const subagents = allRuns.map((r) => {
      const parentId = parseParentAgentId(r.childSessionKey);
      return {
        runId: r.runId,
        sessionKey: r.childSessionKey,
        parentAgentId: parentId,
        task: r.task,
        label: r.label,
        createdAt: r.createdAt,
        startedAt: r.startedAt,
        endedAt: r.endedAt,
      };
    });
    res.json({ subagents });
  } catch (err) {
    console.error('Subagents registry error:', err);
    res.status(500).json({ error: 'Failed to load subagents registry' });
  }
});

router.get('/agents/openclaw-list', async (req: Request, res: Response) => {
  try {
    const list = loadOpenClawAgentsList();
    const dbAgents = await query<{ id: string; openclaw_agent_id: string }>(
      `SELECT id, openclaw_agent_id FROM agents WHERE openclaw_agent_id IS NOT NULL`
    );
    const syncedMap = new Map<string, string>();
    dbAgents.forEach((r) => r.openclaw_agent_id && syncedMap.set(r.openclaw_agent_id, r.id));

    res.json({
      agents: list.map((a) => ({
        ...a,
        synced: syncedMap.has(a.id),
        dbAgentId: syncedMap.get(a.id) ?? null,
      })),
    });
  } catch (err) {
    console.error('OpenClaw agents list error:', err);
    res.status(500).json({
      error: 'Failed to list OpenClaw agents',
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

router.get('/agents/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  
  try {
    const agents = await query<Agent>(
      `SELECT id, name, description, last_heartbeat, health, status,
              ip_address, openclaw_version, openclaw_agent_id, created_at, updated_at
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

router.patch('/agents/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, openclaw_agent_id } = req.body;
  
  if (!name && !description && openclaw_agent_id === undefined) {
    res.status(400).json({ error: 'At least one field (name, description, or openclaw_agent_id) is required' });
    return;
  }
  
  try {
    const agents = await query<Agent & { openclaw_agent_id: string | null }>(
      `SELECT id, name, description, openclaw_agent_id FROM agents WHERE id = $1`,
      [id]
    );
    
    if (agents.length === 0) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    
    const updatedName = name || agents[0].name;
    const updatedDescription = description !== undefined ? description : agents[0].description;
    const updatedOpenClawId = openclaw_agent_id === '' || openclaw_agent_id === null
      ? null
      : openclaw_agent_id !== undefined
        ? (typeof openclaw_agent_id === 'string' ? openclaw_agent_id.trim() : null)
        : agents[0].openclaw_agent_id;
    
    await query(
      `UPDATE agents 
       SET name = $1, 
           description = $2,
           openclaw_agent_id = $3,
           updated_at = now()
       WHERE id = $4`,
      [updatedName, updatedDescription, updatedOpenClawId, id]
    );
    
    await query(
      `INSERT INTO events (type, agent_id, data)
       VALUES ($1, $2, $3)`,
      ['agent.updated', id, { name: updatedName, description: updatedDescription, openclaw_agent_id: updatedOpenClawId }]
    );
    
    const updated = await query<Agent>(
      `SELECT id, name, description, last_heartbeat, health, status,
              ip_address, openclaw_version, openclaw_agent_id, created_at, updated_at
       FROM agents
       WHERE id = $1`,
      [id]
    );
    
    res.json(updated[0]);
  } catch (err) {
    console.error('Error updating agent:', err);
    res.status(500).json({ error: 'Failed to update agent' });
  }
});

function loadOpenClawAgentsList(): { id: string; name: string }[] {
  const result: { id: string; name: string }[] = [];
  const configPath = path.join(OPENCLAW_DATA_PATH, 'openclaw.json');

  // Try config file first
  if (fs.existsSync(configPath)) {
    try {
      let raw = fs.readFileSync(configPath, 'utf-8');
      // Strip JSON5 comments and trailing commas for lenient parsing
      raw = raw.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/,(\s*[}\]])/g, '$1');
      const config: { agents?: { list?: Array<{ id?: string; name?: string }> } } = JSON.parse(raw);
      const list = config?.agents?.list ?? [];
      if (Array.isArray(list)) {
        for (const entry of list) {
          const id = typeof entry?.id === 'string' && entry.id.trim() ? entry.id.trim() : null;
          if (id) {
            result.push({
              id,
              name: typeof entry?.name === 'string' && entry.name.trim()
                ? entry.name.trim()
                : id,
            });
          }
        }
      }
    } catch (e) {
      console.warn('OpenClaw config parse failed:', e);
    }
  }

  // Fallback: scan agents directory (agents/<id>/ structure)
  if (result.length === 0) {
    const agentsDir = path.join(OPENCLAW_DATA_PATH, 'agents');
    if (fs.existsSync(agentsDir)) {
      try {
        const dirs = fs.readdirSync(agentsDir, { withFileTypes: true });
        for (const d of dirs) {
          if (d.isDirectory() && d.name && !d.name.startsWith('.')) {
            if (!result.some((a) => a.id === d.name)) {
              result.push({ id: d.name, name: d.name });
            }
          }
        }
      } catch (e) {
        console.warn('OpenClaw agents dir scan failed:', e);
      }
    }
  }

  return result;
}

function loadSubagentsFromRegistry(): SubagentRunRecord[] {
  const result: SubagentRunRecord[] = [];
  if (!fs.existsSync(SUBAGENT_REGISTRY_PATH)) return result;
  try {
    const raw = JSON.parse(fs.readFileSync(SUBAGENT_REGISTRY_PATH, 'utf-8'));
    const runs = raw?.runs;
    if (!runs || typeof runs !== 'object') return result;
    for (const entry of Object.values(runs) as any[]) {
      if (entry?.runId && entry?.childSessionKey) {
        result.push({
          runId: entry.runId,
          childSessionKey: entry.childSessionKey,
          task: entry.task ?? '',
          label: entry.label,
          createdAt: entry.createdAt,
          startedAt: entry.startedAt,
          endedAt: entry.endedAt,
          cleanupCompletedAt: entry.cleanupCompletedAt,
        });
      }
    }
  } catch (e) {
    console.warn('Subagent registry read failed:', e);
  }
  return result;
}

function parseParentAgentId(sessionKey: string): string | null {
  const match = sessionKey.match(/^agent:([^:]+):subagent:/);
  return match ? match[1] : null;
}

router.get('/agents/:id/subagents', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const agents = await query<Agent & { openclaw_agent_id: string | null }>(
      `SELECT id, openclaw_agent_id FROM agents WHERE id = $1`,
      [id]
    );
    if (agents.length === 0) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    const openclawId = agents[0].openclaw_agent_id;
    if (!openclawId) {
      res.json({ registry: [], tracked: [] });
      return;
    }

    const allRuns = loadSubagentsFromRegistry();
    const prefixLower = `agent:${openclawId.toLowerCase()}:subagent:`;
    const registry = allRuns
      .filter((r) => r.childSessionKey.toLowerCase().startsWith(prefixLower))
      .map((r) => ({
        runId: r.runId,
        sessionKey: r.childSessionKey,
        task: r.task,
        label: r.label,
        createdAt: r.createdAt,
        startedAt: r.startedAt,
        endedAt: r.endedAt,
      }));

    // Auto-sync: upsert registry items into agent_subagents so they're always available
    for (const r of registry) {
      try {
        await query(
          `INSERT INTO agent_subagents (agent_id, run_id, session_key, label)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (agent_id, run_id) DO UPDATE SET session_key = $3, label = COALESCE($4, agent_subagents.label)`,
          [id, r.runId, r.sessionKey, r.label ?? null]
        );
      } catch (e) {
        console.warn('Subagent auto-sync insert failed:', e);
      }
    }

    const tracked = await query<{ run_id: string; session_key: string; label: string | null }>(
      `SELECT run_id, session_key, label FROM agent_subagents WHERE agent_id = $1`,
      [id]
    );

    res.json({
      registry,
      tracked: tracked.map((t) => ({ runId: t.run_id, sessionKey: t.session_key, label: t.label })),
    });
  } catch (err) {
    console.error('Subagents list error:', err);
    res.status(500).json({ error: 'Failed to list subagents' });
  }
});

router.post('/agents/:id/subagents/pull', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { runId, sessionKey } = req.body;
  if (!runId || !sessionKey || typeof runId !== 'string' || typeof sessionKey !== 'string') {
    res.status(400).json({ error: 'runId and sessionKey are required' });
    return;
  }

  try {
    const agents = await query<Agent & { openclaw_agent_id: string | null }>(
      `SELECT id, openclaw_agent_id FROM agents WHERE id = $1`,
      [id]
    );
    if (agents.length === 0) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    const parentId = parseParentAgentId(sessionKey);
    if (parentId !== agents[0].openclaw_agent_id) {
      res.status(400).json({ error: 'Subagent does not belong to this agent' });
      return;
    }

    await query(
      `INSERT INTO agent_subagents (agent_id, run_id, session_key, label)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (agent_id, run_id) DO UPDATE SET session_key = $3, label = COALESCE($4, agent_subagents.label)`,
      [id, runId.trim(), sessionKey.trim(), req.body.label || null]
    );

    const inserted = await query<{ run_id: string; session_key: string; label: string | null }>(
      `SELECT run_id, session_key, label FROM agent_subagents WHERE agent_id = $1 AND run_id = $2`,
      [id, runId.trim()]
    );
    const row = inserted[0];
    res.json(row ? { runId: row.run_id, sessionKey: row.session_key, label: row.label } : {});
  } catch (err) {
    console.error('Subagent pull error:', err);
    res.status(500).json({ error: 'Failed to pull subagent' });
  }
});

router.post('/agents/pull-from-openclaw', async (req: Request, res: Response) => {
  const { id: openclawId, name } = req.body;
  if (!openclawId || typeof openclawId !== 'string' || !openclawId.trim()) {
    res.status(400).json({ error: 'OpenClaw agent id is required' });
    return;
  }

  const agentName = typeof name === 'string' && name.trim() ? name.trim() : openclawId.trim();

  try {
    const existing = await query<Agent & { openclaw_agent_id: string | null }>(
      `SELECT id, name, openclaw_agent_id FROM agents WHERE openclaw_agent_id = $1`,
      [openclawId.trim()]
    );

    if (existing.length > 0) {
      if (existing[0].name !== agentName) {
        await query(`UPDATE agents SET name = $1, updated_at = now() WHERE id = $2`, [agentName, existing[0].id]);
      }
      const updated = await query<Agent>(
        `SELECT id, name, description, last_heartbeat, health, status,
                ip_address, openclaw_version, openclaw_agent_id, created_at, updated_at
         FROM agents WHERE id = $1`,
        [existing[0].id]
      );
      res.json({ created: false, agent: updated[0] });
      return;
    }

    const token = uuidv4();
    const inserted = await query<{ id: string }>(
      `INSERT INTO agents (name, token, description, openclaw_agent_id, status)
       VALUES ($1, $2, $3, $4, 'offline')
       RETURNING id`,
      [agentName, token, `Synced from OpenClaw (${openclawId})`, openclawId.trim()]
    );
    await query(
      `INSERT INTO events (type, agent_id, data) VALUES ($1, $2, $3)`,
      ['agent.synced_from_openclaw', inserted[0].id, { openclawId: openclawId.trim(), name: agentName }]
    );

    const agents = await query<Agent>(
      `SELECT id, name, description, last_heartbeat, health, status,
              ip_address, openclaw_version, openclaw_agent_id, created_at, updated_at
       FROM agents WHERE id = $1`,
      [inserted[0].id]
    );

    res.json({ created: true, agent: agents[0] });
  } catch (err) {
    console.error('Pull from OpenClaw error:', err);
    res.status(500).json({
      error: 'Failed to pull agent from OpenClaw',
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

router.post('/agents/sync-from-openclaw', async (req: Request, res: Response) => {
  try {
    const list = loadOpenClawAgentsList();
    if (list.length === 0) {
      res.json({ synced: 0, created: 0, updated: 0, agents: [] });
      return;
    }

    let created = 0;
    let updated = 0;

    for (const { id: openclawId, name } of list) {
      const existing = await query<Agent & { openclaw_agent_id: string | null }>(
        `SELECT id, name FROM agents WHERE openclaw_agent_id = $1`,
        [openclawId]
      );

      if (existing.length > 0) {
        if (existing[0].name !== name) {
          await query(`UPDATE agents SET name = $1, updated_at = now() WHERE id = $2`, [name, existing[0].id]);
          updated++;
        }
      } else {
        const token = uuidv4();
        const inserted = await query<{ id: string }>(
          `INSERT INTO agents (name, token, description, openclaw_agent_id, status)
           VALUES ($1, $2, $3, $4, 'offline')
           RETURNING id`,
          [name, token, `Synced from OpenClaw (${openclawId})`, openclawId]
        );
        await query(
          `INSERT INTO events (type, agent_id, data) VALUES ($1, $2, $3)`,
          ['agent.synced_from_openclaw', inserted[0].id, { openclawId, name }]
        );
        created++;
      }
    }

    const agents = await query<Agent>(
      `SELECT id, name, description, last_heartbeat, health, status,
              ip_address, openclaw_version, openclaw_agent_id, created_at, updated_at
       FROM agents ORDER BY created_at DESC`
    );

    res.json({
      synced: list.length,
      created,
      updated,
      agents,
    });
  } catch (err) {
    console.error('Sync from OpenClaw error:', err);
    res.status(500).json({
      error: 'Failed to sync from OpenClaw',
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

router.delete('/agents/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const agents = await query<Agent>(
      `SELECT id, name FROM agents WHERE id = $1`,
      [id]
    );

    if (agents.length === 0) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    // Insert event before delete (agent_id will be set NULL by ON DELETE SET NULL)
    await query(
      `INSERT INTO events (type, agent_id, data)
       VALUES ($1, $2, $3)`,
      ['agent.deleted', id, { name: agents[0].name }]
    );

    await query(`DELETE FROM agents WHERE id = $1`, [id]);

    res.status(204).send();
  } catch (err) {
    console.error('Error deleting agent:', err);
    res.status(500).json({ error: 'Failed to delete agent' });
  }
});

export default router;
