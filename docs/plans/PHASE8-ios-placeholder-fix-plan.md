# iOS 端占位符修复计划

> 生成时间: 2026-02-27
> 平台: iOS (Swift/SwiftUI)
> 状态: 待执行
> 版本: 2.0 - 详细任务版

---

## 📊 任务总览

| 优先级 | 任务数 | 预估工时 |
|--------|--------|---------|
| P0 阻塞 | 2 | 12h |
| P1 高优先 | 3 | 7h |
| **总计** | **5** | **19h** |

---

## 🔴 P0 - 阻塞任务

### Task 1: 微信登录 SDK 集成

**严重性**: 🔴 严重 - 微信登录功能无法使用
**文件**: `Core/Services/WeChatSignInService.swift`
**当前状态**: 4 个占位符 TODO

#### 1.1 环境准备 (1h)

- [ ] **T1.1.1** 注册微信开放平台账号 (如尚未注册)
- [ ] **T1.1.2** 创建移动应用获取 AppID 和 AppSecret
- [ ] **T1.1.3** 配置应用签名 (MD5)
- [ ] **T1.1.4** 配置 Universal Link
- [ ] **T1.1.5** 在微信开放平台添加 URL Scheme

#### 1.2 CocoaPod 集成 (1h)

- [ ] **T1.2.1** 打开 `ios/Podfile`
- [ ] **T1.2.2** 添加 `pod 'WechatOpenSDK'` 依赖
- [ ] **T1.2.3** 运行 `pod install`
- [ ] **T1.2.4** 验证依赖安装成功

#### 1.3 Info.plist 配置 (0.5h)

- [ ] **T1.3.1** 在 `Info.plist` 添加 `LSApplicationQueriesSchemes` 数组
- [ ] **T1.3.2** 添加 `weixin` 到 `LSApplicationQueriesSchemes`
- [ ] **T1.3.3** 配置 `CFBundleURLTypes` 添加微信 URL Scheme
- [ ] **T1.3.4** 配置 `NSLocationWhenInUseUsageDescription` (如需要)

#### 1.4 代码实现 - 占位符替换 (3h)

- [ ] **T1.4.1** 替换 `registerApp` 占位符
  - 位置: `WeChatSignInService.swift:107`
  - 修改前: `// TODO: Replace with actual WeChat SDK call: WXApi.registerApp`
  - 修改后: `WXApi.registerApp(appID, universalLink: universalLink)`

- [ ] **T1.4.2** 替换 `handleOpen` 占位符
  - 位置: `WeChatSignInService.swift:164`
  - 修改前: `// TODO: Replace with actual WeChat SDK call: WXApi.handleOpen`
  - 修改后: `WXApi.handleOpen(url)`

- [ ] **T1.4.3** 替换 `getApiVersion` 占位符
  - 位置: `WeChatSignInService.swift:170`
  - 修改前: `return "1.9.2" // Placeholder version`
  - 修改后: `WXApi.getApiVersion()`

- [ ] **T1.4.4** 添加 `WXApiDelegate` 协议实现
  - 添加 `WXApiDelegate` 到类声明
  - 实现 `onReq` 回调方法
  - 实现 `onResp` 回调方法

- [ ] **T1.4.5** 配置环境变量
  - 在 `.env` 或 Xcode Scheme 中添加 `WECHAT_APP_ID`
  - 在 `.env` 或 Xcode Scheme 中添加 `WECHAT_APP_SECRET`

#### 1.5 AppDelegate 集成 (1h)

- [ ] **T1.5.1** 在 `AppDelegate.swift` 导入 WeChat SDK
- [ ] **T1.5.2** 实现 `application(_:open:options:)` 方法
- [ ] **T1.5.3** 在方法中调用 `WXApi.handleOpen(url)`
- [ ] **T1.5.4** 在 SceneDelegate 中处理 Universal Link

