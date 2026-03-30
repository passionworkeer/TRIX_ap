# TRIX Native Channel 交付总结

更新时间：2026-03-31 03:08:10 CST  
分支：`codex/native-flow-e2e-fixes`  
本次整理时看到的提交：`e710a32`

## 1. 当前结论

这次改造的主结论是：

- `trix-native` 原生 channel 架构已经在本机跑通。
- 本机 `OpenClaw Gateway + trix-native plugin + Trix Service + Web` 的真实链路已经验证通过。
- slash 命令、图片上传、并发消息、服务端幂等、Pairing 页面、聊天页基础 E2E 都已经有实际跑通结果。
- 还不能直接视为“生产完全签收”，因为长时间 soak、iOS 真机、远端 `trix.love` 全链路还没全部验完。

## 2. 当前架构

### 2.1 拓扑

- 用户电脑本机运行：
  - OpenClaw Gateway
  - `trix-native` 原生插件
- Trix Service 提供：
  - pairing
  - `/api/messages`
  - `/api/uploads`
  - `/api/service/*`
  - websocket 推送
- Web 端负责：
  - 用户登录
  - pairing / claim
  - 会话状态持久化

### 2.2 已对齐的核心契约

- 插件是原生 Channel Plugin，不是外部 relay 主通道。
- 配置入口是 `channels.trix-native`。
- pairing 与 account 是绑定关系，不是全局混用。
- 图片/附件通过 service URL 流转，不是临时前端拼接。
- slash 命令与普通消息都走同一条 native channel 链路。

## 3. 本轮确认过的代码变更

本轮实际确认并保留的核心代码改动只有一个文件：

- [tests/load/native-channel-pressure.mjs](/Users/jiajingqiu/TRIX_ap/tests/load/native-channel-pressure.mjs)

这次修改做了 4 件事：

- 增加 `runTag`，隔离每轮压测。
- pairing label 按轮次隔离。
- forwarded IP seed 按轮次隔离。
- burst slash 场景改成精确 `/status`，不再用 `/status xxx`。
- rate-limit 场景不再复用固定 IP，避免跨轮污染。

这样修完后，压测结果才可信，不会再被脚本本身误导。

## 4. 已跑通的测试结果

### 4.1 原生包测试

命令：

```bash
npm --prefix packages/trix-openclaw-native run test
```

结果：

- `6` 个测试文件通过
- `40/40` 测试通过

覆盖内容包括：

- pairing create / claim
- inspectAccount
- outbound retry
- slash 路由
- attachment servicePath 下载
- service reply 幂等
- websocket replay
- legacy agent websocket 拒绝
- rate limiting
- TTS 鉴权

### 4.2 压力测试

命令：

```bash
node tests/load/native-channel-pressure.mjs
```

最近一次稳定结果：

- `fanout_status`
  - `8/8` 发送成功
  - `8/8` 收到回复
  - 回复 p95 约 `1.7s`
- `burst_same_conversation_status`
  - `8/8` 成功
  - `observedNewOutbound = 8`
- `image_fanout`
  - `3/3` 上传成功
  - `3/3` 发送成功
  - `3/3` 收到回复
- `service_idempotency`
  - 10 次并发同 key
  - 最终只落 1 条 outbound
- `rate_limit_user_messages`
  - `404 = 120`
  - `429 = 5`

### 4.3 插件与通道诊断

命令：

```bash
openclaw plugins doctor
openclaw channels status --probe --json
```

结果：

- `plugins doctor`：`No plugin issues detected`
- `channels status --probe --json`：
  - `running = true`
  - `connected = true`
  - `probe.ok = true`

### 4.4 Playwright 页面测试

命令：

```bash
npx playwright test src/e2e/pairing.spec.ts --project=chromium --reporter=line
npx playwright test src/e2e/chat-detail.spec.ts --project=chromium --reporter=line --workers=1 --timeout=20000
```

结果：

- Pairing 页面：`12/12` 通过
- Chat Detail 页面：`6/6` 通过

说明：

- `chat-detail.spec.ts` 在默认并发下偏慢，单 worker 重跑后通过。

### 4.5 Web 真实链路自动化

本轮真实验证目标：

- 本地 Web：`http://127.0.0.1:4173`
- 本地 Service：`http://127.0.0.1:8788`

使用脚本：

