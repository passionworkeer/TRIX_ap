# iOS 端未解决问题清单

> 最后更新: 2026-03-05

本文档记录 TRIX3DCompanion iOS 端目前已知但尚未解决的技术问题。

---

## 1. 聊天界面点击无反应问题

### 问题描述
在聊天列表页面，点击 TRIX Bot 入口或好友聊天项时，点击事件没有响应，无法跳转到对应的聊天界面或配对界面。

### 当前状态
- ✅ Mock 数据显示正常
- ✅ 导航结构已修复 (使用 NavigationStack)
- ⚠️ 点击事件可能仍有问题（需要真机测试确认）

### 尝试过的修复
1. 移除嵌套的 NavigationStack
2. 使用回调函数传递导航逻辑
3. 为 Sheet 添加 Environment Object
4. 修复 Tab Bar 隐藏逻辑

### 可能的根因
- iOS 模拟器的触摸事件处理问题
- 某些 View 覆盖了点击区域
- 需要真机测试确认

### 相关文件
- `Features/Home/Views/ChatListView.swift`
- `Features/Home/Views/MainTabView.swift`
- `Features/Home/Views/TrixBotChatView.swift`

---

## 2. 配对功能未完全实现

### 问题描述
配对流程需要与后端 API 集成，目前 iOS 端的配对逻辑只是占位实现。

### 需要实现的功能

#### 2.1 扫描二维码配对
- 需要集成相机扫描功能
- 需要实现 `QRScannerView`
- 需要调用后端 API 验证二维码

#### 2.2 手动输入配对码
- ✅ 已创建输入界面
- ⚠️ 需要调用 `ClawbotChannelService.pairWithCode()`

#### 2.3 配对状态管理
- 需要与 `ClawbotChannelService` 集成
- 需要处理配对成功/失败的回调

### 相关文件
- `Features/Pairing/Views/PairingView.swift`
- `Features/Pairing/Views/QRScannerView.swift`
- `Core/Services/ClawbotChannelService.swift`

---

## 3. 后端 API 未接入

### 问题描述
根据需求文档，iOS 端需要接入以下后端 API 模块：

| 模块 | API 路径 | 状态 |
|------|---------|------|
| 用户模块 | /api/user | ❌ 未实现 |
| 好友模块 | /api/friends | ❌ 未实现 |
| 日程模块 | /api/schedules | ❌ 未实现 |
| 待办模块 | /api/todos | ❌ 未实现 |
| 成就模块 | /api/achievements | ❌ 未实现 |
| 商城模块 | /api/mall | ❌ 未实现 |
| 衣柜模块 | /api/wardrobe | ❌ 未实现 |
| 学习历史 | /api/study/history | ❌ 未实现 |
| 学习记录 | /api/study/sessions | ❌ 未实现 |
| 学习房间 | /api/study/room | ❌ 未实现 |
| 聊天模块 | /api/chat | ❌ 未实现 |
| 配对模块 | /api/pairing | ⚠️ 部分实现 |
| 地点模块 | /api/places | ❌ 未实现 |
| 位置模块 | /api/locations | ❌ 未实现 |
| 积分模块 | /api/points | ❌ 未实现 |
| 快照模块 | /api/snapshots | ❌ 未实现 |
| 通知模块 | /api/notifications | ❌ 未实现 |
| 上传模块 | /api/upload | ❌ 未实现 |
| 未读计数 | /api/unread | ❌ 未实现 |
| AI 对话 | /api/clawbot | ⚠️ 部分实现 |
| 学习目标 | /api/study/goals | ❌ 未实现 |

### 基础信息
- 基础 URL: `http://47.243.55.130:8765/api`
- 认证方式: JWT Bearer Token

---

## 4. 主题切换功能未实现

### 问题描述
需求中提到需要支持主题切换（浅色/深色/自动），但尚未实现。

### 需要实现
- 跟随系统设置自动切换
- 用户手动选择主题偏好
- 持久化用户偏好

---

## 5. 三语言国际化未完成

### 问题描述
需要支持简体中文、繁体中文、英文。

### 当前状态
- ✅ 基础 Localizable.strings 已存在
- ⚠️ 部分 UI 文字尚未国际化
- ❌ String Catalog 未使用

---

## 6. UI 组件美化

### 问题描述
部分 UI 组件的视觉表现需要优化。

### 需要优化
- 颜色对比度
- 可访问性
- 设计风格统一

---

## 7. TTS 语音功能问题

### 问题描述
`TrixBotChatView` 中的 TTS 语音功能需要完整测试。

### 相关代码
```swift
// TrixBotChatView.swift
private func speakBotMessage(_ text: String) async {
    await ttsService.stop()
    await ttsService.setVoice(language: ttsLanguage)

    do {
        try await ttsService.speak(text, language: ttsLanguage.rawValue)
    } catch {
        SecureLogger.shared.error("TTS Error: \(error.localizedDescription)")
    }
}
```

---

## 8. ClawbotChannelService 问题

### 问题描述
代码注释中提到：

> 注意: 当前使用 Starscream WebSocket 库，不支持 Socket.IO 协议
> 需要添加 Socket.IO 库或使用其他方式实现完整功能

### 影响功能
- 配对功能
- 实时消息
- 学习房间

---

## 优先级建议

### 高优先级 (P0)
1. 修复点击无反应问题（需要真机测试）
2. 完成配对功能
3. 接入后端 API

### 中优先级 (P1)
4. 主题切换
5. 国际化完善

### 低优先级 (P2)
6. UI 美化
7. TTS 优化

---

## 测试建议

1. **真机测试**：模拟器可能存在触摸事件问题，需要真机验证
2. **API 测试**：使用后端 API 进行集成测试
3. **配对流程**：需要两台设备测试配对功能

---

## 参考文献

- Web 端配对实现: `src/screens/Pairing.tsx`
- Web 端 Clawbot: `src/contexts/ClawbotChannelContext.tsx`
- 后端 API 文档: `docs/API_DOCUMENTATION.md`