#### 1.6 测试 - WeChatSignInServiceTests (2h)

- [ ] **T1.6.1** 打开 `Core/Tests/WeChatSignInServiceTests.swift`
- [ ] **T1.6.2** 添加 `testRegisterApp` 测试用例
  - 验证 `registerApp` 被正确调用
  - 验证传入的 AppID 正确

- [ ] **T1.6.3** 添加 `testHandleOpenURL` 测试用例
  - 模拟微信回调 URL
  - 验证回调被正确处理

- [ ] **T1.6.4** 添加 `testIsWXAppInstalled` 测试用例
  - 模拟微信已安装场景
  - 模拟微信未安装场景

- [ ] **T1.6.5** 添加 `testSignInFlow` 集成测试
  - 测试完整登录流程
  - 测试授权取消场景

#### 1.7 安全审计 (0.5h)

- [ ] **T1.7.1** 验证 AppID/Secret 不硬编码在代码中
- [ ] **T1.7.2** 验证 OAuth 状态参数防 CSRF 攻击
- [ ] **T1.7.3** 验证回调 URL 参数验证
- [ ] **T1.7.4** 验证敏感数据不在日志中泄露
- [ ] **T1.7.5** 验证 access token 安全存储 (Keychain)

---

### Task 2: 积分服务 API 端点连接

**严重性**: 🔴 严重 - 积分功能无法与服务器同步
**文件**: `Core/Services/PointsService.swift`
**当前状态**: 2 处使用 `.authMe` 占位端点

#### 2.1 API 端点定义 (1h)

- [ ] **T2.1.1** 打开 `Core/Services/PointsService.swift`
- [ ] **T2.1.2** 添加新的 APIEndpoint 枚举值
  ```swift
  case addPoints = "/api/points/add"
  case deductPoints = "/api/points/deduct"
  case getPointsBalance = "/api/points/balance"
  ```

- [ ] **T2.1.3** 定义请求体结构
  ```swift
  struct AddPointsRequest: Codable
  struct DeductPointsRequest: Codable
  ```

- [ ] **T2.1.4** 定义响应体结构
  ```swift
  struct PointsResponse: Codable
  ```

#### 2.2 addPoints 方法修改 (1h)

- [ ] **T2.2.1** 定位到 `addPoints` 方法 (约第 258 行)
- [ ] **T2.2.2** 修改 API 端点调用
  - 修改前: `try await apiClient.post(.authMe, body: request)`
  - 修改后: `try await apiClient.post(.addPoints, body: request)`

- [ ] **T2.2.3** 添加请求超时处理
- [ ] **T2.2.4** 添加重试逻辑 (最多 3 次)

#### 2.3 deductPoints 方法修改 (1h)

- [ ] **T2.3.1** 定位到 `deductPoints` 方法 (约第 329 行)
- [ ] **T2.3.2** 修改 API 端点调用
  - 修改前: `try await apiClient.post(.authMe, body: request)`
  - 修改后: `try await apiClient.post(.deductPoints, body: request)`

- [ ] **T2.3.3** 添加余额不足前置检查
- [ ] **T2.3.4** 添加请求超时处理

#### 2.4 错误处理完善 (1h)

- [ ] **T2.4.1** 添加积分不足错误类型
  ```swift
  enum PointsError: Error {
      case insufficientBalance
      // ...
  }
  ```

- [ ] **T2.4.2** 在 `deductPoints` 方法中检查余额
- [ ] **T2.4.3** 返回清晰的错误信息给 UI
- [ ] **T2.4.4** 添加积分操作日志

#### 2.5 测试 - PointsServiceTests (1.5h)

- [ ] **T2.5.1** 打开 `Core/Tests/PointsServiceTests.swift`
- [ ] **T2.5.2** 添加 `testAddPointsSuccess` 测试
  - Mock API 返回正确的积分余额
  - 验证返回的余额正确

