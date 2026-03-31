# TRIX 上线准备增补报告

日期: 2026-04-01

范围:
- iOS 认证注册链路回归修复
- Native / Canvas 服务安全加固
- 大文件 / 高耦合热点扫描与低风险拆分

边界:
- 结论仅覆盖本地源码、模拟器、单元/冒烟测试
- 未登录生产服务器，未直接操作线上数据库
- 不把 `skip` 的 live smoke、未执行的真机链路或缺少签名的第三方登录当作“已验证通过”

## 1. 本轮新增完成项

### 1.1 iOS 认证链路

- `ios/TRIX3DCompanion/Core/Network/APIClient.swift`
  - 修复注册接口返回 `{ user, session }` 嵌套结构时丢失 `session` 的问题
  - `RegisterSessionEnvelope` 现可正确解码 `access_token`、`refresh_token`、`expires_in`
- `ios/TRIX3DCompanion/Core/Services/AuthService.swift`
  - 修复注册后 fallback `login()` 非邮箱确认错误被吞掉并错误返回 success 的问题
- `ios/TRIX3DCompanion/Tests/TRIX3DCompanionTests/Services/APIClientTests.swift`
  - 补上嵌套 `session` 注册返回解码回归测试
- `ios/TRIX3DCompanion/Tests/TRIX3DCompanionTests/Services/AuthServiceTests.swift`
  - 补上 fallback 登录失败时必须向上返回 failure 的回归测试

### 1.2 Native / Canvas 服务安全

- `packages/trix-openclaw-native/src/server/accessControl.ts`
  - `X-Forwarded-For` 仅在请求来自回环或显式信任代理时才生效
- `packages/trix-openclaw-native/src/server/TrixNativeServer.ts`
  - 新增 `TRIX_NATIVE_TRUST_PROXY_ALLOWLIST` 支持，限流和 allowlist 校验统一使用可信来源 IP
- `packages/trix-canvas-service/server.js`
  - 500 错误对客户端统一脱敏
  - ffmpeg 细节仅记录到服务端日志
- `packages/trix-canvas-service/public/canvas.html`
  - 禁止通过 `?token=` / `#token=` 自动登录
  - 检测到 URL 携带 token 时直接清理并提示手动输入
- `packages/trix-canvas-service/proxy.js`
  - 为内存中的 `tasks` / `sessions` 增加硬上限和终态淘汰

## 2. 大文件 / 高耦合扫描

本地按 UTF-8 文本行数扫描后，当前最重的几个热点如下:

| 文件 | 行数 | 说明 |
|------|------|------|
| `packages/trix-canvas-service/public/canvas.html` | 3942 | 单文件前端页面，UI + 状态 + 网络逻辑强耦合 |
| `packages/trix-canvas-service/server.js` | 2650 | Canvas API、鉴权、导出、媒体处理和错误处理集中在一个文件 |
| `packages/trix-openclaw-native/src/server/TrixNativeServer.ts` | 2222 | 协议、鉴权、WebSocket、HTTP endpoint 和状态同步集中 |
| `ios/TRIX3DCompanion/Core/Network/APIEndpoints.swift` | 2100 | 端点定义体量过大，但当前拆分会牵动较多 Xcode 工程配置 |

### 本轮已完成的低风险解耦

- 新增 `packages/trix-canvas-service/canvasSecurity.js`
  - 将 Canvas 的 bind 安全检查、token provisioning、cookie 序列化、鉴权判定、媒体 URL 安全校验从 `server.js` 抽离
  - 目标是先把“安全边界逻辑”从“业务路由逻辑”里解耦出来，降低继续修改时的回归面
- 同步更新 skill runtime 复制规则
  - `skills/trix-canvas-skill/scripts/_paths.py`
  - `skills/trix-canvas-skill/scripts/sync_canvas_runtime.py`
  - 保证打包到 skill 里的 Canvas runtime 与仓库运行时保持一致

### 仍建议后续拆分的热点

1. `packages/trix-canvas-service/public/canvas.html`
   - 下一步适合抽 `auth/session helpers`、`normalizers`、`render helpers`
2. `packages/trix-openclaw-native/src/server/TrixNativeServer.ts`
   - 下一步适合拆 `study-room endpoints` 和 `pairing HTTP handlers`
