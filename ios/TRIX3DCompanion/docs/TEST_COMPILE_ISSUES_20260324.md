# 测试编译问题报告

> 生成时间: 2026-03-24
> 状态: **主项目 BUILD SUCCEEDED**，测试目标部分编译失败

---

## 现状总览

| 模块 | 编译状态 |
|------|---------|
| 主项目 (TRIX3DCompanion) | ✅ BUILD SUCCEEDED |
| 测试目标 (TRIX3DCompanionTests) | ❌ 仍有 1 个文件编译失败 |

---

## 已修复的问题 (本次会话)

### 1. `DataSyncService.swift` — Protocol 成员缺失

**问题**: `DataSyncService` 改为使用 protocol 注入后，调用的方法在 protocol 中不存在。

**修复**:
- `OfflineCacheServiceProtocol` 新增 `cacheUserProfile(_ user: User) async throws`
- `APIClientProtocol` 新增 `getPointsHistory(page: Int, limit: Int) async throws -> [PointsTransaction]`
- `NetworkMonitorProtocol` 已有 `currentStatus: NetworkStatus`，将 `networkMonitor.isConnected` 改为 `networkMonitor.currentStatus.isConnected`（2处）

**涉及文件**:
- `Core/Services/OfflineCacheService.swift`
- `Core/Network/APIClient.swift`
- `Core/Services/DataSyncService.swift`

---

### 2. `DatabaseManagerProtocol` — 缺失 protocol

**问题**: `DataSyncServiceTests.swift` 内声明了 shadowing 的 `protocol DatabaseManagerProtocol`，导致真实 protocol 无法被识别，所有测试 mocks 均报 conformance 错误。

**修复**:
- 创建 `DatabaseManagerProtocol` 到 `Core/Storage/DatabaseManager.swift`
- `DataSyncService` 改为接受 `DatabaseManagerProtocol` 而非具体类型
- 重写 `DataSyncServiceTests.swift`，移除 shadowing declarations，使用真实 protocol

**涉及文件**:
- `Core/Storage/DatabaseManager.swift`
- `Core/Services/DataSyncService.swift`
- `Tests/TRIX3DCompanionTests/Services/DataSyncServiceTests.swift`

---

### 3. 多处 Mock 缺少 `cacheUserProfile` 实现

**问题**: `OfflineCacheServiceProtocol` 新增 `cacheUserProfile` 后，所有 mock 实现均缺失该方法。

**修复**: 为以下 mock 添加空实现 `func cacheUserProfile(_ user: User) async throws {}`:
- `MockOfflineCacheServiceForClawbotHistory` (`ClawbotHistoryServiceTests.swift`)
- `MockOfflineCacheForSync` (`DataSyncServiceTests.swift`)
- `MockOfflineCacheService` (`MockDiagnosticServices.swift`)
- `MockOfflineCacheServiceForProfile` (`MockProfileServices.swift`)

---

### 4. `ProfileViewModelTests.swift` — 重复定义 `UserStats`

**问题**: 测试文件内定义了一个字段不匹配的 `struct UserStats`，与生产代码中的 `UserStats` 冲突，导致 `MockUserServiceForHome.fetchStats()` 返回类型不匹配。

**修复**: 删除 `ProfileViewModelTests.swift` 底部的冗余 `struct UserStats` 定义，改用生产代码中的 `UserStats`。

---

### 5. `MockProfileServices.swift` — 缺失 `import Combine`

**问题**: `MockDataExportService` 使用 `AnyPublisher` 但未 import Combine。

**修复**: 添加 `import Combine`。

---

### 6. `MockVoiceServices.swift` — 属性/方法命名冲突

**问题**: `MockVoicePlayerService` 内同时有 `var simulateError: Bool` 和 `func simulateError()`，Swift 报错。

**修复**: 将布尔属性重命名为 `shouldSimulateError`。

---

### 7. `MockHomeServices.swift` — `MockNotificationService` 重名

**问题**: `MockWorkbenchServices.swift` 和 `MockHomeServices.swift` 都定义了 `MockNotificationService`，导致编译冲突。

**修复**: 将 `MockHomeServices.swift` 中的类重命名为 `MockAppNotificationServiceForHome`，扩展方法同步重命名。

---

### 8. 各 Mock 文件 — 移除冗余 `supabase` 声明

**问题**: `AuthServiceProtocol` 通过 extension 已提供 `var supabase: SupabaseClient? { nil }` 默认实现，mock 不应重复声明。

