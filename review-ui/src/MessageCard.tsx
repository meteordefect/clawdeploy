import { useState } from 'react';
import {
  Bot, Rocket, RefreshCw, AlertCircle,
  ArrowRight, Brain, ChevronDown, ChevronUp,
} from 'lucide-react';

interface ParsedAction {
  type: string;
  taskId?: string;
  project?: string;
  status?: string;
  from?: string;
  to?: string;
  content?: string;
}

function parseActions(text: string): { segments: (string | ParsedAction)[] } {
  const segments: (string | ParsedAction)[] = [];
  const actionRegex = /<action\s+type="([^"]+)"([^>]*)>([\s\S]*?)<\/action>/g;
  let lastIndex = 0;
  let match;

  while ((match = actionRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push(text.slice(lastIndex, match.index).trim());
    }

    const attrs = match[2];
    const action: ParsedAction = {
      type: match[1],
      content: match[3].trim(),
    };

    const taskMatch = attrs.match(/task_id="([^"]+)"/);
    if (taskMatch) action.taskId = taskMatch[1];
    const projMatch = attrs.match(/project="([^"]+)"/);
    if (projMatch) action.project = projMatch[1];
    const statusMatch = attrs.match(/status="([^"]+)"/);
    if (statusMatch) action.status = statusMatch[1];
    const fromMatch = attrs.match(/from="([^"]+)"/);
    if (fromMatch) action.from = fromMatch[1];
    const toMatch = attrs.match(/to="([^"]+)"/);
    if (toMatch) action.to = toMatch[1];

    segments.push(action);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex).trim();
    if (remaining) segments.push(remaining);
  }

  if (segments.length === 0) segments.push(text);
  return { segments };
}

const ACTION_CONFIG: Record<string, { icon: typeof Rocket; label: string; color: string }> = {
  spawn_subagent: { icon: Rocket, label: 'Spawning sub-agent', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  update_task: { icon: RefreshCw, label: 'Task updated', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
  check_status: { icon: RefreshCw, label: 'Checking status', color: 'text-slate-400 bg-slate-400/10 border-slate-400/20' },
  ask_human: { icon: AlertCircle, label: 'Needs your input', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' },
  update_memory: { icon: Brain, label: 'Memory updated', color: 'text-purple-400 bg-purple-400/10 border-purple-400/20' },
  create_memory: { icon: Brain, label: 'Memory created', color: 'text-purple-400 bg-purple-400/10 border-purple-400/20' },
  status_change: { icon: ArrowRight, label: 'Status changed', color: 'text-slate-400 bg-slate-400/10 border-slate-400/20' },
};

function ActionCard({ action }: { action: ParsedAction }) {
  const [expanded, setExpanded] = useState(false);
  const config = ACTION_CONFIG[action.type] || {
    icon: RefreshCw,
    label: action.type,
    color: 'text-slate-400 bg-slate-400/10 border-slate-400/20',
  };
  const Icon = config.icon;
  const colorClasses = config.color.split(' ');

  return (
    <div className={`rounded-md border px-2.5 py-1.5 my-1.5 ${colorClasses[1]} ${colorClasses[2]}`}>
      <button
        onClick={() => action.content && setExpanded(!expanded)}
        className={`flex items-center gap-2 w-full text-left ${action.content ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <Icon size={12} className={`flex-shrink-0 ${colorClasses[0]}`} />
        <span className={`text-xs font-medium ${colorClasses[0]}`}>
          {config.label}
        </span>
        {action.taskId && (
          <span className="text-[10px] text-tertiary font-mono">{action.taskId}</span>
        )}
        {action.project && (
          <span className="text-[10px] text-tertiary">{action.project}</span>
        )}
        {action.from && action.to && (
          <span className="text-[10px] text-tertiary">
            {action.from} → {action.to}
          </span>
        )}
        {action.content && (
          <span className="ml-auto flex-shrink-0">
            {expanded ? <ChevronUp size={10} className="text-tertiary" /> : <ChevronDown size={10} className="text-tertiary" />}
          </span>
        )}
      </button>
      {expanded && action.content && (
        <pre className="text-[11px] text-secondary mt-1.5 whitespace-pre-wrap font-mono leading-relaxed max-h-40 overflow-y-auto">
          {action.content}
        </pre>
      )}
    </div>
  );
}

interface MessageCardProps {
  content: string;
  role: 'user' | 'assistant';
  timestamp: number;
}

export function MessageCard({ content, role, timestamp }: MessageCardProps) {
  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (role === 'user') {
    return (
      <div className="flex gap-3 flex-row-reverse">
        <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-accent text-white">
          <span className="text-xs font-medium">M</span>
        </div>
        <div className="flex-1 max-w-[75%] text-right">
          <div className="inline-block rounded-lg px-3.5 py-2 bg-accent text-white">
            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{content}</p>
          </div>
          <div className="text-[10px] text-tertiary mt-1 px-1">{formatTime(timestamp)}</div>
        </div>
      </div>
    );
  }

  const { segments } = parseActions(content);
  const hasActions = segments.some(s => typeof s !== 'string');

  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-subtle border border-border">
        <Bot size={14} className="text-secondary" />
      </div>
      <div className="flex-1 max-w-[85%]">
        {hasActions ? (
          <div>
            {segments.map((seg, i) =>
              typeof seg === 'string' ? (
                seg && (
                  <div key={i} className="inline-block rounded-lg px-3.5 py-2 bg-subtle border border-border mb-1">
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{seg}</p>
                  </div>
                )
              ) : (
                <ActionCard key={i} action={seg} />
              )
            )}
          </div>
        ) : (
          <div className="inline-block rounded-lg px-3.5 py-2 bg-subtle border border-border">
            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{content}</p>
          </div>
        )}
        <div className="text-[10px] text-tertiary mt-1 px-1">{formatTime(timestamp)}</div>
      </div>
    </div>
  );
}
