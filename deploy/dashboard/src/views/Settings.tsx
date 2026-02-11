import { Card } from '../components/Card';

export function Settings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-primary">Settings</h1>
        <p className="text-secondary mt-1">System configuration and preferences</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="System Information" noPadding>
          <div className="divide-y divide-gray-100">
            <div className="flex justify-between p-4 hover:bg-subtle/30 transition-colors">
              <span className="text-secondary font-medium">Version</span>
              <span className="font-mono text-sm text-primary bg-subtle px-2 py-0.5 rounded border border-gray-200">v3.0</span>
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
              <span className="font-mono text-xs text-primary bg-subtle px-2 py-0.5 rounded border border-gray-200">
                {import.meta.env.VITE_API_URL || '/api'}
              </span>
            </div>
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
            <div className="pt-6 mt-4 border-t border-gray-100">
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
