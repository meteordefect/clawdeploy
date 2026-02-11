# FriendLabs Mission Control — Design Reference

## Design Philosophy

**The Apple of AI Agents.** Clean, confident, no clutter.

**Beautiful but simple.** Start with fewer features, more polish.
**Glanceable.** Know what's happening in 2 seconds.
**Micro-animations everywhere.** State changes feel alive, not static.
**Polish over features.** A refined MVP beats a cluttered full build.
**Responsive and alive.** The UI should feel like it's listening.

**What We Don't Do:**
- No dashboards on dashboards
- No stat overload
- No enterprise complexity
- No "power user" density

---

## Source Analysis: SiteGPT Mission Control

Extracted functional components from reference design. 
FriendLabs will implement these mobile-first with a different visual style.

---

## 1. HEADER / STATUS BAR

**SiteGPT Implementation:**
- Product logo + name
- Workspace/project selector (dropdown)
- Active agents count
- Tasks in queue count
- Docs quick access
- Timestamp + date display
- Online/offline status indicator

**FriendLabs Mobile Adaptation:**
- Compact header with key stats
- Pull-down for project switcher
- Bottom nav for Docs and settings
- Status pill (online/offline)

---

## 2. AGENTS PANEL

**SiteGPT Implementation:**
- Vertical list of agents
- Avatar + name + role label
- Status badges (LEAD, SPC, INT, etc.)
- Activity indicators (WORKING, idle, etc.)
- Total agent count

**Agent Roles Observed:**
| Role | Function |
|------|----------|
| Founder | Leadership/oversight |
| Developer Agent | Code tasks |
| Customer Research | User insights |
| Squad Lead | Coordination |
| Content Writer | Written deliverables |
| Email Marketing | Campaign work |
| Social Media | Platform content |

**Friend Card (Main View) — Apple Minimal**
Show just enough to know what's happening:
- Avatar + name
- Status indicator (glowing dot: green = awake, dim = sleeping)
- Last task: "Researched competitor pricing" (truncated)
- Sleep/Wake toggle — subtle button with indicator light
- One key stat: "3 tasks today" or "Last active 2h ago"

No clutter. No dashboards on dashboards. Glanceable.

**FriendLabs Mobile:**
- Horizontal scrollable Friend cards (top of screen)
- Tap Friend → expands to Friend detail (full screen slide-up)
  - Recent activity feed
  - Current/last task details
  - Quick actions: assign task, message
- Swipe to scroll through Friends

**FriendLabs Desktop:**
- Friend cards in top bar or sidebar (always visible)
- Same minimal info as mobile — no extra density for density's sake
- Click Friend → side panel with detail view
- Hover: subtle highlight, no tooltip spam

**Sleep/Wake Button:**
- Small toggle or icon button on each Friend card
- Indicator light: soft glow when awake, dim when sleeping
- Tap to toggle (with confirmation for wake — costs tokens)
- Micro-animation: gentle pulse on state change

**Responsive Breakpoint:**
- < 768px: Mobile (scroll + expand)
- ≥ 768px: Desktop (cards visible, side panel detail)

---

## 3. MISSION QUEUE (KANBAN)

**SiteGPT Implementation:**
Columns:
1. INBOX — Unassigned tasks waiting for triage
2. ASSIGNED — Tasks with agent assigned, not started
3. IN PROGRESS — Active work
4. REVIEW — Awaiting approval/feedback
5. DONE — Completed

**Task Card Components:**
- Title (bold, truncated)
- Description snippet (2 lines max)
- Assigned agent avatar
- Timestamp (relative: "1 day ago")
- Tags/labels (research, content, SEO, etc.)
- Visual hierarchy: title > agent > tags > time

**FriendLabs Mobile Adaptation:**
- Swipe between columns (horizontal tabs or swipe gesture)
- Default view: single column at a time
- Pull down to refresh
- Tap card to expand detail view
- Swipe right on card = move to next column
- FAB (floating action button) for new task
- Filter by agent, tag, or time

