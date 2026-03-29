# 主题系统集成指南

## 快速集成步骤

### 1. 在应用入口启用主题

已在 `TRIX3DCompanionApp.swift` 中完成：

```swift
@main
struct TRIX3DCompanionApp: App {
    @StateObject private var appState = AppState()
    @State private var themeManager = ThemeManager.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
                .themed(with: themeManager) // ✅ 应用主题
        }
    }
}
```

### 2. 在视图中使用主题颜色

#### 替换硬编码颜色

```swift
// ❌ 旧代码
Text("标题")
    .foregroundColor(.black)

ZStack {
    Color.white
}

// ✅ 新代码
Text("标题")
    .foregroundStyle(.textPrimary)

ZStack {
    Color.background
}
```

#### 使用品牌颜色

```swift
// 品牌渐变按钮
Button("开始学习") {
    // action
}
.font(.button)
.foregroundStyle(.white)
.frame(maxWidth: .infinity)
.padding()
.background(Color.brandGradient)
.cornerRadius(12)

// 品牌色图标
Image(systemName: "star.fill")
    .foregroundStyle(.brandPurple)
```

#### 使用语义颜色

```swift
// 文本颜色层级
VStack {
    Text("主标题")
        .font(.headlineStyle)
        .foregroundStyle(.textPrimary)

    Text("副标题")
        .font(.subheadlineStyle)
        .foregroundStyle(.textSecondary)

    Text("说明文字")
        .font(.caption)
        .foregroundStyle(.textTertiary)
}

// 状态颜色
HStack {
    Image(systemName: "checkmark.circle.fill")
        .foregroundStyle(.success)

    Image(systemName: "exclamationmark.triangle.fill")
        .foregroundStyle(.warning)

    Image(systemName: "xmark.circle.fill")
        .foregroundStyle(.error)
}
```

### 3. 在视图中使用字体

#### 使用预定义字体样式

```swift
// ❌ 旧代码
Text("标题")
    .font(.system(size: 34, weight: .bold))

// ✅ 新代码
Text("标题")
    .font(.largeTitle)
```

#### 字体样式示例

```swift
VStack(alignment: .leading, spacing: 16) {
    Text("大标题 34pt")
        .font(.largeTitle)

    Text("标题 28pt")
        .font(.titleStyle)

    Text("标题2 22pt")
        .font(.title2)

    Text("标题3 20pt")
        .font(.title3)

    Text("标题文字 20pt")
        .font(.headlineStyle)

    Text("正文 17pt")
        .font(.bodyStyle)

    Text("呼出文字 16pt")
        .font(.callout)

    Text("副标题 15pt")
        .font(.subheadlineStyle)

    Text("脚注 13pt")
        .font(.footnote)

    Text("说明文字 12pt")
        .font(.caption)
}
```

### 4. 主题切换功能

#### 在设置页面添加主题切换

```swift
struct SettingsView: View {
    @State private var themeManager = ThemeManager.shared

    var body: some View {
        Form {
            Section("外观") {
                Picker("主题", selection: $themeManager.currentTheme) {
                    ForEach(AppTheme.allCases, id: \.self) { theme in
                        Text(theme.displayName).tag(theme)
                    }
                }
                .pickerStyle(.navigationLink)

                HStack {
                    Image(systemName: themeManager.isDarkMode ? "moon.fill" : "sun.max.fill")
                        .foregroundStyle(themeManager.isDarkMode ? .brandPurple : .warning)

                    Text("当前: \(themeManager.isDarkMode ? "深色模式" : "浅色模式")")
                        .font(.subheadlineStyle)
                        .foregroundStyle(.textSecondary)
                }
            }
        }
    }
}
```

#### 快速主题切换按钮

```swift
struct ThemeToggleView: View {
    @State private var themeManager = ThemeManager.shared

    var body: some View {
        Button {
            themeManager.toggleDarkMode()
        } label: {
            Image(systemName: themeManager.isDarkMode ? "sun.max.fill" : "moon.fill")
                .font(.title2)
                .foregroundStyle(.brandPurple)
                .frame(width: 44, height: 44)
                .background(Color.cardBackground)
                .cornerRadius(10)
        }
    }
}
```

### 5. 组件样式示例

#### 卡片样式

```swift
struct CardView: View {
    let title: String
    let subtitle: String

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headlineStyle)
                    .foregroundStyle(.textPrimary)

                Text(subtitle)
                    .font(.subheadlineStyle)
                    .foregroundStyle(.textSecondary)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.subheadline)
                .foregroundStyle(.textTertiary)
        }
        .padding()
        .background(Color.cardBackground)
        .cornerRadius(12)
        .shadow(color: .shadow, radius: 4, x: 0, y: 2)
    }
}
```

#### 输入框样式

```swift
struct StyledTextField: View {
    let title: String
    @Binding var text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.subheadlineStyle)
                .foregroundStyle(.textSecondary)

            TextField("请输入", text: $text)
                .textFieldStyle(.roundedBorder)
                .font(.bodyStyle)
        }
        .padding()
        .background(Color.cardBackground)
        .cornerRadius(12)
    }
}
```

