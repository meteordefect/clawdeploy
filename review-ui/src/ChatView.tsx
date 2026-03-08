import { useState, useRef, useEffect } from 'react';
import { Send, Bot, ChevronDown } from 'lucide-react';
import { api } from './api';
import { MessageCard } from './MessageCard';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ModelOption { id: string; label: string; default?: boolean; }

interface ChatViewProps {
  initialConversationId: string | null;
  onConversationCreated: (convId: string) => void;
}

export function ChatView({ initialConversationId, onConversationCreated }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [activeModel, setActiveModel] = useState<string>('');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    api.chat.models().then(m => {
      setModels(m);
      if (m.length > 0 && !activeModel) {
        const def = m.find(x => x.default) ?? m[0];
        setActiveModel(def.id);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (initialConversationId) {
      loadConversation(initialConversationId);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const parseConversationMessages = (raw: string): Message[] => {
    const bodyMatch = raw.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
    const body = bodyMatch ? bodyMatch[1] : raw;
    const parsed: Message[] = [];
    const regex = /\*\*(Marten|Pi)\s*\((\d{2}:\d{2})\):\*\*\s*([\s\S]*?)(?=\*\*(?:Marten|Pi)\s*\(\d{2}:\d{2}\):\*\*|$)/g;
    let match;
    while ((match = regex.exec(body)) !== null) {
      const [, speaker, , content] = match;
      const trimmed = content.trim();
      if (!trimmed) continue;
      parsed.push({
        id: `hist-${parsed.length}`,
        role: speaker === 'Marten' ? 'user' : 'assistant',
        content: trimmed,
        timestamp: Date.now() - ((1000 - parsed.length) * 60000),
      });
    }
    return parsed;
  };

  const loadConversation = async (convId: string) => {
    try {
      const data = await api.conversations.get(convId);
      setConversationId(convId);
      setMessages(parseConversationMessages(data.content));
    } catch { /* ignore */ }
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    const text = input.trim();
    setInput('');
    setSending(true);

    try {
      const resp = await api.chat.send(text, conversationId || undefined, activeModel || undefined);
      if (resp.conversation_id && resp.conversation_id !== conversationId) {
        setConversationId(resp.conversation_id);
        onConversationCreated(resp.conversation_id);
      }
      setMessages(prev => [...prev, {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: resp.response,
        timestamp: Date.now(),
      }]);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${err.message || 'Failed to get response'}`,
        timestamp: Date.now(),
      }]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Bot size={40} className="text-tertiary opacity-20 mb-3" />
            <p className="text-sm text-secondary">Start a conversation with Phoung</p>
            <p className="text-xs text-tertiary mt-1.5">Ask about projects, assign tasks, or check status</p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageCard
            key={msg.id}
            content={msg.content}
            role={msg.role}
            timestamp={msg.timestamp}
          />
        ))}

        {sending && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full flex items-center justify-center bg-subtle border border-border">
              <Bot size={14} className="text-secondary" />
            </div>
            <div className="inline-block rounded-lg px-3.5 py-2 bg-subtle border border-border">
              <div className="flex items-center gap-1.5 py-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-bounce [animation-delay:0ms]" />
                <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-bounce [animation-delay:150ms]" />
                <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-border p-3 flex-shrink-0 bg-card">
        <div className="flex gap-2 items-end">
          {models.length > 0 && (
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setShowModelPicker(p => !p)}
                className="flex items-center gap-1.5 px-2.5 py-2.5 text-[11px] font-medium text-tertiary hover:text-secondary bg-subtle border border-border rounded-lg transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block flex-shrink-0" />
                {models.find(m => m.id === activeModel)?.label || 'Model'}
                <ChevronDown size={10} />
              </button>
              {showModelPicker && (
                <div className="absolute left-0 bottom-full mb-1 w-44 bg-card border border-border rounded-xl shadow-card z-50 overflow-hidden">
                  {models.map(m => (
                    <button
                      key={m.id}
                      onClick={() => { setActiveModel(m.id); setShowModelPicker(false); }}
                      className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${
                        m.id === activeModel
                          ? 'bg-accent/15 text-accent-light'
                          : 'text-secondary hover:bg-subtle hover:text-primary'
                      }`}
                    >
                      {m.label}
                      {m.id === activeModel && <span className="float-right text-accent-light">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Phoung..."
            disabled={sending}
            rows={1}
            className="flex-1 px-3.5 py-2.5 bg-subtle border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-none disabled:opacity-50 text-sm leading-relaxed text-primary placeholder:text-tertiary"
            style={{ minHeight: '40px', maxHeight: '120px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="px-3.5 py-2.5 bg-accent text-white rounded-lg hover:bg-accent-dark disabled:opacity-50 transition-colors flex items-center shadow-sm flex-shrink-0"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
