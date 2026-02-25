import SwiftUI

@main
struct TRIX3DCompanionApp: App {
    @StateObject private var appState = AppState()
    @State private var themeManager = ThemeManager.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
                .themed(with: themeManager)
        }
    }
}
