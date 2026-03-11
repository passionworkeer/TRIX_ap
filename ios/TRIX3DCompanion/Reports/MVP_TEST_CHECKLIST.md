# iOS MVP 完整测试清单

> 生成时间: 2026-03-11
> 目标: 验证 iOS 端能通过配对码/扫码连接 OpenClaw 并收发消息

---

## 一、配对核心功能 (重点)

### 1.1 配对流程测试

| # | 测试项 | 类型 | 状态 | 备注 |
|---|--------|------|------|------|
| 1 | 输入 6 位配对码配对 | 手动 | 🔲 | 需要服务器 |
| 2 | 扫描二维码配对 | 手动 | 🔲 | 需要服务器 |
| 3 | Relay 中继连接 | 手动 | 🔲 | 需要服务器 |
| 4 | 配对成功后收发消息 | 手动 | 🔲 | 核心功能 |

### 1.2 配对 UI 测试

| # | 测试项 | 类型 | 状态 |
|---|--------|------|------|
| 5 | PairingView 渲染 | ✅ 自动化 | - |
| 6 | QRScannerView 渲染 | ✅ 自动化 | - |
| 7 | 输入框验证 (6位码) | ✅ 自动化 | - |

---

## 二、自动化测试 (我可以运行)

### 2.1 单元测试

| # | 测试文件 | 测试数量 | 状态 |
|---|----------|----------|------|
| 1 | SmokeTests.swift | 20+ | ✅ |
| 2 | AuthServiceTests.swift | 15+ | ✅ |
| 3 | APIClientTests.swift | 20+ | ✅ |
| 4 | ChatServiceTests.swift | 15+ | ✅ |
| 5 | StudyServiceTests.swift | 15+ | ✅ |
| 6 | PaymentServiceTests.swift | 15+ | ✅ |
| 7 | PointsServiceTests.swift | 15+ | ✅ |
| 8 | KeychainManagerTests.swift | 10+ | ✅ |
| 9 | DatabaseManagerTests.swift | 15+ | ✅ |
| 10 | ClawbotPairingServiceTests.swift | 15+ | ✅ |
| 11 | WebSocketManagerTests.swift | 15+ | ✅ |
| 12 | NetworkMonitorTests.swift | 10+ | ✅ |
| 13 | OfflineCacheServiceTests.swift | 10+ | ✅ |
| 14 | LocationServiceTests.swift | 10+ | ✅ |
| 15 | NotificationServicesTests.swift | 10+ | ✅ |

### 2.2 冒烟测试

| # | 测试文件 | 状态 |
|---|----------|------|
| 1 | SmokeTests.swift | ✅ 可运行 |
| 2 | SecurityAuditTests.swift | ✅ |

### 2.3 UI 测试

| # | 测试文件 | 状态 |
|---|----------|------|
| 1 | AuthenticationFlowTests.swift | ⚠️ 需要配置 |
| 2 | OnboardingFlowTests.swift | ⚠️ 需要配置 |
| 3 | StoreFlowTests.swift | ⚠️ 需要配置 |
| 4 | SettingsFlowTests.swift | ⚠️ 需要配置 |
| 5 | PairingUITests.swift | ⚠️ 需要配置 |

---

## 三、核心模块测试

### 3.1 认证模块

| # | 测试项 | 类型 | 状态 |
|---|--------|------|------|
| 1 | Apple 登录 | 手动 | 🔲 |
| 2 | 邮箱注册/登录 | 手动 | 🔲 |
| 3 | 登出 | 手动 | 🔲 |
| 4 | Token 刷新 | ✅ 自动化 | - |

### 3.2 聊天模块

| # | 测试项 | 类型 | 状态 |
|---|--------|------|------|
| 1 | 好友列表 | 手动 | 🔲 |
| 2 | 发送文字消息 | 手动 | 🔲 |
| 3 | 接收文字消息 | 手动 | 🔲 |
| 4 | 语音消息录制 | 手动 | 🔲 |
| 5 | 语音消息播放 | 手动 | 🔲 |
| 6 | 消息已读状态 | 手动 | 🔲 |

### 3.3 学习模块

| # | 测试项 | 类型 | 状态 |
|---|--------|------|------|
| 1 | 学习计时器 | 手动 | 🔲 |
| 2 | 虚拟自习室 | 手动 | 🔲 |
| 3 | 学习统计 | 手动 | 🔲 |
| 4 | 专注音乐 | 手动 | 🔲 |

