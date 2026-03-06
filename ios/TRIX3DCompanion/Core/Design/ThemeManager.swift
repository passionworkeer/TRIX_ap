import SwiftUI
import Combine

// MARK: - Theme Manager
/// 主题管理器 - 统一管理浅色/深色模式
/// 支持系统主题跟随和手动切换
@MainActor
final class ThemeManager: ObservableObject {

    // MARK: - Singleton

    /// 全局主题管理器实例
    static let shared = ThemeManager()

    // MARK: - Published Properties

    /// 当前是否为深色模式
    @Published private(set) var isDarkMode: Bool = false

    /// 当前颜色方案
    @Published private(set) var colorScheme: ColorScheme = .light

    /// 是否跟随系统主题
    @Published var followsSystemTheme: Bool = true

    // MARK: - Private Properties

    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    private init() {
        setupSystemThemeObserver()
        loadSavedThemePreference()
    }

    // MARK: - Public Methods

    /// 切换主题
    func toggleTheme() {
        isDarkMode.toggle()
        colorScheme = isDarkMode ? .dark : .light
        saveThemePreference()
    }

    /// 设置为深色模式
    func setDarkMode(_ enabled: Bool) {
        guard isDarkMode != enabled else { return }
        isDarkMode = enabled
        colorScheme = enabled ? .dark : .light
        followsSystemTheme = false
        saveThemePreference()
    }

    /// 设置颜色方案
    func setColorScheme(_ scheme: ColorScheme) {
        colorScheme = scheme
        isDarkMode = scheme == .dark
    }

    /// 重置为跟随系统主题
    func resetToSystemTheme() {
        followsSystemTheme = true
        updateFromSystemTheme()
        saveThemePreference()
    }

    /// 获取当前实际颜色方案
    func effectiveColorScheme(for colorScheme: ColorScheme?) -> ColorScheme {
        if followsSystemTheme {
            return colorScheme ?? .light
        }
        return self.colorScheme
    }

    // MARK: - Private Methods

    private func setupSystemThemeObserver() {
        // 监听颜色方案变化
        NotificationCenter.default.publisher(for: ColorSchemeChangedNotification)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.updateFromSystemTheme()
            }
            .store(in: &cancellables)
    }

    private func updateFromSystemTheme() {
        guard followsSystemTheme else { return }

        // 获取系统当前颜色方案
        let systemScheme = NSApp.effectiveAppearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua ? ColorScheme.dark : ColorScheme.light
        colorScheme = systemScheme
        isDarkMode = systemScheme == .dark
    }

    private func loadSavedThemePreference() {
        let defaults = UserDefaults.standard

        if defaults.object(forKey: ThemePreferenceKeys.followsSystemTheme) != nil {
            followsSystemTheme = defaults.bool(forKey: ThemePreferenceKeys.followsSystemTheme)
        }

        if defaults.object(forKey: ThemePreferenceKeys.isDarkMode) != nil {
            isDarkMode = defaults.bool(forKey: ThemePreferenceKeys.isDarkMode)
            colorScheme = isDarkMode ? .dark : .light
        }
    }

    private func saveThemePreference() {
        let defaults = UserDefaults.standard
        defaults.set(followsSystemTheme, forKey: ThemePreferenceKeys.followsSystemTheme)
        defaults.set(isDarkMode, forKey: ThemePreferenceKeys.isDarkMode)
    }
}

// MARK: - Theme Preference Keys

private enum ThemePreferenceKeys {
    static let followsSystemTheme = "followsSystemTheme"
    static let isDarkMode = "isDarkMode"
}

// MARK: - Notification Names

private let ColorSchemeChangedNotification = Notification.Name("ColorSchemeChanged")

// MARK: - Theme Colors Extension

extension Color {
    /// 主题颜色集合
    static let theme = ThemeColors()
}

/// 主题颜色定义
struct ThemeColors {
    // MARK: - Brand Colors

    /// 主色
    let primary = Color.brandPurple

    /// 次要色
    let secondary = Color.brandPink

    /// 强调色
    let accent = Color.accent

    // MARK: - Background Colors

    /// 背景色
    var background: Color {
        Color.background
    }

    /// 表面色
    var surface: Color {
        Color.cardBackground
    }

    /// 次级背景色
    var secondaryBackground: Color {
        Color.secondaryBackground
    }

    // MARK: - Text Colors