- [ ] **T2.5.3** 添加 `testAddPointsFailure` 测试
  - Mock API 返回错误
  - 验证错误被正确处理

- [ ] **T2.5.4** 添加 `testDeductPointsSuccess` 测试
  - Mock 余额充足场景
  - 验证扣减成功

- [ ] **T2.5.5** 添加 `testDeductPointsInsufficientBalance` 测试
  - Mock 余额不足场景
  - 验证返回 `insufficientBalance` 错误

#### 2.6 安全审计 (0.5h)

- [ ] **T2.6.1** 验证客户端不会超支扣减 (双重检查)
- [ ] **T2.6.2** 验证积分操作有防重放机制
- [ ] **T2.6.3** 验证操作日志完整记录
- [ ] **T2.6.4** 验证网络请求使用 HTTPS

---

## 🟡 P1 - 高优先级任务

### Task 3: 聊天列表新建聊天同步

**严重性**: 🟡 中等 - 聊天记录不同步
**文件**: `Features/Home/Views/ChatListView.swift`
**当前状态**: 1 个 TODO 未实现

#### 3.1 现有代码分析 (0.5h)

- [ ] **T3.1.1** 定位 TODO 位置 (ChatListView.swift:234)
- [ ] **T3.1.2** 分析现有实现逻辑
- [ ] **T3.1.3** 检查 ChatService API 可用性

#### 3.2 ChatService 集成 (1.5h)

- [ ] **T3.2.1** 取消注释 `handleCreateChat` 中的代码
- [ ] **T3.2.2** 注入 ChatService 依赖
- [ ] **T3.2.3** 实现 `createChatRoom` 调用
  ```swift
  Task {
      do {
          let room = try await chatService.createChatRoom(
              name: trimmedName,
              type: .group
          )
          // 更新本地数据
      } catch {
          // 处理错误
      }
  }
  ```

- [ ] **T3.2.4** 处理创建失败场景
  - 保留本地记录
  - 标记需要同步
  - 后续重试

#### 3.3 测试 - ChatListViewModelTests (1h)

- [ ] **T3.3.1** 打开 `Features/Home/ViewModels/ChatListViewModelTests.swift`
- [ ] **T3.3.2** 添加 `testCreateChatRoomSuccess` 测试
- [ ] **T3.3.3** 添加 `testCreateChatRoomFailure` 测试
- [ ] **T3.3.4** 添加 `testCreateChatRoomOffline` 测试

---

### Task 4: 配对二维码生成

**严重性**: 🟡 中等 - 二维码显示可能有问题
**文件**: `Features/Pairing/Views/PairingView.swift`
**当前状态**: 使用占位符

#### 4.1 库添加 (0.5h)

- [ ] **T4.1.1** 打开 `ios/Podfile`
- [ ] **T4.1.2** 添加 `pod 'EFQRCode'` 依赖
- [ ] **T4.1.3** 运行 `pod install`

#### 4.2 二维码生成实现 (1.5h)

- [ ] **T4.2.1** 定位占位符位置 (PairingView.swift:284)
- [ ] **T4.2.2** 导入 EFQRCode 库
- [ ] **T4.2.3** 实现二维码生成方法
  ```swift
  func generateQRCode(from string: String) -> UIImage? {
      guard let cgImage = EFQRCode.generate(
          for: string,
          backgroundColor: UIColor.white.cgColor,
          foregroundColor: UIColor.purple.cgColor
      ) else { return nil }
      return UIImage(cgImage: cgImage)
  }
  ```

- [ ] **T4.2.4** 在 PairingView 中使用真实二维码
- [ ] **T4.2.5** 处理生成失败回退

#### 4.3 测试 - PairingServiceTests (1h)

- [ ] **T4.3.1** 打开 `Core/Tests/PairingServiceTests.swift`
- [ ] **T4.3.2** 添加 `testQRCodeGeneration` 测试
- [ ] **T4.3.3** 添加 `testQRCodeGenerationEmptyString` 测试

