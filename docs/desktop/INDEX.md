# Desktop Documentation Index

> Last updated: 2026-03-30

## Core Documentation

| Document | Description |
|----------|-------------|
| [DESKTOP_ARCHITECTURE.md](./DESKTOP_ARCHITECTURE.md) | Electron architecture: IPC, preload, multi-window, LuminaLayout |

## Related

- [Desktop PRD](../requirements/DESKTOP_PRD.md) — Product requirements for desktop app
- [Desktop Test Report](../issues/DESKTOP_TEST_REPORT.md) — Test status and coverage
- [Native Channel Protocol](../TRIX_NATIVE_CHANNEL.md) — TRIX Native messaging spec
- [Changelog](../CHANGELOG.md) — Development iteration log

## Quick Reference

- **Framework**: Electron 33 + React 19 + TypeScript + Vite
- **IPC Handlers**: ~90 handlers across window, gateway, study, auth, channels
- **Windows**: Main window (LuminaLayout) + Float window (GlassPet) + System tray
- **Gateway**: OpenClaw integration for AI agent orchestration
