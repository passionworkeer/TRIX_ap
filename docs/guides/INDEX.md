# 操作指南索引

> TRIX 3D Companion 操作指南总览
> **最后更新**: 2026-04-04

---

## 指南列表

| 文档 | 说明 | 最后更新 |
|------|------|----------|
| [PAIRING.md](./PAIRING.md) | 三端配对、解绑、故障排查（唯一权威配对文档） | 2026-04-04 |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | 生产环境部署指南（trix.love） | 2026-04-04 |
| [SERVER_GUIDE.md](./SERVER_GUIDE.md) | 服务器连接和运维操作 | 2026-04-04 |
| [IOS_TEST_DEPLOY_GUIDE.md](./IOS_TEST_DEPLOY_GUIDE.md) | iOS 测试、打包、上架完整方案（Windows 开发环境） | 2026-04-04 |
| [MACOS_LAUNCHD.md](./MACOS_LAUNCHD.md) | macOS launchd 开机自启模板（OpenClaw Gateway） | — |
| [SUPABASE_EMAIL_CONFIRMATION.md](./SUPABASE_EMAIL_CONFIRMATION.md) | Supabase 邮箱确认配置（iOS/Web/Desktop 三端均已完成） | 2026-04-04 |

---

## 指南依赖关系

```
PAIRING.md          ← TRIX_NATIVE_CHANNEL.md（上游协议）
DEPLOYMENT.md       ← SERVER_GUIDE.md（下游运维）
IOS_TEST_DEPLOY_GUIDE.md  ← iOS 项目配置（ios/IOS_ARCHITECTURE.md）
```

---

## 关键端口速查

| 服务 | 端口 | 相关指南 |
|------|------|----------|
| Web 开发服务器 | 5173 | SETUP.md |
| OpenClaw Gateway | 18789 | PAIRING.md, MACOS_LAUNCHD.md |
| TRIX Native Server | 8788 | SERVER_GUIDE.md, DEPLOYMENT.md |

---

**最后更新**: 2026-04-04
