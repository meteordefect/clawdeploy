import { createContext, useContext, ReactNode } from 'react';
import { useOpenClawChat } from '../hooks/useOpenClawChat';

// Prefer explicit env; else derive from same host (works with IP, domain, or any URL)
const getGatewayWsUrl = () => {
  const envUrl = import.meta.env.VITE_GATEWAY_WS_URL;
  if (envUrl) return envUrl;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/gateway/ws`;
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
