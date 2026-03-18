//
//  AppState.swift
//  TRIX3DCompanion
//
//  Global application state management
//  Optimized for fast launch performance
//

import SwiftUI
import Network
import Combine

// MARK: - Main Tab Enum

/// Main application tabs
enum MainTab: String, CaseIterable {
    case home = "nav.home"
    case map = "nav.map"
    case study = "nav.study"
    case core = "nav.core"
    case chat = "nav.chat"
    case profile = "nav.profile"

    var displayName: String {
        rawValue.localized
    }

    var systemImage: String {
        switch self {
        case .home: return "house.fill"
        case .map: return "map.fill"
        case .study: return "book.fill"
        case .core: return "diamond.fill"
        case .chat: return "message.fill"
        case .profile: return "person.fill"
        }
    }

    var icon: String {
        return systemImage
    }
}

enum PendingCompanionRoute: Equatable {
    case trixBot
    case pairing
}

/// Supported in-app languages
enum AppDisplayLanguage: String, CaseIterable, Identifiable {
    case simplifiedChinese = "zh-Hans"
    case traditionalChinese = "zh-Hant"
    case english = "en"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .simplifiedChinese:
            return "简体中文"
        case .traditionalChinese:
            return "繁體中文"
        case .english:
            return "English"
        }
    }

    static func from(localeIdentifier: String) -> AppDisplayLanguage {
        let lowercased = localeIdentifier.lowercased()
        if lowercased.hasPrefix("zh-hant") || lowercased.contains("zh-tw") || lowercased.contains("zh-hk") {
            return .traditionalChinese
        }
        if lowercased.hasPrefix("zh") {
            return .simplifiedChinese
        }
        if lowercased.hasPrefix("en") {
            return .english
        }
        return .english
    }
}

// MARK: - Network Status

/// Network connection status (App-specific simplified version)
/// Note: NetworkMonitor has its own NetworkStatus struct with more details
enum AppNetworkStatus {
    case unknown
    case connected
    case disconnected
}

enum UITestEventLogger {
    private static let logFileName = "trix-ui-events.log"

    // Cached formatters for performance
    private static let iso8601Formatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    static var isEnabled: Bool {
        let arguments = ProcessInfo.processInfo.arguments
        return arguments.contains("--skip-onboarding")
    }

    static func log(_ message: String) {
        guard isEnabled else { return }

        let timestamp = Self.iso8601Formatter.string(from: Date())
        let line = "\(timestamp) \(message)\n"
        guard let data = line.data(using: .utf8) else { return }

        let url = FileManager.default.temporaryDirectory.appendingPathComponent(logFileName)

        if FileManager.default.fileExists(atPath: url.path) {
            if let handle = try? FileHandle(forWritingTo: url) {
                defer { try? handle.close() }
                try? handle.seekToEnd()
                try? handle.write(contentsOf: data)
            }
            return
        }

        try? data.write(to: url, options: .atomic)
    }
}

// MARK: - App State

/// Global application state manager
@MainActor
final class AppState: ObservableObject {

    // MARK: - Singleton

    static let shared = AppState()

    // MARK: - Published Properties - User

    /// Current authenticated user
    @Published private(set) var currentUser: User?

    /// Whether user is currently logged in
    @Published private(set) var isLoggedIn: Bool = false

    // MARK: - Published Properties - UI State

    /// Currently selected tab
    @Published var selectedTab: MainTab = .chat

    /// Pending cross-tab companion destination triggered from other surfaces.
    @Published var pendingCompanionRoute: PendingCompanionRoute?

    /// Dark mode setting (delegated to ThemeManager for consistency)
    var isDarkMode: Bool {
        ThemeManager.shared.isDarkMode
    }

    /// Push notification setting
    @Published var isPushNotificationEnabled: Bool = true

    /// In-app language setting
    @Published var appLanguage: AppDisplayLanguage = .simplifiedChinese

    // MARK: - Published Properties - Network

    /// Current network connection status
    @Published private(set) var networkStatus: AppNetworkStatus = .unknown

    /// Whether network is currently available
    @Published var isNetworkAvailable: Bool = true

    // MARK: - Published Properties - Loading States

    /// Whether app is performing initial loading
    @Published private(set) var isLoading: Bool = false

    /// Loading message for current operation
    @Published private(set) var loadingMessage: String?

    // MARK: - Dependencies

    private let authService: AuthService
    private var networkMonitor: NWPathMonitor?
    private let networkQueue = DispatchQueue(label: "NetworkMonitor")

    // MARK: - Private Properties

    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    /// Initialize app state with dependencies
    /// - Parameter authService: Authentication service (defaults to shared)
    init(
        authService: AuthService? = nil
    ) {
        self.authService = authService ?? .shared

        // Setup with minimal initialization for fast launch
        setupMinimalState()

        // Check initial login state (fast path)
        self.isLoggedIn = self.authService.isLoggedIn
        self.currentUser = self.authService.currentUser
    }

