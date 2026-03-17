import SwiftUI
import Kingfisher

@main
struct TRIX3DCompanionApp: App {
    @StateObject private var appState = AppState()
    @StateObject private var chatService = ChatService.shared
    @StateObject private var clawbotChannel = ClawbotChannelViewModel.shared
    @State private var themeManager = ThemeManager.shared

    // Performance tracking
    private let launchOptimizer = AppLaunchOptimizer.shared

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
                .preferredColorScheme(appState.isDarkMode ? .dark : .light)
                .onAppear {
                    // End services phase when first view appears
                    launchOptimizer.endPhase(.services)
                    launchOptimizer.startPhase(.initialView)
                    themeManager.setTheme(appState.isDarkMode ? .dark : .light)
                }
                .onChange(of: appState.isDarkMode) { isDarkMode in
                    themeManager.setTheme(isDarkMode ? .dark : .light)
                }
                .task {
                    // Execute deferred initialization tasks
                    await DeferredInitializationManager.shared.executeDeferredTasks()
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