3. `ios/TRIX3DCompanion/Core/Network/APIEndpoints.swift`
   - 下一步适合拆分为按域分组的扩展文件，但需要配套修改 Xcode project

## 3. 本地验证结果

### 3.1 iOS

已通过:

```bash
xcodebuild -workspace ios/TRIX3DCompanion/TRIX3DCompanion.xcworkspace \
  -scheme TRIX3DCompanion \
  -destination 'platform=iOS Simulator,id=7F7822BC-BBC1-42C6-A966-D5596819D990' \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO \
  -only-testing:TRIX3DCompanionTests/APIClientTests/testRegisterRequestEncodesUsernameInMetadata \
  -only-testing:TRIX3DCompanionTests/APIClientTests/testDecodeRegisterResponseFromTopLevelUserMarksEmailConfirmationRequired \
  -only-testing:TRIX3DCompanionTests/APIClientTests/testDecodeRegisterResponseFromUserEnvelopeWithoutConfirmationTimestampStillMarksEmailConfirmationRequired \
  -only-testing:TRIX3DCompanionTests/APIClientTests/testDecodeRegisterResponseFromUserEnvelopeWithSessionPreservesSessionTokens \
  -only-testing:TRIX3DCompanionTests/AuthServiceTests/testRegisterSuccess \
  -only-testing:TRIX3DCompanionTests/AuthServiceTests/testRegisterReturnsEmailConfirmationRequiredWhenSignupNeedsVerification \
  -only-testing:TRIX3DCompanionTests/AuthServiceTests/testRegisterFallsBackToLoginWhenSignupReturnsNoSessionWithoutConfirmationRequirement \
  -only-testing:TRIX3DCompanionTests/AuthServiceTests/testRegisterFailsWhenFallbackLoginFailsForNonConfirmationReason \
  -only-testing:TRIX3DCompanionTests/AuthServiceTests/testLoginWithEmailNotConfirmedReturnsSpecificError \
  -only-testing:TRIX3DCompanionTests/AuthViewModelTests/testRegisterEmailConfirmationRequiredShowsSuccessState \
  -only-testing:TRIX3DCompanionTests/AuthViewModelTests/testLoginEmailConfirmationRequiredShowsSpecificMessage \
  test
```

结果:
- 定向认证回归 `11/11` 通过

### 3.2 Native / Canvas

已通过:

```bash
npm --prefix packages/trix-openclaw-native run test
```

结果:
- `45/45` 通过，包含新增 `accessControl.test.ts`

已通过:

```bash
npm --prefix packages/trix-canvas-service run check
```

结果:
- `server.js` / `proxy.js` / `relay.js` / `start-all.js` 语法检查通过

已通过:

```bash
node --test tests/smoke/trix-canvas-skill-install-smoke.test.mjs tests/smoke/trix-canvas-skill-smoke.test.mjs
```

结果:
- Canvas skill/runtime smoke `2/2` 通过

## 4. 仍未闭环的上线风险

### 4.1 真实注册链路

- `ios/TRIX3DCompanion/Tests/TRIX3DCompanionTests/Smoke/AuthLiveRegistrationSmokeTests.swift`
  - 当前真实邮件注册 smoke 会因为 Supabase 邮件限流 `429 email rate limit exceeded` 而 `skip`
  - 这说明本地逻辑修复已完成，但“真实注册闭环”仍未被最终验证

### 4.2 第三方登录 / IAP / 真机链路

- Apple / WeChat 登录仍缺真实 provider 回路验证
- StoreKit / 验单 / 购买到账未做真实闭环
- 缺签名，不能把真机/审核构建结果视为已确认

### 4.3 线上运维面

- 未登录生产服务器，未核查:
  - Nginx 真实反代配置
  - `TRIX_NATIVE_TRUST_PROXY_ALLOWLIST` 是否已按真实代理链设置
  - 线上 Canvas / proxy 实际暴露方式

## 5. 建议的下一步

1. 在生产或准生产环境核对 `TRIX_NATIVE_TRUST_PROXY_ALLOWLIST` 与反代链，只允许真实 Nginx / 网关地址被信任
2. 用非限流邮箱或更宽松的测试项目完成一次真实注册邮件闭环
3. 优先继续拆 `canvas.html` 的 auth / render / normalize 模块，这是当前最大的前端耦合点
