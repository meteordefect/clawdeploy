import { useState, useCallback } from 'react';
import type { ChatSession } from './useOpenClawChat';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  sessionKey?: string;
}

const FAKE_AGENTS = {
  agents: [
    { id: 'main', name: 'main', synced: true, dbAgentId: null as string | null },
    { id: 'ops', name: 'ops', synced: true, dbAgentId: null as string | null },
  ],
};

const now = Date.now();

const SEED_MESSAGES: Message[] = [
  { id: 'u1', role: 'user', content: 'Hey @main, I just pushed a new commit to the deploy branch. Can you walk me through what will happen when I run the deploy script?', timestamp: now - 1_800_000 },
  { id: 'a1', role: 'assistant', content: 'Sure! Here\'s the deploy pipeline step by step:\n\n1. **Ansible connects** to your VPS over SSH\n2. **Source sync** — your local `clawdeploy-custom/` directory is rsync\'d to `/opt/clawdeploy-custom/` on the server\n3. **Docker build** — runs `docker compose build --no-cache` which rebuilds both the API and Dashboard images\n4. **Container restart** — old containers are stopped and new ones are brought up with `docker compose up -d`\n5. **Health check** — waits for the API to respond on `/health` before marking the deploy as successful\n\nThe whole process usually takes about 2-3 minutes. Want me to watch for any issues?', timestamp: now - 1_795_000 },
  { id: 'u2', role: 'user', content: 'Yeah that would be great. Also, what agents are currently registered?', timestamp: now - 1_500_000 },
  { id: 'a2', role: 'assistant', content: 'You currently have 2 agents registered:\n\n| Agent | Status | Last Seen |\n|-------|--------|-----------|\n| **main** | Active | 2s ago |\n| **ops** | Active | 5s ago |\n\nBoth are healthy and responding to heartbeats. The `main` agent handles general tasks and the `ops` agent is configured for infrastructure operations like deploys, disk checks, and service monitoring.', timestamp: now - 1_495_000 },
  { id: 'u3', role: 'user', content: 'Perfect. @ops can you show me the current resource usage on the VPS?', timestamp: now - 1_200_000 },
  { id: 'a3', role: 'assistant', content: 'Here\'s the current resource snapshot:\n\n**CPU:** 12% avg (4 cores)\n**Memory:** 1.8 GB / 4 GB (45%)\n**Disk:**\n```\nFilesystem   Size  Used  Avail  Use%  Mounted\n/dev/sda1     40G   18G    21G   47%  /\n```\n**Docker containers:** 6 running\n```\nNAME                        CPU %   MEM\nclawdeploy-custom-api       0.3%    142 MiB\nclawdeploy-custom-dashboard 0.1%     18 MiB\nnginx-proxy                 0.0%     12 MiB\npostgres                    0.5%    256 MiB\nopenclaw-gateway             1.2%    198 MiB\nredis                       0.1%     8 MiB\n```\n\nEverything looks healthy. You have plenty of headroom on all resources.', timestamp: now - 1_195_000 },
  { id: 'u4', role: 'user', content: 'Nice. I noticed the gateway memory is a bit higher than usual. Is that normal?', timestamp: now - 900_000 },
  { id: 'a4', role: 'assistant', content: 'The gateway is at 198 MiB which is within normal range — it typically sits between 140-220 MiB depending on active connections and cached session data. Here\'s the trend over the last 24h:\n\n- **Min:** 138 MiB (overnight, low traffic)\n- **Max:** 215 MiB (during bulk message processing)\n- **Current:** 198 MiB\n\nIf it consistently goes above 250 MiB, that would be worth investigating. Right now I wouldn\'t worry about it. The slight bump is likely from the 2 active webchat sessions holding message history in memory.', timestamp: now - 895_000 },
  { id: 'u5', role: 'user', content: 'Makes sense. Can you check if there have been any errors in the API logs today?', timestamp: now - 600_000 },
  { id: 'a5', role: 'assistant', content: 'I checked the API logs for today. Here\'s the summary:\n\n**Total requests:** 1,247\n**Errors:** 3 (0.24% error rate)\n\nThe 3 errors were:\n1. `10:14:02` — `404 GET /favicon.ico` (browser request, harmless)\n2. `11:32:18` — `502 GET /agents/openclaw-list` (gateway was restarting during deploy, recovered in 3s)\n3. `14:01:55` — `408 POST /chat/send` (request timeout, client disconnected before response)\n\nNothing concerning here — all transient issues that resolved themselves. No 500s, no crashes, no unhandled exceptions.', timestamp: now - 595_000 },
  { id: 'u6', role: 'user', content: '@main what about the chat history? Are sessions being stored correctly now after our fix?', timestamp: now - 300_000 },
  { id: 'a6', role: 'assistant', content: 'Yes! The session fix is working correctly. Here\'s what I can see:\n\n**Active sessions:** 1 (using the unified `main` key)\n**Legacy sessions detected:** 0 (migration complete)\n**Message count:** 47 messages in the current session\n\nBefore the fix, you had 5 fragmented sessions with random keys like `dashboard-x7k2m-1708234567`. Those have all been migrated to the single `main` session. Messages from different devices and tabs are now properly consolidated.\n\nThe `localStorage` on each client points to `main` and the gateway normalizes any stale references that might come through from cached clients.', timestamp: now - 295_000 },
  { id: 'u7', role: 'user', content: 'Awesome, that was driving me crazy. One more thing — can you give me a quick summary of what\'s been deployed this week?', timestamp: now - 120_000 },
  { id: 'a7', role: 'assistant', content: 'Here\'s your deploy history for this week:\n\n**Monday Feb 16**\n- 09:14 — Soft deploy: Dashboard CSS hotfix (border-radius on cards)\n- 11:02 — Full deploy: New `/agents/openclaw-list` endpoint\n\n**Tuesday Feb 17**\n- 14:30 — Full deploy: Chat session unification fix\n- 14:45 — Soft deploy: Removed debug logging from chat hook\n\n**Wednesday Feb 18**\n- No deploys\n\n**Thursday Feb 19**\n- 08:55 — Full deploy: Added `useFakeChat` hook for offline preview\n- 16:20 — Full deploy: ChatView layout overhaul (sticky header, mobile fixes)\n\n**Friday Feb 20 (today)**\n- 10:08 — Failed deploy (missing `</div>` tag — fixed)\n- 10:45 — Full deploy: Build fix + type alignment for fake agents\n\n**Total: 8 deploys (7 successful, 1 failed-then-fixed)**', timestamp: now - 115_000 },
  { id: 'u8', role: 'user', content: 'Great overview. Everything looks solid. I\'ll kick off another deploy once I finish reviewing the layout changes in the preview.', timestamp: now - 60_000 },
  { id: 'a8', role: 'assistant', content: 'Sounds good! I\'ll be here monitoring. A few things to keep in mind for the next deploy:\n\n- The layout changes affect `Layout.tsx`, `ChatView.tsx`, and `ChatInput.tsx` — make sure all three are committed\n- The new `useFakeChat.ts` hook should be included too\n- You can verify the mobile layout by adding `?fake=1` to the URL before deploying to production\n\nJust say the word when you\'re ready and I can watch the deploy logs in real time.', timestamp: now - 55_000 },
];