**Task States for Non-Tech Users:**
| Visual | State | Meaning |
|--------|-------|---------|
| 🟡 | Inbox | Needs assignment |
| 🔵 | Working | Agent is on it |
| 🟣 | Review | Needs your input |
| ✅ | Done | Complete |

---

## 4. LIVE FEED / ACTIVITY STREAM

**SiteGPT Implementation:**
- Real-time activity log
- Filter tabs: All, Tasks, Comments, Decisions, Docs, Status
- Agent filter buttons (toggle visibility per agent)
- Entry format: "[Agent] [action] on [item]" + timestamp
- Relative timestamps ("2 hours ago")

**Activity Types Observed:**
- Comments on tasks
- Task status changes
- Document updates
- Decision logging

**FriendLabs Mobile Adaptation:**
- Full-screen activity view (swipe from queue)
- Push notifications for @mentions
- Collapsible filter chips
- Infinite scroll
- Tap entry to jump to source task
- Badge count for unread on nav

---

## 5. TASK DETAIL VIEW (Inferred)

**Expected Components:**
- Full title + description
- Assigned agent(s)
- Status selector
- Comment thread
- Attachments/documents
- Activity history for this task
- @mention support in comments
- Due date (optional)
- Tags/labels editor

**FriendLabs Mobile Adaptation:**
- Bottom sheet modal (slide up)
- Sticky header with title + status
- Scrollable comment section
- Quick actions bar: comment, reassign, mark done
- Swipe down to dismiss

---

## 6. DOCUMENTS PANEL (Inferred from "Docs" button)

**Expected Components:**
- List of deliverables/outputs
- Linked to tasks
- Search/filter
- Preview or download

**FriendLabs Mobile Adaptation:**
- Separate tab in bottom nav
- Grid or list view toggle
- Share action for deliverables
- Offline access for key docs

---

## 7. NOTIFICATIONS / @MENTIONS

**SiteGPT Implementation:**
- Live feed shows comments with mentions
- Real-time updates visible

**FriendLabs Mobile Adaptation:**
- Push notifications for:
  - Agent @mentions you
  - Task status changes
  - Agent stuck/needs input
- In-app notification center
- Badge on nav icon
- Sound/vibration options

---

## MOBILE-FIRST NAVIGATION STRUCTURE

```
┌─────────────────────────────────────┐
│  [Header: Stats + Status]           │
├─────────────────────────────────────┤
│  [Agent Bar: Horizontal Scroll]     │
├─────────────────────────────────────┤
│                                     │
│  [Main Content Area]                │
│  - Queue (default)                  │
│  - Activity Feed                    │
│  - Task Detail (modal)              │
│                                     │
├─────────────────────────────────────┤
│  [Bottom Nav]                       │
│  Queue | Feed | Docs | Settings     │
└─────────────────────────────────────┘
```

---

## GESTURES & INTERACTIONS

| Gesture | Action |
|---------|--------|
| Swipe left/right | Navigate queue columns |
| Swipe down | Refresh / dismiss modal |
| Tap card | Open task detail |
| Long press agent | Show agent info |
| Swipe card right | Quick move to next status |
| Pull from edge | Open side panel (if needed) |
| FAB tap | New task |

---

## VISUAL STYLE GUIDE

### Design Philosophy

**Apple Sophistication** — Clean, minimal, deliberate.
Every element earns its place. White space is a feature.
Clarity over decoration. Quiet confidence.

---

### Color Palette

```
BACKGROUNDS
───────────────────────────────────────────────────
Surface         #FAFAFA     Soft off-white (page bg)
Card            #FFFFFF     Pure white (elevated)
Subtle          #F5F5F7     Apple gray (sections)

TEXT
───────────────────────────────────────────────────
Primary         #1D1D1F     Near-black (headings)
Secondary       #6E6E73     Soft gray (body, meta)
Tertiary        #A1A1A6     Light gray (placeholders)

ACCENT
───────────────────────────────────────────────────
Midnight Blue   #1E3A5F     Primary accent (links, highlights)
Midnight Dark   #152A45     Hover state
Midnight Light  #2D4A6F     Active state

ACTIONS
───────────────────────────────────────────────────
Button Primary  #1D1D1F     Black (CTAs)
Button Hover    #000000     Pure black
Button Text     #FFFFFF     White on dark

STATUS
───────────────────────────────────────────────────
Working         #1E3A5F     Midnight blue
Review          #7C3AED     Soft purple
Done            #059669     Muted green
Waiting         #F59E0B     Warm amber
```

