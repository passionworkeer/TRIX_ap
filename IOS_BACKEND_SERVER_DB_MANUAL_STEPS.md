# iOS + Backend 手动联调与数据库操作清单

本文档用于你在本机/服务器上执行我在沙箱里无法完成的“长期运行服务 + 真实外部依赖”操作。

## 1. 后端启动前检查

在 `server/clawbot-channel/.env` 确认至少包含：

- `PORT=8765`
- `SUPABASE_URL=...`
- `SUPABASE_ANON_KEY=...` 或服务端使用的 key
- `SUPABASE_SERVICE_ROLE_KEY=...`（如果你的路由需要）
- `JWT_SECRET=...`

可选（未配置时服务可启动，但对应能力不可用）：

- OSS 上传：`ALIYUN_OSS_*`
- TTS/AI 相关第三方 key

## 2. 后端安装与启动

```bash
cd /Users/jiajingqiu/TRIX_ap/server/clawbot-channel
npm install
npm run dev
```

如果你不是开发模式：

```bash
npm run start
```

## 3. 数据库检查（SQLite 本地）

后端会在启动时初始化 SQLite 表。
你可以执行：

```bash
cd /Users/jiajingqiu/TRIX_ap/server/clawbot-channel
sqlite3 data/clawbot.db ".tables"
```

确认包含：

- `oauth_accounts`
- `payment_orders`
- `user_subscriptions`
- `messages`
- `pairings`

## 4. 关键接口验收（建议）

> 先注册或登录拿到 token，再测受保护接口。

### 4.1 Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `GET /api/auth/me`
- `POST /api/auth/logout`

### 4.2 OAuth 账户管理

- `GET /api/user/oauth/accounts`
- `POST /api/user/oauth/link`
- `POST /api/user/oauth/unlink`

### 4.3 支付/订阅

- `POST /api/payments/purchase-points`
- `POST /api/payments/verify-receipt`
- `GET /api/payments/orders`
- `GET /api/payments/subscription`
- `POST /api/payments/restore`

### 4.4 Socket 通道

确保服务监听 `8765` 后，iOS 端可连接：

- 连接事件：`connect/disconnect/reconnect`
- 配对：`pair_with_code` / `pair_with_token`
- 消息：`app_message` + `message_sent/message_failed`
- 心跳：`ping/pong`

### 4.5 好友推荐与加好友

- `GET /api/friends/recommendations?limit=8`
- `POST /api/friends`
- `GET /api/friends`

说明：
- 推荐接口现在会基于 `profiles` + `friends` 计算“未添加好友”的候选用户。
- 返回字段：`id/name/avatar_url/mutual_friends/is_online`，iOS 已接入并用于聊天页“推荐好友”。

## 5. iOS 端联调步骤

1. 在 iOS 配置里把 API Base URL 指向你的后端（真机通常不能用 `localhost`，需用局域网 IP）。
2. 先验收邮箱注册登录。
3. 验收资料编辑保存（Profile -> Save）。
4. 验收相机页相册按钮可选图并进入上传流。
5. 验收 Study Timer 设置页（齿轮）可修改时长。
6. 验收 TRIX Bot 配对 + 实时消息通路。
7. 验收支付页（StoreKit 沙盒账号）购买/恢复。
8. 验收聊天页“推荐好友”区块：应能加载推荐并点击“添加”后写入好友关系。
9. 验收地图页点击好友标签：应弹出好友详情 sheet（状态、学习状态、坐标）。

## 6. 已修复但你本机需重点复核项

- Socket.IO iOS 客户端已从 stub 改为真实实现。
- StoreKitService 的恢复购买、交易历史、订阅状态、收据数据已从 stub 改为真实 StoreKit 2 流程。
- 后端 `extended.js`、`supplement.js` 的阻断性语法错误已修复。

## 7. 仍需你提供真实第三方配置的项目

这些不是代码缺失，而是凭据/平台配置问题：

- WeChat 正式 SDK（`WXApi`）接入与 AppID/Universal Link
- StoreKit 生产商品、沙盒账号、App Store Connect 配置
- Supabase 生产环境 RLS/表结构与密钥权限
- OSS 生产 bucket 凭据

## 8. 本轮已执行的数据库实操结果

### 8.1 SQLite（本地）

已执行：

- 读取表：`oauth_accounts/payment_orders/user_subscriptions`
- 插入 OAuth 测试记录
- 查询回读
- 删除清理

结果：读写均成功，测试记录已清理（无残留）。

### 8.2 Supabase（远端）

已执行：

- `profiles` 读操作（`head + count`）成功，返回 `count=11`
- 匿名 key 直写 `profiles` 被 RLS 拒绝（`401 new row violates row-level security policy`）

结论：

- 当前后端使用的是 `anon` key（非 `service_role`），可读能力正常；
- 写入受 RLS 约束，生产联调时请用 `SUPABASE_SERVICE_ROLE_KEY` 或按策略放行对应写入。

### 8.3 本轮 Supabase 结构差异修复（已完成）

实测发现当前 Supabase 线上结构与历史代码不一致：

- `chat_rooms`、`chat_room_participants` 不存在
- `friends` 表不包含 `name/avatar_url/bio` 列

已处理：

- 聊天相关 API 改为 SQLite 本地表驱动（`chat_rooms_local`、`chat_room_participants_local`、`chat_messages_local`）
- `friends` 接口改为 `friends + profiles` 组合返回，兼容 iOS 模型
- `friends` 新增兼容 `friendId` 与 `friend_id` 两种请求字段

## 9. 本轮联调阻塞点（需要你侧配合）

- 我在本机调用 `POST /api/auth/register` 多次后遇到 Supabase `email rate limit exceeded`，导致无法继续自动完成“注册->登录->带 token 调推荐/加好友”整链路冒烟。
- 你可以在 Supabase 控制台临时放宽 auth 邮件频率，或提供一个可用测试账号，我可以继续把 token 鉴权链路全自动验完。
