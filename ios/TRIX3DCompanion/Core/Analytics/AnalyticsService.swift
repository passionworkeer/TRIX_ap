//
//  AnalyticsService.swift
//  TRIX3DCompanion
//
//  Analytics service for tracking user events and app performance
//

import Foundation
import FirebaseAnalytics
import os.log

/// Analytics event types
enum AnalyticsEvent: String {
    // User Events
    case userLogin = "user_login"
    case userLogout = "user_logout"
    case userRegister = "user_register"

    // Study Events
    case studySessionStart = "study_session_start"
    case studySessionComplete = "study_session_complete"
    case studySessionPause = "study_session_pause"
    case studySessionResume = "study_session_resume"
    case studyTimerStart = "study_timer_start"
    case studyTimerStop = "study_timer_stop"

    // Chat Events
    case messageSent = "message_sent"
    case messageReceived = "message_received"
    case voiceMessageSent = "voice_message_sent"
    case imageSent = "image_sent"

    // Social Events
    case friendAdded = "friend_added"
    case friendRemoved = "friend_removed"
    case qrCodeScanned = "qr_code_scanned"

    // Navigation Events
    case screenView = "screen_view"
    case tabSelected = "tab_selected"

    // Purchase Events
    case purchaseInitiated = "purchase_initiated"
    case purchaseCompleted = "purchase_completed"
    case purchaseFailed = "purchase_failed"
    case pointsEarned = "points_earned"
    case pointsSpent = "points_spent"

    // Error Events
    case errorOccurred = "error_occurred"
    case networkError = "network_error"

    // Feature Usage
    case featureUsed = "feature_used"
    case settingsChanged = "settings_changed"
}

/// Analytics service protocol
protocol AnalyticsServiceProtocol {
    func logEvent(_ event: AnalyticsEvent, parameters: [String: Any]?)
    func setUserProperty(_ value: String, forKey key: String)
    func setUserId(_ userId: String?)
    func logScreenView(screenName: String, screenClass: String?)
}

/// Main analytics service implementation
final class AnalyticsService: ObservableObject, AnalyticsServiceProtocol {

    // MARK: - Singleton

    static let shared = AnalyticsService()

    // MARK: - Properties

    private let logger = Logger(subsystem: "com.trix3d.companion", category: "Analytics")
    private var isEnabled: Bool = true

    // Cached formatters for performance
    private static let iso8601Formatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    // MARK: - Initialization

    private init() {
        #if DEBUG
        isEnabled = false // Disable analytics in debug
        #endif
    }

    // MARK: - Public Methods

    /// Log analytics event
    func logEvent(_ event: AnalyticsEvent, parameters: [String: Any]? = nil) {
        guard isEnabled else {
            logger.debug("Analytics disabled, skipping event: \(event.rawValue)")
            return
        }

        // Add common parameters
        var params = parameters ?? [:]
        params["timestamp"] = Self.iso8601Formatter.string(from: Date())

        // Log to Firebase
        Analytics.logEvent(event.rawValue, parameters: params)

        logger.info("Analytics event logged: \(event.rawValue)")
    }

    /// Set user property
    func setUserProperty(_ value: String, forKey key: String) {
        guard isEnabled else { return }
        Analytics.setUserProperty(value, forName: key)
    }

    /// Set user ID
    func setUserId(_ userId: String?) {
        guard isEnabled else { return }
        Analytics.setUserID(userId)
    }

    /// Log screen view
    func logScreenView(screenName: String, screenClass: String? = nil) {
        guard isEnabled else { return }
        Analytics.logEvent(AnalyticsEvent.screenView.rawValue, parameters: [
            "screen_name": screenName,
            "screen_class": screenClass ?? ""
        ])
    }

    // MARK: - Convenience Methods

    /// Log study session start
    func logStudySessionStart(duration: TimeInterval) {
        logEvent(.studySessionStart, parameters: [
            "planned_duration": duration
        ])
    }

    /// Log study session complete
    func logStudySessionComplete(duration: TimeInterval, pointsEarned: Int) {
        logEvent(.studySessionComplete, parameters: [
            "actual_duration": duration,
            "points_earned": pointsEarned
        ])
    }

    /// Log message sent
    func logMessageSent(type: String) {
        logEvent(.messageSent, parameters: [
            "message_type": type
        ])
    }

    /// Log purchase
    func logPurchase(productId: String, amount: Double, currency: String) {
        logEvent(.purchaseCompleted, parameters: [
            "product_id": productId,
            "amount": amount,
            "currency": currency
        ])
    }

    /// Log error
    func logError(errorCode: String, errorMessage: String, context: String? = nil) {
        var params: [String: Any] = [
            "error_code": errorCode,
            "error_message": errorMessage
        ]
        if let context = context {
            params["context"] = context
        }
        logEvent(.errorOccurred, parameters: params)
    }
}

// MARK: - User Properties

extension AnalyticsService {

    /// User property keys
    enum UserProperty: String {
        case isPremium = "is_premium"
        case userLevel = "user_level"
        case totalStudyTime = "total_study_time"
        case totalPoints = "total_points"
        case friendCount = "friend_count"
        case preferredLanguage = "preferred_language"
    }

    /// Set user property
    func setUserProperty(_ property: UserProperty, value: String) {
        setUserProperty(value, forKey: property.rawValue)
    }

    /// Set premium status
    func setPremiumStatus(_ isPremium: Bool) {
        setUserProperty(.isPremium, value: isPremium ? "true" : "false")
    }

    /// Update user stats
    func updateUserStats(studyTime: TimeInterval, points: Int, friendCount: Int) {
        let studyHours = Int(studyTime / 3600)
        setUserProperty(.totalStudyTime, value: "\(studyHours)")
        setUserProperty(.totalPoints, value: "\(points)")
        setUserProperty(.friendCount, value: "\(friendCount)")
    }
}
