//
//  SecureLogger.swift
//  TRIX3DCompanion
//
//  Secure logging system that redacts sensitive data in production builds
//  Created: Phase 6F Security Audit
//

import Foundation
import os.log

/// Secure logging levels
enum LogLevel: Int, Comparable {
    case debug = 0
    case info = 1
    case warning = 2
    case error = 3

    static func < (lhs: LogLevel, rhs: LogLevel) -> Bool {
        return lhs.rawValue < rhs.rawValue
    }
}

/// Secure logger that automatically redacts sensitive information in production
@available(iOS 14.0, *)
final class SecureLogger {

    // MARK: - Singleton

    static let shared = SecureLogger()

    // MARK: - Properties

    private let subsystem = "com.trix3d.companion"
    private let isProduction: Bool
    private let minimumLevel: LogLevel

    private lazy var logger = Logger(subsystem: subsystem, category: "App")

    // MARK: - Initialization

    private init() {
        #if DEBUG
        self.isProduction = false
        self.minimumLevel = .debug
        #else
        self.isProduction = true
        self.minimumLevel = .info
        #endif
    }

    // MARK: - Public Logging Methods

    /// Log debug message (DEBUG builds only)
    func debug(_ message: String, file: String = #file, function: String = #function, line: Int = #line) {
        log(level: .debug, message: message, file: file, function: function, line: line)
    }

    /// Log info message
    func info(_ message: String, file: String = #file, function: String = #function, line: Int = #line) {
        log(level: .info, message: message, file: file, function: function, line: line)
    }

    /// Log warning message
    func warning(_ message: String, file: String = #file, function: String = #function, line: Int = #line) {
        log(level: .warning, message: message, file: file, function: function, line: line)
    }

    /// Log error message
    func error(_ message: String, file: String = #file, function: String = #function, line: Int = #line) {
        log(level: .error, message: message, file: file, function: function, line: line)
    }

    // MARK: - Specialized Logging Methods

    /// Log location data safely (coordinates redacted in production)
    func location(
        latitude: Double,
        longitude: Double,
        accuracy: Double?,
        file: String = #file,
        function: String = #function,
        line: Int = #line
    ) {
        let message: String
        if isProduction {
            // Redact to ~1km precision
            let lat = String(format: "%.2f", latitude)
            let lon = String(format: "%.2f", longitude)
            message = "Location updated (accuracy: \(accuracy ?? 0)m) [\(lat), \(lon)]"
        } else {
            // Full precision in debug
            let lat = String(format: "%.6f", latitude)
            let lon = String(format: "%.6f", longitude)
            let acc = String(format: "%.1f", accuracy ?? 0)
            message = "Location updated: \(lat), \(lon) (accuracy: \(acc)m)"
        }
        log(level: .debug, message: message, file: file, function: function, line: line)
    }

    /// Log token safely (mostly masked)
    func token(
        _ tokenType: String,
        token: String?,
        file: String = #file,
        function: String = #function,
        line: Int = #line
    ) {
        guard let token = token, !token.isEmpty else {
            log(level: .debug, message: "\(tokenType): (empty)", file: file, function: function, line: line)
            return
        }

        let masked: String
        if token.count > 8 {
            let prefix = String(token.prefix(4))
            let suffix = String(token.suffix(4))
            masked = "\(prefix)****\(suffix)"
        } else {
            masked = "****"
        }

        log(level: .debug, message: "\(tokenType): \(masked)", file: file, function: function, line: line)
    }

    /// Log user action (sanitized in production)
    func userAction(
        _ action: String,
        username: String? = nil,
        file: String = #file,
        function: String = #function,
        line: Int = #line
    ) {
        let message: String
        if isProduction {
            message = "User action: \(action)"
        } else {
            if let username = username {
                message = "User '\(username)' performed: \(action)"
            } else {
                message = "User performed: \(action)"
            }
        }
        log(level: .info, message: message, file: file, function: function, line: line)
    }

    /// Log network request (sanitized in production)
    func networkRequest(
        _ endpoint: String,
        method: String,
        file: String = #file,
        function: String = #function,
        line: Int = #line
    ) {
        log(level: .debug, message: "Network \(method): \(endpoint)", file: file, function: function, line: line)
    }

