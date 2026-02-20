import { useState, useEffect, useCallback, useRef } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  sessionKey?: string;
}

export interface ChatSession {
  key: string;
  preview: string;
  timestamp: number;
  messageCount: number;
}

interface ChatState {
  messages: Message[];
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
}

// --- localStorage persistence ---

const SESSIONS_INDEX_KEY = 'openclaw-chat-sessions';
const CURRENT_SESSION_KEY = 'openclaw-chat-active-session';
const msgStorageKey = (key: string) => `openclaw-chat-msg-${key}`;

export function loadSessionsIndex(): ChatSession[] {
  try { return JSON.parse(localStorage.getItem(SESSIONS_INDEX_KEY) || '[]'); }
  catch { return []; }
}

function saveSessionsIndex(sessions: ChatSession[]) {
  try { localStorage.setItem(SESSIONS_INDEX_KEY, JSON.stringify(sessions)); }
  catch { /* storage full */ }
}

function loadMessagesFromStorage(sessionKey: string): Message[] {
  try { return JSON.parse(localStorage.getItem(msgStorageKey(sessionKey)) || '[]'); }
  catch { return []; }
}

function saveMessagesToStorage(sessionKey: string, messages: Message[]) {
  try { localStorage.setItem(msgStorageKey(sessionKey), JSON.stringify(messages)); }
  catch { /* storage full */ }
}

/** Fixed session key for webchat - all devices/tabs share this (maps to OpenClaw agent main) */
const MAIN_SESSION_KEY = 'main';

function getMainSessionKey(): string {
  return MAIN_SESSION_KEY;
}

function isLegacyRandomKey(key: string): boolean {
  return key.startsWith('dashboard-') && /dashboard-[a-z0-9]+-\d+/.test(key);
}

function getOrCreateCurrentSessionKey(): string {
  const stored = localStorage.getItem(CURRENT_SESSION_KEY);
  // Migrate from legacy random keys to shared main - prevents fragmented history
  if (!stored || isLegacyRandomKey(stored)) {
    const key = getMainSessionKey();
    localStorage.setItem(CURRENT_SESSION_KEY, key);
    return key;
  }
  return stored;
}

function updateSessionsIndex(sessionKey: string, messages: Message[]): ChatSession[] {
  const sessions = loadSessionsIndex();
  const lastMsg = messages[messages.length - 1];
  const firstUserMsg = messages.find(m => m.role === 'user');
  const preview = firstUserMsg
    ? firstUserMsg.content.substring(0, 80)
    : (lastMsg?.content.substring(0, 80) || '');

  const idx = sessions.findIndex(s => s.key === sessionKey);
  const entry: ChatSession = {
    key: sessionKey,
    preview,
    timestamp: lastMsg?.timestamp || Date.now(),
    messageCount: messages.length,
  };

  if (idx >= 0) sessions[idx] = entry;
  else sessions.unshift(entry);

  sessions.sort((a, b) => b.timestamp - a.timestamp);
  const trimmed = sessions.slice(0, 50);
  saveSessionsIndex(trimmed);
  return trimmed;
}

// --- Hook ---

/**
 * Hook to connect to OpenClaw Gateway via WebSocket
 * Uses OpenClaw's native protocol for chat with localStorage persistence
 */