```bash
node tests/e2e/local-native-flow.cjs
```

实际跑过的链路：

- 页面手动输入配对码
- `/status` 发送与收回复
- 同一会话连续多次 `/status`
- 图片上传 + 模型回复
- 同一会话连续 3 条普通文本

实测结果：

- pairing 成功进入 `#/chat/clawbot`
- `/status` 能正常收到 OpenClaw 回复
- 图片上传走通：
  - `POST /api/uploads`
  - `POST /api/messages`
- 图片最终通过签名 attachment URL 渲染
- 模型能正确描述上传图片
- 连续普通文本在本次实测中返回了多条回复

## 5. 本轮发现的重要现象

### 5.1 本地原生链路已经是真实可用状态

已经被证明可用的路径是：

- 本机 OpenClaw Gateway
- 本机 `trix-native` 插件
- 本机 Trix Service `127.0.0.1:8788`
- 本机 Web 前端 `127.0.0.1:4173`

这说明原生架构不是“方向正确但没跑通”，而是本机整条链路已经能工作。

### 5.2 `openclaw channels login` 有过一次偶发 500

出现过一次：

```text
Failed to create pairing QR: 500 Internal Server Error
```

但后续现象是：

- 重试后恢复正常
- 直接请求 `POST /api/pairings` 返回 `201`

当前判断：

- 更像偶发问题
- 不像 service 已经整体坏掉
- 但如果要做生产验收，这个点必须继续追根因

### 5.3 `openclaw status --deep` 不适合当自动化 smoke 命令

实测现象：

- 会进入交互式状态
- 不适合无人值守自动化

建议用：

```bash
openclaw channels status --probe --json
```

### 5.4 本机 OpenClaw 还有一条无关认证噪音

曾出现：

```text
openai-codex refresh_token_reused
```

影响：

- 不影响 `trix-native` 本身验证
- 说明这台机器本地某个 OpenClaw OAuth 态是脏的

## 6. 还没有完全签收的部分

以下内容还不能算完成：

- `8~24h` soak
- iOS 真机 E2E
- 远端 `trix.love` 与本机 OpenClaw 的完整正式链路
- `channels login` 偶发 500 根因修复
- 备份 / 恢复演练
- 整机重启后的恢复验证

## 7. 本地复现步骤

### 7.1 启动本地 Trix Service

```bash
node packages/trix-openclaw-native/dist/cli.js \
  server start \
  --host 127.0.0.1 \
  --port 8788 \
  --storage-dir .trix-local-e2e \
  --public-base-url http://127.0.0.1:8788 \
  --service-token trix-local-e2e-token
```

### 7.2 检查 OpenClaw 是否识别通道

```bash
openclaw channels status --probe --json
openclaw plugins doctor
```

### 7.3 启动指向本地 service 的前端

```bash
VITE_TRIX_NATIVE_SERVER_URL=http://127.0.0.1:8788 \
VITE_TRIX_NATIVE_PUBLIC_URL=http://127.0.0.1:8788 \
npm run dev -- --host 127.0.0.1 --port 4173
```

### 7.4 生成配对码

```bash
openclaw channels login --channel trix-native --account default --verbose
```

期望输出：

- pairing code
- claim URL
- 终端 QR

### 7.5 浏览器完成配对

打开：

- `http://127.0.0.1:4173/#/pairing`

然后：

- 进入手动输入模式
- 输入 6 位 pairing code
- 成功后进入 `#/chat/clawbot`

### 7.6 发送最小验证消息

建议 smoke：

- `/status`
- 上传一张图并发送 `请描述这张图片`
- 连续发送 3 条普通文本

## 8. 下一步建议

建议优先级：

1. 定位并修复 `openclaw channels login` 偶发 500。
2. 跑一次 `8h+` 本地 soak。
3. 把同样一组验证流程迁到 `trix.love` 正式链路。
4. 补 iOS 真机验证。
5. 固化一套稳定回归脚本，至少覆盖：
   - pairing
   - slash
   - 图片上传
   - reconnect / replay

## 9. 最终判断

目前已经可以明确说：

- 原生架构是对的
- 本机原生链路是真正跑通的
- plugin / service / web 的整合已经不是“纸面实现”，而是有真实自动化验证的

目前还不能说：

- 已完成完整生产签收
- 已证明长时间稳定性
- iOS 与远端正式域名已经全部验完
