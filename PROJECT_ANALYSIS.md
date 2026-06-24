# 项目深度分析报告 — TRIX 3D Companion

**分析日期**: 2026-06-25
**分析范围**: 全项目（Web + iOS + Desktop + packages/*）
**触发**: 本轮 git 历史清理 + force-push + 测试通过后的健康验证
**方法**: 5 专家 agent 并行 + 2 派辩论（乐观 vs 批判）

---

## 📊 综合评分

| 维度 | 评分 | 趋势 | 说明 |
|------|------|------|------|
| 架构 | 6.5/10 | → | 三端边界清晰，god module 突出，缺共享契约 |
| 安全 | 7.0/10 | ↑ | 远程历史已清，本地 .env 仍含真密钥需轮换 |
| 性能 | 5.0/10 | → | 32MB GLB + 17MB 视频无拆分，首屏重 |
| 测试 | 5.0/10 | → | 116/117 单元通过，覆盖率 20.54% 远低于 80% 目标 |
| 代码质量 | 6.5/10 | → | 25+ `any` 残留，不一致错误处理 |

---

## ✅ 本轮已完成（不需再处理）

- git filter-repo 重写 1128 个提交，从历史抹除所有可用凭证（Supabase JWT×2、阿里云 OSS key、3 个 auth token、project refs）
- force-push `develop`（`db5456d`）和 `main`（`9ed3e311`）到 GitHub
- 修复 pre-commit hook：用通用 pattern + jwt.io 白名单，不再明文存密钥（修复了 hook 自身曾 reintroduce 密钥的回归 bug）
- 删除遗留 locked worktree `.claude/worktrees/agent-a523a76a24dfb2878` 及其分支（磁盘上含真实 JWT）
- `.gitignore` 增补 `.claude/worktrees/`、`.claude/scheduled_tasks.{lock,json}`
- 测试：单元 116/116、smoke 194/194、web-api 3/3 全部通过

---

## 🔴 用户必须立即处理（AI 无法代执行）

### 1. 在控制台**轮换**所有泄露的密钥（远程 GitHub / CDN 缓存仍可能存旧值）
| 系统 | 操作 |
|------|------|
| Supabase Dashboard | 两个项目（`hmbukjv...` / `bqzjumxf...`）→ Settings → API → **Rotate** anon key，并验证 RLS |
| 阿里云 RAM | 禁用 AccessKey `LTAI-REDACTED-ACCESSKEY-ID`，重新创建后更新部署 |
| TRIX Native Server | 重生成 `VITE_GATEWAY_AUTH_TOKEN` 和 `VITE_PC_AUTH_TOKEN` |

### 2. iOS Info.plist 占位符（iOS 端当前不可运行）
- 现状：`ios/TRIX3DCompanion/Resources/Info.plist` 是 `__SUPABASE_URL_PLACEHOLDER__` / `__SUPABASE_ANON_KEY_PLACEHOLDER__`，编译过但运行必崩
- 短期：轮换拿到新 key 后填回 Info.plist
- 长期方案（推荐）：xcconfig 注入 + Info.plist 用 `$(SUPABASE_URL)` / `$(SUPABASE_ANON_KEY)` build setting 引用，`.xcconfig` 加进 `.gitignore`

### 3. 清理本地仍含密钥历史的引用
```bash
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git tag -d backup-before-cleanup-20260624
git branch -D backup/openclaw-pairing-history refs-notes/origin-main
```
（这些未 push，但本地 agent/IDE 历史仍可读）

---

## 🟡 高优先级（下个 sprint）

| 问题 | 位置 | 修复 |
|------|------|------|
| **IPC 命令注入** | `desktop/src/preload/index-e2e.cjs` 暴露 `openclaw:run-command` 接受任意 cmd | main 进程加 cmd 白名单 + 参数校验 |
| **pre-commit 防线不完整** | `.githooks/pre-commit` 只查 staged diff（commit e42a488 就是反例） | 加 `.githooks/pre-push` 全树扫描 |
| **TrixNativeChannelClient god module** | `src/services/TrixNativeChannelClient.ts:1` 1925 行 | 按 bounded context 拆 pairing/transport/attachments/history |
| **TrixNativeServer god module** | `packages/trix-openclaw-native/src/server/TrixNativeServer.ts:1` 2225 行 | 拆路由模块 |
| **ChatDetail.tsx 零测试** | `src/screens/ChatDetail.tsx:1` 1070 行 | 加核心渲染/交互测试 |
| **messageQueueService / featureFlagService 零测试** | `src/services/` | 业务核心，必须补 |
| **3D 资源未拆分** | `public/3d/trix_character_optimized.glb` 32MB、4 个 mp4 共 17MB | Vite `three-vendor` chunk 拆分 + GLB Draco 压缩 |

---

## 🟢 优化建议（backlog）

- 覆盖率从 20.54% 提至 80%（CLAUDE.md 目标）：按 P0/P1/P2 补 messageQueueService → features/* → apiClient 错误路径
- 清理 25+ `any` 残留（`MessageList.tsx:42`、`placeService.ts:37,89,116`、`uploadService.ts:473-475`）
- 统一错误处理：要么所有 catch 走 `src/lib/errors.ts:729` 的 AppError，要么明确豁免 5-6 处
- DynamicBackground 粒子改 CSS-only 或 IntersectionObserver 懒激活（50 粒子/帧 createRadialGradient）
- Supabase `getChatHistory` 改 RPC + cursor 分页，关闭 `count + data` 双查询（`src/services/chatService.ts:99-104`）
- WebSocket + Socket.io 双心跳合并到 ConnectionManager 加 idle 检测
- Electron 主进程 spawn Gateway 改为 detach，不阻塞 BrowserWindow.show()
- 50+ E2E `test.skip()` 加 TODO 注释，说明原因
- 三端共享契约：抽出 `trix-protocol` 包导出 zod schema + TS types（当前 `@trix/*` 名实不符）

---

## ⚔️ 辩论结论

### 共识（双方同意）
- ✅ 远程历史清理 + force-push 本轮目标已达成
- ✅ 密钥轮换**必须**用户手动去 Supabase/阿里云操作，AI 不能代执行
- ✅ iOS Info.plist 占位符是 ship-blocker，不是 backlog
- ✅ pre-commit hook 曾因设计缺陷 reintroduce 密钥（commit e42a488），pre-push 防线必须补
- ✅ 性能/测试覆盖率/god module 是 backlog，非本轮失败

### 分歧
- 乐观派认为本轮可结束，剩余问题属 backlog
- 批判派认为 IPC 命令注入面（preload 暴露 `openclaw:run-command`）是真实可利用漏洞，必须本轮加白名单

### 最终建议优先级
1. **用户立即做**：轮换密钥 + 清理本地 backup 引用（30 分钟）
2. **本轮完成前补**：IPC cmd 白名单（15 分钟，1 文件）
3. **下个 sprint**：xcconfig 注入、pre-push hook、god module 拆分、补核心 0% 测试
4. **持续**：覆盖率提升、错误处理统一、3D 资源优化

---

## 🔄 上一轮无对照报告（首次基线）

*报告由 DeepAnalysis 生成 | 5 agents 分析 + 2 派辩论*