### 3.4 商店模块

| # | 测试项 | 类型 | 状态 |
|---|--------|------|------|
| 1 | 商品列表 | 手动 | 🔲 |
| 2 | 积分购买 (IAP) | 手动 | 🔲 |
| 3 | 订阅功能 | 手动 | 🔲 |
| 4 | 积分历史 | 手动 | 🔲 |

### 3.5 个人中心

| # | 测试项 | 类型 | 状态 |
|---|--------|------|------|
| 1 | 个人资料查看 | 手动 | 🔲 |
| 2 | 头像修改 | 手动 | 🔲 |
| 3 | 设置页面 | 手动 | 🔲 |
| 4 | 主题切换 | 手动 | 🔲 |
| 5 | 语言切换 | 手动 | 🔲 |
| 6 | 隐私设置 | 手动 | 🔲 |

### 3.6 其他功能

| # | 测试项 | 类型 | 状态 |
|---|--------|------|------|
| 1 | 地图定位 | 手动 | 🔲 |
| 2 | 截图分享 | 手动 | 🔲 |
| 3 | 推送通知 | 手动 | 🔲 |
| 4 | TTS 语音播报 | 手动 | 🔲 |

---

## 四、你需要手动测试的清单

### 4.1 配对核心 (必须)

| # | 测试项 | 预期结果 |
|---|--------|----------|
| 1 | 打开配对页面 | PairingView 正常显示 |
| 2 | 点击"扫码配对" | 相机权限请求 → 扫码界面 |
| 3 | 扫描有效二维码 | 解析成功，开始配对 |
| 4 | 输入 6 位配对码 | 输入框限制 6 位，自动大写 |
| 5 | 配对码输入完成后点击验证 | 发起配对请求 |
| 6 | 配对成功 | 显示成功页面，可以开始聊天 |
| 7 | 配对失败 (无效码) | 显示错误提示 |
| 8 | Relay 中继模式输入 server + gatewayId + accessCode | 发起连接 |
| 9 | 连接成功后发送消息 | 消息发送到服务器 |
| 10 | 接收服务器消息 | 消息显示在聊天界面 |

### 4.2 基础功能 (必须)

| # | 测试项 | 预期结果 |
|---|--------|----------|
| 1 | App 启动 | 正常显示首页 |
| 2 | 登录 | 登录成功，进入首页 |
| 3 | 登出 | 返回登录页 |
| 4 | 切换 Tab | 正常切换 |
| 5 | 返回按钮 | 正常返回 |

### 4.3 网络相关 (必须)

| # | 测试项 | 预期结果 |
|---|--------|----------|
| 1 | 有网络正常操作 | 所有功能正常 |
| 2 | 断网提示 | 显示无网络提示 |
| 3 | 网络恢复 | 自动重连 |

---

## 五、测试优先级

### P0 (必须通过)

1. ✅ 编译成功
2. ✅ 登录/登出
3. ✅ 配对流程 (扫码/输入码)
4. ✅ 收发消息
5. ✅ Tab 切换

### P1 (重要)

1. 学习计时器
2. 商店购买
3. 个人资料
4. 设置页面

### P2 (优化)

1. 地图功能
2. 截图分享
3. TTS 语音
4. 推送通知

---

## 六、运行测试命令

```bash
# 1. 编译项目
cd ios/TRIX3DCompanion
xcodebuild -project TRIX3DCompanion.xcodeproj \
  -scheme TRIX3DCompanion \
  -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  build

# 2. 运行单元测试
xcodebuild test \
  -project TRIX3DCompanion.xcodeproj \
  -scheme TRIX3DCompanion \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  -only-testing:TRIX3DCompanionTests

# 3. 运行冒烟测试
xcodebuild test \
  -project TRIX3DCompanion.xcodeproj \
  -scheme TRIX3DCompanion \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  -only-testing:TRIX3DCompanionTests/SmokeTests
```

---

## 七、测试前准备

1. **服务器运行**: 确保配对服务器在运行 (如 `ws://localhost:8765`)
2. **OpenClaw 运行**: 电脑端打开 OpenClaw，生成配对码
3. **模拟器/真机**: 准备 iOS 模拟器或真机
4. **网络**: 确保手机和电脑在同一网络或服务器可达

---

**生成时间**: 2026-03-11
