-- Add openclaw_agent_id to link ClawDeploy agents with OpenClaw agents.list
ALTER TABLE agents ADD COLUMN IF NOT EXISTS openclaw_agent_id TEXT;
CREATE INDEX IF NOT EXISTS idx_agents_openclaw_agent_id ON agents(openclaw_agent_id) WHERE openclaw_agent_id IS NOT NULL;