---

### Typography

**Primary: Serif for Headlines**
Font: `'Playfair Display'` or `'Cormorant Garamond'` or `'Source Serif Pro'`
Weight: 500-600 for headlines
Use: Page titles, section headers, hero text

**Secondary: Sans-Serif for UI**
Font: `'Inter'` or `'SF Pro Display'` or system-ui
Weight: 400-500 for body, 600 for emphasis
Use: Navigation, labels, body text, buttons

**Type Scale (Mobile First)**
```
Hero            32px / 1.1    Serif, 500
H1              28px / 1.2    Serif, 500
H2              22px / 1.3    Serif, 500
H3              18px / 1.4    Sans, 600
Body            16px / 1.5    Sans, 400
Small           14px / 1.4    Sans, 400
Caption         12px / 1.3    Sans, 400, uppercase, tracking +0.5px
```

**Letter Spacing**
- Section labels: `letter-spacing: 0.1em` (all-caps, spaced)
- Body: default
- Buttons: `letter-spacing: 0.02em`

---

### Card System

**Elevated Card (default)**
```css
background: #FFFFFF;
border-radius: 16px;
box-shadow: 0 1px 3px rgba(0,0,0,0.04), 
            0 4px 12px rgba(0,0,0,0.03);
border: 1px solid rgba(0,0,0,0.04);
```

**Flat Card (alternate)**
```css
background: #FFFFFF;
border-radius: 12px;
border: 1px solid #E5E5E7;
box-shadow: none;
```

**Card Padding**
- Mobile: 16px
- Desktop: 24px

---

### Buttons

**Primary Button (Black)**
```css
background: #1D1D1F;
color: #FFFFFF;
border-radius: 12px;
padding: 14px 24px;
font-weight: 500;
font-size: 15px;
letter-spacing: 0.02em;
transition: background 0.2s ease;

:hover {
  background: #000000;
}

:active {
  transform: scale(0.98);
}
```

**Secondary Button (Outline)**
```css
background: transparent;
color: #1D1D1F;
border: 1px solid #D1D1D6;
border-radius: 12px;
padding: 14px 24px;

:hover {
  background: #F5F5F7;
  border-color: #C7C7CC;
}
```

**Text Button**
```css
color: #1E3A5F;
font-weight: 500;
text-decoration: none;

:hover {
  text-decoration: underline;
}
```

---

### Status Badges / Pills

**Solid Badge**
```css
background: #1D1D1F;
color: #FFFFFF;
border-radius: 6px;
padding: 4px 10px;
font-size: 11px;
font-weight: 600;
text-transform: uppercase;
letter-spacing: 0.05em;
```

**Outline Badge**
```css
background: transparent;
color: #6E6E73;
border: 1px solid #D1D1D6;
border-radius: 6px;
padding: 4px 10px;
font-size: 11px;
```

**Status Colors (Badge BG)**
```
NEW         #1D1D1F (black)
WORKING     #1E3A5F (midnight)
REVIEW      #7C3AED (purple)
DONE        #059669 (green)
```

---

### Icons

**Style**: Line icons, 1.5px stroke
**Set**: Lucide, Heroicons (outline), or Phosphor
**Size**: 20px default, 24px for nav, 16px for inline
**Color**: Inherit from text color

**Icon Containers**
```css
/* Circular icon holder (stats cards) */
width: 40px;
height: 40px;
border-radius: 50%;
background: #F5F5F7;
display: flex;
align-items: center;
justify-content: center;
```

---

### Spacing System

**Base unit**: 4px

