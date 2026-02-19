# TRIX 3D Companion 全量缺陷审计（P0/P1/P2/P3）

审计日期：2026-02-19  
审计基线：`71e5134`  
审计范围：`src/`、`server/clawbot-channel/`、`deployments/`、`deploy.sh`、`database/*.sql`、环境配置与部署脚本  

## 已确认修复（本次不计入缺陷）

1. `pairWithQR()` 返回值链路已与 `boolean` 对齐，不再出现“扫码永远失败”的类型错配问题。  
证据：`src/contexts/ClawbotChannelContext.tsx`（`pairWithQR` 使用 `result.success`）
2. `addFriend()` 已改为走审批请求流，不再直接双向插入好友关系。  
证据：`src/services/databaseService.ts:141`
3. 快照流程已改为上传真实图片 + 生成提示词 + 跳转会话自动发送。  
证据：`src/screens/Snapshot.tsx:131`、`src/screens/Snapshot.tsx:152`、`src/screens/ChatDetail.tsx:469`

---

## P0（必须优先修复）

### P0-1 Socket 身份未做服务端鉴权，可直接伪造用户或 Bot（越权/劫持）

问题描述：`clawbot-channel` 直接信任客户端上报的 `userId` 和 `deviceId`，没有握手层鉴权中间件。  

证据：
- `server/clawbot-channel/server.js:360`（`app_register` 直接使用 `data.userId`）
- `server/clawbot-channel/server.js:369`（直接 `socket.join(user_${userId})`）
- `server/clawbot-channel/server.js:392`（`check_pairing_status` 直接按传入 `userId` 查状态）
- `server/clawbot-channel/server.js:243`（`bot_request_pairing` 直接信任 `deviceId`，可“恢复”已配对 Bot）

影响：
- 可冒充任意用户查询配对状态、接收/发送 Bot 消息。
- 可冒充 Bot 抢占 `deviceId`，干扰或劫持消息通道。

复现方式（最小）：
1. 任意 Socket 客户端连接服务。
2. 发送 `app_register`，`userId` 填目标用户 UUID。
3. 发送 `check_pairing_status` 或后续消息事件，观察越权结果。

修复建议：
1. Socket 握手强制携带 Supabase JWT，并在服务端验证签名与过期时间。
2. `socket.userId` 必须从已验证 Token 提取，禁止信任 payload 里的 `userId`。
3. Bot 侧增加设备级密钥或签名挑战，不允许仅凭 `deviceId` 恢复会话。

### P0-2 Webhook 鉴权存在“空配置放行”风险

问题描述：当 `CLAWBOT_WEBHOOK_SECRET` 未配置时，`undefined !== undefined` 为 `false`，会导致 webhook 误放行。  

证据：
- `server/clawbot-channel/server.js:120`
- `server/clawbot-channel/server.js:121`

影响：
- 误配置时，外部可伪造 Bot 回调注入消息。

复现方式：
1. 启动服务时不设置 `CLAWBOT_WEBHOOK_SECRET`。
2. 不带 `x-webhook-secret` 请求头访问 `/webhook/clawbot`，请求不会因鉴权被拒绝。

修复建议：
1. 启动时强制校验 `CLAWBOT_WEBHOOK_SECRET` 非空，否则进程拒绝启动。
2. 鉴权逻辑增加显式空值检查，再做常量时间比较。

### P0-3 敏感配置已被提交到仓库（明文密钥/令牌泄露）

问题描述：`.env`、`server/clawbot-channel/.env` 等敏感文件已纳入版本控制，包含 webhook secret 与 OSS AK/SK。  

证据：
- `server/clawbot-channel/.env:18`
- `server/clawbot-channel/.env:26`
- `server/clawbot-channel/.env:27`
- `.env:7`
- `.gitignore:1`（未包含 `.env` 忽略规则）

影响：
- 密钥泄露后可导致 webhook 伪造、OSS 资源滥用、历史版本长期可恢复。

修复建议：
1. 立即轮换已暴露密钥（Webhook secret、OSS AK/SK、网关 token）。
2. 从 Git 历史彻底清理敏感文件。
3. 更新 `.gitignore`，阻止再次提交。

### P0-4 运行时 SQLite 数据文件被提交到仓库（数据泄露风险）

问题描述：运行时数据库文件被跟踪，包含配对和消息数据。  

证据：
- `server/clawbot-channel/data/pairing.db`
- `server/clawbot-channel/data/pairing.db-shm`
- `server/clawbot-channel/data/pairing.db-wal`
- `server/clawbot-channel/config/database.js:5`（默认 DB 在仓库内 `./data/pairing.db`）