---

### Task 5: 相机预览层集成

**严重性**: 🟡 中等 - 相机功能不完整
**文件**: `Features/Snapshot/Views/CameraView.swift`
**当前状态**: 1 个占位符

#### 5.1 预览层集成 (2h)

- [ ] **T5.1.1** 定位占位符位置 (CameraView.swift:404)
- [ ] **T5.1.2** 添加 `AVCaptureVideoPreviewLayer` 属性
- [ ] **T5.1.3** 初始化预览层
  ```swift
  private lazy var previewLayer: AVCaptureVideoPreviewLayer = {
      let layer = AVCaptureVideoPreviewLayer()
      layer.videoGravity = .resizeAspectFill
      return layer
  }()
  ```

- [ ] **T5.1.4** 配置预览层会话
- [ ] **T5.1.5** 添加预览层到视图层级

#### 5.2 权限处理完善 (1h)

- [ ] **T5.2.1** 检查相机权限状态
- [ ] **T5.2.2** 实现权限请求逻辑
- [ ] **T5.2.3** 处理权限被拒绝场景
- [ ] **T5.2.4** 添加设置跳转入口

#### 5.3 测试 - PhotoCaptureFlowTests (1.5h)

- [ ] **T5.3.1** 打开 `TRIX3DUITests/PhotoCaptureFlowTests.swift`
- [ ] **T5.3.2** 添加 `testCameraPermissionGranted` 测试
- [ ] **T5.3.3** 添加 `testCameraPermissionDenied` 测试

---

## ✅ 任务清单汇总 (共 40 个子任务)

### Task 1: 微信登录 SDK 集成 (14 个子任务)

- [ ] T1.1.1 注册微信开放平台账号
- [ ] T1.1.2 创建移动应用获取 AppID
- [ ] T1.1.3 配置应用签名
- [ ] T1.1.4 配置 Universal Link
- [ ] T1.1.5 添加 URL Scheme
- [ ] T1.2.1 打开 Podfile
- [ ] T1.2.2 添加 WechatOpenSDK 依赖
- [ ] T1.2.3 运行 pod install
- [ ] T1.2.4 验证依赖安装
- [ ] T1.3.1 添加 LSApplicationQueriesSchemes
- [ ] T1.3.2 添加 weixin 到查询列表
- [ ] T1.3.3 配置 CFBundleURLTypes
- [ ] T1.3.4 配置权限说明
- [ ] T1.4.1 替换 registerApp
- [ ] T1.4.2 替换 handleOpen
- [ ] T1.4.3 替换 getApiVersion
- [ ] T1.4.4 添加 WXApiDelegate
- [ ] T1.4.5 配置环境变量
- [ ] T1.5.1 导入 SDK
- [ ] T1.5.2 实现 application open
- [ ] T1.5.3 调用 WXApi.handleOpen
- [ ] T1.5.4 处理 Universal Link
- [ ] T1.6.1 打开测试文件
- [ ] T1.6.2 测试 registerApp
- [ ] T1.6.3 测试 handleOpenURL
- [ ] T1.6.4 测试 isWXAppInstalled
- [ ] T1.6.5 测试登录流程
- [ ] T1.7.1 验证无硬编码
- [ ] T1.7.2 验证 CSRF 防护
- [ ] T1.7.3 验证 URL 验证
- [ ] T1.7.4 验证无日志泄露
- [ ] T1.7.5 验证 token 存储

### Task 2: 积分 API 端点 (12 个子任务)