export function useOpenClawChat(gatewayUrl: string, gatewayToken: string) {
  const initialSessionKey = getOrCreateCurrentSessionKey();

  const [activeSessionKey, setActiveSessionKey] = useState<string>(initialSessionKey);
  const [savedSessions, setSavedSessions] = useState<ChatSession[]>(loadSessionsIndex);
  const [state, setState] = useState<ChatState>(() => ({
    messages: loadMessagesFromStorage(initialSessionKey),
    isConnected: false,
    isConnecting: false,
    error: null,
  }));

  const wsRef = useRef<WebSocket | null>(null);
  const sessionKeyRef = useRef<string>(initialSessionKey);

  // OpenClaw gateway requires a specific client ID from GATEWAY_CLIENT_IDS
  const clientIdRef = useRef<string>('webchat-ui');

  const pendingRpcsRef = useRef<Map<string, { resolve: (r: any) => void; reject: (e: Error) => void }>>(new Map());
  const rpcIdCounter = useRef(0);

  // Keep ref in sync with state
  useEffect(() => {
    sessionKeyRef.current = activeSessionKey;
  }, [activeSessionKey]);

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    const key = sessionKeyRef.current;
    saveMessagesToStorage(key, state.messages);
    if (state.messages.length > 0) {
      const updated = updateSessionsIndex(key, state.messages);
      setSavedSessions(updated);
    }
  }, [state.messages]);

  // Send RPC request to gateway
  const sendRpc = useCallback((method: string, params: any = {}): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected to gateway'));
        return;
      }

      const id = `rpc-${++rpcIdCounter.current}`;
      const frame = {
        type: 'req',
        id,
        method,
        params,
      };

      pendingRpcsRef.current.set(id, { resolve, reject });
      wsRef.current.send(JSON.stringify(frame));

      setTimeout(() => {
        if (pendingRpcsRef.current.has(id)) {
          pendingRpcsRef.current.delete(id);
          reject(new Error('RPC timeout'));
        }
      }, 30000);
    });
  }, []);

  // Send message to OpenClaw
  const sendMessage = useCallback(async (content: string) => {
    try {
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
        timestamp: Date.now(),
      };

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, userMessage],
      }));

      await sendRpc('chat.send', {
        sessionKey: sessionKeyRef.current,
        message: content,
        idempotencyKey: userMessage.id,
        timeoutMs: 0,
      });
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to send message',
      }));
    }
  }, [sendRpc]);

  // Start a new chat session (resets main - shared across devices)
  const startNewSession = useCallback(async () => {
    const key = getMainSessionKey();
    localStorage.setItem(CURRENT_SESSION_KEY, key);
    sessionKeyRef.current = key;
    setActiveSessionKey(key);
    setState(prev => ({ ...prev, messages: [] }));

    // Send /new to OpenClaw to reset session context on backend
    try {
      await sendRpc('chat.send', {
        sessionKey: key,
        message: '/new',
        idempotencyKey: `new-${Date.now()}`,
        timeoutMs: 0,
      });
    } catch (err) {
      console.error('[OpenClaw] Failed to reset session:', err);
    }
  }, [sendRpc]);

  // Load an existing session's messages
  const loadSession = useCallback((key: string) => {
    const messages = loadMessagesFromStorage(key);
    localStorage.setItem(CURRENT_SESSION_KEY, key);
    sessionKeyRef.current = key;
    setActiveSessionKey(key);
    setState(prev => ({ ...prev, messages }));
  }, []);

  // Delete a session from history
  const deleteSession = useCallback((key: string) => {
    localStorage.removeItem(msgStorageKey(key));
    const sessions = loadSessionsIndex().filter(s => s.key !== key);
    saveSessionsIndex(sessions);
    setSavedSessions(sessions);
    if (key === sessionKeyRef.current) {
      const mainKey = getMainSessionKey();
      localStorage.setItem(CURRENT_SESSION_KEY, mainKey);
      sessionKeyRef.current = mainKey;
      setActiveSessionKey(mainKey);
      setState(prev => ({ ...prev, messages: loadMessagesFromStorage(mainKey) }));
    }
  }, []);

  // Connect to OpenClaw gateway
  useEffect(() => {
    setState(prev => ({ ...prev, isConnecting: true }));

    const ws = new WebSocket(gatewayUrl);
    wsRef.current = ws;

    let connectSent = false;

    ws.onopen = () => {
      console.log('[OpenClaw] WebSocket connected');

      setTimeout(() => {
        if (!connectSent && ws.readyState === WebSocket.OPEN) {
          connectSent = true;
          const connectId = `connect-${Date.now()}`;

          pendingRpcsRef.current.set(connectId, {
            resolve: (result) => {
              if (result.ok) {
                console.log('[OpenClaw] Connected successfully');
                setState(prev => ({
                  ...prev,
                  isConnected: true,
                  isConnecting: false,
                  error: null,
                }));
              } else {
                console.error('[OpenClaw] Connect failed:', result.error);
                setState(prev => ({
                  ...prev,
                  error: `Connection failed: ${result.error}`,
                  isConnecting: false,
                }));
              }
            },
            reject: (err) => {
              console.error('[OpenClaw] Connect error:', err);
              setState(prev => ({
                ...prev,
                error: err.message,
                isConnecting: false,
              }));
            },
          });

          ws.send(JSON.stringify({
            type: 'req',
            id: connectId,
            method: 'connect',
            params: {
              minProtocol: 3,
              maxProtocol: 3,
              client: {
                id: clientIdRef.current,
                displayName: 'ClawDeploy Dashboard',
                version: '1.0.0',
                platform: 'web',
                mode: 'webchat',
                instanceId: sessionKeyRef.current,
              },
              caps: [],
              auth: {
                token: gatewayToken,
                password: gatewayToken,
              },
            },
          }));
        }
      }, 100);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'res' && msg.id && pendingRpcsRef.current.has(msg.id)) {
          const pending = pendingRpcsRef.current.get(msg.id)!;
          pendingRpcsRef.current.delete(msg.id);

          if (msg.ok) {
            pending.resolve({ ok: true, result: msg.payload });
          } else {
            const errorMsg = msg.error?.message || 'Unknown error';
            pending.resolve({ ok: false, error: errorMsg });
          }
          return;
        }

        if (msg.type === 'event' && msg.event === 'chat') {
          const payload = msg.payload;

          if (payload.state === 'final' && payload.message) {
            const assistantMessage: Message = {
              id: `assistant-${Date.now()}-${payload.seq}`,
              role: 'assistant',
              content: payload.message.content
                .filter((c: any) => c.type === 'text' && c.text)
                .map((c: any) => c.text)
                .join(''),
              timestamp: payload.message.timestamp || Date.now(),
              sessionKey: payload.sessionKey,
            };

            setState(prev => ({
              ...prev,
              messages: [...prev.messages, assistantMessage],
            }));
          }
        }
      } catch (err) {
        console.error('[OpenClaw] Failed to parse message:', err);
      }
    };

    ws.onerror = (event) => {
      console.error('[OpenClaw] WebSocket error:', event);

      const errorMessage = `Unable to connect to OpenClaw Gateway at ${gatewayUrl}. ` +
        `Make sure the gateway is running on port 18789 and accessible.`;

      setState(prev => ({
        ...prev,
        error: errorMessage,
        isConnecting: false,
      }));
    };

    ws.onclose = (event) => {
      console.log('[OpenClaw] WebSocket closed:', event.code, event.reason);
      setState(prev => ({
        ...prev,
        isConnected: false,
        isConnecting: false,
        ...(event.code !== 1000 && {
          error: `Connection closed (${event.code}${event.reason ? `: ${event.reason}` : ''}). ` +
            `The OpenClaw Gateway may not be running.`
        }),
      }));

      pendingRpcsRef.current.forEach((pending) => {
        pending.reject(new Error('Connection closed'));
      });
      pendingRpcsRef.current.clear();
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [gatewayUrl, gatewayToken]);

  return {
    ...state,
    activeSessionKey,
    savedSessions,
    sendMessage,
    startNewSession,
    loadSession,
    deleteSession,
  };
}
