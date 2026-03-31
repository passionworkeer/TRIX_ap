# TRIX 三端 OWASP Top 10 审计

日期: 2026-03-31

范围:
- Web: `/src`, `/public`
- Desktop: `/desktop`
- Native services: `/packages/trix-openclaw-native`, `/packages/trix-canvas-service`
- iOS: `/ios/TRIX3DCompanion`

方法:
- 人工源码审计
- 针对 token / secret / localStorage / IPC / shell / CORS / SSRF / 明文传输的定向检索
- 多个 subagent 交叉检查，最终结论仅保留人工复核通过的问题

## Remediation Update

状态:
- 本轮高风险修复已在本地完成并复核。
- 下方 `Findings` 保留的是审计时发现的问题类型，便于回溯；其中多数已在同日完成收口。

已完成修复:
- Canvas:
  - 已补鉴权入口、cookie 会话、允许源白名单。
  - 已去掉客户端可控 `result_url` 写入，并对媒体 URL 做前后端双向净化。
  - 2026-04-01：500 错误已统一脱敏，不再把 ffmpeg / 内部路径细节回给客户端。
  - 2026-04-01：已禁止 `?token=` / `#token=` URL 自动登录，改为仅允许页面内手动输入 token。
  - 2026-04-01：proxy 的 `tasks` / `sessions` 已增加容量上限与终态淘汰，降低内存堆积风险。
- Pairing / Native:
  - `PairingService` 改为强制 `secret`，客户端删除“去掉 secret 重试”。
  - WebSocket 不再把 `clientToken` 放在 query string，改为子协议传输。
  - `clientToken` 从 `localStorage` 迁到 `sessionStorage`，配对页与 ops 配对页都已去敏。
  - Native attachment 已补本地路径默认禁用、私网/回环/私有 DNS 拦截、远端大小上限。
  - 2026-04-01：`X-Forwarded-For` 仅在请求来自回环或显式信任代理时才被采信，限流与 allowlist 不再无条件信任客户端伪造头。
- Desktop:
  - `openclaw` / `clawhub` / `gateway` 启动链路已去掉 `shell: true`。
  - renderer 不再暴露通用 `configRead` / `configWrite`。
  - `config:read-section` / `config:write-section` 已改为 section allowlist，并对 token/secret/password/webhook 做脱敏读取与保值写回。
  - Supabase auth session 改为主进程内存态，不再明文持久化到磁盘，也不再把完整 session 回传 renderer。
- iOS:
  - Debug 默认地址已切到安全回退，且只允许通过环境变量覆写到 `https/wss` 或本地回环地址。
  - 已删除对公网 IP `TRIX_SERVER_HOST` 的 ATS 明文例外。
- Debug 页面:
  - `public/env-check.html` 现仅允许本地访问，且不再显示 token 片段。

验证:
- `npm --prefix packages/trix-openclaw-native test -- pairing.test.ts server.test.ts`
- `npx vitest run src/services/TrixNativeChannelClient.session-switch.test.ts`
- `npm run type-check`
- `npm --prefix desktop run build:desktop`
- `plutil -lint ios/TRIX3DCompanion/Resources/Info.plist`
- 额外复核:
  - 已再次检索 `shell: true`、`TRIX_SERVER_HOST`、`configRead()` / `configWrite()` 等高风险模式，源码范围内未再命中。

仍未覆盖:
- 未执行完整 `xcodebuild` / iOS Simulator / 真机回归。
- 未执行联网黑盒 DAST / 渗透测试。
- Canvas 鉴权门禁、受保护媒体读取、私网 URL 拒绝路径的 E2E / 压测仍偏少。

## Findings

### 1. Critical: Canvas 服务未鉴权，配合 `CORS *` 与未转义 `result_url` 可形成存储型 XSS

OWASP:
- A01 Broken Access Control
- A03 Injection