影响：
- 用户/设备数据泄露、冲突合并污染、环境间数据串扰。

修复建议：
1. 将 DB 路径迁移到仓库外（如 `/var/lib/...`）。
2. 从版本控制移除历史 DB 文件并加入 ignore。

---

## P1（核心功能/核心链路风险）

### P1-1 `pair_with_token` 先绑定用户再检查 Bot 在线，导致配对状态脏写

证据：
- `server/clawbot-channel/server.js:590`（先 `bindUserToPairing`）
- `server/clawbot-channel/server.js:594`（后检查 `botSockets.has(...)`）

影响：
- Bot 离线时仍可能写入用户绑定，造成“表里已绑定但实际未配对”。

修复建议：
1. 与 `pair_with_code` 一样，先检查 Bot 在线，再执行绑定。
2. 对绑定+完成配对使用事务/原子流程，失败即回滚。

### P1-2 `app_message` 异常分支使用了作用域外 `messageId`，确认回执可能丢失

证据：
- `server/clawbot-channel/server.js:639`（`messageId` 在 `try` 内声明）
- `server/clawbot-channel/server.js:698`（`catch` 中继续引用 `messageId`）

影响：
- 出错时确认事件可能发送失败，客户端会出现“卡发送中/状态不一致”。

修复建议：
1. 将 `messageId` 提升到 `try` 外层作用域。
2. 为异常路径补充回执单测。

### P1-3 会话层 `sendMessage` API 契约不一致，前端错误回滚路径失效

问题描述：Context 暴露 `sendMessage: (...) => void`，但调用方用 `await` 语义期望可捕获失败。  

证据：
- `src/contexts/ClawbotChannelContext.tsx:41`
- `src/contexts/ClawbotChannelContext.tsx:242`
- `src/screens/ChatDetail.tsx:380`

影响：
- `await` 立即返回，发送失败不会进入 `catch`，乐观 UI 回滚不可靠。

修复建议：
1. Context `sendMessage` 改为返回 `Promise<void>` 并向上传播失败。
2. 调用方仅在 Promise resolve 后确认“发送成功”。

### P1-4 上传/签名 URL 接口缺少鉴权，存在资源滥用与数据外泄风险

证据：
- `server/clawbot-channel/server.js:152`（`/oss/signed-url` 无鉴权）
- `server/clawbot-channel/server.js:170`（`/upload` 无鉴权）
- `server/clawbot-channel/server.js:206`（`/upload/base64` 无鉴权）

影响：
- 任意外部请求可上传文件、消耗 OSS 成本、申请签名下载 URL。

修复建议：
1. 为这三类接口统一加 JWT 鉴权中间件。
2. 签名 URL 限制 key 前缀只能访问当前用户命名空间。
3. `/upload/base64` 补齐速率限制与体积限制。

### P1-5 数据库初始化脚本与运行时代码严重漂移，部署易直接故障

问题描述：`database/INIT_ALL.sql` 与前端代码依赖的 schema 不一致。  

证据：
- `database/INIT_ALL.sql:79`（`notifications` 使用 `recipient_id`）
- `src/services/databaseService.ts:200`（代码使用 `notifications.user_id`）
- `database/INIT_ALL.sql:346`（`friend_latest_messages` 仅 `content/created_at`）
- `src/config/supabase.ts:145`（代码要求 `friend_latest_messages` 含 `name/avatar/status/...`）
- `database/INIT_ALL.sql:33`（`friends.status` 默认 `accepted`）
- `src/config/supabase.ts:52`（代码期望 `online/offline/busy/away`）

影响：
- 用错初始化脚本时，好友列表/通知/状态渲染直接异常。

修复建议：
1. 仅保留一个权威初始化入口（建议迁移为版本化 migration）。
2. 删除或显式封存与当前 runtime 不兼容的 SQL。

### P1-6 一键部署/重启仍指向 nanobot 流程，容易误重启错误服务

证据：
- `deploy.sh:24`、`deploy.sh:57`、`deploy.sh:102`
- `deployments/server-setup/restart-services.sh:22`（启动 `cloud_server_advanced.py`）

影响：
- 运维执行 `./deploy.sh restart` 时可能重启已弃用链路，而不是当前 `clawbot-channel`。

修复建议：
1. 从统一部署入口移除 nanobot 选项与调用。
2. `restart-services.sh` 改为只管理当前线上链路（PM2 `clawbot-channel`）。

---

## P2（重要但可并行排期）

