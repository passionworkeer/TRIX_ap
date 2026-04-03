# iOS Documentation Index

> Last updated: 2026-04-03

## Core Documentation

| Document | Description |
|----------|-------------|
| [README.md](./README.md) | iOS project overview and setup |
| [IOS_ARCHITECTURE.md](./IOS_ARCHITECTURE.md) | MVVM architecture, 295 Swift files, 59 services |
| [IOS_API_REFERENCE.md](./IOS_API_REFERENCE.md) | Swift service interfaces |
| [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) | APNs quick reference |

## Guides

| Document | Description |
|----------|-------------|
| [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) | Theme integration guide |
| [ARCHITECTURE_DIAGRAM.md](./ARCHITECTURE_DIAGRAM.md) | Voice message architecture diagrams |
| [TESTING.md](./TESTING.md) | Push notification testing guide |

## Launch Readiness

| Document | Description |
|----------|-------------|
| [../project-reports/LAUNCH_READINESS_UPDATE_20260401.md](../project-reports/LAUNCH_READINESS_UPDATE_20260401.md) | Latest iOS launch-readiness update, opt-in test toggles, repo hardening |
| [../project-reports/LAUNCH_READINESS_SUMMARY_20260331.md](../project-reports/LAUNCH_READINESS_SUMMARY_20260331.md) | Local fixes and verification summary |

Current local regression snapshot:
- Default `TRIX3DCompanionTests`: `1648 executed / 43 skipped / 0 failures`
- Skipped items are explicit opt-in suites such as live backend smoke, performance benchmarks, and permission-sensitive checks

## Security

| Document | Description |
|----------|-------------|
| [security/INDEX.md](./security/INDEX.md) | Master index for iOS security docs |
| [security/SECURITY_AUDIT.md](./security/SECURITY_AUDIT.md) | Main security audit (grade B+) |
| [security/SECURITY_AUDIT_P0-1.md](./security/SECURITY_AUDIT_P0-1.md) | StoreKit security |
| [security/SECURITY_AUDIT_P0-2.md](./security/SECURITY_AUDIT_P0-2.md) | Payment API security |
| [security/SECURITY_AUDIT_P0-8_M003.md](./security/SECURITY_AUDIT_P0-8_M003.md) | SSL Pinning (grade A) |
| [security/IOS_SECURITY_HARDENING.md](./security/IOS_SECURITY_HARDENING.md) | Security hardening guide |
| [security/SECURITY_CONFIGURATION.md](./security/SECURITY_CONFIGURATION.md) | Sensitive info configuration |
| [security/P1-2.3-sql-injection-audit.md](./security/P1-2.3-sql-injection-audit.md) | SQL injection audit |
| [security/P1-2.4-data-flow-analysis.md](./security/P1-2.4-data-flow-analysis.md) | Data flow analysis |

## Related

- [App Store Materials](../../ios/TRIX3DCompanion/Resources/AppStore/) — Icons, screenshots, descriptions
- [Feature: Profile](../../ios/TRIX3DCompanion/Features/Profile/README.md) — Profile feature (MVVM, glassmorphism)
- [Feature: Voice](../../ios/TRIX3DCompanion/Features/Voice/README.md) — Audio playback, TTS
- [Theme System](../../ios/TRIX3DCompanion/Shared/Theme/README.md) — Colors, typography, theme manager
- [Detox E2E](../../ios/detox/README.md) — E2E testing setup with Detox + Jest