```
xs      4px
sm      8px
md      16px
lg      24px
xl      32px
2xl     48px
3xl     64px
```

**Mobile Margins**
- Page padding: 16px
- Section gap: 32px
- Card gap: 12px

---

### Shadows

**Subtle (cards)**
```css
box-shadow: 0 1px 3px rgba(0,0,0,0.04), 
            0 4px 12px rgba(0,0,0,0.03);
```

**Medium (modals, dropdowns)**
```css
box-shadow: 0 4px 6px rgba(0,0,0,0.05),
            0 12px 24px rgba(0,0,0,0.08);
```

**No harsh shadows** — keep everything soft and diffused.

---

### Motion / Transitions

**Philosophy**: Beautiful but simple. Polish over features. Feels responsive and alive.

**Default timing**: `200ms ease`
**Enter animations**: `300ms ease-out`
**Exit animations**: `200ms ease-in`

**Interactions**
- Buttons: subtle scale on press (0.98)
- Cards: no hover lift (keep flat)
- Modals: slide up from bottom (mobile)
- Page transitions: fade (150ms)

**Micro-Animations (State Changes)**
- Status badge change: subtle pulse + color fade (200ms)
- New activity item: slide in from right + fade (250ms)
- Task moves between columns: smooth glide (300ms ease-out)
- Friend status dot: gentle pulse when working
- Loading states: skeleton shimmer (not spinners)
- Success: brief green flash on element (150ms)
- @mention highlight: soft glow pulse (400ms)

**Keep It Subtle**
- Animations should feel natural, not flashy
- User shouldn't consciously notice them — just feel the polish
- Prefer transforms (translate, scale) over layout shifts
- Use will-change sparingly for performance

---

### Visual References

| Element | Reference |
|---------|-----------|
| Cards + Stats | Profound Realty dashboard |
| Serif headlines | Fair Developers hero |
| Button style | Both — black pill, white text |
| Overall tone | Apple.com product pages |

**Avoid**
- Colored backgrounds (keep neutral)
- Heavy shadows
- Rounded-full buttons (keep 12px radius)
- Dense layouts
- Decorative elements
- Gradients (except subtle on dark accent cards)

---

## DATA MODEL ALIGNMENT

Architecture: HTTP Command API + Postgres (Control Plane Pattern)

From FriendLabs.MD, Postgres tables:

```sql
-- Core entities
missions:   id, tenant_id, title, description, status, created_at, updated_at
agents:     id, tenant_id, name, role, session_key, status, current_mission_id

-- Command/work tracking
commands:   id, mission_id, agent_id, type, payload, status, created_at, completed_at
runs:       id, command_id, agent_id, started_at, ended_at, exit_code, model_used

-- Immutable event log (audit + activity feed)
events:     id, mission_id, agent_id, type, payload, created_at

-- Outputs
artifacts:  id, mission_id, run_id, type, content, path, created_at
```

Command Statuses: `pending` → `claimed` → `running` → `completed` | `failed`
Mission Statuses: `inbox` → `assigned` → `in_progress` → `review` → `done`
Event Types: `comment`, `status_change`, `mention`, `artifact_created`, `agent_assigned`

These map directly to the UI sections:
- `agents` → Agents Panel
- `missions` → Mission Queue cards (Kanban)
- `events` → Live Feed + Task Detail comments
- `artifacts` → Docs panel
- `events WHERE type='mention'` → Push + in-app alerts

Key Principles:
- Every action is an HTTP command
- Every result is persisted state in Postgres
- Agents are replaceable workers (poll for work)
- UI is a reader, not a controller (polls for state)
- Events table = immutable audit log (replay, debug, cost attribution)

---

## NEXT STEPS

1. Define color palette and visual language
2. Create mobile wireframes for core screens
3. Prototype swipe interactions
4. Design mission card component
5. Build agent status bar component
6. Build HTTP Command API (Node/Express or FastAPI)
7. Create Postgres schema and migrations
8. Implement polling in React dashboard (2-5s intervals)
9. Build mention-watcher daemon
