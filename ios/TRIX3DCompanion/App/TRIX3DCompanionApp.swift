import SwiftUI

@main
struct TRIX3DCompanionApp: App {
    @StateObject private var appState = AppState()
    @StateObject private var chatService = ChatService.shared
    @State private var themeManager = ThemeManager.shared

    // Performance tracking
    private let launchOptimizer = AppLaunchOptimizer.shared

    init() {
        // Start tracking services initialization phase
        launchOptimizer.startPhase(.services)
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
                .environmentObject(chatService)
                .themed(with: themeManager)
                .onAppear {
                    // End services phase when first view appears
                    launchOptimizer.endPhase(.services)
                    launchOptimizer.startPhase(.initialView)
                }
                .task {
                    // Execute deferred initialization tasks
                    await DeferredInitializationManager.shared.executeDeferredTasks()
                }
        }
    }
}
