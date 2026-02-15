import { useState, useEffect, useCallback, useRef } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  sessionKey?: string;
}

interface ChatState {
  messages: Message[];
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
}

/**
 * Hook to connect to OpenClaw Gateway via WebSocket
 * Uses OpenClaw's native protocol for chat
 */
export function useOpenClawChat(gatewayUrl: string, gatewayToken: string) {
  const [state, setState] = useState<ChatState>({
    messages: [],
    isConnected: false,
    isConnecting: false,
    error: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const sessionKeyRef = useRef<string>(`dashboard-${Math.random().toString(36).substring(2, 15)}-${Date.now()}`);

  // OpenClaw gateway requires a specific client ID from GATEWAY_CLIENT_IDS
  // Valid IDs: webchat-ui, openclaw-control-ui, webchat, cli, gateway-client, openclaw-macos, openclaw-ios, openclaw-android, node-host, test, fingerprint, openclaw-probe
  const clientIdRef = useRef<string>('webchat-ui');

  const pendingRpcsRef = useRef<Map<string, { resolve: (r: any) => void; reject: (e: Error) => void }>>(new Map());
  const rpcIdCounter = useRef(0);

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

      // Timeout after 30 seconds
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
      // Add user message to UI immediately
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

      // Send via OpenClaw chat.send RPC
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

  // Connect to OpenClaw gateway
  useEffect(() => {
    setState(prev => ({ ...prev, isConnecting: true }));

    const ws = new WebSocket(gatewayUrl);
    wsRef.current = ws;

    let connectSent = false;

    ws.onopen = () => {
      console.log('[OpenClaw] WebSocket connected');

      // Send connect request after brief delay
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

          // Send connect with proper client ID format and auth credentials
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
                mode: 'webchat',  // Must match GATEWAY_CLIENT_MODES
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

        // Handle RPC responses
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

        // Handle chat events (agent responses)
        if (msg.type === 'event' && msg.event === 'chat') {
          const payload = msg.payload;
          
          // Only show final messages
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

        // Ignore other events (tick, challenge, etc.)
      } catch (err) {
        console.error('[OpenClaw] Failed to parse message:', err);
      }
    };

    ws.onerror = (event) => {
      console.error('[OpenClaw] WebSocket error:', event);

      // Determine if the error is due to gateway not running
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
        // Only show error if it wasn't a clean close
        ...(event.code !== 1000 && {
          error: `Connection closed (${event.code}${event.reason ? `: ${event.reason}` : ''}). ` +
            `The OpenClaw Gateway may not be running.`
        }),
      }));

      // Reject all pending RPCs
      pendingRpcsRef.current.forEach((pending) => {
        pending.reject(new Error('Connection closed'));
      });
      pendingRpcsRef.current.clear();
    };

    // Cleanup on unmount
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [gatewayUrl, gatewayToken]);

  return {
    ...state,
    sendMessage,
  };
}
