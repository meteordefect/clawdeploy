import { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Wifi, WifiOff } from 'lucide-react';
import { Card } from '../Card';
import { Badge } from '../Badge';
import { Button } from '../Button';
import { useOpenClawChat } from '../../hooks/useOpenClawChat';

// Get OpenClaw gateway config from environment
const GATEWAY_WS_URL = import.meta.env.VITE_GATEWAY_WS_URL || 'ws://localhost:18789';
const GATEWAY_TOKEN = import.meta.env.VITE_GATEWAY_TOKEN || '';

export function ChatView() {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { messages, isConnected, isConnecting, error, sendMessage } = useOpenClawChat(
    GATEWAY_WS_URL,
    GATEWAY_TOKEN
  );

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !isConnected) return;

    const messageText = input.trim();
    setInput('');

    try {
      await sendMessage(messageText);
    } catch (err) {
      console.error('Failed to send message:', err);
      // Restore input on error
      setInput(messageText);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="animate-in fade-in duration-300 h-full flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif tracking-tight mb-1">Chat</h2>
          <p className="text-sm text-text-secondary">
            Direct connection to OpenClaw Gateway
          </p>
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

      <Card className="flex-1 flex flex-col min-h-0 max-h-[calc(100vh-250px)]">
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

          {messages.map((msg) => (
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
                      status="default"
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
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                </div>

                {/* Timestamp */}
                <div className="text-xs text-text-tertiary mt-1 px-1">
                  {formatTime(msg.timestamp)}
                </div>
              </div>
            </div>
          ))}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-black/5 p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isConnected ? "Type your message to OpenClaw..." : "Waiting for connection..."}
              disabled={!isConnected}
              className="flex-1 px-4 py-2 border border-black/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || !isConnected}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <Send size={16} />
              <span className="hidden sm:inline">Send</span>
            </Button>
          </div>
          <p className="text-xs text-text-tertiary mt-2">
            Connected directly to OpenClaw's AI agent system
          </p>
        </div>
      </Card>
    </div>
  );
}
