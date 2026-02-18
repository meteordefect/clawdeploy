import { useState } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export function Settings() {
  const [deployLoading, setDeployLoading] = useState(false);
  const [deployResult, setDeployResult] = useState<string | null>(null);
  const [rollbackLoading, setRollbackLoading] = useState(false);
  const [rollbackResult, setRollbackResult] = useState<string | null>(null);

  const handleDeploy = async () => {
    if (!confirm('Rebuild and redeploy this custom dashboard? This may take a few minutes.')) return;
    setDeployLoading(true);
    setDeployResult(null);
    try {
      const res = await fetch(`${API_URL}/deploy`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setDeployResult('Deploy complete. ' + (data.output?.slice?.(0, 200) || ''));
      } else {
        setDeployResult('Deploy failed: ' + (data.error || res.statusText));
      }
    } catch (err) {
      setDeployResult('Request failed: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setDeployLoading(false);
    }
  };

  const handleRollback = async () => {
    if (!confirm('Roll back to the previous version? Use this if the UI is broken.')) return;
    setRollbackLoading(true);
    setRollbackResult(null);
    try {
      const res = await fetch(`${API_URL}/deploy/rollback`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setRollbackResult('Rollback complete. ' + (data.output?.slice?.(0, 200) || ''));
      } else {
        setRollbackResult('Rollback failed: ' + (data.error || res.statusText));
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

        <Card title="Deploy">
          <div className="space-y-4 text-sm">
            <p className="text-secondary">
              Rebuild and redeploy after editing code. Rollback if something breaks.
            </p>
            <div className="flex gap-3">
              <Button variant="primary" onClick={handleDeploy} disabled={deployLoading}>
                {deployLoading ? 'Deploying...' : 'Deploy'}
              </Button>
              <Button variant="secondary" onClick={handleRollback} disabled={rollbackLoading}>
                {rollbackLoading ? 'Rolling back...' : 'Rollback'}
              </Button>
            </div>
            {deployResult && (
              <p className={`text-xs ${deployResult.startsWith('Deploy complete') ? 'text-success' : 'text-danger'}`}>
                {deployResult}
              </p>
            )}
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
