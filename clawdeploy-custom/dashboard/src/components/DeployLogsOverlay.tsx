import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../api/client';

interface DeployLogsOverlayProps {
  open: boolean;
  onClose: () => void;
  deploying: boolean;
}

export function DeployLogsOverlay({ open, onClose, deploying }: DeployLogsOverlayProps) {
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [logs, setLogs] = useState('');

  // Poll logs when overlay is open
  useEffect(() => {
    if (!open) return;

    const fetchLogs = async () => {
      const { logs: l } = await api.deploy.logs();
      setLogs(l);
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 500);
    return () => clearInterval(interval);
  }, [open]);

  // Auto-scroll to bottom when logs update
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[85vh] flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-subtle/50">
          <h2 className="text-lg font-semibold text-primary">Deploy logs</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-secondary hover:text-primary hover:bg-subtle transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4 font-mono text-sm">
          <pre className="whitespace-pre-wrap break-words text-secondary min-h-0">
            {logs || (deploying ? 'Waiting for output…' : 'No logs available.')}
          </pre>
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}
