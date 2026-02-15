# Chat Implementation - Developer Reference

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                      App.tsx                            │
│                    (Router setup)                       │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ├── / → redirects to /chat
                        ├── /chat → ChatView
                        └── /agents → Agents (for agent list)
                        │
┌───────────────────────┴─────────────────────────────────┐
│                    Layout.tsx                           │
│              (Navigation - Chat is #1)                  │
└─────────────────────────────────────────────────────────┘
                        │
┌───────────────────────┴─────────────────────────────────┐
│                    ChatView.tsx                         │
│                   (Main chat UI)                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  - Message list (left/right aligned)            │   │
│  │  - Connection status                            │   │
│  │  - Uses ChatInput for input area                │   │
│  └─────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────┴─────────────────────────────────┐
│                  ChatInput.tsx                         │
│            (@mention system component)                  │
│  ┌─────────────────────────────────────────────────┐   │
│  │  - Textarea with auto-resize                    │   │
│  │  - Mention detection (@ trigger)                 │   │
│  │  - Agent suggestions dropdown                    │   │
│  │  - Keyboard navigation                           │   │
│  └─────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────┴─────────────────────────────────┐
│                 useOpenClawChat.ts                      │
│              (WebSocket connection hook)                │
│  ┌─────────────────────────────────────────────────┐   │
│  │  - WebSocket connection to gateway              │   │
│  │  - Message sending via RPC                      │   │
│  │  - Event handling for responses                 │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                        │
┌───────────────────────┴─────────────────────────────────┐
│                   api/client.ts                          │
│              (API calls for agent list)                 │
└─────────────────────────────────────────────────────────┘
```

## Key Files

### Core Components

| File | Purpose | Key Functions |
|------|---------|---------------|
| `ChatView.tsx` | Main chat interface | Message rendering, mention display |
| `ChatInput.tsx` | Input with @mentions | Agent suggestions, keyboard nav |
| `useOpenClawChat.ts` | WebSocket hook | Connect, send, receive messages |
| `Layout.tsx` | Navigation | Tab ordering (Chat first) |
| `App.tsx` | Routing | /chat route, default redirect |

### Types Used

```typescript
// From types.ts
interface Agent {
  id: string;
  name: string;
  description?: string;
  status: 'online' | 'stale' | 'offline';
  last_heartbeat?: string;
  // ... more fields
}

// In useOpenClawChat.ts
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  sessionKey?: string;
}

// In ChatInput.tsx (internal)
interface Mention {
  id: string;
  name: string;
  displayName: string;
  start: number;
  end: number;
}
```

## Extending the Chat System

### 1. Add Message Types

If you want to support different message types (files, commands, etc.):

```typescript
// Extend Message type
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  type: 'text' | 'file' | 'command' | 'error';
  content: string;
  timestamp: number;
  metadata?: {
    mentions?: string[];
    attachments?: Attachment[];
    command?: Command;
  };
}
```

### 2. Handle Mentions on the Backend

Currently, mentions are extracted but not sent to OpenClaw. To use them:

```typescript
// In ChatView.tsx
const handleSend = async (message: string, mentionedAgentIds?: string[]) => {
  if (mentionedAgentIds && mentionedAgentIds.length > 0) {
    // Pass mentions to OpenClaw
    await sendMessage({
      text: message,
      mentions: mentionedAgentIds,
      targetAgents: mentionedAgentIds  // Route to specific agents
    });
  } else {
    await sendMessage(message);
  }
};
```

### 3. Add Rich Text Support (Lexical)

Replace textarea with Lexical editor (from Team9):

```bash
npm install lexical @lexical/react @lexical/utils
```

Then create `RichTextEditor.tsx` similar to Team9's implementation.

### 4. Add File Attachments

```typescript
// In ChatInput.tsx
const [attachments, setAttachments] = useState<File[]>([]);

const handleFileUpload = (files: FileList) => {
  setAttachments(prev => [...prev, ...Array.from(files)]);
};

