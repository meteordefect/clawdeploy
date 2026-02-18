import { useState } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';

const CUSTOM_API_URL = '/dashboard/custom/api';

export function Settings() {
  const [rollbackLoading, setRollbackLoading] = useState(false);
  const [rollbackResult, setRollbackResult] = useState<string | null>(null);

  const handleRollbackCustom = async () => {
    if (!confirm('Roll back the custom dashboard to the previous version? Use this if OpenClaw broke the UI.')) return;
    setRollbackLoading(true);
    setRollbackResult(null);
    try {
      const res = await fetch(`${CUSTOM_API_URL}/deploy/rollback`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setRollbackResult('Rollback complete. ' + (data.output?.slice?.(0, 200) || ''));
      } else {
        setRollbackResult('Rollback failed: ' + (data.error || data.message || res.statusText));
      }
    } catch (err) {
      setRollbackResult('Request failed: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setRollbackLoading(false);
    }
  };
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-primary">Settings</h1>
        <p className="text-secondary mt-1">System configuration and preferences</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="System Information" noPadding>
          <div className="divide-y divide-border">
            <div className="flex justify-between p-4 hover:bg-subtle/30 transition-colors">
              <span className="text-secondary font-medium">Version</span>
              <span className="font-mono text-sm text-primary bg-subtle px-2 py-0.5 rounded border border-border">v3.0</span>
            </div>
            <div className="flex justify-between p-4 hover:bg-subtle/30 transition-colors">
              <span className="text-secondary font-medium">Architecture</span>
              <span className="text-primary text-sm">Pull-based Control Plane</span>
            </div>
            <div className="flex justify-between p-4 hover:bg-subtle/30 transition-colors">
              <span className="text-secondary font-medium">Database</span>
              <span className="text-primary text-sm">PostgreSQL 16</span>
            </div>
            <div className="flex justify-between p-4 hover:bg-subtle/30 transition-colors">
              <span className="text-secondary font-medium">API URL</span>
              <span className="font-mono text-xs text-primary bg-subtle px-2 py-0.5 rounded border border-border">
                {import.meta.env.VITE_API_URL || '/api'}
              </span>
            </div>
          </div>
        </Card>

        <Card title="Custom Dashboard">
          <div className="space-y-4 text-sm">
            <p className="text-secondary">
              If OpenClaw edits the custom dashboard and breaks it, roll back to the last working version.
            </p>
            <Button
              variant="secondary"
              onClick={handleRollbackCustom}
              disabled={rollbackLoading}
            >
              {rollbackLoading ? 'Rolling back...' : 'Rollback Custom Dashboard'}
            </Button>
            {rollbackResult && (
              <p className={`text-xs ${rollbackResult.startsWith('Rollback complete') ? 'text-success' : 'text-danger'}`}>
                {rollbackResult}
              </p>
            )}
          </div>
        </Card>

        <Card title="About">
          <div className="space-y-4 text-sm text-secondary">
            <p className="leading-relaxed">
              ClawDeploy is a self-hosted control plane for managing remote OpenClaw AI agent instances.
            </p>
            <p className="leading-relaxed">
              Features pull-based heartbeat architecture, PostgreSQL-backed state management,
              and a password-protected dashboard.
            </p>
            <div className="pt-6 mt-4 border-t border-border">
              <p className="text-xs text-tertiary font-medium">
                © 2026 Friend Labs • Built with React, TypeScript, and Tailwind CSS
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
