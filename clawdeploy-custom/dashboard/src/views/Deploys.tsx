import { useState } from 'react';
import { Card } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';
import { usePolling } from '../hooks/usePolling';
import { api } from '../api/client';

type Deploy = {
  id: string;
  status: string;
  stage: string | null;
  output: string | null;
  error: string | null;
  started_at: string;
  created_at: string;
  updated_at: string;
};

function deployStatusToBadge(status: string): string {
  switch (status) {
    case 'success':
      return 'online';
    case 'failed':
      return 'failed';
    case 'building':
    case 'starting':
      return 'pending';
    default:
      return 'offline';
  }
}

const STAGE_LABELS: Record<string, string> = {
  initializing: 'Initializing',
  building_images: 'Building images',
  restarting_containers: 'Restarting containers',
};

export function Deploys() {
  const [limit, setLimit] = useState(20);
  const { data, loading, error } = usePolling(
    () => api.deploy.list(limit),
    5000
  );

  const deploys = data?.deploys ?? [];

  if (loading && !deploys.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-tertiary">Loading deploy history...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-danger">Error loading deploys: {error.message}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-primary">Deploys</h1>
          <p className="text-secondary mt-1">Deploy history and build logs</p>
        </div>
        <div className="relative">
          <select
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value, 10))}
            className="select-base"
          >
            <option value="10">Last 10</option>
            <option value="20">Last 20</option>
            <option value="50">Last 50</option>
            <option value="100">Last 100</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-tertiary">
            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
              <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
            </svg>
          </div>
        </div>
      </div>

      <Card noPadding>
        {deploys.length > 0 ? (
          <div className="divide-y divide-border">
            {deploys.map((deploy: Deploy) => (
              <DeployRow key={deploy.id} deploy={deploy} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-4xl mb-4 grayscale opacity-50">🚀</div>
            <div className="text-primary font-medium mb-2">No deploys yet</div>
            <div className="text-sm text-secondary">
              Deploy history will appear here after your first deploy
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function DeployRow({ deploy }: { deploy: Deploy }) {
  const [expanded, setExpanded] = useState(false);
  const stageLabel = deploy.stage ? (STAGE_LABELS[deploy.stage] ?? deploy.stage) : null;
  const isInProgress = deploy.status === 'building' || deploy.status === 'starting';

  return (
    <div className="p-4 hover:bg-subtle/50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <StatusBadge
              status={deployStatusToBadge(deploy.status)}
              className="text-xs"
            />
            <span className="text-xs text-tertiary">
              {new Date(deploy.started_at || deploy.created_at).toLocaleString()}
            </span>
            {stageLabel && isInProgress && (
              <span className="text-xs text-secondary">• {stageLabel}</span>
            )}
            <span className="font-mono text-[10px] text-tertiary truncate" title={deploy.id}>
              {deploy.id.slice(0, 8)}…
            </span>
          </div>
          {deploy.error && (
            <p className="text-sm text-danger mt-1 truncate" title={deploy.error}>
              {deploy.error}
            </p>
          )}
          {(deploy.output || deploy.error) && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-2 text-xs font-medium text-accent hover:text-accent-dark transition-colors"
            >
              {expanded ? 'Hide logs' : 'Show logs'}
            </button>
          )}
        </div>
      </div>
      {expanded && (deploy.output || deploy.error) && (
        <div className="mt-3">
          <pre className="text-[10px] bg-surface p-4 rounded-lg overflow-x-auto text-secondary border border-border max-h-64 overflow-y-auto whitespace-pre-wrap break-words">
            {deploy.error ? `Error: ${deploy.error}\n\n` : ''}
            {deploy.output || 'No output captured.'}
          </pre>
        </div>
      )}
    </div>
  );
}
