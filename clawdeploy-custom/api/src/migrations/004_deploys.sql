-- Deploy tracking for custom dashboard
CREATE TABLE IF NOT EXISTS deploys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status          TEXT NOT NULL,  -- building, starting, success, failed
    stage           TEXT,           -- building_images, restarting_containers
    output          TEXT,
    error           TEXT,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deploys_created_at ON deploys(created_at DESC);
