import { useState, useEffect, useCallback } from 'react';
import {
  GitBranch, ExternalLink, Clock, AlertCircle,
  CheckCircle, XCircle, Loader, ChevronDown, ChevronUp,
  Bot, MessageSquare, ArrowRight, Copy, Check,
} from 'lucide-react';
import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { api } from './api';
import type { Task, TaskStatus, TaskActivity } from './types';

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pending',
  queued: 'Queued',
  coding: 'Coding',
  pr_open: 'PR Open',
  ready_to_merge: 'Ready to Merge',
  needs_human: 'Needs Input',
  completed: 'Completed',
  failed: 'Failed',
  rejected: 'Rejected',
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatTs(ts: string) {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return ts;
  }
}

function CollapsibleText({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
      >
        {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        {label}
      </button>
      {open && (
        <div className="relative mt-1">
          <button
            onClick={handleCopy}
            className="absolute top-1 right-1 p-1 rounded bg-white/5 hover:bg-white/10 text-tertiary"
          >
            {copied ? <Check size={10} /> : <Copy size={10} />}
          </button>
          <pre className="text-xs text-slate-300 font-mono bg-[#0d1117] rounded-lg p-3 pr-8 max-h-80 overflow-auto whitespace-pre-wrap leading-relaxed">
            {text}
          </pre>
        </div>
      )}
    </div>
  );
}

function AgentLogViewer({ taskId, run }: { taskId: string; run: number }) {
  const [log, setLog] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchLog = useCallback(async () => {
    if (log !== null) return;
    setLoading(true);
    try {
      const data = await api.tasks.agentLog(taskId, run);
      setLog(data.log);
    } catch {
      setLog('(failed to load log)');
    } finally {
      setLoading(false);
    }
  }, [taskId, run, log]);

  const handleToggle = () => {
    if (!open && log === null) fetchLog();
    setOpen(!open);
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (log) {
      await navigator.clipboard.writeText(log);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="mt-1">
      <button
        onClick={handleToggle}
        className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
      >
        {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        View agent output
      </button>
      {open && (
        <div className="relative mt-1">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-tertiary p-3">
              <Loader size={12} className="animate-spin" /> Loading...
            </div>
          ) : (
            <>
              <button
                onClick={handleCopy}
                className="absolute top-1 right-1 p-1 rounded bg-white/5 hover:bg-white/10 text-tertiary"
              >
                {copied ? <Check size={10} /> : <Copy size={10} />}
              </button>
              <pre className="text-xs text-slate-300 font-mono bg-[#0d1117] rounded-lg p-3 pr-8 max-h-80 overflow-auto whitespace-pre-wrap leading-relaxed">
                {log || '(empty)'}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ActivityTimeline({ taskId }: { taskId: string }) {
  const [events, setEvents] = useState<TaskActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.tasks.activity(taskId)
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [taskId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-tertiary py-2">
        <Loader size={12} className="animate-spin" /> Loading timeline...
      </div>
    );
  }

  if (events.length === 0) {
    return <div className="text-xs text-tertiary py-2">No sub-agent activity yet.</div>;
  }

  return (
    <div className="space-y-0">
      <p className="text-xs font-medium text-secondary mb-2">Activity Timeline</p>
      <div className="relative pl-4 border-l border-border space-y-3">
        {events.map((ev, i) => (
          <div key={i} className="relative">
            <div className="absolute -left-[21px] top-0.5 w-3 h-3 rounded-full border-2 border-card bg-border flex items-center justify-center">
              {ev.type === 'agent_spawned' && <Bot size={6} className="text-blue-400" />}
              {ev.type === 'agent_completed' && (
                ev.exit_code === 0
                  ? <CheckCircle size={6} className="text-green-400" />
                  : <XCircle size={6} className="text-red-400" />
              )}
              {ev.type === 'phoung_note' && <MessageSquare size={6} className="text-amber-400" />}
              {ev.type === 'status_change' && <ArrowRight size={6} className="text-slate-400" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-tertiary">{formatTs(ev.ts)}</span>
                {ev.type === 'agent_spawned' && (
                  <span className="text-blue-400 font-medium">
                    Sub-agent #{ev.run} spawned{ev.agent_type ? ` (${ev.agent_type})` : ''}
                  </span>
                )}
                {ev.type === 'agent_completed' && (
                  <span className={ev.exit_code === 0 ? 'text-green-400 font-medium' : 'text-red-400 font-medium'}>
                    Agent #{ev.run} {ev.exit_code === 0 ? 'completed' : `failed (exit ${ev.exit_code})`}
                  </span>
                )}
                {ev.type === 'phoung_note' && (
                  <span className="text-amber-400 font-medium">Phoung</span>
                )}
                {ev.type === 'status_change' && (
                  <span className="text-slate-400">
                    Status: {ev.from} <ArrowRight size={10} className="inline" /> {ev.to}
                  </span>
                )}
              </div>
              {ev.type === 'phoung_note' && ev.message && (
                <p className="text-xs text-secondary mt-0.5">{ev.message}</p>
              )}
              {ev.type === 'agent_spawned' && ev.prompt && (
                <CollapsibleText label="View prompt" text={ev.prompt} />
              )}
              {ev.type === 'agent_completed' && ev.run != null && (
                <AgentLogViewer taskId={taskId} run={ev.run} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface TaskDetailViewProps {
  task: Task;
  onRefresh: () => void;
}

export function TaskDetailView({ task, onRefresh }: TaskDetailViewProps) {
  const [merging, setMerging] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const status = task.meta.status as TaskStatus;

  const statusIcon = {
    pending: <Clock size={18} className="text-waiting" />,
    queued: <Clock size={18} className="text-waiting" />,
    coding: <Loader size={18} className="text-working animate-spin" />,
    pr_open: <ExternalLink size={18} className="text-review" />,
    ready_to_merge: <CheckCircle size={18} className="text-done" />,
    needs_human: <AlertCircle size={18} className="text-warning" />,
    completed: <CheckCircle size={18} className="text-done" />,
    failed: <XCircle size={18} className="text-danger" />,
    rejected: <XCircle size={18} className="text-danger" />,
  }[status];

  const handleMerge = async () => {
    setMerging(true);
    try {
      await api.tasks.merge(task.meta.id);
      onRefresh();
    } catch (err: any) {
      alert(`Merge failed: ${err.message}`);
    } finally {
      setMerging(false);
    }
  };

  const handleReject = async () => {
    setRejecting(true);
    try {
      await api.tasks.reject(task.meta.id);
      onRefresh();
    } catch (err: any) {
      alert(`Reject failed: ${err.message}`);
    } finally {
      setRejecting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border flex-shrink-0 bg-card">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex-shrink-0">{statusIcon}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-serif font-bold text-primary">{task.meta.id}</h1>
              <Badge variant={status}>{STATUS_LABELS[status]}</Badge>
              {task.meta.project && (
                <span className="text-xs text-tertiary">{task.meta.project}</span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              {task.meta.branch && (
                <span className="flex items-center gap-1 text-xs text-secondary">
                  <GitBranch size={10} />
                  <code className="font-mono text-[11px] bg-subtle px-1 py-0.5 rounded">{task.meta.branch}</code>
                </span>
              )}
              {task.meta.pr && (
                <span className="flex items-center gap-1 text-xs text-secondary">
                  <ExternalLink size={10} />
                  PR #{task.meta.pr}
                </span>
              )}
              {task.meta.created && (
                <span className="flex items-center gap-1 text-xs text-tertiary">
                  <Clock size={10} />
                  {timeAgo(task.meta.created)}
                </span>
              )}
            </div>
          </div>
        </div>

        {(status === 'ready_to_merge' || status === 'pr_open') && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              size="sm"
              onClick={handleMerge}
              disabled={merging || !task.meta.pr}
              className="bg-done hover:bg-done/90 text-white"
            >
              {merging ? 'Merging...' : 'Merge PR'}
            </Button>
            <Button size="sm" variant="destructive" onClick={handleReject} disabled={rejecting}>
              {rejecting ? 'Rejecting...' : 'Reject'}
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {task.meta.question && status === 'needs_human' && (
          <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
            <p className="text-sm font-medium text-warning mb-1">Phoung needs your input</p>
            <p className="text-sm text-primary">{task.meta.question}</p>
          </div>
        )}

        <div className="bg-subtle rounded-lg p-4">
          <p className="text-xs font-medium text-secondary mb-2">Task Details</p>
          <pre className="text-sm text-primary whitespace-pre-wrap font-mono leading-relaxed max-h-80 overflow-y-auto">
            {task.body}
          </pre>
        </div>

        <ActivityTimeline taskId={task.meta.id} />
      </div>
    </div>
  );
}
