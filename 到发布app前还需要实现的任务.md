# iOS App 发布前任务清单 (Phase 7B 深度扫描版)

> 文档创建时间: 2026-02-27
> 当前版本: 1.2
> 预计发布时间: TBD

---

## 📊 项目状态概览

### 当前完成度
- **开发完成度**: 95%
- **测试完成度**: 70%
- **发布准备度**: 55%

### 已验证实现的核心模块 ✅

| 模块 | 文件 | 状态 | 备注 |
|------|------|------|------|
| StoreKit 支付 | StoreKitService.swift | ✅ 已实现 | 收据验证完整 |
| PaymentService | PaymentService.swift | ✅ 已实现 | 订单管理完整 |
| OAuth 认证 | OAuthManager.swift | ✅ 已实现 | Apple/WeChat |
| Apple 登录 | AppleSignInService.swift | ✅ 已实现 | 完整实现 |
| 聊天服务 | ChatService.swift | ✅ 已实现 | 含 WebSocket |
| 学习服务 | StudyService.swift | ✅ 已实现 | |
| 数据同步 | DataSyncService.swift | ✅ 已实现 | |
| 积分服务 | PointsService.swift | ✅ 已实现 | |
| Keychain | KeychainManager.swift | ✅ 已实现 | 安全验证完整 |
| 越狱检测 | JailbreakDetector.swift | ✅ 已实现 | |
| SSL 固定 | SSLPinningManager.swift | ✅ 已实现 | 支持公钥固定 |
| 请求重试 | RequestRetryManager.swift | ✅ 已实现 | |
| 请求去重 | RequestDeduplicator.swift | ✅ 已实现 | |
| 安全头验证 | SecurityHeadersValidator.swift | ✅ 已实现 | |
| WebSocket | WebSocketManager.swift | ✅ 已实现 | |
| 数据库 | DatabaseManager.swift | ✅ 已实现 | |
| 通知服务 | PushNotificationService.swift | ✅ 已实现 | |
| 本地通知 | LocalNotificationService.swift | ✅ 已实现 | |
| 语音服务 | TTSService.swift | ✅ 已实现 | |
| 语音播放 | VoicePlaybackService.swift | ✅ 已实现 | |
| 网络监控 | NetworkMonitor.swift | ✅ 已实现 | |
| 离线缓存 | OfflineCacheService.swift | ✅ 已实现 | |

---

## 🚨 发现的实际问题

### 1. 微信登录 - 占位符实现 (P0-严重)

**文件**: `Core/Services/WeChatSignInService.swift`

| 问题 | 严重性 | 说明 |
|------|--------|------|
| WeChatSDK 是占位符 | 🔴 严重 | `WeChatSDK.isWXAppInstalled()` 永远返回 `false` |
| AppID 未配置 | 🔴 严重 | 硬编码 "YOUR_WECHAT_APP_ID" |
| AppSecret 未配置 | 🔴 严重 | 硬编码 "YOUR_WECHAT_APP_SECRET" |
| sendAuthRequest() 未实现 | 🔴 严重 | TODO 注释，无实际 SDK 调用 |
| 7 个 TODO | 🔴 严重 | 需要集成真正的微信 SDK |

**影响**:
- 微信登录功能完全不可用
- 用户无法通过微信注册/登录

---

### 2. 剩余 TODO 清理

| 文件 | 行号 | 问题 |
|------|------|------|
| DataExportService.swift | 378 | 消息检索未实现 |
| ChatListView.swift | 189 | 新建聊天未实现 |
| VoiceMessageIntegrationExample.swift | 257 | 服务器上传未实现 |

---

### 3. StoreKit 收据验证 - 潜在问题

**文件**: `Core/Services/StoreKitService.swift`

| 问题 | 严重性 | 说明 |
|------|--------|------|
| 使用 DispatchSemaphore | 🟡 中等 | 可能在主线程死锁，建议改为 async/await |
| getReceiptData() 超时 | 🟡 中等 | 5秒超时可能导致数据丢失 |

---

### 4. 硬编码敏感信息

| 文件 | 问题 |
|------|------|
| WeChatSignInService.swift | 硬编码 "YOUR_WECHAT_APP_ID" |
| WeChatSignInService.swift | 硬编码 "YOUR_WECHAT_APP_SECRET" |

---

## 📋 待完成任务总览

| 优先级 | 任务数 | 预计工时 |
|--------|--------|----------|
| P0 - 阻塞 | 8 | ~25h |
| P1 - 高 | 15 | ~40h |
| P2 - 中 | 10 | ~25h |
| P3 - 低 | 5 | ~15h |
| **总计** | **38** | **~105h** |

---

## P0 阻塞任务

### P0-1: 微信登录 SDK 集成

**风险**: 🔴 严重 - 微信登录完全不可用
**文件**: `Core/Services/WeChatSignInService.swift`

#### 子任务

- [ ] **P0-1.1** 集成微信 OpenSDK (CocoaPods/SPM)
  - 添加 `WechatOpenSDK` 依赖
  - 配置 URL Scheme: `wx...`
  - 配置 Universal Link

