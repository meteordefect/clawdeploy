import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, AtSign } from 'lucide-react';
import { api } from '../../api/client';

interface ChatInputProps {
  onSend: (message: string, mentionedAgentIds?: string[]) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

interface Mentionable {
  id: string;
  token: string;
  displayName: string;
  kind: 'agent' | 'subagent';
}

interface Mention {
  id: string;
  name: string;
  displayName: string;
  start: number;
  end: number;
}

function mentionMatchesQuery(m: Mentionable, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    m.token.toLowerCase().includes(q) ||
    m.displayName.toLowerCase().includes(q) ||
    m.id.toLowerCase().includes(q)
  );
}

export function ChatInput({ onSend, disabled, placeholder = "mention for a specific agent" }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [mentionables, setMentionables] = useState<Mentionable[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<Mentionable[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load mentionables from OpenClaw (agents + subagents, no DB)
  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.agents.mentionables();
        const list: Mentionable[] = [
          ...data.agents.map((a) => ({
            id: a.id,
            token: a.token,
            displayName: a.name,
            kind: 'agent' as const,
          })),
          ...data.subagents.map((s) => ({
            id: s.sessionKey,
            token: s.sessionKey,
            displayName: s.label,
            kind: 'subagent' as const,
          })),
        ];
        setMentionables(list);
      } catch (err) {
        console.error('Failed to load mentionables:', err);
      }
    };
    load();
  }, []);

  // Parse mentions from input - match @token (word chars, colons, dots, hyphens for session keys)
  const parseMentions = useCallback((text: string): { text: string; mentions: Mention[] } => {
    const mentions: Mention[] = [];
    const mentionRegex = /@([\w:.-]+)/g;
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      const [fullMatch, token] = match;
      const m = mentionables.find(
        (a) =>
          a.token === token ||
          a.token.toLowerCase() === token.toLowerCase() ||
          a.displayName.toLowerCase() === token.toLowerCase()
      );
      if (m) {
        mentions.push({
          id: m.id,
          name: m.token,
          displayName: m.displayName,
          start: match.index,
          end: match.index + fullMatch.length,
        });
      }
    }
    return { text, mentions };
  }, [mentionables]);

  // Handle mention typing - match by name or id
  const handleMentionTrigger = useCallback((text: string, cursorPos: number) => {
    const textBeforeCursor = text.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@([\w:.-]*)$/);

    if (mentionMatch) {
      const query = mentionMatch[1];
      setMentionQuery(query);
      setMentionStart(cursorPos - mentionMatch[0].length);

      const filtered = mentionables.filter((m) => mentionMatchesQuery(m, query));
      setSuggestions(filtered);
      setSelectedIndex(0);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
      setSuggestions([]);
    }
  }, [mentionables]);

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setInput(newValue);
    adjustTextareaHeight();

    const cursorPos = e.target.selectionStart;
    handleMentionTrigger(newValue, cursorPos);
  };

  // Auto-resize textarea
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % suggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSelectSuggestion(suggestions[selectedIndex]);
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      await handleSend();
    }
  };

  // Select a suggestion
  const handleSelectSuggestion = (m: Mentionable) => {
    const beforeMention = input.slice(0, mentionStart);
    const afterMention = input.slice(mentionStart + mentionQuery.length + 1);
    const newValue = `${beforeMention}@${m.token} ${afterMention}`;

    setInput(newValue);
    setShowSuggestions(false);
    setSuggestions([]);

    setTimeout(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        const newCursorPos = mentionStart + m.token.length + 2;
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  // Handle send
  const handleSend = async () => {
    if (!input.trim() || disabled) return;

    const { mentions } = parseMentions(input);
    const mentionedIds = mentions.map(m => m.id);

    setInput('');
    adjustTextareaHeight();

    await onSend(input.trim(), mentionedIds.length > 0 ? mentionedIds : undefined);
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <div className="flex gap-2 min-w-0 items-start">
        <div className="flex-1 min-w-0 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={isMobile ? "type @agent to mention" : placeholder}
            disabled={disabled}
            rows={1}
            className="w-full px-4 py-3 pr-12 bg-subtle border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-none disabled:opacity-50 disabled:cursor-not-allowed text-sm leading-relaxed text-primary placeholder:text-tertiary shadow-sm overflow-hidden"
            style={{ minHeight: '44px', maxHeight: '150px' }}
          />
          {input.length > 0 && (
            <button
              onClick={() => {
                setInput('');
                adjustTextareaHeight();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiary hover:text-secondary transition-colors"
              aria-label="Clear input"
            >
              <AtSign size={14} />
            </button>
          )}
        </div>
        <button
          onClick={handleSend}
          disabled={!input.trim() || disabled}
          className="flex-shrink-0 bg-accent text-white rounded-xl hover:bg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center shadow-sm"
          style={{ width: '44px', height: '44px' }}
        >
          <Send size={isMobile ? 16 : 18} />
        </button>
      </div>

      {/* Mention suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute left-0 right-0 bottom-full mb-2 bg-card border border-border rounded-xl shadow-lg z-50 max-h-64 overflow-y-auto"
        >
          <div className="p-2">
            <div className="text-xs text-tertiary uppercase tracking-wide px-2 py-1">
              {mentionQuery ? 'Matching' : 'Agents & Subagents'}
            </div>
            {suggestions.map((m, index) => (
              <button
                key={m.id}
                onClick={() => handleSelectSuggestion(m)}
                className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left transition-colors ${
                  index === selectedIndex
                    ? 'bg-accent/15 text-accent-light'
                    : 'hover:bg-subtle'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-subtle flex items-center justify-center text-lg shadow-sm border border-border">
                  {m.kind === 'subagent' ? '🔗' : '🤖'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-primary truncate">{m.displayName}</div>
                  <div className="text-xs text-tertiary font-mono truncate">{m.token}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {showSuggestions && suggestions.length === 0 && mentionQuery && (
        <div className="absolute left-0 right-0 bottom-full mb-2 bg-card border border-border rounded-xl shadow-lg z-50 p-3 text-sm text-tertiary">
          No matching agents found
        </div>
      )}
    </div>
  );
}
