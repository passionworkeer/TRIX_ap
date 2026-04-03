# Desktop Documentation Index

> Last updated: 2026-04-03

## Core Documentation

| Document | Description |
|----------|-------------|
| [DESKTOP_ARCHITECTURE.md](./DESKTOP_ARCHITECTURE.md) | Electron architecture: 99 IPC handlers, preload, multi-window, LuminaLayout, Gateway WS RPC |

## Related

- [Desktop PRD](../requirements/DESKTOP_PRD.md) — Product requirements for desktop app
- [Project Reports](../project-reports/) — Launch readiness, OWASP audit, and project status
- [Native Channel Protocol](../TRIX_NATIVE_CHANNEL.md) — TRIX Native messaging spec
- [Changelog](../CHANGELOG.md) — Development iteration log

## Quick Reference

- **Framework**: Electron 33.4 + React 19 + TypeScript + Vite
- **IPC Handlers**: **101** handlers (window/gateway/gateway-ws/auth/study/trixnative/channels/config/cron/system)
- **Windows**: Main window (LuminaLayout, 11 routes) + Float window (260×280px, always-on-top) + System tray
- **Gateway**: OpenClaw integration — child process + Triple-layer Health + Diagnostic Engine + WS RPC
- **Preload**: 79 unique methods (preferences/friends/notifications stubs not yet implemented in IPC)