const FAKE_REPLIES = [
  'Got it! Let me look into that for you. Based on what I can see, everything looks normal. Is there anything specific you\'d like me to check?',
  'I ran the diagnostics and here\'s what I found:\n- All services: **healthy**\n- Response time: 45ms avg\n- No errors in the last hour\n\nAnything else?',
  'Sure thing. I\'ve updated the configuration and the changes should take effect on the next deploy cycle. Want me to trigger a soft deploy now?',
  'Here\'s a summary of recent activity:\n1. 3 chat sessions today\n2. 2 deploys (1 soft, 1 full)\n3. No failed health checks\n4. Memory usage stable at ~140 MB',
];

/**
 * Fake chat hook that matches useOpenClawChat interface.
 * Activate with ?fake=1 or VITE_FAKE_CHAT=true for offline UI development.
 */
export function useFakeChat() {
  const [messages, setMessages] = useState<Message[]>(SEED_MESSAGES);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const [isWaitingForReply, setIsWaitingForReply] = useState(false);
  const [savedSessions] = useState<ChatSession[]>([
    { key: 'main', preview: 'Hey @main, I just pushed a new commit to the deploy branch...', timestamp: now - 1_800_000, messageCount: 16 },
  ]);

  const sendMessage = useCallback(async (content: string) => {
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsWaitingForReply(true);

    const reply = FAKE_REPLIES[Math.floor(Math.random() * FAKE_REPLIES.length)];

    // Simulate streaming with progressive reveal
    let revealed = '';
    const words = reply.split(' ');
    for (let i = 0; i < words.length; i++) {
      await new Promise(r => setTimeout(r, 30 + Math.random() * 40));
      revealed += (i > 0 ? ' ' : '') + words[i];
      setStreamingContent(revealed);
    }

    const assistantMsg: Message = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: reply,
      timestamp: Date.now(),
    };
    setStreamingContent(null);
    setIsWaitingForReply(false);
    setMessages(prev => [...prev, assistantMsg]);
  }, []);

  const startNewSession = useCallback(async () => {
    setMessages([]);
  }, []);

  const loadSession = useCallback((_key: string) => {
    setMessages(SEED_MESSAGES);
  }, []);

  const deleteSession = useCallback((_key: string) => {}, []);

  return {
    messages,
    streamingContent,
    isConnected: true,
    isConnecting: false,
    isWaitingForReply,
    error: null as string | null,
    sendMessage,
    activeSessionKey: 'main',
    savedSessions,
    startNewSession,
    loadSession,
    deleteSession,
  };
}

export { FAKE_AGENTS };
