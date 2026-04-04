# iOS 安全文档索引

> -04-04

## 当前状态

- 默认 iOS 全量回归已稳定为 `1648 executed / 43 skipped / 0 failures`
- live backend smoke、performance benchmark、权限敏感测试均为显式 opt-in
- 本轮新增安全收口:
  - 聊天链路日志不再公开打印消息正文
  - `Debug.xcconfig` 不再携带默认 demo 凭证

## 核心审计

| 文档 | 说明 |
|------|------|
| [SECURITY_AUDIT.md](./SECURITY_AUDIT.md) | iOS 主安全审计 |
| [SECURITY_AUDIT_P0-1.md](./SECURITY_AUDIT_P0-1.md) | StoreKit / 购买链路专项 |
| [SECURITY_AUDIT_P0-2.md](./SECURITY_AUDIT_P0-2.md) | Payment API / 验单专项 |
| [SECURITY_AUDIT_P0-8_M003.md](./SECURITY_AUDIT_P0-8_M003.md) | SSL Pinning 专项 |

## 配置与硬化

| 文档 | 说明 |
|------|------|
| [IOS_SECURITY_HARDENING.md](./IOS_SECURITY_HARDENING.md) | 凭证、配置和构建层硬化 |
| [SECURITY_CONFIGURATION.md](./SECURITY_CONFIGURATION.md) | 安全配置说明 |

## 深入分析

| 文档 | 说明 |
|------|------|
| [P1-2.3-sql-injection-audit.md](./P1-2.3-sql-injection-audit.md) | SQL 注入审计 |
| [P1-2.4-data-flow-analysis.md](./P1-2.4-data-flow-analysis.md) | 数据流分析 |

## 关联报告

- [../../project-reports/INDEX.md](../../project-reports/INDEX.md)
- [../../project-reports/LAUNCH_READINESS_UPDATE_20260401.md](../../project-reports/LAUNCH_READINESS_UPDATE_20260401.md)
