import { useState } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { useDeploy } from '../contexts/DeployContext';
import { api } from '../api/client';

export function Settings() {
  const { setLocalDeploying } = useDeploy();
  const [deployLoading, setDeployLoading] = useState(false);
  const [deployResult, setDeployResult] = useState<string | null>(null);
  const [rollbackLoading, setRollbackLoading] = useState(false);
  const [rollbackResult, setRollbackResult] = useState<string | null>(null);

  const handleDeploy = async (soft = false) => {
    const msg = soft
      ? 'Quick deploy (uses cache, faster)?'
      : 'Full rebuild and redeploy? This may take a few minutes.';
    if (!confirm(msg)) return;
    setDeployLoading(true);
    setDeployResult(null);
    setLocalDeploying(true);
    try {
      const data = await api.deploy.deploy(soft);
      if (data.status === 'started') {
        setDeployResult(null);
        setLocalDeploying(true);
      } else if (data.error) {
        setDeployResult('Deploy failed: ' + data.error);
        setLocalDeploying(false);
      } else {
        setDeployResult('Deploy failed: ' + (data.message || 'Unknown error'));
        setLocalDeploying(false);
      }
    } catch (err) {
      setDeployResult('Request failed: ' + (err instanceof Error ? err.message : String(err)));
      setLocalDeploying(false);
    } finally {
      setDeployLoading(false);
    }
  };

  const handleRollback = async () => {
    if (!confirm('Roll back to the previous version? Use this if the UI is broken.')) return;
    setRollbackLoading(true);
    setRollbackResult(null);
    setLocalDeploying(true);
    try {
      const data = await api.deploy.rollback();
      if (data.error) {
        setRollbackResult('Rollback failed: ' + (data.error || data.message || ''));
      } else {
        setRollbackResult('Rollback complete. ' + (data.output?.slice?.(0, 200) || ''));
      }
    } catch (err) {
      setRollbackResult('Request failed: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setRollbackLoading(false);
      setLocalDeploying(false);
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
              Full deploy: rebuild dashboard + API from scratch. Quick deploy: rebuild dashboard only (Vite build, refresh page to see changes).
              Both show the deploy banner. Rollback if something breaks.
            </p>
            <div className="flex gap-3">
              <Button variant="primary" onClick={() => handleDeploy(false)} disabled={deployLoading}>
                {deployLoading ? 'Deploying...' : 'Full deploy'}
              </Button>
              <Button variant="secondary" onClick={() => handleDeploy(true)} disabled={deployLoading}>
                Quick deploy
              </Button>
              <Button variant="secondary" onClick={handleRollback} disabled={rollbackLoading}>
                {rollbackLoading ? 'Rolling back...' : 'Rollback'}
              </Button>
            </div>
            {deployResult && (
              <p className={`text-xs ${deployResult.startsWith('Deploy failed') || deployResult.startsWith('Request failed') ? 'text-danger' : 'text-success'}`}>
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