    // MARK: - Setup

    /// Minimal initialization for fast launch
    private func setupMinimalState() {
        // Only load critical preferences synchronously
        let defaults = UserDefaults.standard

        // Dark mode is now managed by ThemeManager
        if let rawLanguage = defaults.string(forKey: "appLanguage"),
           let language = AppDisplayLanguage(rawValue: rawLanguage) {
            appLanguage = language
        } else {
            appLanguage = AppDisplayLanguage.from(localeIdentifier: Locale.preferredLanguages.first ?? "en")
        }

        // Always start with Home tab by default, unless a UI test overrides it.
        selectedTab = launchSelectedTabOverride() ?? .home

        // Load last selected tab only if explicitly set by user
        // For now, always default to home to avoid confusion
        // Uncomment below if persistence is needed after initial setup
        /*
        if let tabRawValue = defaults.string(forKey: "selectedTab"),
           let tab = MainTab(rawValue: tabRawValue) {
            selectedTab = tab
        }
        */

        // Defer heavy setup to after first frame
        DeferredInitializationManager.shared.register { [weak self] in
            await self?.setupDeferredServices()
        }
    }

    /// Full setup to run after first frame is rendered
    @MainActor
    private func setupDeferredServices() async {
        setupNetworkMonitoring()
        setupAuthObservers()
        loadUserPreferences()
    }

    // MARK: - Legacy Setup Methods (now deferred)

    private func setupNetworkMonitoring() {
        networkMonitor = NWPathMonitor()
        networkMonitor?.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in
                self?.isNetworkAvailable = path.status == .satisfied
                self?.networkStatus = path.status == .satisfied ? .connected : .disconnected
            }
        }

        networkMonitor?.start(queue: networkQueue)
    }

    private func setupAuthObservers() {
        // Observe login state changes
        authService.$isLoggedIn
            .receive(on: DispatchQueue.main)
            .sink { [weak self] isLoggedIn in
                self?.isLoggedIn = isLoggedIn
                if isLoggedIn {
                    self?.currentUser = self?.authService.currentUser
                } else {
                    self?.currentUser = nil
                }
            }
            .store(in: &cancellables)

        // Observe user changes
        authService.$currentUser
            .receive(on: DispatchQueue.main)
            .sink { [weak self] user in
                self?.currentUser = user
            }
            .store(in: &cancellables)
    }

    private func loadUserPreferences() {
        let defaults = UserDefaults.standard

        // Dark mode is now managed by ThemeManager

        // Load push notification preference
        isPushNotificationEnabled = defaults.bool(forKey: "isPushNotificationEnabled")

        // Load language preference
        if let rawLanguage = defaults.string(forKey: "appLanguage"),
           let language = AppDisplayLanguage(rawValue: rawLanguage) {
            appLanguage = language
        } else {
            appLanguage = AppDisplayLanguage.from(localeIdentifier: Locale.preferredLanguages.first ?? "en")
        }

        // Load last selected tab
        if let tabRawValue = defaults.string(forKey: "selectedTab"),
           let tab = MainTab(rawValue: tabRawValue) {
            selectedTab = tab
        }

        if let launchSelectedTabOverride = launchSelectedTabOverride() {
            selectedTab = launchSelectedTabOverride
        }
    }

    private func launchSelectedTabOverride() -> MainTab? {
        let arguments = ProcessInfo.processInfo.arguments

        if let inlineArgument = arguments.first(where: { $0.hasPrefix("--initial-tab=") }) {
            let rawValue = String(inlineArgument.dropFirst("--initial-tab=".count))
            return mainTab(from: rawValue)
        }

        if let argumentIndex = arguments.firstIndex(of: "--initial-tab"),
           arguments.indices.contains(argumentIndex + 1) {
            return mainTab(from: arguments[argumentIndex + 1])
        }

        return nil
    }

    private func mainTab(from rawValue: String) -> MainTab? {
        switch rawValue.lowercased() {
        case "home":
            return .home
        case "map":
            return .map
        case "study":
            return .study
        case "core":
            return .core
        case "chat":
            return .chat
        case "profile":
            return .profile
        default:
            return MainTab(rawValue: rawValue)
        }
    }

    // MARK: - Public Methods - Session Management

    /// Refresh current user session
    /// - Parameter force: Force refresh even if session is valid
    func refreshSession(force: Bool = false) async {
        guard isLoggedIn else { return }

        isLoading = true
        loadingMessage = "Refreshing session..."

        let result = await authService.fetchCurrentUser()

        switch result {
        case .success(let user):
            currentUser = user
            let displayName = user.username ?? user.email ?? user.id
            SecureLogger.shared.authEvent("Session refreshed for user: \(displayName)")

        case .failure(let error):
            SecureLogger.shared.error("Failed to refresh session: \(error.localizedDescription)")
            if case AuthError.invalidCredentials = error {
                await logout()
            }
        }

        isLoading = false
        loadingMessage = nil
    }

    /// Logout current user
    func logout() async {
        isLoading = true
        loadingMessage = "Logging out..."

        let _ = await authService.logout()

        // Clear local state
        currentUser = nil
        isLoggedIn = false
        selectedTab = .home

        isLoading = false
        loadingMessage = nil

        SecureLogger.shared.authEvent("User logged out successfully")
    }

    // MARK: - Public Methods - User Preferences

    /// Toggle dark mode (delegated to ThemeManager)
    func toggleDarkMode() {
        ThemeManager.shared.toggleDarkMode()
    }

    /// Set dark mode (delegated to ThemeManager)
    func setDarkMode(_ isEnabled: Bool) {
        ThemeManager.shared.setTheme(isEnabled ? .dark : .light)
    }

    /// Toggle push notifications
    func togglePushNotifications() {
        setPushNotificationsEnabled(!isPushNotificationEnabled)
    }

    /// Set push notifications enabled state
    func setPushNotificationsEnabled(_ isEnabled: Bool) {
        guard isPushNotificationEnabled != isEnabled else { return }
        isPushNotificationEnabled = isEnabled
        saveUserPreferences()
    }

    /// Set app language
    func setAppLanguage(_ language: AppDisplayLanguage) {
        guard appLanguage != language else { return }
        appLanguage = language
        saveUserPreferences()
    }

    /// Update selected tab
    func selectTab(_ tab: MainTab) {
        UITestEventLogger.log("selectTab -> \(tab.rawValue)")
        selectedTab = tab
    }

    // MARK: - Private Methods - Setup

    // Note: setupNetworkMonitoring, setupAuthObservers, loadUserPreferences
    // are now handled by setupDeferredServices for better launch performance

    // MARK: - Private Methods - Persistence

    private func saveUserPreferences() {
        let defaults = UserDefaults.standard

        // Dark mode is now managed by ThemeManager
        defaults.set(isPushNotificationEnabled, forKey: "isPushNotificationEnabled")
        defaults.set(appLanguage.rawValue, forKey: "appLanguage")
        defaults.set(selectedTab.rawValue, forKey: "selectedTab")
    }

    // MARK: - Cleanup

    /// Cleanup resources when app state is deallocated
    deinit {
        networkMonitor?.cancel()
        cancellables.removeAll()
    }
}

