import { Card } from '../components/Card';

export function Settings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">System configuration and preferences</p>
      </div>

      <Card title="System Information">
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-600">Version</span>
            <span className="font-medium text-gray-900">ClawDeploy v3.0</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-600">Architecture</span>
            <span className="font-medium text-gray-900">Pull-based Control Plane</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-600">Database</span>
            <span className="font-medium text-gray-900">PostgreSQL 16</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-gray-600">API URL</span>
            <span className="font-mono text-xs text-gray-900">
              {import.meta.env.VITE_API_URL || '/api'}
            </span>
          </div>
        </div>
      </Card>

      <Card title="About">
        <div className="space-y-4 text-sm text-gray-600">
          <p>
            ClawDeploy is a self-hosted control plane for managing remote OpenClaw AI agent instances.
          </p>
          <p>
            Features pull-based heartbeat architecture, PostgreSQL-backed state management,
            and a password-protected dashboard.
          </p>
          <div className="pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              © 2026 Friend Labs • Built with React, TypeScript, and Tailwind CSS
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