// Send with attachments
await onSend(message, mentionedAgentIds, attachments);
```

### 5. Add Agent Typing Indicators

```typescript
// Extend WebSocket event handling
if (msg.type === 'event' && msg.event === 'typing') {
  const { agentId, isTyping } = msg.payload;
  setTypingAgents(prev => isTyping
    ? [...prev, agentId]
    : prev.filter(id => id !== agentId)
  );
}
```

### 6. Add Message Search

```typescript
// Add to ChatView.tsx
const [searchQuery, setSearchQuery] = useState('');
const filteredMessages = messages.filter(msg =>
  msg.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
  msg.role === 'user' && msg.content.includes('@')
);
```

### 7. Export Chat History

```typescript
const exportChat = () => {
  const chatText = messages.map(msg =>
    `[${formatTime(msg.timestamp)}] ${msg.role}: ${msg.content}`
  ).join('\n');

  const blob = new Blob([chatText], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chat-export-${Date.now()}.txt`;
  a.click();
};
```

## Customization

### Change Mention Highlight Color

```css
/* In your global CSS */
.mention-highlight {
  @apply bg-purple-100 text-purple-700;  /* Instead of blue */
}
```

### Change Agent Avatar

```typescript
// In ChatInput.tsx
<div className="w-8 h-8 rounded-full bg-purple-100 ...">
  {/* Use agent status icon */}
  {agent.status === 'online' ? '🟢' : '🔴'}
</div>
```

### Add Agent Presence

```typescript
// Show "typing..." indicator
<div className="flex items-center gap-2 text-xs text-gray-500">
  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
  agent1 is typing...
</div>
```

## WebSocket Protocol

### Connect Request
```json
{
  "type": "req",
  "id": "connect-123",
  "method": "connect",
  "params": {
    "minProtocol": 3,
    "maxProtocol": 3,
    "client": {
      "id": "clawdeploy-dashboard",
      "displayName": "ClawDeploy Dashboard",
      "version": "1.0.0",
      "platform": "web",
      "mode": "user"
    },
    "caps": [],
    "role": "operator",
    "scopes": ["operator.admin"],
    "auth": { "token": "your-token" }
  }
}
```

### Send Message Request
```json
{
  "type": "req",
  "id": "send-456",
  "method": "chat.send",
  "params": {
    "sessionKey": "dashboard-session",
    "message": "Hello @agent1",
    "idempotencyKey": "user-123",
    "timeoutMs": 0
  }
}
```

### Chat Response Event
```json
{
  "type": "event",
  "event": "chat",
  "payload": {
    "state": "final",
    "seq": 1,
    "sessionKey": "dashboard-session",
    "message": {
      "content": [
        { "type": "text", "text": "Hello! How can I help?" }
      ],
      "timestamp": 1234567890
    }
  }
}
```

## Debugging

### Enable WebSocket Logging

```typescript
// In useOpenClawChat.ts
ws.onmessage = (event) => {
  console.log('[WS] Received:', event.data);
  // ... rest of handler
};

ws.onopen = () => {
  console.log('[WS] Connected');
  // ... rest of handler
};
```

### Debug Mention Detection

```typescript
console.log('Input:', input);
console.log('Mention match:', input.match(/@(\w*)$/));
console.log('Query:', mentionQuery);
console.log('Suggestions:', suggestions);
```

### Test Connection

```typescript
// In ChatView.tsx
useEffect(() => {
  console.log('Connection status:', { isConnected, isConnecting, error });
}, [isConnected, isConnecting, error]);
```

## Performance Notes

1. **Agent List** - Loaded once on mount, consider polling for updates
2. **Message List** - Virtualize for large histories (react-window)
3. **Mention Parsing** - Regex is fast, but debounce if typing fast
4. **WebSocket** - Automatic reconnection on disconnect

## Testing Checklist

- [ ] Type `@` shows suggestions
- [ ] Arrow keys navigate suggestions
- [ ] Enter selects suggestion
- [ ] Escape closes suggestions
- [ ] Click outside closes suggestions
- [ ] Shift+Enter adds new line
- [ ] Enter sends message
- [ ] Mentions appear highlighted in message
- [ ] Mention badges appear below message
- [ ] Mobile navigation works
- [ ] Connection status displays correctly
- [ ] Disconnected state disables input

## Future Enhancement Ideas

1. **Rich Text Editor** - Add formatting, code blocks
2. **File Upload** - Send images, documents
3. **Message Reactions** - React to messages
4. **Message Editing** - Edit sent messages
5. **Reply/Threads** - Reply to specific messages
6. **Search/Filter** - Find messages
7. **Export** - Download chat history
8. **Agent Presets** - Quick commands for agents
9. **Command History** - Up/Down arrow to see previous messages
10. **Markdown Preview** - Live preview of formatted text

---

Happy coding! 🚀