// MARK: - Convenience Extensions

extension AppState {

    /// Check if current user has premium features
    var isPremium: Bool {
        currentUser?.points ?? 0 > 0
    }

    /// Get user's display name
    var displayName: String {
        currentUser?.displayName ?? currentUser?.username ?? "User"
    }

    /// Get user's avatar URL if available
    var avatarURL: URL? {
        guard let urlString = currentUser?.avatarUrl else { return nil }
        return URL(string: urlString)
    }

    /// Get user's points
    var userPoints: Int {
        currentUser?.points ?? 0
    }

    /// Spend points (for in-app purchases)
    /// - Parameter amount: Amount of points to spend
    /// - Returns: True if points were successfully spent
    @discardableResult
    func spendPoints(_ amount: Int) -> Bool {
        guard let user = currentUser, (user.points ?? 0) >= amount else {
            return false
        }

        // Create updated user with new points
        let updatedUser = User(
            id: user.id,
            username: user.username,
            email: user.email,
            avatarUrl: user.avatarUrl,
            avatarConfig: user.avatarConfig,
            fullName: user.fullName,
            displayName: user.displayName,
            bio: user.bio,
            website: user.website,
            points: (user.points ?? 0) - amount,
            isStudying: user.isStudying,
            companionId: user.companionId,
            totalStudyTime: user.totalStudyTime,
            lastActiveAt: user.lastActiveAt,
            currentStreak: user.currentStreak,
            daysActive: user.daysActive,
            interactionCount: user.interactionCount,
            showOnlineStatus: user.showOnlineStatus,
            school: user.school,
            grade: user.grade,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        )

        currentUser = updatedUser
        return true
    }

    /// Check if user is currently studying
    var isStudying: Bool {
        currentUser?.isStudying ?? false
    }

    /// Get total study time in minutes
    var totalStudyTime: Int {
        currentUser?.totalStudyTime ?? 0
    }

    /// Format total study time as human readable string
    var formattedStudyTime: String {
        let hours = totalStudyTime / 60
        let minutes = totalStudyTime % 60

        if hours > 0 {
            return "\(hours)h \(minutes)m"
        } else {
            return "\(minutes)m"
        }
    }
}

// MARK: - Preview Support

#Preview("AppState") {
    let state = AppState.shared

    return VStack {
        Text("Current User: \(state.currentUser?.username ?? "None")")
        Text("Is Logged In: \(state.isLoggedIn ? "Yes" : "No")")
        Text("Selected Tab: \(state.selectedTab.rawValue)")
        Text("Network Available: \(state.isNetworkAvailable ? "Yes" : "No")")
        Text("Dark Mode: \(state.isDarkMode ? "On" : "Off")")
    }
}
