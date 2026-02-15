# Chat with @Agent Mentions - Quick Guide

## Visual Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Chat                                    ● Connected            │
│  Talk to your agents • Use @ to mention specific agents        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────┐     │
│  │  [Avatar] OpenClaw                                  │     │
│  │                                                      │     │
│  │  Hello! I'm ready to help you with your agents.      │     │
│  │                                                      │     │
│  │  2:30 PM                                             │     │
│  └──────────────────────────────────────────────────────┘     │
│                                                                 │
│                                    ┌────────────────────────┐ │
│  ┌─────────────────────────────┐  │ [Avatar] You           │ │
│  │ Check status of @agent1     │  │                        │ │
│  └─────────────────────────────┘  │                        │ │
│  [@agent1]                        │                        │ │
│  2:31 PM                         └────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────┐     │
│  │  [Avatar] OpenClaw                                  │     │
│  │                                                      │     │
│  │  agent1 is online and healthy. Last heartbeat: 5s ago│     │
│  │                                                      │     │
│  │  2:31 PM                                             │     │
│  └──────────────────────────────────────────────────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Type your message... Use @agent to mention                    │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ @agent                                                   │    │
│  └────────────────────────────────────────────────────────┘    │
│                         ┌────────────────┐                      │
│                         │ [Send]         │                      │
│                         └────────────────┘                      │
│                                                                 │
│  @ Type @agentname to mention specific agents                  │
└─────────────────────────────────────────────────────────────────┘
```

## How to Use @Mentions

### Step 1: Type @
```
Type: @
```

### Step 2: See Suggestions
```
┌──────────────────────────────────┐
│ All Online Agents                │
│                                  │
│ 🤖 agent1                       │
│    Production agent             │
│    Active                       │
│                                  │
│ 🤖 agent2                       │
│    Development instance         │
│    5m ago                       │
│                                  │
│ 🤖 monitoring-bot              │
│    Health check agent           │
│    Active                       │
└──────────────────────────────────┘
```

### Step 3: Filter by Typing
```
Type: @prod
┌──────────────────────────────────┐
│ Matching Agents                  │
│                                  │
│ 🤖 agent1                       │
│    Production agent             │
│    Active                       │
└──────────────────────────────────┘
```

### Step 4: Select and Send
```
Type: @agent1 Please check the system status

[Send]

Message appears with blue mention badge:
┌─────────────────────────────────┐
│ Check status of @agent1         │
│ [@agent1]                       │
└─────────────────────────────────┘
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` | Send message |
| `Shift + Enter` | New line |
| `↑` Arrow | Navigate suggestions up |
| `↓` Arrow | Navigate suggestions down |
| `Escape` | Close suggestions |
| `@` | Open agent suggestions |

## Message Types

### User Messages (You)
```
┌─────────────────────────────────┐
│ ┌──────┐                         │
│ │ User │                         │
│ └──────┘                         │
│                                  │
│ Hey @agent1, can you help?       │ ← Right-aligned, blue
│ [@agent1]                        │ ← Mention badge
│                                  │
│ 2:30 PM                          │
└─────────────────────────────────┘
```

### Assistant Messages (OpenClaw)
```
┌─────────────────────────────────┐
│ ┌──────┐                         │
│ │  Bot │                         │
│ └──────┘                         │
│                                  │
│ OpenClaw                         │ ← Badge
│                                  │
│ Sure! I'll help agent1 right away│ ← Left-aligned, gray
│                                  │
│ 2:31 PM                          │
└─────────────────────────────────┘
```

## Connection Status

| Status | Indicator | Description |
|--------|-----------|-------------|
| Connecting | 🟡 Yellow pulse | Connecting to gateway |
| Connected | 🟢 Green wifi icon | Ready to chat |
| Disconnected | 🔴 Red wifi off | Connection lost |

## Navigation Update

**NEW Navigation Order:**

1. **Chat** ← Now PRIMARY tab! 🎯
2. Agents
3. Missions
4. Files
5. Sessions
6. Events
7. Settings

**Mobile Quick Access:**
- Chat, Agents, Missions, Files (bottom navigation)

## Tips & Tricks

1. **Quick Mention** - Just type `@` and select from list
2. **Filter Faster** - Type `@prod` to find "agent1"
3. **Multi-Line** - Use `Shift + Enter` for new lines
4. **Clear Input** - Click X button to clear

## Example Conversations

### Check Agent Status
```
You: @agent1 What's your current load?

OpenClaw: agent1 reports:
- CPU: 45%
- Memory: 2.1GB/4GB
- Tasks: 3 running
```

### Delegate Task
```
You: @deployment-bot deploy the latest version to production

OpenClaw: Starting deployment...
- Pulling latest code
- Running tests
- Deploying to prod-01
```

### Multiple Mentions
```
You: @agent1 and @monitoring-bot please check cluster health

OpenClaw: Notifying both agents...
- agent1: acknowledged
- monitoring-bot: acknowledged
```

## What Makes This Special?

1. **No Channels** - Simple direct chat
2. **Smart Mentions** - Only shows online agents
3. **Visual Feedback** - Clear mention highlighting
4. **Keyboard Friendly** - Power user shortcuts
5. **Fast** - Instant suggestions, no delay
6. **Clean** - Minimal, focused UI

---

That's it! Start chatting with your agents! 🚀