**修复**: 从以下 mock 中移除 `var supabase: SupabaseClient? { nil }`:
- `MockAuthServiceForClawbotHistory` (`ClawbotHistoryServiceTests.swift`)
- `MockAuthServiceForUserStats` (`UserStatsServiceTests.swift`)
- `MockAuthServiceForChat` (`MockChatServices.swift`)

---

### 9. `NetworkError.custom()` — 缺失标签

**问题**: 错误地使用 `NetworkError.custom("...")` 而非 `NetworkError.custom(message: "...")`。

**修复**: 修正 `MockChatServices.swift` 中的调用。

---

### 10. `MockImageUploadService` — `final class` 继承问题

**问题**: 多个测试文件尝试继承 `ImageUploadService`（`final class`），Swift 不允许。

**修复**:
- `MockImageUploadServiceForSnapshot` (`MockMapServices.swift`) 改为实现 `ImageUploadServiceProtocol`
- `MockImageUploadServiceForProfile` (`MockProfileServices.swift`) 改为实现 `ImageUploadServiceProtocol`
- 移除 `@Published` 属性（protocol 中不存在），改为普通 computed properties
- 方法签名改为 protocol 定义（无默认值参数）

---

### 11. `SettingsViewModel` — `$currentProgress` 在 protocol 中不存在

**问题**: `DataExportServiceProtocol` 暴露的是 `progressPublisher`，不是 `$currentProgress`（Combine projected value）。

**修复**: 改用 `exportService.progressPublisher`。

---

### 12. `StudyServiceTests.swift` — 使用不存在的 `durationMinutes`

**问题**: 测试 helper `createMockSession()` 使用 `durationMinutes`，但 `StudySession` 的实际字段是 `duration`。

**修复**: 修正为 `duration: 0`。

---

## 仍存在的编译错误 (1 个文件)

### `StudyServiceTests.swift` — 引用了不存在的类型

**问题**: `MockWebSocketManagerForStudy` 声明遵循 `WebSocketManagerProtocol`，但此 protocol **在生产代码中不存在**。

历史原因：旧的 `StudyService` 使用 `WebSocketManagerProtocol`（包含 `WebSocketError`、`BotMessage`、`SocketResponse` 等类型）。但当前生产代码中，`StudyService` 已改为使用 `ClawbotChannelServiceProtocol`，这些类型均已不存在。

测试文件使用了旧版 API 签名，与当前 `StudyService` 的初始化和依赖完全不匹配：
- `StudyService.init` 参数为 `apiClient`, `clawbotChannelService`, `authService`，但测试传入的是 `webSocketManager`
- `MockWebSocketManagerForStudy` 实现了不存在的 protocol 和类型

**影响**: 该文件无法编译，**整个测试 target 编译失败**（Swift 将整个 target 作为一个编译单元）。

**修复方案**: 需要重写 `StudyServiceTests.swift`：
1. 移除 `MockWebSocketManagerForStudy`
2. 改为 mock `ClawbotChannelServiceProtocol`（生产代码实际使用的依赖）
3. 修正 `StudyService` 初始化调用
4. 使用正确的生产类型替代不存在的 `WebSocketError`、`BotMessage`、`SocketResponse`

**涉及文件**: `Tests/TRIX3DCompanionTests/Services/StudyServiceTests.swift`

---

## 根因分析

本次会话发现的核心问题是**协议影子（Protocol Shadowing）**：

`DataSyncServiceTests.swift` 在测试 target 内部重新声明了 `NetworkMonitorProtocol`、`OfflineCacheServiceProtocol`、`DatabaseManagerProtocol`，这些声明**隐藏了生产代码中的同名真实 protocol**。结果：
- 真实 protocol 的 mock 实现无法通过 conformance 检查（"does not conform"）
- 错误向各个 mock 文件级联扩散
- 修复了一个 mock 又冒出新的不 conform 错误

**教训**: 测试 target 内禁止重新声明与生产代码同名的 protocol，测试 mocks 必须直接 conforming 到真实 protocol。

---

## 测试执行建议

在 `StudyServiceTests.swift` 修复前，测试 suite 无法完整运行。建议：

```bash
# 临时排除 StudyServiceTests 编译
# 方案：在 xcodebuild 中使用 -only-testing 跳过该文件

# 完整修复后运行
xcodebuild test -workspace TRIX3DCompanion.xcworkspace \
  -scheme TRIX3DCompanion \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro'
```