- [ ] T2.1.1 打开 PointsService.swift
- [ ] T2.1.2 添加 APIEndpoint 枚举值
- [ ] T2.1.3 定义请求体结构
- [ ] T2.1.4 定义响应体结构
- [ ] T2.2.1 定位 addPoints 方法
- [ ] T2.2.2 修改 API 端点
- [ ] T2.2.3 添加超时处理
- [ ] T2.2.4 添加重试逻辑
- [ ] T2.3.1 定位 deductPoints 方法
- [ ] T2.3.2 修改 API 端点
- [ ] T2.3.3 添加余额检查
- [ ] T2.3.4 添加超时处理
- [ ] T2.4.1 添加错误类型
- [ ] T2.4.2 实现余额验证
- [ ] T2.4.3 返回错误信息
- [ ] T2.4.4 添加操作日志
- [ ] T2.5.1 打开测试文件
- [ ] T2.5.2 测试 addPoints 成功
- [ ] T2.5.3 测试 addPoints 失败
- [ ] T2.5.4 测试 deductPoints 成功
- [ ] T2.5.5 测试余额不足
- [ ] T2.6.1 验证防超支
- [ ] T2.6.2 验证防重放
- [ ] T2.6.3 验证日志记录
- [ ] T2.6.4 验证 HTTPS

### Task 3: 聊天同步 (7 个子任务)

- [ ] T3.1.1 定位 TODO
- [ ] T3.1.2 分析实现逻辑
- [ ] T3.1.3 检查 API 可用性
- [ ] T3.2.1 取消注释代码
- [ ] T3.2.2 注入依赖
- [ ] T3.2.3 实现 createChatRoom
- [ ] T3.2.4 处理失败场景
- [ ] T3.3.1 打开测试文件
- [ ] T3.3.2 测试创建成功
- [ ] T3.3.3 测试创建失败
- [ ] T3.3.4 测试离线场景

### Task 4: 二维码生成 (6 个子任务)

- [ ] T4.1.1 打开 Podfile
- [ ] T4.1.2 添加 EFQRCode
- [ ] T4.1.3 运行 pod install
- [ ] T4.2.1 定位占位符
- [ ] T4.2.2 导入库
- [ ] T4.2.3 实现生成方法
- [ ] T4.2.4 使用真实二维码
- [ ] T4.2.5 处理失败
- [ ] T4.3.1 打开测试文件
- [ ] T4.3.2 测试生成
- [ ] T4.3.3 测试空字符串

### Task 5: 相机预览 (7 个子任务)

- [ ] T5.1.1 定位占位符
- [ ] T5.1.2 添加 previewLayer
- [ ] T5.1.3 初始化预览层
- [ ] T5.1.4 配置会话
- [ ] T5.1.5 添加到视图
- [ ] T5.2.1 检查权限
- [ ] T5.2.2 请求权限
- [ ] T5.2.3 处理拒绝
- [ ] T5.2.4 添加设置入口
- [ ] T5.3.1 打开测试文件
- [ ] T5.3.2 测试权限允许
- [ ] T5.3.3 测试权限拒绝

---

## 🔗 依赖关系图

```
T1 (微信登录 SDK)
├── T1.1 账号准备 (外部)
├── T1.2 CocoaPod (T1.3 前)
├── T1.3 Info.plist (T1.4 前)
├── T1.4 代码实现 (T1.2, T1.3 后)
├── T1.5 AppDelegate (T1.4 后)
├── T1.6 测试 (T1.4 后)
└── T1.7 安全审计 (最后)

T2 (积分 API)
├── T2.1 端点定义
├── T2.2 addPoints (T2.1 后)
├── T2.3 deductPoints (T2.1 后)
├── T2.4 错误处理 (T2.2, T2.3 后)
├── T2.5 测试 (T2.2, T2.3 后)
└── T2.6 安全审计 (最后)

T3 (聊天同步)
├── T3.1 代码分析
├── T3.2 实现 (T3.1 后)
└── T3.3 测试 (T3.2 后)

T4 (二维码)
├── T4.1 添加库
└── T4.2 实现 (T4.1 后)

T5 (相机预览)
├── T5.1 预览层集成
└── T5.2 权限处理 (独立)
```

---

**最后更新**: 2026-02-27