#### 按钮样式

```swift
struct PrimaryButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.button)
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.brandGradient)
                .cornerRadius(12)
        }
    }
}

struct SecondaryButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.button)
                .foregroundStyle(.brandPurple)
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.brandPurple.opacity(0.1))
                .cornerRadius(12)
        }
    }
}
```

### 6. 常见视图更新示例

#### 更新 HomeView

```swift
struct HomeView: View {
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 20) {
                    // 欢迎卡片
                    welcomeCard

                    // 学习进度
                    progressCard
                }
                .padding()
            }
            .navigationTitle("首页")
            .background(Color.background) // ✅ 使用主题背景色
        }
    }

    private var welcomeCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("欢迎回来！")
                .font(.title3)
                .foregroundStyle(.textPrimary) // ✅ 使用主题文本色

            Text("今天的学习目标是 2 小时")
                .font(.bodyStyle)
                .foregroundStyle(.textSecondary) // ✅ 使用次要文本色
        }
        .padding()
        .background(Color.cardBackground) // ✅ 使用卡片背景色
        .cornerRadius(12)
    }

    private var progressCard: some View {
        HStack {
            Image(systemName: "book.fill")
                .font(.title2)
                .foregroundStyle(.brandPurple) // ✅ 使用品牌色

            VStack(alignment: .leading, spacing: 4) {
                Text("今日学习")
                    .font(.subheadlineStyle)
                    .foregroundStyle(.textSecondary)

                Text("1 小时 30 分钟")
                    .font(.headlineStyle)
                    .foregroundStyle(.textPrimary)
            }

            Spacer()
        }
        .padding()
        .background(Color.cardBackground)
        .cornerRadius(12)
        .shadow(color: .shadow, radius: 4) // ✅ 使用主题阴影色
    }
}
```

### 7. 预览和调试

#### 在 Preview 中测试主题

```swift
#if DEBUG
#Preview("Light Theme") {
    HomeView()
        .themed(with: .preview)
}

#Preview("Dark Theme") {
    HomeView()
        .themed(with: .previewDark)
}
#endif
```

#### 查看完整的主题系统预览

```swift
#if DEBUG
// 在任意视图中添加预览按钮
Button("查看主题系统") {
    // 在实际应用中可以用 sheet 或 navigationLink
    ThemePreviewView()
        .themed()
}
#endif
```

## 需要更新的文件清单

### ✅ 已完成
- [x] `TRIX3DCompanionApp.swift` - 已集成主题
- [x] `ContentView.swift` - 已更新为使用主题颜色

### 🔄 建议更新
- [ ] `Features/Auth/Views/LoginView.swift`
- [ ] `Features/Auth/Views/RegisterView.swift`
- [ ] `Features/Home/Views/HomeView.swift`
- [ ] `Features/Home/Views/ProfileView.swift`
- [ ] `Features/Home/Views/ChatListView.swift`
- [ ] `Features/Home/Views/StudyListView.swift`

## 更新步骤

对于每个视图文件：

1. **替换颜色**
   - `.foregroundColor(.black)` → `.foregroundStyle(.textPrimary)`
   - `.foregroundColor(.gray)` → `.foregroundStyle(.textSecondary)`
   - `Color.white` → `Color.background` (背景) 或 `Color.cardBackground` (卡片)
   - `Color.purple` → `Color.brandPurple`

2. **替换字体**
   - `.font(.title)` → `.font(.titleStyle)`
   - `.font(.headline)` → `.font(.headlineStyle)`
   - `.font(.body)` → `.font(.bodyStyle)`

3. **添加预览**
   ```swift
   #Preview("Light") {
       YourView()
           .themed(with: .preview)
   }

   #Preview("Dark") {
       YourView()
           .themed(with: .previewDark)
   }
   ```

## 最佳实践

1. **使用语义化颜色** - 不要使用具体颜色值，使用 `.textPrimary`, `.background` 等
2. **使用预定义字体** - 不要自定义字体大小，使用 `.bodyStyle`, `.headlineStyle` 等
3. **在应用入口应用主题** - 只需调用一次 `.themed()`
4. **测试两种模式** - 在浅色和深色模式下都要测试
5. **使用 Preview** - 为每个视图创建浅色和深色预览

## 常见问题

### Q: 为什么我的视图没有应用主题？
A: 确保在 `TRIX3DCompanionApp.swift` 中调用了 `.themed()`

### Q: 如何在非视图代码中访问主题？
A: 使用 `ThemeManager.shared.isDarkMode` 检查当前模式

### Q: 如何创建自定义颜色？
A: 在 `Colors.swift` 中添加新的颜色扩展，支持浅色和深色模式

### Q: 主题设置会持久化吗？
A: 是的，主题会自动保存到 UserDefaults

## 下一步

1. 逐步更新现有视图文件
2. 创建可复用的组件库 (使用主题系统)
3. 添加更多的自定义颜色和字体样式
4. 在设置页面添加主题切换选项

---

**更新日期**: 2026-03-29
**版本**: 1.0.0
