# iOS 端未解决问题清单

> 最后更新: 2026-03-18

本文档记录 TRIX3DCompanion iOS 端目前已知但尚未解决的技术问题。

---

## ✅ 已修复问题

| # | 问题 | 修复日期 | 状态 |
|---|------|----------|------|
| 1 | Socket.IO 支持 | 2026-03-13 | ✅ 已实现 (ClawbotChannelService.swift) |
| 2 | 后端 API 接入 | 2026-03-13 | ✅ User/Friend/Chat/Points 等 20+ 模块 |
| 3 | 配对功能 | 2026-03-13 | ⚠️ 基础实现完成 |
| 4 | 聊天界面点击无反应 | 2026-03-18 | ✅ 已修复 (MainTabView.swift - safeAreaInset) |
| 5 | 主题切换功能 | 2026-03-18 | ✅ 已实现 (ThemeManager + AppState) |
| 6 | 三语言国际化 | 2026-03-18 | ✅ 已修复 (MainTab + 翻译补全) |

---

## 🔴 P0 - 致命问题

### (已修复) 聊天界面点击无反应问题

**修复说明 (2026-03-18)**
- **根因**: `NavigationStack` 与 `.safeAreaInset(edge: .bottom)` 的组合使用导致内部 ScrollView 点击区域计算错误
- **修复方案**: 将 `GlassDockView` 从 `safeAreaInset` 移到 ZStack 中
- **修改文件**: `Features/Home/Views/MainTabView.swift`

---

## 🟠 P1 - 高优先级

### (已修复) 主题切换功能

**修复说明 (2026-03-18)**
- ThemeManager 已实现完整主题管理
- AppState.isDarkMode 现在返回 ThemeManager.isDarkMode
- 支持浅色/深色/跟随系统三种模式
- 主题偏好已持久化到 UserDefaults

---

### (已修复) 三语言国际化

**修复说明 (2026-03-18)**
- 修复 MainTab 硬编码问题：改用 localized key (nav.home, nav.map 等)
- 补充缺失的翻译 key (theme.*, common.*)
- 修复 Preview 文件中的硬编码中文

---

## 🟡 P2 - 中优先级

### (已修复) UI 组件美化

**修复说明 (2026-03-18)**
- 将 21 个核心文件的硬编码颜色替换为主题色
- 替换规则：
  - `.gray` → `.textSecondary` / `.tertiaryBackground`
  - `.purple` → `.brandPurple`
  - `.green` → `.success`
  - `.red` → `.error`
  - `.orange` → `.warning`
  - `.blue` → `.info`
  - `.white.opacity` → `.textPrimary.opacity`
  - `.black.opacity` → `.overlay.opacity`
- 修改文件：ChatListView, MessageBubbleView, ChatInputBar, ProfileView 等 21 个文件

---

## 📊 iOS 问题统计

| 优先级 | 问题数 | 状态 |
|--------|--------|------|
| P0 | 0 | ✅ 全部修复 |
| P1 | 0 | ✅ 全部修复 |
| P2 | 0 | ✅ 已修复 |
| **总计** | **0** | ✅ 全部完成 |

---

## 测试建议

1. **真机测试**：模拟器可能存在触摸事件问题，需要真机验证
2. **API 测试**：使用后端 API 进行集成测试
3. **配对流程**：需要两台设备测试配对功能

---

*更新时间: 2026-03-18*
