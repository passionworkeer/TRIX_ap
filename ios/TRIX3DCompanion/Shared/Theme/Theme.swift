import SwiftUI

/// 主题管理器
/// 负责管理应用的主题状态和切换
/// Using ObservableObject for iOS 16 compatibility (Observable macro is iOS 17+)
@MainActor
final class ThemeManager: ObservableObject {

    // MARK: - Singleton

    static let shared = ThemeManager()

    // MARK: - Properties

    /// 当前主题设置
    @Published private(set) var currentTheme: AppTheme {
        didSet {
            UserDefaultsManager.shared.setSelectedTheme(currentTheme)
            updateColorScheme()
        }
    }

    /// 当前颜色方案（用于 SwiftUI）
    private(set) var colorScheme: ColorScheme?

    /// 是否为深色模式
    var isDarkMode: Bool {
        switch currentTheme {
        case .dark:
            return true
        case .light:
            return false
        case .system:
            // 获取系统设置
            if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
               let window = windowScene.windows.first {
                return window.traitCollection.userInterfaceStyle == .dark
            }
            return false
        }
    }

    // MARK: - Initialization

    private init() {
        // 从 UserDefaults 加载保存的主题
        self.currentTheme = UserDefaultsManager.shared.getSelectedTheme()
        self.colorScheme = Self.colorSchemeForTheme(currentTheme)
    }

    // MARK: - Theme Management

    /// 切换主题
    /// - Parameter theme: 新主题
    func setTheme(_ theme: AppTheme) {
        currentTheme = theme
    }

    /// 切换到下一个主题（循环切换）
    func toggleTheme() {
        let allThemes = AppTheme.allCases
        if let currentIndex = allThemes.firstIndex(of: currentTheme) {
            let nextIndex = (currentIndex + 1) % allThemes.count
            currentTheme = allThemes[nextIndex]
        }
    }

    /// 在浅色和深色之间切换
    func toggleDarkMode() {
        switch currentTheme {
        case .light:
            currentTheme = .dark
        case .dark:
            currentTheme = .light
        case .system:
            // 如果是跟随系统，则切换到相反的模式
            currentTheme = isDarkMode ? .light : .dark
        }
    }

    // MARK: - Private Methods

    /// 更新颜色方案
    private func updateColorScheme() {
        colorScheme = Self.colorSchemeForTheme(currentTheme)
    }

    /// 获取主题对应的颜色方案
    /// - Parameter theme: 主题
    /// - Returns: 颜色方案
    private static func colorSchemeForTheme(_ theme: AppTheme) -> ColorScheme? {
        switch theme {
        case .light:
            return .light
        case .dark:
            return .dark
        case .system:
            return nil // nil 表示跟随系统
        }
    }
}

// MARK: - Environment Key

private struct ThemeManagerKey: EnvironmentKey {
    static let defaultValue = ThemeManager.shared
}

extension EnvironmentValues {
    /// 主题管理器环境值
    var themeManager: ThemeManager {
        get { self[ThemeManagerKey.self] }
        set { self[ThemeManagerKey.self] = newValue }
    }
}

// MARK: - View Extension

extension View {

    /// 应用主题到视图
    /// - Parameter themeManager: 主题管理器
    /// - Returns: 应用了主题的视图
    @ViewBuilder
    func themed(with themeManager: ThemeManager = .shared) -> some View {
        if let scheme = themeManager.colorScheme {
            self.environment(\.themeManager, themeManager).preferredColorScheme(scheme)
        } else {
            self.environment(\.themeManager, themeManager)
        }
    }

    /// 监听主题变化
    /// - Parameter action: 主题变化时的回调
    /// - Returns: 应用了监听的视图
    func onThemeChange(perform action: @escaping (AppTheme) -> Void) -> some View {
        self.onReceive(ThemeManager.shared.$currentTheme) { theme in
            action(theme)
        }
    }
}

// MARK: - Color Scheme Detection

extension ThemeManager {

    /// 监听系统主题变化
    func observeSystemThemeChanges() {
        // 监听系统主题变化通知
        NotificationCenter.default.addObserver(
            forName: UIApplication.didBecomeActiveNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            if self?.currentTheme == .system {
                self?.updateColorScheme()
            }
        }
    }

    /// 停止监听系统主题变化
    func stopObservingSystemThemeChanges() {
        NotificationCenter.default.removeObserver(
            self,
            name: UIApplication.didBecomeActiveNotification,
            object: nil
        )
    }
}

// MARK: - Preview Support

#if DEBUG
extension ThemeManager {
    /// 预览用的主题管理器
    static var preview: ThemeManager {
        let manager = ThemeManager()
        manager.currentTheme = .light
        return manager
    }

    /// 预览用的深色主题管理器
    static var previewDark: ThemeManager {
        let manager = ThemeManager()
        manager.currentTheme = .dark
        return manager
    }
}
#endif

// MARK: - Convenience Properties

extension ThemeManager {

    /// 主题颜色
    var colors: Color.Type {
        Color.self
    }

    /// 主题字体
    var fonts: Font.Type {
        Font.self
    }
}
