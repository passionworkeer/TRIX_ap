//
//  ErrorTrackingService.swift
//  TRIX3DCompanion
//
//  Error tracking service for capturing and reporting errors
//

import Foundation
import Sentry
import os.log

/// Error tracking service protocol
protocol ErrorTrackingServiceProtocol {
    func captureError(_ error: Error, context: [String: Any]?)
    func captureMessage(_ message: String, level: SentryLevel, context: [String: Any]?)
    func setUser(userId: String?, email: String?, username: String?)
    func clearUser()
}

/// Main error tracking service implementation
final class ErrorTrackingService: ObservableObject, ErrorTrackingServiceProtocol {

    // MARK: - Singleton

    static let shared = ErrorTrackingService()

    // MARK: - Properties

    private let logger = Logger(subsystem: "com.trix3d.companion", category: "ErrorTracking")
    private var isEnabled: Bool = true
    private let dsn = "YOUR_SENTRY_DSN" // Replace with actual DSN

    // MARK: - Initialization

    private init() {
        #if DEBUG
        isEnabled = false // Disable error tracking in debug
        setupSentry()
        #else
        isEnabled = true
        setupSentry()
        #endif
    }

    // MARK: - Setup

    private func setupSentry() {
        SentrySDK.start { options in
            options.dsn = self.dsn
            options.debug = !self.isEnabled

            // Sample rate: 100% in debug, 10% in production
            #if DEBUG
            options.sampleRate = 1.0
            #else
            options.sampleRate = 0.1
            #endif

            // Environment
            #if DEBUG
            options.environment = "development"
            #else
            options.environment = "production"
            #endif

            // Attach stack trace
            options.attachStackTrace = true

            // Maximum breadcrumbs
            options.maxBreadcrumbs = 50

            // Session timeout
            options.sessionTimeoutInterval = 30

            // Enable app hang tracking
            options.appHang = true

            // Enable auto session tracking
            options.enableAutoSessionTracking = true

            // Release version
            options.releaseName = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
        }

        logger.info("Sentry initialized")
    }

    // MARK: - Public Methods

    /// Capture error
    func captureError(_ error: Error, context: [String: Any]? = nil) {
        guard isEnabled else {
            logger.warning("Error tracking disabled, error: \(error.localizedDescription)")
            return
        }

        // Create scope with context
        let scope = Scope()
        if let context = context {
            for (key, value) in context {
                scope.setExtra(value: value, key: key)
            }
        }

        // Capture error
        SentrySDK.capture(error: error) { scope in
            return scope
        }

        logger.error("Error captured: \(error.localizedDescription)")
    }

    /// Capture message
    func captureMessage(_ message: String, level: SentryLevel = .error, context: [String: Any]? = nil) {
        guard isEnabled else { return }

        // Create scope with context
        let scope = Scope()
        if let context = context {
            for (key, value) in context {
                scope.setExtra(value: value, key: key)
            }
        }

        // Capture message
        SentrySDK.capture(message: message, level: level) { scope in
            return scope
        }

        logger.debug("Message captured: \(message)")
    }

    /// Set user information
    func setUser(userId: String?, email: String?, username: String?) {
        guard isEnabled else { return }

        let user = Sentry.User(
            userId: userId ?? "",
            email: email,
            username: username,
            extras: nil
        )
        SentrySDK.setUser(user)
    }

    /// Clear user information
    func clearUser() {
        guard isEnabled else { return }
        SentrySDK.setUser(nil)
    }

    // MARK: - Convenience Methods

    /// Capture network error
    func captureNetworkError(error: Error, endpoint: String, method: String) {
        captureError(error, context: [
            "endpoint": endpoint,
            "method": method,
            "type": "network_error"
        ])
    }

    /// Capture authentication error
    func captureAuthError(error: Error, method: String) {
        captureError(error, context: [
            "method": method,
            "type": "authentication_error"
        ])
    }

    /// Capture UI error
    func captureUIError(error: Error, screenName: String) {
        captureError(error, context: [
            "screen_name": screenName,
            "type": "ui_error"
        ])
    }

    /// Capture fatal error
    func captureFatalError(message: String, context: [String: Any]? = nil) {
        captureMessage(message, level: .fatal, context: context)
    }
}

// MARK: - Global Error Handler

extension ErrorTrackingService {

    /// Setup global error handler
    func setupGlobalErrorHandler() {
        // Setup NSException handler for Objective-C errors
        NSSetUncaughtExceptionHandler { exception in
            ErrorTrackingService.shared.captureMessage(
                "Uncaught exception: \(exception.reason ?? "Unknown")",
                level: .fatal,
                context: [
                    "name": exception.name.rawValue,
                    "reason": exception.reason ?? ""
                ]
            )
        }

        // Setup signal handler for crashes
        signal(SIGABRT) { signal in
            ErrorTrackingService.shared.captureMessage(
                "Signal received: SIGABRT",
                level: .fatal
            )
        }

        signal(SIGSEGV) { signal in
            ErrorTrackingService.shared.captureMessage(
                "Signal received: SIGSEGV",
                level: .fatal
            )
        }

        logger.info("Global error handlers configured")
    }
}
