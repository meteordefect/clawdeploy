import { useRef, useEffect } from 'react';
import { User, Bot, Wifi, WifiOff, AtSign } from 'lucide-react';
import { Badge } from '../Badge';
import { useOpenClawChat } from '../../hooks/useOpenClawChat';
import { ChatInput } from './ChatInput';

// Get OpenClaw gateway config from environment
// If not set, construct from current window location
const getGatewayWsUrl = () => {
  const envUrl = import.meta.env.VITE_GATEWAY_WS_URL;
  if (envUrl) return envUrl;

  // Auto-detect based on current protocol
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const port = window.location.port ? `:${window.location.port}` : '';
  return `${protocol}//${host}${port}`;
};

const GATEWAY_WS_URL = getGatewayWsUrl();
const GATEWAY_TOKEN = import.meta.env.VITE_GATEWAY_TOKEN || '';

export function ChatView() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { messages, isConnected, isConnecting, error, sendMessage } = useOpenClawChat(
    GATEWAY_WS_URL,
    GATEWAY_TOKEN
  );

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (message: string, _mentionedAgentIds?: string[]) => {
    if (!message.trim() || !isConnected) return;

    try {
      await sendMessage(message);
      // mentionedAgentIds can be used in future to route to specific agents
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Render message content with highlighted mentions
  const renderMessageContent = (content: string) => {
    // Split by @mentions and render them differently
    const parts = content.split(/(@\w+)/g);
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        return (
          <span key={index} className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md mx-0.5 font-medium">
            <AtSign size={12} />
            {part.slice(1)}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  // Extract mentioned agent names from a message
  const extractMentions = (content: string): string[] => {
    const mentions = content.match(/@(\w+)/g);
    return mentions ? mentions.map(m => m.slice(1)) : [];
  };

  return (
    <div className="animate-in fade-in duration-300 h-full flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-gray-900">Chat</h1>
          <p className="text-gray-600 mt-1">Talk to your agents directly • Use @ to mention specific agents</p>
        </div>
        <div className="flex items-center gap-2">
          {isConnecting ? (
            <>
              <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
              <span className="text-sm text-text-secondary">Connecting...</span>
            </>
          ) : isConnected ? (
            <>
              <Wifi size={16} className="text-green-500" />
              <span className="text-sm text-text-secondary">Connected</span>
            </>
          ) : (
            <>
              <WifiOff size={16} className="text-red-500" />
              <span className="text-sm text-red-600">Disconnected</span>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card border border-black/5 flex-1 flex flex-col min-h-0 max-h-[calc(100vh-250px)] overflow-hidden">
        {/* Connection notice when gateway is unavailable */}
        {!isConnected && !isConnecting && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 pt-0.5">
                <WifiOff size={20} className="text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-amber-800 mb-1">OpenClaw Gateway Not Available</h3>
                <p className="text-xs text-amber-700 leading-relaxed">
                  The chat feature requires an OpenClaw Gateway to be running on the server.
                  The gateway is not currently configured or running. This feature is currently unavailable.
                </p>
                <p className="text-xs text-amber-600 mt-2">
                  <strong>Available features:</strong> Overview, Agents, Missions, Files, Sessions, Events, Settings
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {error && (
            <div className="text-center text-red-600 text-sm p-4 bg-red-50 rounded-lg">
              {error}
            </div>
          )}

          {messages.length === 0 && !error && (
            <div className="text-center text-text-secondary p-8">
              <Bot size={48} className="mx-auto mb-4 opacity-20" />
              <p className="text-sm">
                {isConnected 
                  ? 'No messages yet. Start a conversation with OpenClaw!'
                  : 'Waiting for connection to OpenClaw gateway...'}
              </p>
              <p className="text-xs mt-2 text-text-tertiary">
                Connected to: {GATEWAY_WS_URL}
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
                {/* Avatar */}
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    msg.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-subtle border border-black/10'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <User size={16} />
                  ) : (
                    <Bot size={16} className="text-text-secondary" />
                  )}
                </div>

                {/* Message Bubble */}
                <div className={`flex-1 max-w-[70%] ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                  {/* OpenClaw badge (for assistant responses) */}
                  {msg.role === 'assistant' && (
                    <div className="mb-1">
                      <Badge
                        variant="outline"
                        className="text-xs px-2 py-0.5 bg-green-100 text-green-800 border-green-200"
                      >
                        OpenClaw
                      </Badge>
                    </div>
                  )}

                  {/* Message Content */}
                  <div
                    className={`inline-block rounded-lg px-4 py-2 ${
                      msg.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-subtle border border-black/5'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                      {msg.role === 'user' ? renderMessageContent(msg.content) : msg.content}
                    </p>
                  </div>

                  {/* Mentioned Agents */}
                  {mentions.length > 0 && (
                    <div className={`flex gap-1 mt-1.5 flex-wrap ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {mentions.map((agentName, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md"
                        >
                          <AtSign size={8} />
                          {agentName}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Timestamp */}
                  <div className="text-xs text-text-tertiary mt-1 px-1">
                    {formatTime(msg.timestamp)}
                  </div>
                </div>
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-black/5 p-4">
          <ChatInput
            onSend={handleSend}
            disabled={!isConnected}
            placeholder={isConnected ? "Type your message... Use @agent to mention" : "Waiting for connection..."}
          />
          <p className="text-xs text-text-tertiary mt-2 flex items-center gap-2">
            <AtSign size={12} className="opacity-70" />
            Type <span className="font-mono bg-black/5 px-1 rounded">@agentname</span> to mention specific agents
          </p>
        </div>
      </div>
    </div>
  );
}
