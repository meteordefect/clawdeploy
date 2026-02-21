import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { User, Bot, Wifi, WifiOff, AtSign, Plus, History, Trash2, Clock, MessageSquare } from 'lucide-react';
import { Badge } from '../Badge';
import { useOpenClawChat } from '../../hooks/useOpenClawChat';
import type { ChatSession } from '../../hooks/useOpenClawChat';
import { useFakeChat, FAKE_AGENTS } from '../../hooks/useFakeChat';
import { ChatInput } from './ChatInput';
import { usePolling } from '../../hooks/usePolling';
import { useDeploy } from '../../contexts/DeployContext';
import { api } from '../../api/client';

const getGatewayWsUrl = () => {
  const envUrl = import.meta.env.VITE_GATEWAY_WS_URL;
  if (envUrl) return envUrl;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/gateway/ws`;
};

const GATEWAY_WS_URL = getGatewayWsUrl();
const GATEWAY_TOKEN = import.meta.env.VITE_GATEWAY_TOKEN || '';

function useFakeMode(): boolean {
  const [searchParams] = useSearchParams();
  return (
    import.meta.env.VITE_FAKE_CHAT === 'true' ||
    searchParams.get('fake') === '1'
  );
}

export function ChatView() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  const fake = useFakeMode();
  const realChat = useOpenClawChat(GATEWAY_WS_URL, GATEWAY_TOKEN);
  const fakeChat = useFakeChat();
  const chat = fake ? fakeChat : realChat;

  const {
    messages, streamingContent, isConnected, isConnecting, isWaitingForReply, error, sendMessage,
    activeSessionKey, savedSessions, startNewSession, loadSession, deleteSession,
  } = chat;

  const { data: openclawAgents, loading: agentsLoading, error: agentsError } = usePolling(
    () => fake ? Promise.resolve(FAKE_AGENTS) : api.agents.openclawList(),
    10000,
  );

  const { deploying } = useDeploy();

  // Find the portal target after mount
  useEffect(() => {
    setPortalTarget(document.getElementById('mobile-chat-slot'));
  }, []);

  useEffect(() => {
    const sessionParam = searchParams.get('session');
    if (sessionParam) {
      loadSession(sessionParam);
      setSearchParams({}, { replace: true });
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [messages, streamingContent]);

  const handleSend = async (message: string, _mentionedAgentIds?: string[]) => {
    if (!message.trim() || (!isConnected && !fake)) return;
    try {
      await sendMessage(message);
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const formatTime = (timestamp: number): string =>
    new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const formatSessionTime = (timestamp: number): string => {
    const diffDays = Math.floor((Date.now() - timestamp) / 86_400_000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const renderMessageContent = (content: string) => {
    const parts = content.split(/(@[\w:.-]+)/g);
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        return (
          <span key={index} className="inline-flex items-center gap-1 bg-accent/20 text-accent-light px-1.5 py-0.5 rounded-md mx-0.5 font-medium">
            <AtSign size={12} />
            {part.slice(1)}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const extractMentions = (content: string): string[] => {
    const mentions = content.match(/@([\w:.-]+)/g);
    return mentions ? mentions.map((m) => m.slice(1)) : [];
  };

  const handleSelectSession = (session: ChatSession) => {
    loadSession(session.key);
    setShowHistory(false);
  };

  const handleNewChat = () => {
    startNewSession();
    setShowHistory(false);
  };

  const handleDeleteSession = (e: React.MouseEvent, key: string) => {
    e.stopPropagation();
    deleteSession(key);
  };

  // Connection indicator (shared between mobile and desktop)
  const connectionIcon = isConnecting ? (
    <div className="w-2 h-2 rounded-full bg-warning animate-pulse" />
  ) : isConnected ? (
    <Wifi size={14} className="text-success" />
  ) : (
    <WifiOff size={14} className="text-danger" />
  );

  // Controls rendered into the mobile header via portal
  const mobileControls = portalTarget && createPortal(
    <>
      {fake && (
        <span className="text-[10px] font-mono bg-warning/20 text-warning px-1.5 py-0.5 rounded">FAKE</span>
      )}
      <button
        onClick={handleNewChat}
        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-secondary hover:text-primary bg-subtle border border-border rounded-lg transition-colors"
      >
        <Plus size={12} />
        New
      </button>
      <button
        onClick={() => setShowHistory(!showHistory)}
        className={`flex items-center gap-1 px-2 py-1 text-xs font-medium border rounded-lg transition-colors ${
          showHistory
            ? 'text-accent-light bg-accent/15 border-accent/30'
            : 'text-secondary hover:text-primary bg-subtle border-border'
        }`}
      >
        <History size={12} />
        {savedSessions.length > 0 && (
          <span className="text-[10px] bg-accent/20 text-accent-light px-1 py-0.5 rounded-full leading-none">
            {savedSessions.length}
          </span>
        )}
      </button>
      {openclawAgents && openclawAgents.agents.length > 0 && openclawAgents.agents.map((a) => (
        <span
          key={a.id}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium bg-subtle text-primary border border-border rounded"
        >
          <Bot size={10} className="text-tertiary" />
          {a.name}
        </span>
      ))}
      <div className="ml-auto">{connectionIcon}</div>
    </>,
    portalTarget,
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full overflow-hidden animate-in fade-in duration-300">
      {/* Mobile controls via portal */}
      {mobileControls}

      {/* Desktop header — fixed at top, never scrolls */}
      <div className="hidden md:block flex-shrink-0 bg-surface border-b border-border/50 px-4 pt-3 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif font-bold text-primary">Chat</h1>
            <p className="text-secondary mt-1">Talk to your agents directly &bull; Use @ to mention specific agents</p>
          </div>
          <div className="flex items-center gap-3">
            {fake && (
              <span className="text-xs font-mono bg-warning/20 text-warning px-2 py-0.5 rounded">FAKE</span>
            )}
            <button
              onClick={handleNewChat}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-secondary hover:text-primary bg-subtle hover:bg-subtle/80 border border-border rounded-lg transition-colors"
            >
              <Plus size={14} />
              New Chat
            </button>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border rounded-lg transition-colors ${
                showHistory
                  ? 'text-accent-light bg-accent/15 border-accent/30'
                  : 'text-secondary hover:text-primary bg-subtle hover:bg-subtle/80 border-border'
              }`}
            >
              <History size={14} />
              History
              {savedSessions.length > 0 && (
                <span className="text-xs bg-accent/20 text-accent-light px-1.5 py-0.5 rounded-full">
                  {savedSessions.length}
                </span>
              )}
            </button>
            <div className="flex items-center gap-2 pl-3 border-l border-border">
              {isConnecting ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-warning animate-pulse" />
                  <span className="text-sm text-secondary">Connecting...</span>
                </>
              ) : isConnected ? (
                <>
                  <Wifi size={16} className="text-success" />
                  <span className="text-sm text-secondary">Connected</span>
                </>
              ) : (
                <>
                  <WifiOff size={16} className="text-danger" />
                  <span className="text-sm text-danger">Disconnected</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Desktop agents bar */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-secondary uppercase tracking-wide">Agents</span>
          {agentsLoading && !openclawAgents && (
            <span className="text-xs text-tertiary">Loading…</span>
          )}
          {agentsError && (
            <span className="text-xs text-tertiary" title={agentsError.message}>Could not load agents</span>
          )}
          {openclawAgents && openclawAgents.agents.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {openclawAgents.agents.map((a) => (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-subtle text-primary border border-border rounded-lg"
                >
                  <Bot size={12} className="text-tertiary" />
                  {a.name}
                </span>
              ))}
            </div>
          )}
          {openclawAgents && openclawAgents.agents.length === 0 && !agentsLoading && (
            <span className="text-xs text-tertiary">No agents configured</span>
          )}
        </div>
      </div>

      {/* Body: sidebar + chat column */}
      <div className="flex-1 flex flex-row min-h-0 min-w-0 overflow-hidden md:m-4 md:bg-card md:rounded-2xl md:shadow-card md:border md:border-border">
        {/* History sidebar — desktop only */}
        {showHistory && (
          <div className="hidden md:flex w-72 border-r border-border flex-col bg-subtle/30 flex-shrink-0">
            <div className="p-3 border-b border-border">
              <h3 className="text-sm font-semibold text-primary">Chat History</h3>
              <p className="text-xs text-tertiary mt-0.5">
                {savedSessions.length} conversation{savedSessions.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {savedSessions.length === 0 ? (
                <div className="text-center text-tertiary text-xs p-6">
                  <MessageSquare size={24} className="mx-auto mb-2 opacity-30" />
                  No saved conversations
                </div>
              ) : (
                savedSessions.map((session) => (
                  <button
                    key={session.key}
                    onClick={() => handleSelectSession(session)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg transition-all group ${
                      session.key === activeSessionKey
                        ? 'bg-accent/15 border border-accent/30'
                        : 'hover:bg-subtle border border-transparent'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm truncate flex-1 ${
                        session.key === activeSessionKey ? 'text-accent-light font-medium' : 'text-primary'
                      }`}>
                        {session.preview || 'New conversation'}
                      </p>
                      <button
                        onClick={(e) => handleDeleteSession(e, session.key)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-danger/20 text-tertiary hover:text-danger transition-all flex-shrink-0"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock size={10} className="text-tertiary" />
                      <span className="text-xs text-tertiary">{formatSessionTime(session.timestamp)}</span>
                      <span className="text-xs text-tertiary">• {session.messageCount} msg{session.messageCount !== 1 ? 's' : ''}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Chat column */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {/* Connection warning */}
          {!isConnected && !isConnecting && !fake && (
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 m-4 mb-0 flex-shrink-0">
              <div className="flex items-start gap-3">
                <WifiOff size={20} className="text-warning flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-warning mb-1">OpenClaw Gateway Not Available</h3>
                  <p className="text-xs text-secondary leading-relaxed">
                    The chat feature requires an OpenClaw Gateway running on the server.
                  </p>
                  <p className="text-xs text-tertiary mt-1">
                    Tip: add <span className="font-mono">?fake=1</span> to the URL to preview the UI offline.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Messages — the only scrollable area */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 space-y-4 min-w-0">
            {error && (
              <div className="text-center text-danger text-sm p-4 bg-danger/10 rounded-lg">
                {error}
              </div>
            )}

            {messages.length === 0 && !error && (
              <div className="text-center text-secondary p-8">
                <Bot size={48} className="mx-auto mb-4 opacity-20" />
                <p className="text-sm">
                  {isConnected || fake
                    ? 'No messages yet. Start a conversation!'
                    : 'Waiting for connection to OpenClaw gateway...'}
                </p>
              </div>
            )}

            {messages.map((msg) => {
              const mentions = msg.role === 'user' ? extractMentions(msg.content) : [];
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      msg.role === 'user' ? 'bg-accent text-white' : 'bg-subtle border border-border'
                    }`}
                  >
                    {msg.role === 'user' ? <User size={16} /> : <Bot size={16} className="text-secondary" />}
                  </div>

                  <div className={`flex-1 max-w-[85%] md:max-w-[70%] ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                    {msg.role === 'assistant' && (
                      <div className="mb-1">
                        <Badge variant="outline" className="text-xs px-2 py-0.5 bg-success/15 text-success border-success/30">
                          OpenClaw
                        </Badge>
                      </div>
                    )}

                    <div className={`inline-block rounded-lg px-3 py-2 md:px-4 ${
                      msg.role === 'user' ? 'bg-accent text-white' : 'bg-subtle border border-border'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                        {msg.role === 'user' ? renderMessageContent(msg.content) : msg.content}
                      </p>
                    </div>

                    {mentions.length > 0 && (
                      <div className={`flex gap-1 mt-1.5 flex-wrap ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {mentions.map((agentName, i) => (
                          <span key={i} className="inline-flex items-center gap-1 text-xs bg-accent/20 text-accent-light px-1.5 py-0.5 rounded-md">
                            <AtSign size={8} />
                            {agentName}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="text-xs text-tertiary mt-1 px-1">
                      {formatTime(msg.timestamp)}
                    </div>
                  </div>
                </div>
              );
            })}

            {isWaitingForReply && messages.length > 0 && (
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-subtle border border-border">
                  <Bot size={16} className="text-secondary" />
                </div>
                <div className="flex-1 max-w-[85%] md:max-w-[70%] text-left">
                  <div className="mb-1">
                    <Badge variant="outline" className="text-xs px-2 py-0.5 bg-success/15 text-success border-success/30">
                      OpenClaw
                    </Badge>
                  </div>
                  <div className="inline-block rounded-lg px-3 py-2 md:px-4 bg-subtle border border-border">
                    {streamingContent ? (
                      <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                        {streamingContent}
                        <span className="inline-block w-2 h-4 ml-0.5 bg-primary animate-pulse align-middle" />
                      </p>
                    ) : (
                      <p className="text-sm text-tertiary flex items-center gap-2">
                        <span className="inline-flex gap-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" style={{ animationDelay: '300ms' }} />
                        </span>
                        Thinking…
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input — pinned to bottom */}
          <div className="flex-shrink-0 border-t border-border p-3 pb-20 md:p-4 md:pb-4 min-w-0 bg-surface md:bg-transparent">
            <ChatInput
              onSend={handleSend}
              disabled={(!isConnected && !fake) || deploying}
              placeholder={
                deploying
                  ? 'Deploy in progress…'
                  : (isConnected || fake)
                    ? (window.innerWidth < 768 ? '@agent to mention' : 'Type your message… Use @agent to mention')
                    : 'Waiting for connection…'
              }
            />
            <p className="hidden md:flex text-xs text-tertiary mt-2 items-center gap-2">
              <AtSign size={12} className="opacity-70" />
              Type <span className="font-mono bg-subtle px-1 rounded">@agentname</span> to mention specific agents
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
