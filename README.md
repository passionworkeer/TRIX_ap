# TRIX 3D Companion

> AI Companion Across Web, iOS, and Windows Desktop — powered by Supabase + OpenClaw + TRIX Native Channel

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-19.2.4-61DAFB?logo=react)](https://react.dev)
[![Electron](https://img.shields.io/badge/Electron-33.4-47848F?logo=electron)](https://electronjs.org)
[![Swift](https://img.shields.io/badge/Swift-5.9-FA7343?logo=swift)](https://swift.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4.2-06B6D4?logo=tailwindcss)](https://tailwindcss.com)

---

## Table of Contents

- [Overview](#overview)
- [Three Platforms](#three-platforms)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Features](#features)
- [Getting Started](#getting-started)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Documentation](#documentation)
- [Contributing](#contributing)

---

## Overview

TRIX 3D Companion is a cross-platform AI companion application with three fully-featured clients:

| Platform | Tech | Architecture | Environment |
|----------|------|-------------|-------------|
| **Web** | React 19 + Vite + Tailwind CSS 4 | SPA (HashRouter) | Browser |
| **iOS** | SwiftUI + MVVM | Native | iOS 16+ |
| **Desktop** | Electron 33 + React 19 | Multi-window | Windows 10/11 |

All three platforms communicate through the **TRIX Native Channel** — a WebSocket-based real-time protocol that bridges AI personality, study tracking, social maps, and device pairing into a unified experience.

---

## Three Platforms

### Web — `src/`

The primary web client. Single-page application with 19 routes, covering the full companion experience from login to social maps.

- **Tech**: React 19.2.4, TypeScript 5.8.2, Vite 6.2, Tailwind CSS 4.2
- **Routing**: React Router 7 (HashRouter, compatible with Electron `file://` protocol)
- **Styling**: Dual-theme design system — **Lumina** (light) and **Monolith Noir** (dark)
- **Backend**: Supabase (Auth + Realtime Database + Storage)
- **i18n**: i18next + react-i18next
- **Maps**: Leaflet + React-Leaflet
- **Animations**: Framer Motion 12

### iOS — `ios/TRIX3DCompanion/`

Native SwiftUI companion app with full feature parity on iOS.

- **Tech**: Swift 5.9, SwiftUI, iOS 16+
- **Architecture**: MVVM with Combine
- **Networking**: Alamofire (REST) + Starscream (WebSocket)
- **Local Storage**: GRDB (SQLite) + Keychain
- **Maps**: MapKit
- **Camera**: AVFoundation
- **Payments**: StoreKit 2
- **Pairing**: `ClawbotChannelService` + QR code scanning via `QRScannerView`

### Desktop — `desktop/`

Windows desktop companion with multi-window support, system tray, and native IPC.

- **Tech**: Electron 33.4, React 19 (Renderer), Node.js (Main Process)
- **Multi-window**: Main window + Float window (always-on-top, 220×320)
- **State**: `electron-store` (JSON persistence) + `electron-log`
- **Build**: electron-builder (NSIS installer + portable exe)
- **IPC**: 51 handlers via contextBridge — Gateway lifecycle, channel messaging, system info, Supabase auth
- **System Tray**: Programmatic icon generation, context menu

---

## Tech Stack

### Core

| Category | Technology |
|----------|-----------|
| Language | TypeScript 5.8.2 (Web/Desktop), Swift 5.9 (iOS) |
| Web Framework | React 19.2.4 |
| Build Tool | Vite 6.2 |
| Styling | Tailwind CSS 4.2 |
| Desktop | Electron 33.4 |
| Mobile | SwiftUI (iOS 16+) |
| Backend | Supabase (Auth + Database + Storage) |
| Real-time | Socket.io-client, Starscream (iOS) |
| Package Manager | npm workspaces |

### Web/Desktop Dependencies

```
framer-motion          # Animations
react-router-dom       # Routing
@supabase/supabase-js  # Backend client
i18next               # Internationalization
leaflet + react-leaflet # Maps
lucide-react          # Icons
socket.io-client       # Real-time
electron-store         # Desktop persistence
electron-log           # Desktop logging
vite-plugin-electron   # Desktop bundling
vitest                 # Unit testing
@playwright/test       # E2E testing
```

### Server Package — `packages/trix-openclaw-native`

```
ws                     # WebSocket server (port 8788)
qrcode / qrcode-terminal  # QR code generation
node-edge-tts          # Edge TTS synthesis
openclaw               # OpenClaw Gateway plugin
```

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                     Client Layer                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │   Web    │  │   iOS    │  │     Desktop      │  │
│  │ React 19 │  │  SwiftUI │  │  Electron 33      │  │
│  └────┬─────┘  └────┬─────┘  └────────┬─────────┘  │
│       │             │                 │             │
└───────┼─────────────┼─────────────────┼─────────────┘
        │             │                 │
        ▼             ▼                 ▼
┌─────────────────────────────────────────────────────┐
│              TRIX Native Channel                     │
│   WebSocket (wss) + REST API + QR Pairing Protocol  │
│   Base URL: https://trix.love  |  Local: :8788       │
└────────────────────────┬────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│              OpenClaw Gateway                        │
│   WebSocket Gateway (port 18789)                     │
│   Plugin: trix-openclaw-native                       │
└────────────────────────┬────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│               Supabase Backend                       │
│   Auth  ·  Database  ·  Storage  ·  Realtime        │
└─────────────────────────────────────────────────────┘
```

### Key Ports

| Service | Port | Description |
|---------|------|-------------|
| Web Dev Server | 5173 | Vite dev server |
| Gateway | 18789 | OpenClaw WebSocket gateway |
| TRIX Native Server | 8788 | Local TRIX WebSocket + REST |
| Production TRIX | 443 | `https://trix.love` |

### TRIX Native Channel Protocol

The single source of truth for cross-platform pairing.

```
QR Code Format: http://host/pair?code=XXX&secret=YYY&accountId=ZZZ

Pairing Flow:
1. Device A generates 6-8 char code + secret
2. Code stored in DB with 1-hour TTL, 7s polling interval
3. Device B scans QR / enters code → POST /api/pairings/:code/claim
4. Both devices receive pairing confirmation via WebSocket
```

### Design System — Dual Theme

| Token | Lumina (Light) | Monolith Noir (Dark) |
|-------|---------------|---------------------|
| Background | `#f7f9fb` | `#131313` |
| Surface | `#ffffff` | `#0e0e0e` – `#353534` |
| Primary | `#630ed4` | `#ffffff` |
| Accent | `#6366f1` | `#a1a1aa` |
| Direction | Warm Precision | Digital Architect |

- **No 1px borders** — tonal shifts for sectioning
- **No drop shadows** — ambient shadows (4% opacity)
- **Glassmorphism** — `backdrop-blur` for overlays

---

## Features

### Core Features (All Platforms)

| Feature | Description |
|---------|-------------|
| **AI Chat** | Real-time messaging with AI companion personality |
| **Study Room** | Pomodoro timer + study session tracking |
| **Snapshot** | AI photo capture with gallery |
| **Achievements** | Gamified progress with 17+ achievements, rarity tiers |
| **Social Map** | Leaflet-based map with friend check-ins (Web) / MapKit (iOS) |
| **Pairing** | QR code device pairing across all three platforms |
| **Points Mall** | Virtual currency and item shop |
| **Wardrobe** | Virtual avatar customization |
| **Notifications** | Real-time push notifications |

### Web-Specific Features

| Feature | Description |
|---------|-------------|
| **19 Routes** | Home, Chat, ChatDetail, Study, Snapshot, Profile, Map, Pairing, QrPairing, PointsMall, Wardrobe, Diagnostic, etc. |
| **Dual Theme** | Lumina (light) and Monolith Noir (dark) themes |
| **Float Window** | Always-on-top mini companion window |
| **Agent Distribution Map** | MapPage showing AI agent geographic spread |
| **Emoji Picker** | Rich emoji picker with recent + search |
| **TTS Integration** | Edge TTS synthesis via proxy |
| **Baidu Maps** | Location service integration |
| **Aliyun OSS** | File storage and CDN |

### Desktop-Specific Features

| Feature | Description |
|---------|-------------|
| **Multi-window** | Main window + Float window (always-on-top) |
| **System Tray** | Minimize to tray, quick replies, notification preview |
| **IPC Architecture** | 51 main-process IPC handlers |
| **Gateway Lifecycle** | Start/stop/status from Settings UI |
| **Channel Messaging** | Direct plugin channel communication |
| **Supabase Auth IPC** | Sign in/up/out/get-session from renderer |
| **System Info IPC** | CPU, memory, disk, running processes |
| **NSIS Installer** | Windows installer + portable exe |

### iOS-Specific Features

| Feature | Description |
|---------|-------------|
| **SwiftUI MVVM** | Clean architecture with Combine |
| **APNs Push** | Apple Push Notification service |
| **StoreKit 2** | In-app purchases |
| **SSL Pinning** | Network security hardening |
| **Request Deduplication** | Automatic retry + deduplication |

---

## Services Architecture (`src/services/`)

| Service | Responsibility |
|---------|---------------|
| `TrixNativeChannelClient.ts` | Primary — WebSocket + REST API client |
| `chatService.ts` | Chat messages and conversations |
| `friendService.ts` | Friend management and requests |
| `achievementService.ts` | Achievement unlocking and progress |
| `pointsService.ts` | Points/currency operations |
| `studySessionService.ts` | Study room and session records |
| `locationService.ts` | Friend location tracking |
| `baiduMapService.ts` | Baidu Maps integration |
| `uploadService.ts` | File upload handling |
| `OSSService.ts` | Aliyun OSS CDN integration |
| `ttsService.ts` | Text-to-speech synthesis |
| `notificationService.ts` | Push notification management |
| `scheduleService.ts` | Schedule/calendar management |
| `todoService.ts` | Todo items |
| `sessionService.ts` | Auth session management |
| `StorageService.ts` | Local storage abstraction |

---

## Database Schema (Supabase)

| Table | Description |
|-------|-------------|
| `users` | User profiles and settings |
| `conversations` | Chat conversation threads |
| `messages` | Individual chat messages |
| `pairings` | Cross-device pairing records |
| `study_sessions` | Study room sessions and stats |
| `achievements` | Achievement definitions |
| `user_achievements` | User achievement unlock status |
| `points` | User points balance |
| `friend_requests` | Friend request records |
| `locations` | User location check-ins |

---

## Getting Started

### Prerequisites

| Requirement | Version |
|------------|---------|
| Node.js | ≥ 18.x |
| npm | ≥ 9.x |
| Python | ≥ 3.9 (for trix-openclaw-native) |
| Xcode | ≥ 15 (for iOS) |
| Windows | 10/11 (for Desktop) |

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/trix-3d-companion.git
cd trix-3d-companion
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```env
# Required — Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Optional — TRIX Native Server
VITE_TRIX_NATIVE_SERVER_URL=http://localhost:8788

# Optional — Baidu Maps
VITE_BAIDU_MAP_AK=your-baidu-map-ak
```

### 4. Start Development

```bash
# Web
npm run dev

# Desktop
npm run dev:desktop

# iOS — open in Xcode
open ios/TRIX3DCompanion/TRIX3DCompanion.xcworkspace
```

---

## Development

### Project Structure

```
trix-3d-companion/
├── src/                          # Web app (React 19)
│   ├── components/                # Reusable UI components
│   ├── pages/                    # Route-level pages
│   ├── services/                # API + business logic services
│   ├── hooks/                    # Custom React hooks
│   ├── i18n/                     # Translations (en, zh, etc.)
│   ├── types/                    # TypeScript type definitions
│   └── styles/                   # Global styles + Tailwind
├── desktop/                      # Electron desktop app
│   ├── src/
│   │   ├── main/                # Electron main process (Node.js)
│   │   │   ├── index.ts        # Entry point
│   │   │   ├── ipc.ts          # IPC handlers
│   │   │   ├── preload.ts      # contextBridge API
│   │   │   ├── tray.ts         # System tray
│   │   │   └── float.tsx       # Float window
│   │   └── renderer/            # React renderer
│   │       ├── pages/          # Desktop pages
│   │       └── components/     # Desktop components
│   └── dist/                    # Build output
├── ios/                         # iOS app
│   └── TRIX3DCompanion/
│       ├── Sources/            # Swift source files
│       ├── Resources/          # Assets + Info.plist
│       └── project.yml         # XcodeGen config
├── packages/
│   └── trix-openclaw-native/   # TRIX Native Server + OpenClaw Plugin
│       ├── src/server.ts       # WebSocket server
│       ├── src/plugin/         # OpenClaw plugin
│       └── openclaw.plugin.json
├── database/                   # Supabase schema migrations
├── tests/
│   ├── smoke/                 # Node.js smoke tests
│   └── e2e/                   # Playwright E2E tests
├── docs/                      # Architecture + design docs (50+)
├── stitch/                   # Design system source files
└── public/                   # Static assets
```

### Desktop IPC API

Renderer calls main process via `window.electronAPI`:

```typescript
// Gateway
window.electronAPI.gateway.start()
window.electronAPI.gateway.stop()
window.electronAPI.gateway.status()          // → { running: boolean }
window.electronAPI.gateway.getLog()          // → string

// Auth
window.electronAPI.auth.signIn(email, password)
window.electronAPI.auth.signUp(email, password)
window.electronAPI.auth.signOut()
window.electronAPI.auth.getSession()          // → Session | null

// Channels
window.electronAPI.channels.list()            // → ChannelInfo[]
window.electronAPI.channels.start(channelId)
window.electronAPI.channels.stop(channelId)
window.electronAPI.channels.send(channelId, payload)

// System
window.electronAPI.system.info()             // CPU, memory, OS
window.electronAPI.system.disk()             // Disk usage
window.electronAPI.system.checkPackages(packages)  // Check installed apps

// State
window.electronAPI.state.read(key)
window.electronAPI.state.write(key, value)
```

### Key Development Rules

| Rule | Reason |
|------|--------|
| Use `loadFile()` not `loadURL()` | asar compatibility |
| Use `app.getPath('userData')` not `process.cwd()` | Correct paths in packaged app |
| Add `-webkit-app-region: no-drag` to buttons in drag regions | Prevents button drag behavior |
| `startAccount()` must never return | Returning = channel stopped = restart loop |
| Use channel IDs with brackets: `cfg.channels?.['trix-native']` | Handles hyphenated keys |
| Use `TrixNativeChannelClient.ts` not `ClawbotChannelBridge` | Web uses the correct client |

---

## Testing

### Test Suite

```bash
# Unit tests (Vitest)
npm run test:unit
npm run test:unit:watch    # Watch mode
npm run test:unit:coverage # With coverage report

# Smoke tests (Node.js)
npm run test:smoke

# Server tests
npm run test:server

# E2E tests (Playwright — Chromium, Firefox, WebKit)
npm run test:e2e
npm run test:e2e:ui        # Interactive UI mode
npm run test:e2e:debug     # Debugger mode

# All tests
npm run test:all
```

### Coverage Target

- **Unit**: Core services 80%+ line coverage
- **Smoke**: All critical paths
- **E2E**: Happy path + edge cases per platform

### E2E Desktop Verification Strategy

The E2E runner uses a dual-mode strategy:
1. **Electron launch** — preferred, runs app directly
2. **Fallback** (if launch times out) — validates via:
   - Process list (`tasklist`) — confirms TRIX Companion.exe running
   - Log files — checks for App ready, Main window, Float window markers
   - Network — verifies Gateway port 18789 + `/health` returns 200 OK

---

## Deployment

### Web

```bash
npm run build
# Output: dist/
# Deploy to any static host (Vercel, Netlify, Cloudflare Pages)
```

### Desktop

```bash
npm run build:desktop       # NSIS installer (.exe)
npm run build:desktop:dir   # Directory output (portable)
```

Output locations:
- `desktop/dist/` — packaged Electron app
- `desktop/dist-desktop/` — electron-builder output

### iOS

```bash
cd ios
xcbuild -project TRIX3DCompanion.xcodeproj \
        -scheme TRIX3DCompanion \
        -configuration Release \
        -derivedDataPath build
```

### Production Services

| Service | URL |
|---------|-----|
| Web Frontend | http://TRIX_SERVER_HOST |
| TRIX Native | http://TRIX_SERVER_HOST:8788 |
| Gateway | ws://TRIX_SERVER_HOST:18789 |

---

## Documentation

50+ documents organized in `docs/`:

### Architecture

| Document | Description |
|---------|-------------|
| `docs/TRIX_NATIVE_CHANNEL.md` | **Single source of truth** for pairing protocol |
| `docs/architecture/WEB_ARCHITECTURE.md` | Web stack deep dive |
| `docs/architecture/DESKTOP_ARCHITECTURE.md` | Electron architecture + IPC |
| `docs/architecture/IOS_ARCHITECTURE.md` | iOS MVVM architecture |
| `docs/database/DATABASE_SCHEMA.md` | Full Supabase schema |
| `docs/INDEX.md` | Master documentation index |

### Design

| Document | Description |
|---------|-------------|
| `docs/ui/LUMINA_DESIGN.md` | Lumina light theme tokens |
| `docs/ui/DESIGN.md` | Monolith Noir dark theme |
| `docs/desktop/stitch/DESKTOP_STITCH.md` | Desktop design system |

### Guides

| Document | Description |
|---------|-------------|
| `docs/guides/PAIRING.md` | Device pairing guide |
| `docs/guides/DEPLOYMENT.md` | Deployment guide |
| `docs/ENVIRONMENT.md` | All environment variables |

---

## Contributing

### Branch Naming

```
feat/<feature-name>      # New features
fix/<issue-description>  # Bug fixes
refactor/<scope>         # Refactoring
docs/<scope>             # Documentation
test/<scope>             # Tests
chore/<scope>            # Tooling/dependencies
```

### Commit Format

```
<type>: <description>

<optional body>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`

### Code Review Checklist

- [ ] No hardcoded secrets (API keys, passwords, tokens)
- [ ] No SQL injection or XSS vulnerabilities
- [ ] All user inputs validated at system boundaries
- [ ] Error handling on all async operations
- [ ] No `any` types in TypeScript
- [ ] Desktop uses `app.getPath('userData')` not `process.cwd()`
- [ ] Pairing uses URL format `http://host/pair?code=XXX&secret=YYY`

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Acknowledgments

- [Supabase](https://supabase.com) — Auth, Database, Storage, Realtime
- [OpenClaw](https://github.com) — Gateway and plugin framework
- [Tailwind CSS](https://tailwindcss.com) — Utility-first styling
- [Framer Motion](https://www.framer.com/motion/) — Animations
- [Leaflet](https://leafletjs.com) — Interactive maps (Web)
- [MapKit](https://developer.apple.com/documentation/mapkit) — Native maps (iOS)
- [Electron](https://electronjs.org) — Cross-platform desktop
