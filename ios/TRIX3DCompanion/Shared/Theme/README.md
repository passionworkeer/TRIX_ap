# TRIX 3D Companion - Theme System

iOS 主题系统，提供完整的颜色、字体和主题管理功能。

## 文件结构

```
Shared/Theme/
├── Colors.swift         # 颜色系统
├── Typography.swift     # 字体系统
├── Theme.swift         # 主题管理器
└── ThemePreview.swift  # 预览视图 (Debug only)
```

## 快速开始

### 1. 在 App 中启用主题系统

```swift
import SwiftUI

@main
struct TRIX3DCompanionApp: App {
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
                .themed() // 应用主题
        }
    }
}
```

### 2. 使用颜色

```swift
// 品牌颜色
Text("品牌紫")
    .foregroundStyle(.brandPurple)

// 背景色
ZStack {
    Color.background
    // ...
}

// 文本色
Text("标题")
    .foregroundStyle(.textPrimary)

Text("副标题")
    .foregroundStyle(.textSecondary)

// 状态颜色
Image(systemName: "checkmark.circle.fill")
    .foregroundStyle(.success)
```

### 3. 使用字体

```swift
Text("大标题")
    .font(.largeTitle)

Text("正文")
    .font(.bodyStyle)

Text("按钮")
    .font(.button)
```

### 4. 主题切换

```swift
// 获取主题管理器
@State private var themeManager = ThemeManager.shared

// 切换主题
themeManager.setTheme(.dark)
themeManager.setTheme(.light)
themeManager.setTheme(.system)

// 循环切换
themeManager.toggleTheme()

// 切换深色/浅色
themeManager.toggleDarkMode()

// 检查当前是否深色模式
if themeManager.isDarkMode {
    // 深色模式
}
```

## 颜色系统

### 品牌颜色

| 名称 | 颜色值 | 用途 |
|------|--------|------|
| `brandPurple` | #8B5CF6 | 品牌主色 - 紫色 |
| `brandPink` | #EC4899 | 品牌次色 - 粉色 |
| `brandGradient` | Purple → Pink | 品牌渐变 |

### 语义颜色

| 名称 | 浅色模式 | 深色模式 | 用途 |
|------|---------|---------|------|
| `primary` | #8B5CF6 | #8B5CF6 | 主要操作色 |
| `secondary` | #A78BFA | #A78BFA | 次要操作色 |
| `accent` | #EC4899 | #EC4899 | 强调色 |
| `background` | #FFFFFF | #000000 | 主背景 |
| `secondaryBackground` | #F9FAFB | #111827 | 次级背景 |
| `textPrimary` | #111827 | #F9FAFB | 主要文本 |
| `textSecondary` | #6B7280 | #9CA3AF | 次要文本 |
| `success` | #10B981 | #10B981 | 成功状态 |
| `warning` | #F59E0B | #F59E0B | 警告状态 |
| `error` | #EF4444 | #EF4444 | 错误状态 |

## 字体系统

| 样式 | 大小 | 字重 | 用途 |
|------|------|------|------|
| `largeTitle` | 34pt | Bold | 大标题 |
| `titleStyle` | 28pt | Bold | 标题 |
| `title2` | 22pt | Bold | 标题2 |
| `title3` | 20pt | Semibold | 标题3 |
| `headlineStyle` | 20pt | Semibold | 标题 |
| `bodyStyle` | 17pt | Regular | 正文 |
| `callout` | 16pt | Regular | 呼出文字 |
| `subheadlineStyle` | 15pt | Regular | 副标题 |
| `footnote` | 13pt | Regular | 脚注 |
| `caption` | 12pt | Regular | 说明文字 |
| `button` | 17pt | Semibold | 按钮文字 |

## 主题管理

### AppTheme 枚举

```swift
enum AppTheme: String, CaseIterable {
    case system  // 跟随系统
    case light   // 浅色模式
    case dark    // 深色模式
}
```

### ThemeManager 功能

- ✅ 主题切换 (light/dark/system)
- ✅ 主题持久化 (自动保存到 UserDefaults)
- ✅ 系统主题监听
- ✅ SwiftUI 集成 (Environment + PreferredColorScheme)
- ✅ 深色模式检测

## 最佳实践

### 1. 使用语义化颜色

✅ **推荐**
```swift
Text("标题")
    .foregroundStyle(.textPrimary)

ZStack {
    Color.background
}
```

❌ **避免**
```swift
Text("标题")
    .foregroundStyle(Color(hex: "111827"))

ZStack {
    Color.white
}
```

### 2. 使用预定义字体样式

✅ **推荐**
```swift
Text("标题")
    .font(.headlineStyle)
```

❌ **避免**
```swift
Text("标题")
    .font(.system(size: 20, weight: .semibold))
```

### 3. 在视图层级应用主题

✅ **推荐** - 在 App 入口应用
```swift
@main
struct MyApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .themed()
        }
    }
}
```

❌ **避免** - 每个视图都应用
```swift
struct SomeView: View {
    var body: some View {
        Text("Hello")
            .themed() // 不需要
    }
}
```

### 4. 监听主题变化

```swift
struct MyView: View {
    var body: some View {
        ContentView()
            .onThemeChange { newTheme in
                // 主题变化时的处理
                print("Theme changed to: \(newTheme.displayName)")
            }
    }
}
```

## 预览和调试

在 Debug 模式下，可以使用 `ThemePreviewView` 查看所有颜色和字体：

```swift
#if DEBUG
ThemePreviewView()
    .themed()
#endif
```

## 与现有代码集成

### 1. 替换硬编码颜色

```swift
// 旧代码
.foregroundColor(Color(hex: "8B5CF6"))

// 新代码
.foregroundStyle(.brandPurple)
```

### 2. 替换系统字体

```swift
// 旧代码
.font(.title)

// 新代码
.font(.titleStyle)
```

### 3. 添加主题支持

```swift
// 旧代码
struct ContentView: View {
    var body: some View {
        Text("Hello")
    }
}

// 新代码
struct ContentView: View {
    var body: some View {
        Text("Hello")
            .themed() // 在 App 入口处应用即可
    }
}
```

## 常见问题

### Q: 如何在非视图代码中获取当前主题？

```swift
let themeManager = ThemeManager.shared
if themeManager.isDarkMode {
    // 深色模式
}
```

### Q: 如何创建自定义颜色？

```swift
extension Color {
    static var myCustomColor: Color {
        Color(light: Color(hex: "FFFFFF"), dark: Color(hex: "000000"))
    }
}
```

### Q: 如何创建自定义字体样式？

```swift
extension Font {
    static var myCustomFont: Font {
        .custom(size: 18, weight: .medium)
    }
}
```

## 更新日志

### v1.0.0 (2026-02-26)
- ✅ 初始版本
- ✅ 完整的颜色系统 (支持 Light/Dark 模式)
- ✅ 完整的字体系统
- ✅ 主题管理器 (支持持久化)
- ✅ 品牌渐变色支持
- ✅ SwiftUI 集成
- ✅ 预览视图

## 贡献者

- Claude + 用户协作

## 许可证

MIT License
