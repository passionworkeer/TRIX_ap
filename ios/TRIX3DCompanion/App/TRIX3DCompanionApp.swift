import SwiftUI
import Kingfisher
import WhatsNewKit

// MARK: - WhatsNewViewController Representable for SwiftUI

struct WhatsNewViewControllerRepresentable: UIViewControllerRepresentable {
    let whatsNew: WhatsNew
    let versionStore: KeyValueWhatsNewVersionStore

    func makeUIViewController(context: Context) -> UIViewController {
        // Initialize WhatsNewViewController with version store
        // Returns nil if the version has already been seen, so we return an empty VC in that case
        guard let viewController = WhatsNewViewController(
            whatsNew: whatsNew,
            versionStore: versionStore
        ) else {
            return UIViewController()
        }
        return viewController
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {
        // No updates needed
    }
}

@main
struct TRIX3DCompanionApp: App {
    @StateObject private var appState = AppState()
    @StateObject private var chatService = ChatService.shared
    @StateObject private var clawbotChannel = ClawbotChannelViewModel.shared
    @State private var themeManager = ThemeManager.shared
    @State private var showWhatsNew = false

    // Performance tracking
    private let launchOptimizer = AppLaunchOptimizer.shared

    // WhatsNewKit version store for tracking shown version
    private let whatsNewVersionStore = KeyValueWhatsNewVersionStore()

    // WhatsNew instance for bilingual support
    private var whatsNew: WhatsNew {
        // Get current locale for bilingual support
        let isChinese = Locale.current.language.languageCode?.identifier == "zh"

        return WhatsNew(
            title: isChinese ? "TRIX3D Companion 新功能" : "New in TRIX3D Companion",
            items: [
                WhatsNew.Item(
                    title: isChinese ? "动画启动屏幕" : "Animated Splash Screen",
                    subtitle: isChinese ? "启动应用时享受精美的动画启动体验" : "Beautiful animated launch experience when starting the app",
                    image: UIImage(systemName: "sparkles.tv.fill")?.withTintColor(.purple, renderingMode: .alwaysOriginal)
                ),
                WhatsNew.Item(
                    title: isChinese ? "实时聊天" : "Real-time Chat",
                    subtitle: isChinese ? "与您的 TRIX3D 机器人实时聊天" : "Chat instantly with your TRIX3D robot in real-time",
                    image: UIImage(systemName: "bubble.left.and.bubble.right.fill")?.withTintColor(.blue, renderingMode: .alwaysOriginal)
                ),
                WhatsNew.Item(
                    title: isChinese ? "二维码配对" : "QR Pairing",
                    subtitle: isChinese ? "扫描二维码轻松配对您的设备" : "Connect your TRIX device easily by scanning a QR code",
                    image: UIImage(systemName: "qrcode.viewfinder")?.withTintColor(.green, renderingMode: .alwaysOriginal)
                ),
                WhatsNew.Item(
                    title: isChinese ? "深色模式" : "Dark Mode",
                    subtitle: isChinese ? "完整的深色模式支持，保护您的眼睛" : "Full dark mode support to protect your eyes",
                    image: UIImage(systemName: "moon.fill")?.withTintColor(.systemIndigo, renderingMode: .alwaysOriginal)
                )
            ]
        )
    }

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
                .fullScreenCover(isPresented: $showWhatsNew) {
                    WhatsNewViewControllerRepresentable(
                        whatsNew: whatsNew,
                        versionStore: whatsNewVersionStore
                    )
                    .ignoresSafeArea()
                }
                .task {
                    // Execute deferred initialization tasks
                    await DeferredInitializationManager.shared.executeDeferredTasks()

                    // Start observing system theme changes for "follow system" mode
                    themeManager.observeSystemThemeChanges()

                    // Check if we should show WhatsNew (first launch after update)
                    // WhatsNewViewController returns nil if version has already been seen
                    if WhatsNewViewController(whatsNew: whatsNew, versionStore: whatsNewVersionStore) != nil {
                        showWhatsNew = true
                    }
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