- [ ] **P0-1.2** 替换 WeChatSDK 占位符
  ```swift
  // 替换为:
  enum WeChatSDK: WeChatSDKProtocol {
      static func registerApp(_ appID: String, universalLink: String?) {
          WXApi.registerApp(appID, universalLink: universalLink)
      }
      // ...
  }
  ```

- [ ] **P0-1.3** 配置真实 AppID/Secret
  - 从环境变量或配置文件加载
  - 移除硬编码占位符

- [ ] **P0-1.4** 实现 sendAuthRequest()
  ```swift
  private func sendAuthRequest() -> Bool {
      let request = SendAuthReq()
      request.scope = "snsapi_userinfo"
      request.state = authState
      return WeChatSDK.sendReq(request)
  }
  ```

- [ ] **P0-1.5** 测试微信登录流程
  - 沙箱环境测试
  - 回调处理测试

---

### P0-2: 剩余 TODO 清理

#### 子任务

- [ ] **P0-2.1** 实现 DataExportService 消息检索
  - 文件: `Core/Services/DataExportService.swift:378`
  - 验收: 正确导出用户消息

- [ ] **P0-2.2** 实现 ChatListView 新建聊天
  - 文件: `Features/Home/Views/ChatListView.swift:189`
  - 验收: 可以创建新聊天会话

- [ ] **P0-2.3** 实现 VoiceMessage 服务器上传
  - 文件: `Features/Chat/Views/VoiceMessageIntegrationExample.swift:257`
  - 验收: 录音可以上传到服务器

---

### P0-3: StoreKit 收据验证优化

**文件**: `Core/Services/StoreKitService.swift`

#### 子任务

- [ ] **P0-3.1** 移除 DispatchSemaphore，改用 async/await
  - 原因: 避免潜在死锁
  - 验收: 异步方法正确实现

- [ ] **P0-3.2** 改进收据数据获取超时处理
  - 增加超时时间或使用流式处理
  - 验收: 不丢失交易数据

---

### P0-4: App Store 元数据准备

**风险**: 🔴 严重 - 无法发布

#### 子任务

- [ ] **P0-4.1** 准备 App 图标 (所有尺寸)
- [ ] **P0-4.2** 准备 App 截图 (所有尺寸)
- [ ] **P0-4.3** 撰写中英文应用描述
- [ ] **P0-4.4** 准备隐私政策
- [ ] **P0-4.5** 填写 App Store Connect 信息
- [ ] **P0-4.6** 配置权限使用说明

---

## P1 高优先级任务

### P1-1: 测试覆盖率提升

**当前**: 70% → **目标**: 85%

#### 子任务

- [ ] **P1-1.1** 补充 PointsService 测试 (~2h)
- [ ] **P1-1.2** 补充 NetworkMonitor 测试 (~1h)
- [ ] **P1-1.3** 补充 OfflineCacheService 测试 (~2h)
- [ ] **P1-1.4** 补充 KeychainManager 测试 (~2h)
- [ ] **P1-1.5** 补充 WebSocketManager 测试 (~2h)
- [ ] **P1-1.6** 补充 APIClient 测试 (~2h)
- [ ] **P1-1.7** 补充 DatabaseManager 测试 (~2h)

---

### P1-2: 安全审计增强

#### 子任务

- [ ] **P1-2.1** 移除硬编码敏感信息
  - 微信 AppID/Secret 改为配置

- [ ] **P1-2.2** Keychain 安全验证
  - 验证 kSecAttrAccessibleWhenUnlockedThisDeviceOnly

- [ ] **P1-2.3** 数据库 SQL 注入扫描
  - 检查所有原始 SQL 查询

- [ ] **P1-2.4** 敏感数据流分析
  - 追踪 Token/Password 流向

- [ ] **P1-2.5** 依赖安全审查
  - 运行 Snyk 或 Dependabot

---

### P1-3: 性能基准完善

#### 子任务

- [ ] **P1-3.1** 启动性能基准测试 (~1h)
- [ ] **P1-3.2** 内存使用基准测试 (~1h)
- [ ] **P1-3.3** 电池消耗基准测试 (~1h)
- [ ] **P1-3.4** 网络性能基准测试 (~1h)

---

### P1-4: UI 测试补充

#### 子任务

- [ ] **P1-4.1** 添加 Store 流程测试 (~2h)
- [ ] **P1-4.2** 添加 Pairing 流程测试 (~2h)
- [ ] **P1-4.3** 添加 Voice 流程测试 (~2h)

---

## P2 中优先级任务

### P2-1: APNs 推送配置

#### 子任务

- [ ] **P2-1.1** 创建 APNs 证书 (开发/生产) (~2h)
- [ ] **P2-1.2** 后端集成推送服务 (~3h)
- [ ] **P2-1.3** 添加推送测试用例 (~1h)

---

### P2-2: API 端点完善

#### 子任务

- [ ] **P2-2.1** 添加支付相关 API 端点定义 (~1h)
- [ ] **P2-2.2** 完善订单管理 API (~2h)

