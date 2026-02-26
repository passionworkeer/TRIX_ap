# Phase 7H: 监控与分析配置指南

**日期**: 2026-02-26
**阶段**: 7H

---

## 1. Firebase 配置

### 1.1 Firebase 项目设置

```swift
// Firebase configuration for TRIX 3D Companion
// File: App/FirebaseConfig.swift

import Foundation
import FirebaseCore
import FirebaseAnalytics
import FirebaseCrashlytics

struct FirebaseConfig {

    /// Configure Firebase services
    static func configure() {
        // Firebase Core
        if FirebaseApp.app() == nil {
            FirebaseApp.configure()
        }

        // Analytics
        configureAnalytics()

        // Crashlytics
        configureCrashlytics()
    }

    /// Configure Analytics
    private static func configureAnalytics() {
        // Enable/disable based on user consent
        let analyticsEnabled = UserDefaultsManager.shared.isAnalyticsEnabled

        if analyticsEnabled {
            Analytics.setAnalyticsCollectionEnabled(true)
        } else {
            Analytics.setAnalyticsCollectionEnabled(false)
        }

        // Set user properties
        setUserProperties()
    }

    /// Configure Crashlytics
    private static func configureCrashlytics() {
        // Enable Crashlytics
        Crashlytics.crashlytics().setCrashlyticsCollectionEnabled(true)

        // Set custom keys
        setCrashlyticsKeys()
    }

    /// Set user properties for analytics
    private static func setUserProperties() {
        if let userId = KeychainManager.shared.getUserId() {
            Analytics.setUserID(userId)
        }

        // Premium status
        let isPremium = AuthService.shared.isPremium
        Analytics.setUserProperty(isPremium ? "premium" : "free", forName: "subscription_type")
    }

    /// Set Crashlytics custom keys
    private static func setCrashlyticsKeys() {
        let keys: [String: Any] = [
            "app_version": Bundle.main.appVersion,
            "build_number": Bundle.main.buildNumber,
            "ios_version": UIDevice.current.systemVersion,
            "device_model": UIDevice.current.model
        ]

        for (key, value) in keys {
            Crashlytics.crashlytics().setCustomValue(value, forKey: key)
        }
    }
}
```

---

## 2. 自定义事件追踪

### 2.1 事件追踪管理器

```swift
// Event tracking service
// File: Core/Services/AnalyticsService.swift

import Foundation
import FirebaseAnalytics

/// Analytics events
enum AnalyticsEvent: String {
    // Authentication
    case login = "login"
    case register = "register"
    case logout = "logout"

    // Study
    case studySessionStart = "study_session_start"
    case studySessionComplete = "study_session_complete"
    case studySessionPause = "study_session_pause"
    case studySessionResume = "study_session_resume"

    // Chat
    case messageSent = "message_sent"
    case messageReceived = "message_received"
    case voiceMessageSent = "voice_message_sent"

    // Points
    case pointsEarned = "points_earned"
    case pointsSpent = "points_spent"
    case premiumPurchased = "premium_purchased"

    // Location
    case locationShared = "location_shared"
    case locationViewed = "location_viewed"

    // Camera
    case photoTaken = "photo_taken"
    case photoSaved = "photo_saved"

    // Errors
    case errorOccurred = "error_occurred"
}

/// Analytics service
final class AnalyticsService {

    static let shared = AnalyticsService()

    private init() {}

    /// Track custom event
    /// - Parameters:
    ///   - event: Event name
    ///   - parameters: Event parameters
    func track(_ event: AnalyticsEvent, parameters: [String: Any] = [:]) {
        // Check if analytics is enabled
        guard UserDefaultsManager.shared.isAnalyticsEnabled else { return }

        // Convert parameters to [String: NSObject]
        let convertedParams = parameters.reduce(into: [String: NSObject]()) { result, pair in
            if let value = pair.value as? NSObject {
                result[pair.key] = value
            } else if let value = pair.value as? Int {
                result[pair.key] = NSNumber(value: value)
            } else if let value = pair.value as? Double {
                result[pair.key] = NSNumber(value: value)
            } else if let value = pair.value as? Bool {
                result[pair.key] = NSNumber(value: value)
            }
        }

        // Log event
        Analytics.logEvent(event.rawValue, parameters: convertedParams)
    }

    // MARK: - Convenience Methods

    /// Track study session
    func trackStudySession(duration: TimeInterval, points: Int) {
        track(.studySessionComplete, parameters: [
            "duration": duration,
            "points_earned": points
        ])
    }

    /// Track message sent
    func trackMessageSent(type: MessageType) {
        track(.messageSent, parameters: [
            "message_type": type.rawValue
        ])
    }

    /// Track error
    func trackError(error: Error, context: String) {
        track(.errorOccurred, parameters: [
            "error_code": (error as NSError).code,
            "error_domain": (error as NSError).domain,
            "context": context
        ])

        // Also log to Crashlytics
        Crashlytics.crashlytics().record(error: error)
    }
}
```