证据:
- [/Users/jiajingqiu/TRIX_ap/packages/trix-canvas-service/server.js#L67](/Users/jiajingqiu/TRIX_ap/packages/trix-canvas-service/server.js#L67)
- [/Users/jiajingqiu/TRIX_ap/packages/trix-canvas-service/server.js#L68](/Users/jiajingqiu/TRIX_ap/packages/trix-canvas-service/server.js#L68)
- [/Users/jiajingqiu/TRIX_ap/packages/trix-canvas-service/server.js#L1205](/Users/jiajingqiu/TRIX_ap/packages/trix-canvas-service/server.js#L1205)
- [/Users/jiajingqiu/TRIX_ap/packages/trix-canvas-service/server.js#L1339](/Users/jiajingqiu/TRIX_ap/packages/trix-canvas-service/server.js#L1339)
- [/Users/jiajingqiu/TRIX_ap/packages/trix-canvas-service/server.js#L1357](/Users/jiajingqiu/TRIX_ap/packages/trix-canvas-service/server.js#L1357)
- [/Users/jiajingqiu/TRIX_ap/packages/trix-canvas-service/server.js#L1383](/Users/jiajingqiu/TRIX_ap/packages/trix-canvas-service/server.js#L1383)
- [/Users/jiajingqiu/TRIX_ap/packages/trix-canvas-service/server.js#L1397](/Users/jiajingqiu/TRIX_ap/packages/trix-canvas-service/server.js#L1397)
- [/Users/jiajingqiu/TRIX_ap/packages/trix-canvas-service/public/canvas.html#L421](/Users/jiajingqiu/TRIX_ap/packages/trix-canvas-service/public/canvas.html#L421)
- [/Users/jiajingqiu/TRIX_ap/packages/trix-canvas-service/public/canvas.html#L523](/Users/jiajingqiu/TRIX_ap/packages/trix-canvas-service/public/canvas.html#L523)

影响:
- 任意来源网页都能直接调用 Canvas API。
- 攻击者可写入恶意 `result_url`。
- Canvas 页面会把该值拼进 `<img src="...">`，未做属性级转义，能触发存储型 XSS。

### 2. Critical: Canvas 上传接口可被用于 SSRF

OWASP:
- A10 SSRF

证据:
- [/Users/jiajingqiu/TRIX_ap/packages/trix-canvas-service/server.js#L1292](/Users/jiajingqiu/TRIX_ap/packages/trix-canvas-service/server.js#L1292)
- [/Users/jiajingqiu/TRIX_ap/packages/trix-canvas-service/server.js#L1304](/Users/jiajingqiu/TRIX_ap/packages/trix-canvas-service/server.js#L1304)
- [/Users/jiajingqiu/TRIX_ap/packages/trix-canvas-service/server.js#L651](/Users/jiajingqiu/TRIX_ap/packages/trix-canvas-service/server.js#L651)
- [/Users/jiajingqiu/TRIX_ap/packages/trix-canvas-service/server.js#L652](/Users/jiajingqiu/TRIX_ap/packages/trix-canvas-service/server.js#L652)

影响:
- 远端可指定 `external_url` 让服务端主动请求任意 URL。
- 当前无鉴权、无协议白名单、无内网地址限制、无 metadata 地址过滤。

### 3. Critical: Pairing secret 可被降级绕过

OWASP:
- A07 Identification and Authentication Failures
- A01 Broken Access Control

证据:
- [/Users/jiajingqiu/TRIX_ap/packages/trix-openclaw-native/src/pairing/PairingService.ts#L95](/Users/jiajingqiu/TRIX_ap/packages/trix-openclaw-native/src/pairing/PairingService.ts#L95)
- [/Users/jiajingqiu/TRIX_ap/packages/trix-openclaw-native/src/pairing/PairingService.ts#L98](/Users/jiajingqiu/TRIX_ap/packages/trix-openclaw-native/src/pairing/PairingService.ts#L98)
- [/Users/jiajingqiu/TRIX_ap/src/services/TrixNativeChannelClient.ts#L834](/Users/jiajingqiu/TRIX_ap/src/services/TrixNativeChannelClient.ts#L834)
- [/Users/jiajingqiu/TRIX_ap/src/services/TrixNativeChannelClient.ts#L842](/Users/jiajingqiu/TRIX_ap/src/services/TrixNativeChannelClient.ts#L842)
- [/Users/jiajingqiu/TRIX_ap/public/pairing.html#L229](/Users/jiajingqiu/TRIX_ap/public/pairing.html#L229)
- [/Users/jiajingqiu/TRIX_ap/public/pairing.html#L231](/Users/jiajingqiu/TRIX_ap/public/pairing.html#L231)

影响:
- 服务端仅在请求显式携带 `secret` 时才校验。
- Web 与主站客户端在收到 `invalid pairing secret` 后会自动去掉 `secret` 重试。
- 结果是 secret 失去强制性，知道 pairing code 就可能 claim 成功。

### 4. High: Web 端会话与 client token 持久化到 `localStorage`，且 client token 暴露在 WebSocket URL

OWASP:
- A07 Identification and Authentication Failures

证据:
- [/Users/jiajingqiu/TRIX_ap/src/config/supabase.ts#L7](/Users/jiajingqiu/TRIX_ap/src/config/supabase.ts#L7)
- [/Users/jiajingqiu/TRIX_ap/src/config/supabase.ts#L9](/Users/jiajingqiu/TRIX_ap/src/config/supabase.ts#L9)
- [/Users/jiajingqiu/TRIX_ap/src/services/TrixNativeChannelClient.ts#L423](/Users/jiajingqiu/TRIX_ap/src/services/TrixNativeChannelClient.ts#L423)
- [/Users/jiajingqiu/TRIX_ap/src/services/TrixNativeChannelClient.ts#L632](/Users/jiajingqiu/TRIX_ap/src/services/TrixNativeChannelClient.ts#L632)
- [/Users/jiajingqiu/TRIX_ap/src/services/TrixNativeChannelClient.ts#L738](/Users/jiajingqiu/TRIX_ap/src/services/TrixNativeChannelClient.ts#L738)
- [/Users/jiajingqiu/TRIX_ap/public/pairing.html#L243](/Users/jiajingqiu/TRIX_ap/public/pairing.html#L243)
- [/Users/jiajingqiu/TRIX_ap/public/pairing.html#L281](/Users/jiajingqiu/TRIX_ap/public/pairing.html#L281)
- [/Users/jiajingqiu/TRIX_ap/packages/trix-openclaw-native/src/server/TrixNativeServer.ts#L734](/Users/jiajingqiu/TRIX_ap/packages/trix-openclaw-native/src/server/TrixNativeServer.ts#L734)
- [/Users/jiajingqiu/TRIX_ap/packages/trix-openclaw-native/src/server/TrixNativeServer.ts#L1154](/Users/jiajingqiu/TRIX_ap/packages/trix-openclaw-native/src/server/TrixNativeServer.ts#L1154)

影响:
- 浏览器本地存储、扩展、XSS、日志或代理都可能拿到 `clientToken`。
- 服务端对消息接口依赖 `x-trix-client-token`，令牌泄漏可直接扩大为会话接管。
- WebSocket 查询串里的敏感参数也会增加日志泄漏面。

### 5. High: Desktop 主进程存在命令注入链

OWASP:
- A03 Injection

证据:
- [/Users/jiajingqiu/TRIX_ap/desktop/src/main/ipc.ts#L317](/Users/jiajingqiu/TRIX_ap/desktop/src/main/ipc.ts#L317)
- [/Users/jiajingqiu/TRIX_ap/desktop/src/main/ipc.ts#L44](/Users/jiajingqiu/TRIX_ap/desktop/src/main/ipc.ts#L44)
- [/Users/jiajingqiu/TRIX_ap/desktop/src/preload/index.js#L64](/Users/jiajingqiu/TRIX_ap/desktop/src/preload/index.js#L64)
- [/Users/jiajingqiu/TRIX_ap/desktop/src/main/openclaw.ts#L323](/Users/jiajingqiu/TRIX_ap/desktop/src/main/openclaw.ts#L323)
- [/Users/jiajingqiu/TRIX_ap/desktop/src/main/openclaw.ts#L325](/Users/jiajingqiu/TRIX_ap/desktop/src/main/openclaw.ts#L325)
- [/Users/jiajingqiu/TRIX_ap/desktop/src/main/openclaw.ts#L326](/Users/jiajingqiu/TRIX_ap/desktop/src/main/openclaw.ts#L326)
- [/Users/jiajingqiu/TRIX_ap/desktop/src/main/openclaw.ts#L348](/Users/jiajingqiu/TRIX_ap/desktop/src/main/openclaw.ts#L348)

影响:
- renderer 输入 `query` 只做长度限制。
- 主进程最终以 `spawn(..., { shell: true })` 执行 `clawhub search`。
- Node 已明确警告这种模式下参数只会拼接，不会安全转义，可形成 shell 注入。

### 6. High: Desktop renderer 可直接读写 `openclaw.json`，连同网关与 native token 一并暴露

OWASP:
- A01 Broken Access Control
- A05 Security Misconfiguration

证据:
- [/Users/jiajingqiu/TRIX_ap/desktop/src/preload/index.js#L206](/Users/jiajingqiu/TRIX_ap/desktop/src/preload/index.js#L206)
- [/Users/jiajingqiu/TRIX_ap/desktop/src/preload/index.js#L207](/Users/jiajingqiu/TRIX_ap/desktop/src/preload/index.js#L207)
- [/Users/jiajingqiu/TRIX_ap/desktop/src/preload/index.js#L209](/Users/jiajingqiu/TRIX_ap/desktop/src/preload/index.js#L209)
- [/Users/jiajingqiu/TRIX_ap/desktop/src/main/ipc.ts#L1580](/Users/jiajingqiu/TRIX_ap/desktop/src/main/ipc.ts#L1580)
- [/Users/jiajingqiu/TRIX_ap/desktop/src/main/ipc.ts#L2713](/Users/jiajingqiu/TRIX_ap/desktop/src/main/ipc.ts#L2713)
- [/Users/jiajingqiu/TRIX_ap/desktop/src/main/ipc.ts#L2724](/Users/jiajingqiu/TRIX_ap/desktop/src/main/ipc.ts#L2724)
- [/Users/jiajingqiu/TRIX_ap/desktop/src/main/ipc.ts#L2750](/Users/jiajingqiu/TRIX_ap/desktop/src/main/ipc.ts#L2750)
- [/Users/jiajingqiu/TRIX_ap/desktop/src/main/gateway.ts#L708](/Users/jiajingqiu/TRIX_ap/desktop/src/main/gateway.ts#L708)

影响:
- preload 向 renderer 暴露了 `configRead*` / `configWrite*`。
- `openclaw.json` 中同时承载网关 token 与 native channel token。
- 任何 renderer 侧 XSS 或未受信 UI 代码，都能直接读取或改写这些凭据。

### 7. High: Native attachment 输入可被用于服务端代读本地文件或代请求任意 URL

OWASP:
- A10 SSRF
- A01 Broken Access Control

证据:
- [/Users/jiajingqiu/TRIX_ap/packages/trix-openclaw-native/src/attachments/AttachmentStore.ts#L143](/Users/jiajingqiu/TRIX_ap/packages/trix-openclaw-native/src/attachments/AttachmentStore.ts#L143)
- [/Users/jiajingqiu/TRIX_ap/packages/trix-openclaw-native/src/attachments/AttachmentStore.ts#L148](/Users/jiajingqiu/TRIX_ap/packages/trix-openclaw-native/src/attachments/AttachmentStore.ts#L148)
- [/Users/jiajingqiu/TRIX_ap/packages/trix-openclaw-native/src/attachments/AttachmentStore.ts#L152](/Users/jiajingqiu/TRIX_ap/packages/trix-openclaw-native/src/attachments/AttachmentStore.ts#L152)
- [/Users/jiajingqiu/TRIX_ap/packages/trix-openclaw-native/src/server/TrixNativeServer.ts#L878](/Users/jiajingqiu/TRIX_ap/packages/trix-openclaw-native/src/server/TrixNativeServer.ts#L878)
- [/Users/jiajingqiu/TRIX_ap/packages/trix-openclaw-native/src/server/TrixNativeServer.ts#L1020](/Users/jiajingqiu/TRIX_ap/packages/trix-openclaw-native/src/server/TrixNativeServer.ts#L1020)

影响:
- 附件输入接受 `localPath` 与 `url`。
- 当前既没有路径根目录约束，也没有协议/目标地址限制。
- 拿到有效 token 的调用方可借 native server 读本地文件或访问任意 URL。

### 8. Medium-High: Desktop 把完整 Supabase session 明文持久化到 `electron-store`

OWASP:
- A02 Cryptographic Failures
- A07 Identification and Authentication Failures

证据:
- [/Users/jiajingqiu/TRIX_ap/desktop/src/main/ipc.ts#L375](/Users/jiajingqiu/TRIX_ap/desktop/src/main/ipc.ts#L375)
- [/Users/jiajingqiu/TRIX_ap/desktop/src/main/ipc.ts#L381](/Users/jiajingqiu/TRIX_ap/desktop/src/main/ipc.ts#L381)
- [/Users/jiajingqiu/TRIX_ap/desktop/src/main/ipc.ts#L389](/Users/jiajingqiu/TRIX_ap/desktop/src/main/ipc.ts#L389)
- [/Users/jiajingqiu/TRIX_ap/desktop/src/main/ipc.ts#L417](/Users/jiajingqiu/TRIX_ap/desktop/src/main/ipc.ts#L417)

影响:
- access token / refresh token 明文落盘。
- 同一进程内 IPC 还能把 session 再读回 renderer。

### 9. Medium-High: iOS Debug 默认连接明文公网地址，ATS 对公网 IP 放行不安全 HTTP

OWASP:
- A02 Cryptographic Failures
- A05 Security Misconfiguration

证据:
- [/Users/jiajingqiu/TRIX_ap/ios/TRIX3DCompanion/Core/Network/APIEndpoints.swift#L62](/Users/jiajingqiu/TRIX_ap/ios/TRIX3DCompanion/Core/Network/APIEndpoints.swift#L62)
- [/Users/jiajingqiu/TRIX_ap/ios/TRIX3DCompanion/Core/Network/APIEndpoints.swift#L65](/Users/jiajingqiu/TRIX_ap/ios/TRIX3DCompanion/Core/Network/APIEndpoints.swift#L65)
- [/Users/jiajingqiu/TRIX_ap/ios/TRIX3DCompanion/Core/Network/APIEndpoints.swift#L86](/Users/jiajingqiu/TRIX_ap/ios/TRIX3DCompanion/Core/Network/APIEndpoints.swift#L86)
- [/Users/jiajingqiu/TRIX_ap/ios/TRIX3DCompanion/Core/Network/APIEndpoints.swift#L89](/Users/jiajingqiu/TRIX_ap/ios/TRIX3DCompanion/Core/Network/APIEndpoints.swift#L89)
- [/Users/jiajingqiu/TRIX_ap/ios/TRIX3DCompanion/Resources/Info.plist#L58](/Users/jiajingqiu/TRIX_ap/ios/TRIX3DCompanion/Resources/Info.plist#L58)
- [/Users/jiajingqiu/TRIX_ap/ios/TRIX3DCompanion/Resources/Info.plist#L60](/Users/jiajingqiu/TRIX_ap/ios/TRIX3DCompanion/Resources/Info.plist#L60)

影响:
- Debug / 测试构建默认走 `ws://TRIX_SERVER_HOST:8765` 与 `http://TRIX_SERVER_HOST:8788`。
- ATS 明确允许对该公网 IP 进行不安全 HTTP 连接。
- 配对与消息流量在测试环境中可能暴露于明文链路。

## Open Questions

- Canvas 服务是否已经只打算在内网或受信网关后运行。如果会直接暴露公网，上述第 1 和第 2 条优先级应继续上调。
- Desktop 的 `configRead*` / `configWrite*` 是否确实对所有 renderer 页面开放。如果后续只给受信设置页使用，也仍建议按最小权限拆分。
- Native attachment 的 `localPath` 能否被上游业务显式限制为可信目录。如果不能，应视作默认可利用面。

## Residual Risks / Gaps

- 本轮是源码静态审计，不等同于黑盒渗透或联网 DAST。
- iOS 侧未发现比“明文调试链路 + ATS 放行”更高优先级的新问题；token 存储主路径看起来在 Keychain 中，而非 UserDefaults。
- 已剔除一条误报: `packages/trix-canvas-service/relay.js` 未发现硬编码密钥。

## 修复优先级

1. 先封 Canvas: 加鉴权、去掉 `CORS *`、禁止任意写 `result_url`、前端改为 DOM API/属性安全赋值。
2. 修 Pairing: secret 改成强制校验，客户端删除“去掉 secret 重试”逻辑。
3. 收口 token 面: Web 不再把 `clientToken` 放 URL；Desktop 不再明文持久化完整 session；IPC 拆分最小权限。
4. 去掉 `shell: true` 搜索链路，改 `spawn/execFile` 的安全参数调用。
5. 对所有服务端 `url/localPath` 输入增加白名单、目录约束、内网地址阻断。
6. iOS 移除公网 IP 的不安全 ATS 例外，Debug 也统一到 TLS 或本地回环地址。