### P2-1 `pairingLimiter` 已定义但未生效，WebSocket 配对接口无实际限流

证据：
- `server/clawbot-channel/server.js:80`（定义）
- 全文件仅此一处出现（未应用）

影响：
- 配对码/Token 接口可被高频尝试，增加爆破与资源消耗风险。

修复建议：
1. 在 `pair_with_code`、`pair_with_token` 事件层加基于 IP+socket 的限流。

### P2-2 QR 配对服务内置默认 Token + 本地持久化，密钥管理弱

证据：
- `src/services/clawbotPairingService.ts:47`
- `src/services/clawbotPairingService.ts:58`
- `src/screens/QRCodePairing.tsx:81`

影响：
- 默认 Token 泄露后可复用，`localStorage` 令牌易被前端注入脚本读取。

修复建议：
1. 移除硬编码默认 Token。
2. 改为一次性短时令牌，不在 `localStorage` 长驻。

### P2-3 环境模板与生产配置含硬编码地址/Token，跨环境易误配

证据：
- `.env.example:43`、`.env.example:44`、`.env.example:49`
- `.env.production:27`（`ws://127.0.0.1:18789`）

影响：
- 部署后连接失败或误连本地环回；模板泄露内网地址与 token。

修复建议：
1. `.env.example` 仅保留占位符，不放真实地址/token。
2. 生产环境变量由 CI/CD 注入，不提交固定值。

### P2-4 后端依赖存在高危审计项（供应链风险）

证据（命令）：`npm audit --omit=dev --json`（`server/clawbot-channel`）  
结果：`9 high`，集中在 `sqlite3` 依赖链（`node-gyp/tar/glob`）。  

影响：
- 安装/构建阶段安全风险上升，长期维护成本高。

修复建议：
1. 升级 `sqlite3` 及依赖链，或替换为无原生编译依赖方案。
2. 将 `npm audit` 加入 CI 阻断阈值。

### P2-5 缺少自动化测试脚本，回归风险完全依赖人工验证

证据：
- `package.json:6`（仅 `dev/build/preview`）
- `server/clawbot-channel/package.json:6`（无 `test`）

影响：
- 配对、消息、鉴权类回归容易在上线后暴露。

修复建议：
1. 至少补充配对链路和消息 ACK 的集成测试。
2. 前端补关键页面 smoke 测试。

---

## P3（体验/维护性问题）

### P3-1 nanobot 遗留代码与文档仍大量存在，和当前架构定位冲突

证据：
- `deploy.sh:24`
- `server/cloud_server_advanced.py:5`
- `server/README.md:31`
- `docs/deployment-guides/SERVER_PORTS.md:41`

影响：
- 新同学容易按旧链路部署，导致排障方向偏离。

修复建议：
1. 将 nanobot 相关代码迁到明确 `archive/`，入口脚本完全移除引用。

### P3-2 `.gitignore` 含异常字符且规则不完整

证据：
- `.gitignore:25`
- `.gitignore:26`
- `.gitignore:27`

影响：
- 可读性差，且无法阻止敏感配置和运行时文件再次入库。

修复建议：
1. 清理异常字符。
2. 明确加入 `.env`、`server/clawbot-channel/.env`、`server/clawbot-channel/data/` 等忽略规则。

### P3-3 前端主包体积过大，首屏加载压力高

证据（命令）：`npm run build`  
结果：`dist/assets/index-*.js` 约 `1204 KB`（minified），构建已给出 chunk size warning。  

影响：
- 低端移动网络下首屏慢、交互可用时间变长。

修复建议：
1. 进行路由级代码分割。
2. 将重组件/图表/地图按需加载。

### P3-4 Token Monitor 仍有未完成功能点

证据：
- `src/screens/TokenMonitor.tsx:294`（`TODO: 打开会话详情弹窗`）

影响：
- 诊断链路信息深挖能力不足。

修复建议：
1. 补齐会话详情弹窗与 drill-down。

---

## 执行验证记录

1. 前端构建：`npm run build`，通过。  
2. 根项目漏洞审计：`npm audit --omit=dev`，`0` 条漏洞。  
3. `clawbot-channel` 漏洞审计：`npm audit --omit=dev`，`9 high`。  
4. 自动化测试脚本：前后端均未提供 `test` script。  

---

## 建议修复顺序（执行优先级）

1. 先处理全部 P0（鉴权/密钥/数据泄露）。  
2. 再处理 P1（配对状态一致性、消息确认链路、部署入口）。  
3. P2 与 P3 并行推进，先清理 nanobot 遗留和环境模板。  

