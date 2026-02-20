import { createContext, useContext, ReactNode } from 'react';
import { useOpenClawChat } from '../hooks/useOpenClawChat';

// Gateway config from environment (same as ChatView)
const getGatewayWsUrl = () => {
  const envUrl = import.meta.env.VITE_GATEWAY_WS_URL;
  if (envUrl) return envUrl;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const port = window.location.port ? `:${window.location.port}` : '';
  return `${protocol}//${host}${port}`;
};

const GATEWAY_WS_URL = getGatewayWsUrl();
const GATEWAY_TOKEN = import.meta.env.VITE_GATEWAY_TOKEN || '';

type ChatContextValue = ReturnType<typeof useOpenClawChat>;

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const chat = useOpenClawChat(GATEWAY_WS_URL, GATEWAY_TOKEN);
  return <ChatContext.Provider value={chat}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error('useChat must be used within ChatProvider');
  }
  return ctx;
}