---

### P2-3: UI 占位符实现

#### 子任务

- [ ] **P2-3.1** 实现相机入口 (ChatDetailView) (~2h)
- [ ] **P2-3.2** 添加编辑表单字段 (ProfileView) (~2h)
- [ ] **P2-3.3** 实现房间创建功能 (StudyListView) (~2h)

---

### P2-4: 文档完善

#### 子任务

- [ ] **P2-4.1** 更新 API_REFERENCE.md (~1h)
- [ ] **P2-4.2** 更新 ARCHITECTURE.md (~1h)

---

## P3 低优先级任务

### P3-1: 3D 角色展示

#### 子任务

- [ ] **P3-1.1** 准备 3D 模型 (~10h)
- [ ] **P3-1.2** 集成 SceneKit (~5h)

---

### P3-2: 代码文档完善

#### 子任务

- [ ] **P3-2.1** 生成 SwiftDoc 文档 (~3h)
- [ ] **P3-2.2** 补充公共 API 文档注释 (~2h)

---

## 🧪 测试文件清单

### 已存在测试 (11个) ✅
| 测试 | 状态 |
|------|------|
| StoreKitServiceTests | ✅ 完整 |
| PaymentServiceTests | ✅ 完整 |
| AppleSignInServiceTests | ✅ 完整 |
| OAuthManagerTests | ✅ 完整 |
| WeChatSignInServiceTests | ✅ 框架完整 |
| ChatServiceTests | ✅ 完整 |
| StudyServiceTests | ✅ 完整 |
| DataSyncServiceTests | ✅ 完整 |
| ProfileViewModelTests | ✅ |
| ChatDetailViewModelTests | ✅ |
| StudyListViewModelTests | ✅ |

### 性能测试 (4个) ✅
| 测试 | 状态 |
|------|------|
| LaunchPerformanceBenchmark | ✅ |
| MemoryPerformanceBenchmark | ✅ |
| BatteryPerformanceBenchmark | ✅ |
| NetworkPerformanceBenchmark | ✅ |

### 需要新增 (7个) ⚠️
| 测试 | 优先级 |
|------|--------|
| PointsServiceTests | P1 |
| NetworkMonitorTests | P1 |
| OfflineCacheServiceTests | P1 |
| KeychainManagerTests | P1 |
| WebSocketManagerTests | P1 |
| APIClientTests | P1 |
| DatabaseManagerTests | P1 |

---

## 🔒 安全审计清单

### 已实现 ✅
- [x] KeychainManager 安全存储
- [x] JailbreakDetector 越狱检测
- [x] SSLPinningManager 证书固定
- [x] RequestRetryManager 请求重试
- [x] RequestDeduplicator 请求去重
- [x] SecurityHeadersValidator 安全头验证
- [x] InputValidator 输入验证

### 需要修复 ⚠️
| 问题 | 优先级 | 文件 |
|------|--------|------|
| 硬编码微信 AppID | P0 | WeChatSignInService.swift |
| 硬编码微信 AppSecret | P0 | WeChatSignInService.swift |
| 微信 SDK 未集成 | P0 | WeChatSignInService.swift |

### 需要审计增强 ⚠️
| 任务 | 优先级 |
|------|--------|
| Keychain 访问控制验证 | P1 |
| 数据库 SQL 注入扫描 | P1 |
| 敏感数据流分析 | P1 |
| 依赖安全审查 | P1 |

---

## 📊 进度跟踪

### 总体进度

| 阶段 | 任务数 | 完成 | 进度 |
|------|--------|------|------|
| P0 阻塞任务 | 8 | 0 | 0% |
| P1 高优先级 | 15 | 0 | 0% |
| P2 中优先级 | 10 | 0 | 0% |
| P3 低优先级 | 5 | 0 | 0% |
| **总计** | **38** | **0** | **0%** |

---

## 🎯 下一步行动

### 立即开始 (P0)
1. **P0-1**: 微信登录 SDK 集成 (~12h)
2. **P0-2**: 剩余 TODO 清理 (~4h)
3. **P0-3**: StoreKit 收据验证优化 (~3h)
4. **P0-4**: App Store 元数据 (~12h)

### 本周目标
- 完成所有 P0 阻塞任务
- 完成 P1 测试覆盖率提升

### 本月目标
- 完成 P1 安全审计
- 完成 P2 配置任务

---

## 📝 发现的代码质量问题

### 潜在死锁风险
```swift
// StoreKitService.swift:452-494
let semaphore = DispatchSemaphore(value: 0)
Task {
    // async work
    semaphore.signal()
}
semaphore.wait(timeout: .now() + 5)
```
**建议**: 改为 async/await

### 硬编码占位符
```swift
// WeChatSignInService.swift:66-70
private static let weChatAppID = "YOUR_WECHAT_APP_ID"
private static let weChatAppSecret = "YOUR_WECHAT_APP_SECRET"
```
**建议**: 从环境变量或配置文件加载

---

**最后更新**: 2026-02-27
**文档版本**: 1.2
**维护者**: Claude + 用户协作