---

## 3. 错误追踪

### 3.1 错误处理

```swift
// Error tracking and reporting
// File: Core/Utilities/ErrorTracker.swift

import Foundation
import FirebaseCrashlytics

/// Error tracker for centralized error handling
final class ErrorTracker {

    static let shared = ErrorTracker()

    private init() {}

    /// Track and report error
    /// - Parameters:
    ///   - error: The error to track
    ///   - context: Context where error occurred
    ///   - userInfo: Additional user information
    func trackError(
        _ error: Error,
        context: String,
        userInfo: [String: Any] = [:]
    ) {
        // Log to console in debug
        #if DEBUG
        print("[ErrorTracker] \(context): \(error.localizedDescription)")
        #endif

        // Log to Crashlytics
        let crashlytics = Crashlytics.crashlytics()

        // Set context
        crashlytics.setCustomValue(context, forKey: "context")

        // Add additional user info
        for (key, value) in userInfo {
            crashlytics.setCustomValue(value, forKey: key)
        }

        // Record error
        crashlytics.record(error: error)
    }

    /// Track non-fatal error
    func trackNonFatal(message: String, context: String) {
        let error = NSError(
            domain: context,
            code: -1,
            userInfo: [NSLocalizedDescriptionKey: message]
        )

        trackError(error, context: context)
    }
}
```

---

## 4. 性能监控

### 4.1 性能追踪

```swift
// Performance monitoring
// File: Core/Utilities/PerformanceMonitor.swift

import Foundation
import FirebasePerformance

/// Performance monitoring service
final class PerformanceMonitor {

    static let shared = PerformanceMonitor()

    private init() {}

    /// Start trace
    /// - Parameter name: Trace name
    /// - Returns: Trace object
    func startTrace(_ name: String) -> Trace? {
        guard Performance.instrumentationEnabled() else { return nil }
        return Performance.startTrace(name: name)
    }

    /// Measure block execution time
    /// - Parameters:
    ///   - name: Metric name
    ///   - block: Block to measure
    func measure<T>(_ name: String, block: () throws -> T) rethrows -> T {
        let trace = startTrace(name)
        defer {
            trace?.stop()
        }
        return try block()
    }

    /// Measure async block
    /// - Parameters:
    ///   - name: Metric name
    ///   - block: Async block to measure
    func measureAsync<T>(_ name: String, block: () async throws -> T) async rethrows -> T {
        let trace = startTrace(name)
        defer {
            trace?.stop()
        }
        return try await block()
    }

    /// Set HTTP metric
    func trackNetworkRequest(url: String, responseTime: TimeInterval, success: Bool) {
        guard let trace = startTrace("network_\(url)") else { return }

        trace.setValue(responseTime, forMetric: "response_time")
        trace.setValue(success ? "success" : "failure", forMetric: "status")
        trace.stop()
    }
}
```

---

## 5. Dashboard 设置

### 5.1 Firebase Console 配置

在 Firebase Console 中配置以下内容：

#### Analytics Dashboard
1. **用户受众群体**
   - 活跃用户 (Active Users)
   - 付费用户 (Premium Users)
   - 学习用户 (Study Users)

2. **转化漏斗**
   - 注册 → 首次学习 → 持续学习
   - 安装 → 激活 → 付费

3. **自定义事件**
   - study_session_complete
   - points_earned
   - premium_purchased

#### Crashlytics Dashboard
1. **崩溃分组**
   - 按错误类型分组
   - 按设备型号分组

2. **关键指标**
   - 无崩溃用户百分比
   - 崩溃率趋势

#### Performance Dashboard
1. **应用启动时间**
2. **网络请求延迟**
3. **慢帧率**

---

## 6. 使用示例

```swift
// 在代码中使用 analytics 服务

// 追踪学习会话
let duration = Date().timeIntervalSince(startTime)
AnalyticsService.shared.trackStudySession(
    duration: duration,
    points: earnedPoints
)

// 追踪错误
do {
    try someFunction()
} catch {
    ErrorTracker.shared.trackError(
        error,
        context: "AuthService.login"
    )
}

// 追踪性能
let result = PerformanceMonitor.shared.measure("api_fetch") {
    api.fetch()
}
```

---

## 7. 隐私与合规

### 7.1 用户同意

```swift
// 在设置中管理 analytics
struct AnalyticsSettings {

    /// Check if analytics is enabled
    static var isEnabled: Bool {
        get { UserDefaultsManager.shared.isAnalyticsEnabled }
        set {
            UserDefaultsManager.shared.setAnalyticsEnabled(newValue)
            Analytics.setAnalyticsCollectionEnabled(newValue)
        }
    }

    /// Request user consent
    static func requestConsent(completion: @escaping (Bool) -> Void) {
        // Show consent dialog
        // On user decision:
        isEnabled = true
        completion(true)
    }
}
```

---

*配置完成日期: 2026-02-26*
