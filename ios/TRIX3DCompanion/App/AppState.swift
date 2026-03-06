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
    case home = "首页"
    case map = "地图"
    case study = "学习"
    case core = "核心"
    case chat = "聊天"
    case profile = "我的"

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

// MARK: - Network Status

/// Network connection status (App-specific simplified version)
/// Note: NetworkMonitor has its own NetworkStatus struct with more details
enum AppNetworkStatus {
    case unknown
    case connected
    case disconnected
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

    /// Dark mode setting
    @Published var isDarkMode: Bool = false

    /// Push notification setting
    @Published var isPushNotificationEnabled: Bool = true

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
        authService: AuthService = .shared
    ) {
        self.authService = authService

        // Setup with minimal initialization for fast launch
        setupMinimalState()

        // Check initial login state (fast path)
        self.isLoggedIn = authService.isLoggedIn
        self.currentUser = authService.currentUser
    }

    // MARK: - Setup

    /// Minimal initialization for fast launch
    private func setupMinimalState() {
        // Only load critical preferences synchronously
        let defaults = UserDefaults.standard

        // Load dark mode preference
        if #available(iOS 16.0, *) {
            isDarkMode = defaults.bool(forKey: "isDarkMode")
        }

        // Always start with Home tab by default
        // This ensures fresh install or reset users see the Home tab
        selectedTab = .home

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

        // Load dark mode preference
        if #available(iOS 16.0, *) {
            isDarkMode = defaults.bool(forKey: "isDarkMode")
        } else {
            isDarkMode = false
        }

        // Load push notification preference
        isPushNotificationEnabled = defaults.bool(forKey: "isPushNotificationEnabled")

        // Load last selected tab
        if let tabRawValue = defaults.string(forKey: "selectedTab"),
           let tab = MainTab(rawValue: tabRawValue) {
            selectedTab = tab
        }
    }

    // MARK: - Public Methods - Session Management

    /// Refresh current user session
    /// - Parameter force: Force refresh even if session is valid
    func refreshSession(force: Bool = false) async {
        guard isLoggedIn else { return }

        isLoading = true
        loadingMessage = "Refreshing session..."

        do {
            let result = await authService.fetchCurrentUser()

            switch result {
            case .success(let user):
                currentUser = user
                SecureLogger.shared.authEvent("Session refreshed for user: \(user.username)")

            case .failure(let error):
                SecureLogger.shared.error("Failed to refresh session: \(error.localizedDescription)")
                // If refresh fails with unauthorized, logout
                if case AuthError.invalidCredentials = error {
                    await logout()
                }
            }

        } catch {
            SecureLogger.shared.error("Unexpected error refreshing session: \(error.localizedDescription)")
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

    /// Toggle dark mode
    func toggleDarkMode() {
        isDarkMode.toggle()
        saveUserPreferences()
    }

    /// Toggle push notifications
    func togglePushNotifications() {
        isPushNotificationEnabled.toggle()
        saveUserPreferences()
    }

    /// Update selected tab
    func selectTab(_ tab: MainTab) {
        selectedTab = tab
    }

    // MARK: - Private Methods - Setup

    // Note: setupNetworkMonitoring, setupAuthObservers, loadUserPreferences
    // are now handled by setupDeferredServices for better launch performance

    // MARK: - Private Methods - Persistence

    private func saveUserPreferences() {
        let defaults = UserDefaults.standard

        defaults.set(isDarkMode, forKey: "isDarkMode")
        defaults.set(isPushNotificationEnabled, forKey: "isPushNotificationEnabled")
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
        guard var user = currentUser, user.points >= amount else {
            return false
        }

        // Create updated user with new points
        let updatedUser = User(
            id: user.id,
            username: user.username,
            email: user.email,
            avatarUrl: user.avatarUrl,
            fullName: user.fullName,
            displayName: user.displayName,
            bio: user.bio,
            points: user.points - amount,
            isStudying: user.isStudying,
            companionId: user.companionId,
            totalStudyTime: user.totalStudyTime,
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
    @StateObject var state = AppState.shared

    return VStack {
        Text("Current User: \(state.currentUser?.username ?? "None")")
        Text("Is Logged In: \(state.isLoggedIn ? "Yes" : "No")")
        Text("Selected Tab: \(state.selectedTab.rawValue)")
        Text("Network Available: \(state.isNetworkAvailable ? "Yes" : "No")")
        Text("Dark Mode: \(state.isDarkMode ? "On" : "Off")")
    }
}
