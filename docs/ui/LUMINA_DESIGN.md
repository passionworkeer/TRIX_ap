# Lumina Design System — Desktop UI

> **最后更新**: 2026-04-04
> **Theme**: Light / Social-facing pages (Chat, Study, Snapshot, Profile)
> **Background**: `#f7f9fb` (content), `#f2f4f6` (sidebar/frame)
> **Creative North Star**: "The Digital Atheneum" — warm minimalist light mode
> **Reference**: Stitch design system, Desktop Sprint 4

---

## Color Tokens (`stitch/lumina/tokens.ts`)

| Token | Value | Usage |
|-------|-------|-------|
| `background` | `#f7f9fb` | Page content background |
| `surface` | `#ffffff` | Cards, panels |
| `sidebar` | `#f2f4f6` | Sidebar + TitleBar background |
| `border` | `#e8edf2` | Subtle dividers |
| `text-primary` | `#1a1f2e` | Headlines, primary text |
| `text-secondary` | `#6b7280` | Secondary labels |
| `accent` | `#630ed4` | Primary actions (purple) |
| `accent-hover` | `#5208c0` | Hover state |
| `success` | `#22c55e` | Online, success states |
| `danger` | `#ef4444` | Errors, destructive |

---

## Typography

- **Headlines**: Inter / system-ui, bold, high scale contrast
- **Body**: Inter, regular, 14-16px
- **Mono**: JetBrains Mono (chat messages, code blocks)

---

## Layout

```
┌─────────────────────────────────────────────────────┐
│  TitleBar (36px, draggable, sidebar collapse btn)  │
├──────────────┬──────────────────────────────────────┤
│              │                                      │
│  Sidebar     │         Content Area                 │
│  (240px,     │         (Lumina light bg)            │
│  collapsible)│                                      │
│              │                                      │
└──────────────┴──────────────────────────────────────┘
```

---

## Pages (Lumina / Light)

| Page | Background | Design |
|------|-----------|--------|
| Chat | `#f7f9fb` | Two-column: friend list + message window |
| Study | `#f7f9fb` | Session cards, progress indicators |
| Snapshot | `#f7f9fb` | Camera capture, image gallery |
| Map | `#f7f9fb` | Friend/place map with markers |
| Profile | `#f7f9fb` | Avatar, achievements, settings preview |

---

## Components

### LuminaLayout (`stitch/shared/LuminaLayout.tsx`)
- Wraps all Lumina pages with Sidebar + TitleBar
- Manages sidebar collapsed state
- Applies Lumina CSS variables to :root

### Sidebar (`lumina/components/Sidebar.tsx`)
- 240px expanded, icon-only collapsed
- Navigation: Chat, Study, Snapshot, Map, Profile
- Gateway status indicator (running/stopped)
- Collapse toggle button

### TitleBar (`lumina/components/TitleBar.tsx`)
- 36px height, `-webkit-app-region: drag`
- App title, window controls (min/max/close)
- Sidebar collapse button

### Buttons (`lumina/components/buttons.tsx`)
- **primary**: Purple fill, white text
- **secondary**: White fill, gray border
- **ghost**: Transparent, text only
- **outline**: Border only, transparent bg

### Cards (`lumina/components/cards.tsx`)
- **surface-low**: `#ffffff`, subtle shadow
- **surface-mid**: Slightly elevated
- **surface-high**: Maximum elevation

### Inputs (`lumina/components/inputs.tsx`)
- Bottom border only style (underline input)
- Focus: purple bottom border

### ChatPage (`lumina/pages/ChatPage.tsx`)
- Left: friend/conversation list with search
- Right: message window with message bubbles
- Message input at bottom with send button

---

## vs Monolith Noir

| Aspect | Lumina | Noir |
|--------|--------|------|
| Audience | Social, user-facing | Tool, developer-facing |
| Background | `#f7f9fb` | `#131313` |
| Surface | White cards | Glassmorphic dark cards |
| Primary Color | Purple `#630ed4` | White `#ffffff` |
| Typography | Warm, rounded | Precise, monospace accents |
| Pages | Chat, Study, Snapshot, Map, Profile | Dashboard, Agents, Channels, Settings |