    /// 主要文本色
    var textPrimary: Color {
        Color.textPrimary
    }

    /// 次要文本色
    var textSecondary: Color {
        Color.textSecondary
    }

    // MARK: - Status Colors

    /// 成功色
    var success: Color {
        Color.success
    }

    /// 警告色
    var warning: Color {
        Color.warning
    }

    /// 错误色
    var error: Color {
        Color.error
    }

    /// 信息色
    var info: Color {
        Color.info
    }

    // MARK: - Border & Separator

    /// 边框色
    var border: Color {
        Color.border
    }

    /// 分割线色
    var separator: Color {
        Color.separator
    }
}

// MARK: - Environment Key

/// 自定义 Environment Key 用于主题管理器
struct ThemeManagerKey: EnvironmentKey {
    static let defaultValue: ThemeManager = ThemeManager.shared
}

extension EnvironmentValues {
    /// 主题管理器环境值
    var themeManager: ThemeManager {
        get { self[ThemeManagerKey.self] }
        set { self[ThemeManagerKey.self] = newValue }
    }
}

// MARK: - View Extension for Theme

extension View {
    /// 根据主题应用样式
    func themed() -> some View {
        self.environment(\.themeManager, ThemeManager.shared)
    }

    /// 应用浅色/深色模式适配
    func adaptToColorScheme(_ colorScheme: ColorScheme?) -> some View {
        self.colorScheme(colorScheme ?? ThemeManager.shared.effectiveColorScheme(for: colorScheme))
    }

    /// 暗黑模式条件修饰器
    @ViewBuilder
    func darkModeOnly(_ content: some View) -> some View {
        if ThemeManager.shared.isDarkMode {
            content
        }
    }

    /// 浅色模式条件修饰器
    @ViewBuilder
    func lightModeOnly(_ content: some View) -> some View {
        if !ThemeManager.shared.isDarkMode {
            content
        }
    }
}

// MARK: - Color Scheme Preference

/// 颜色方案偏好设置
enum ColorSchemePreference: String, CaseIterable {
    case system = "跟随系统"
    case light = "浅色"
    case dark = "深色"

    var colorScheme: ColorScheme? {
        switch self {
        case .system:
            return nil
        case .light:
            return .light
        case .dark:
            return .dark
        }
    }
}

// MARK: - Theme Toggle Button

/// 主题切换按钮组件
struct ThemeToggleButton: View {
    @ObservedObject private var themeManager = ThemeManager.shared

    var body: some View {
        Button(action: {
            themeManager.toggleTheme()
        }) {
            Image(systemName: themeManager.isDarkMode ? "sun.max.fill" : "moon.fill")
                .font(.system(size: 20))
                .foregroundColor(.primary)
                .frame(width: 44, height: 44)
        }
        .buttonStyle(PlainButtonStyle())
        .accessibilityLabel(themeManager.isDarkMode ? "切换到浅色模式" : "切换到深色模式")
    }
}

// MARK: - Preview

#if DEBUG
struct ThemeManager_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: DesignSystem.Spacing.large) {
            // Light Mode
            VStack {
                Text("浅色模式")
                    .font(.headline)
                ThemeToggleButton()
            }
            .padding()
            .background(Color.background)
            .colorScheme(.light)

            // Dark Mode
            VStack {
                Text("深色模式")
                    .font(.headline)
                ThemeToggleButton()
            }
            .padding()
            .background(Color.background)
            .colorScheme(.dark)

            // Theme Colors
            VStack(alignment: .leading, spacing: DesignSystem.Spacing.small) {
                Text("主题颜色")
                    .font(.headline)

                HStack(spacing: DesignSystem.Spacing.medium) {
                    ColorCircle(color: Color.theme.primary, label: "Primary")
                    ColorCircle(color: Color.theme.secondary, label: "Secondary")
                    ColorCircle(color: Color.theme.success, label: "Success")
                    ColorCircle(color: Color.theme.warning, label: "Warning")
                    ColorCircle(color: Color.theme.error, label: "Error")
                }
            }
            .padding()
            .background(Color.secondaryBackground)
        }
        .padding()
    }
}

struct ColorCircle: View {
    let color: Color
    let label: String

    var body: some View {
        VStack(spacing: 4) {
            Circle()
                .fill(color)
                .frame(width: 40, height: 40)
            Text(label)
                .font(.caption2)
                .foregroundColor(.textSecondary)
        }
    }
}
#endif
