import SwiftUI
import Kingfisher
import WhatsNewKit

@main
struct TRIX3DCompanionApp: App {
    @StateObject private var appState = AppState()
    @StateObject private var chatService = ChatService.shared
    @StateObject private var clawbotChannel = ClawbotChannelViewModel.shared
    @State private var themeManager = ThemeManager.shared

    // Performance tracking
    private let launchOptimizer = AppLaunchOptimizer.shared

    // WhatsNew state for automatic presentation on first launch after update
    @State private var whatsNew: WhatsNew? = {
        // Get current locale for bilingual support
        let isChinese = Locale.current.language.languageCode?.identifier == "zh"

        return WhatsNew(
            title: isChinese ? "TRIX3D Companion 新功能" : "New in TRIX3D Companion",
            features: [
                WhatsNew.Feature(
                    image: .init(systemName: "sparkles.tv.fill", foregroundColor: .purple),
                    title: isChinese ? "动画启动屏幕" : "Animated Splash Screen",
                    subtitle: isChinese ? "启动应用时享受精美的动画启动体验" : "Beautiful animated launch experience when starting the app"
                ),
                WhatsNew.Feature(
                    image: .init(systemName: "bubble.left.and.bubble.right.fill", foregroundColor: .blue),
                    title: isChinese ? "实时聊天" : "Real-time Chat",
                    subtitle: isChinese ? "与您的 TRIX3D 机器人实时聊天" : "Chat instantly with your TRIX3D robot in real-time"
                ),
                WhatsNew.Feature(
                    image: .init(systemName: "qrcode.viewfinder", foregroundColor: .green),
                    title: isChinese ? "二维码配对" : "QR Pairing",
                    subtitle: isChinese ? "扫描二维码轻松配对您的设备" : "Connect your TRIX device easily by scanning a QR code"
                ),
                WhatsNew.Feature(
                    image: .init(systemName: "moon.fill", foregroundColor: .indigo),
                    title: isChinese ? "深色模式" : "Dark Mode",
                    subtitle: isChinese ? "完整的深色模式支持，保护您的眼睛" : "Full dark mode support to protect your eyes"
                )
            ]
        )
    }()

    // WhatsNewKit version store for tracking shown version
    private let whatsNewVersionStore = WhatsNewAppVersionStore()

    init() {
        // Start tracking services initialization phase
        launchOptimizer.startPhase(.services)
        configureKingfisher()
    }

    /// Configure Kingfisher cache for better performance
    private func configureKingfisher() {
        let cache = ImageCache.default
        // Memory cache: 100MB
        cache.memoryStorage.config.totalCostLimit = 100 * 1024 * 1024
        // Disk cache: 500MB, 7 days expiration
        cache.diskStorage.config.sizeLimit = 500 * 1024 * 1024
        cache.diskStorage.config.expiration = .days(7)

        // Downloader configuration
        let downloader = ImageDownloader.default
        downloader.downloadTimeout = 15
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
                .environmentObject(chatService)
                .environmentObject(clawbotChannel)
                .environment(\.locale, Locale(identifier: appState.appLanguage.rawValue))
                .id(appState.appLanguage.rawValue)
                .themed(with: themeManager)
                .withToast()
                .sheet(whatsNew: self.$whatsNew, configuration: {
                    // Configure to show only on first launch after app update
                    WhatsNewConfiguration(whatsNew: whatsNew)
                        .applied(\.versionStore, whatsNewVersionStore)
                        .applied(\.animation, .fade)
                })
                .task {
                    // Execute deferred initialization tasks
                    await DeferredInitializationManager.shared.executeDeferredTasks()

                    // Start observing system theme changes for "follow system" mode
                    themeManager.observeSystemThemeChanges()
                }
                .task(id: appState.currentUser?.id) {
                    // Delay Clawbot connection for better startup performance
                    // Connect after 2 seconds to prioritize UI responsiveness
                    if appState.currentUser != nil {
                        try? await Task.sleep(nanoseconds: 2_000_000_000)
                        await clawbotChannel.connect()
                    }
                }
        }
    }
}
