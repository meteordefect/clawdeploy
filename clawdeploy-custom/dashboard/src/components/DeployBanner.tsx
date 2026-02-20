import { useState } from 'react';
import { Loader2, CheckCircle, XCircle, ScrollText } from 'lucide-react';
import { useDeploy } from '../contexts/DeployContext';
import { DeployLogsOverlay } from './DeployLogsOverlay';

const STAGE_LABELS: Record<string, string> = {
  building_images: 'Building images',
  restarting_containers: 'Restarting containers',
};

export function DeployBanner() {
  const { deploying, stage, lastResult } = useDeploy();
  const [logsOpen, setLogsOpen] = useState(false);

  const viewLogsBtn = (
    <button
      onClick={() => setLogsOpen(true)}
      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-current/30 hover:bg-black/10 transition-colors"
    >
      <ScrollText size={14} />
      View logs
    </button>
  );

  // In progress: blue banner
  if (deploying) {
    const stageLabel = stage ? STAGE_LABELS[stage] ?? stage : 'Deploying';
    return (
      <>
        <div
          className="sticky top-0 z-50 flex items-center justify-between gap-4 px-4 py-3 bg-accent/15 border-b border-accent/30 text-accent-light"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-3">
            <Loader2 size={20} className="flex-shrink-0 animate-spin" />
            <span className="font-medium">Deploy in progress…</span>
            <span className="text-accent-light/80 text-sm">Stage: {stageLabel}</span>
          </div>
          <div className="flex items-center gap-3">
            {viewLogsBtn}
            <span className="text-sm text-accent-light/70">Chat unavailable</span>
          </div>
        </div>
        <DeployLogsOverlay open={logsOpen} onClose={() => setLogsOpen(false)} deploying={true} />
      </>
    );
  }

  // Success: green banner (auto-dismiss via API TTL)
  if (lastResult?.success) {
    return (
      <>
        <div
          className="sticky top-0 z-50 flex items-center justify-between gap-4 px-4 py-3 bg-success/15 border-b border-success/30 text-success"
          role="status"
        >
          <div className="flex items-center gap-2">
            <CheckCircle size={20} className="flex-shrink-0" />
            <span className="font-medium">Deploy completed successfully!</span>
          </div>
          {viewLogsBtn}
        </div>
        <DeployLogsOverlay open={logsOpen} onClose={() => setLogsOpen(false)} deploying={false} />
      </>
    );
  }

  // Failure: red banner
  if (lastResult && !lastResult.success) {
    return (
      <>
        <div
          className="sticky top-0 z-50 flex items-center justify-between gap-4 px-4 py-3 bg-danger/15 border-b border-danger/30 text-danger"
          role="alert"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <XCircle size={20} className="flex-shrink-0" />
            <span className="font-medium truncate">
              Deploy failed{lastResult.error ? `: ${lastResult.error}` : ''}
            </span>
          </div>
          {viewLogsBtn}
        </div>
        <DeployLogsOverlay open={logsOpen} onClose={() => setLogsOpen(false)} deploying={false} />
      </>
    );
  }

  return null;
}
