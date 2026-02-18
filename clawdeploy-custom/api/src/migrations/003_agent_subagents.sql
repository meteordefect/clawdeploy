-- Track subagents pulled from OpenClaw for pinging/messaging
CREATE TABLE IF NOT EXISTS agent_subagents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    run_id          TEXT NOT NULL,
    session_key     TEXT NOT NULL,
    label           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(agent_id, run_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_subagents_agent_id ON agent_subagents(agent_id);