    /// Log network response (sanitized in production)
    func networkResponse(
        _ endpoint: String,
        statusCode: Int,
        file: String = #file,
        function: String = #function,
        line: Int = #line
    ) {
        let message: String
        if isProduction {
            message = "Network response: \(statusCode)"
        } else {
            message = "Network response for \(endpoint): \(statusCode)"
        }
        log(level: .debug, message: message, file: file, function: function, line: line)
    }

    // MARK: - Private Methods

    private func log(
        level: LogLevel,
        message: String,
        file: String,
        function: String,
        line: Int
    ) {
        // Check minimum level
        guard level >= minimumLevel else { return }

        // Redact sensitive information in production
        let sanitizedMessage = isProduction ? sanitizeForProduction(message) : message

        // Get filename from path
        let filename = (file as NSString).lastPathComponent

        // Format message
        let formattedMessage = "[\(filename):\(line)] \(function): \(sanitizedMessage)"

        // Log using os_log
        switch level {
        case .debug:
            #if DEBUG
            logger.debug("\(formattedMessage)")
            #endif
        case .info:
            logger.info("\(formattedMessage)")
        case .warning:
            logger.warning("\(formattedMessage)")
        case .error:
            logger.error("\(formattedMessage)")
        }
    }

    /// Sanitize message for production by removing sensitive data
    private func sanitizeForProduction(_ message: String) -> String {
        var sanitized = message

        // Remove potential passwords (password=...pwd=...)
        sanitized = sanitized.replacingOccurrences(
            of: "(password|pwd|token|key|secret)=[^\\s\\)]+",
            with: "$1=****",
            options: .regularExpression,
            range: nil
        )

        // Remove email addresses (partial masking)
        sanitized = sanitized.replacingOccurrences(
            of: "([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})",
            with: "****@$2",
            options: .regularExpression,
            range: nil
        )

        // Remove phone numbers (basic pattern)
        sanitized = sanitized.replacingOccurrences(
            of: "\\d{3}[-.]?\\d{3}[-.]?\\d{4}",
            with: "***-***-****",
            options: .regularExpression,
            range: nil
        )

        // Remove credit card numbers (basic pattern)
        sanitized = sanitized.replacingOccurrences(
            of: "\\d{4}[- ]?\\d{4}[- ]?\\d{4}[- ]?\\d{4}",
            with: "****-****-****-****",
            options: .regularExpression,
            range: nil
        )

        // Remove UUIDs/GUIDs (partial masking)
        sanitized = sanitized.replacingOccurrences(
            of: "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}",
            with: "********-****-****-****-************",
            options: .regularExpression,
            range: nil
        )

        return sanitized
    }
}

// MARK: - Convenience Extensions

extension SecureLogger {

    /// Log app lifecycle event
    func lifecycle(_ event: String, file: String = #file, function: String = #function, line: Int = #line) {
        log(level: .info, message: "Lifecycle: \(event)", file: file, function: function, line: line)
    }

    /// Log performance metric
    func performance(_ operation: String, duration: TimeInterval, file: String = #file, function: String = #function, line: Int = #line) {
        let message = String(format: "Performance: %@ took %.2fms", operation, duration * 1000)
        log(level: .debug, message: message, file: file, function: function, line: line)
    }

    /// Log authentication event
    func authEvent(_ event: String, file: String = #file, function: String = #function, line: Int = #line) {
        log(level: .info, message: "Auth: \(event)", file: file, function: function, line: line)
    }
}

// MARK: - Legacy Print Replacement

/// Replacement for print() that uses secure logging
func secureLog(_ message: String, level: LogLevel = .info, file: String = #file, function: String = #function, line: Int = #line) {
    if #available(iOS 14.0, *) {
        switch level {
        case .debug:
            SecureLogger.shared.debug(message, file: file, function: function, line: line)
        case .info:
            SecureLogger.shared.info(message, file: file, function: function, line: line)
        case .warning:
            SecureLogger.shared.warning(message, file: file, function: function, line: line)
        case .error:
            SecureLogger.shared.error(message, file: file, function: function, line: line)
        }
    } else {
        // Fallback for iOS 13
        #if DEBUG
        print("[\(level)] \(message)")
        #endif
    }
}
