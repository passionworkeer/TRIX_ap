//
//  NetworkLogger.swift
//  TRIX3DCompanion
//
//  Network logging service for API request/response debugging
//

import Foundation

/// Network log entry for request/response tracking
struct NetworkLogEntry: Codable {
    let id: UUID
    let timestamp: Date
    let method: String
    let url: String
    let statusCode: Int?
    let requestHeaders: [String: String]?
    let requestBody: String?
    let responseBody: String?
    let duration: TimeInterval?
    let error: String?

    init(
        id: UUID = UUID(),
        timestamp: Date = Date(),
        method: String,
        url: String,
        statusCode: Int? = nil,
        requestHeaders: [String: String]? = nil,
        requestBody: String? = nil,
        responseBody: String? = nil,
        duration: TimeInterval? = nil,
        error: String? = nil
    ) {
        self.id = id
        self.timestamp = timestamp
        self.method = method
        self.url = url
        self.statusCode = statusCode
        self.requestHeaders = requestHeaders
        self.requestBody = requestBody
        self.responseBody = responseBody
        self.duration = duration
        self.error = error
    }
}

/// Network logger for API request/response logging
/// Automatically logs all API requests and responses with sensitive data redaction
final class NetworkLogger {

    // MARK: - Singleton

    static let shared = NetworkLogger()

    // MARK: - Properties

    private let secureLogger: SecureLogger
    private let isEnabled: Bool
    private let maxBodyLength: Int
    private var logHistory: [NetworkLogEntry] = []
    private let maxHistoryCount = 100

    // Sensitive fields to redact in logs
    private let sensitiveFields = [
        "password",
        "accessToken",
        "refreshToken",
        "authorization",
        "cookie",
        "x-api-key",
        "secret",
        "token",
        "credential"
    ]

    // MARK: - Initialization

    private init() {
        self.secureLogger = SecureLogger.shared

        #if DEBUG
        self.isEnabled = true
        self.maxBodyLength = 5000  // Longer logs in debug
        #else
        self.isEnabled = false  // Disable network logging in production
        #endif
    }

    // MARK: - Public Methods

    /// Log an API request
    /// - Parameters:
    ///   - method: HTTP method
    ///   - url: Request URL
    ///   - headers: Request headers
    ///   - body: Request body (optional)
    /// - Returns: Log entry ID for tracking
    @discardableResult
    func logRequest(
        method: String,
        url: String,
        headers: [String: String]? = nil,
        body: Encodable? = nil
    ) -> UUID {
        guard isEnabled else { return UUID() }

        let entryId = UUID()

        // Convert body to string if available
        var bodyString: String? = nil
        if let body = body {
            bodyString = encodeBodyToString(body)
        }

        // Redact sensitive headers
        let sanitizedHeaders = sanitizeHeaders(headers)

        // Create log entry
        let entry = NetworkLogEntry(
            id: entryId,
            timestamp: Date(),
            method: method,
            url: url,
            requestHeaders: sanitizedHeaders,
            requestBody: bodyString
        )

        // Log to console
        let truncatedBody = truncateBody(bodyString)
        secureLogger.debug("[API REQUEST] \(method) \(url)")
        if let body = truncatedBody {
            secureLogger.debug("[API REQUEST BODY] \(body)")
        }
        if let headers = sanitizedHeaders, !headers.isEmpty {
            let headersString = headers.map { "\($0.key): \(redactSensitiveValue($0.value))" }.joined(separator: ", ")
            secureLogger.debug("[API REQUEST HEADERS] \(headersString)")
        }

        // Store in history
        addToHistory(entry)

        return entryId
    }

    /// Log an API response
    /// - Parameters:
    ///   - entryId: Request entry ID from logRequest
    ///   - statusCode: HTTP status code
    ///   - body: Response body (optional)
    ///   - duration: Request duration in seconds
    ///   - error: Error message (optional)
    func logResponse(
        entryId: UUID,
        statusCode: Int,
        body: Data?,
        duration: TimeInterval,
        error: Error? = nil
    ) {
        guard isEnabled else { return }

        // Convert body to string
        var bodyString: String? = nil
        if let body = body {
            bodyString = String(data: body, encoding: .utf8)
        }

        // Create updated log entry
        let entry = NetworkLogEntry(
            id: entryId,
            timestamp: Date(),
            method: "",  // Will be filled from history if available
            url: "",     // Will be filled from history if available
            statusCode: statusCode,
            responseBody: bodyString,
            duration: duration,
            error: error?.localizedDescription
        )

        // Log to console with appropriate level
        let truncatedBody = truncateBody(bodyString)
        let statusEmoji = getStatusEmoji(for: statusCode)
        let durationMs = duration * 1000

        if let error = error {
            secureLogger.error("[API RESPONSE] \(statusEmoji) \(statusCode) - \(durationMs.formatted(.number.precision(.fractionLength(0))))ms - Error: \(error.localizedDescription)")
        } else {
            let logLevel: (String, LogLevel) = statusCode >= 500
                ? ("[API RESPONSE] \(statusEmoji) \(statusCode) - \(durationMs.formatted(.number.precision(.fractionLength(0))))ms", .error)
                : statusCode >= 400
                    ? ("[API RESPONSE] \(statusEmoji) \(statusCode) - \(durationMs.formatted(.number.precision(.fractionLength(0))))ms", .warning)
                    : ("[API RESPONSE] \(statusEmoji) \(statusCode) - \(durationMs.formatted(.number.precision(.fractionLength(0))))ms", .debug)

            switch logLevel.1 {
            case .error:
                secureLogger.error(logLevel.0)
            case .warning:
                secureLogger.warning(logLevel.0)
            default:
                secureLogger.debug(logLevel.0)
            }
        }

        if let body = truncatedBody {
            secureLogger.debug("[API RESPONSE BODY] \(body)")
        }

        // Update history if entry exists
        updateHistory(entryId: entryId, with: entry)
    }

    /// Get log history
    /// - Parameter limit: Maximum number of entries to return
    /// - Returns: Array of log entries
    func getHistory(limit: Int = 50) -> [NetworkLogEntry] {
        return Array(logHistory.suffix(limit))
    }

    /// Clear log history
    func clearHistory() {
        logHistory.removeAll()
        secureLogger.info("Network log history cleared")
    }

    /// Enable/disable logging
    func setEnabled(_ enabled: Bool) {
        secureLogger.info("Network logging \(enabled ? "enabled" : "disabled")")
    }

    // MARK: - Private Methods

    private func encodeBodyToString(_ body: Encodable) -> String? {
        guard let encodable = body as? any Encodable else { return nil }

        let encoder = JSONEncoder()
        encoder.outputFormatting = .prettyPrinted

        do {
            let data = try encoder.encode(AnyEncodable(encodable))
            return String(data: data, encoding: .utf8)
        } catch {
            return "Failed to encode body: \(error.localizedDescription)"
        }
    }

    private func sanitizeHeaders(_ headers: [String: String]?) -> [String: String]? {
        guard let headers = headers else { return nil }

        var sanitized: [String: String] = [:]
        for (key, value) in headers {
            let lowercaseKey = key.lowercased()
            if sensitiveFields.contains(lowercaseKey) {
                sanitized[key] = "[REDACTED]"
            } else {
                sanitized[key] = value
            }
        }
        return sanitized
    }

    private func redactSensitiveValue(_ value: String) -> String {
        // Check if the value looks like a token
        if value.count > 20 && (value.contains(".") || value.contains("_")) {
            let prefix = String(value.prefix(8))
            let suffix = String(value.suffix(4))
            return "\(prefix)...[REDACTED]...\(suffix)"
        }
        return "[REDACTED]"
    }

    private func truncateBody(_ body: String?) -> String? {
        guard let body = body else { return nil }
        if body.count > maxBodyLength {
            return String(body.prefix(maxBodyLength)) + "\n... [truncated \(body.count - maxBodyLength) characters]"
        }
        return body
    }

    private func getStatusEmoji(for statusCode: Int) -> String {
        switch statusCode {
        case 200...299: return "OK"
        case 300...399: return "REDIRECT"
        case 400: return "BAD_REQUEST"
        case 401: return "UNAUTHORIZED"
        case 403: return "FORBIDDEN"
        case 404: return "NOT_FOUND"
        case 429: return "RATE_LIMIT"
        case 500...599: return "SERVER_ERROR"
        default: return "STATUS_\(statusCode)"
        }
    }

    private func addToHistory(_ entry: NetworkLogEntry) {
        logHistory.append(entry)

        // Trim history if needed
        if logHistory.count > maxHistoryCount {
            logHistory.removeFirst(logHistory.count - maxHistoryCount)
        }
    }

    private func updateHistory(entryId: UUID, with entry: NetworkLogEntry) {
        // Find and update the matching entry
        if let index = logHistory.firstIndex(where: { $0.id == entryId }) {
            var updatedEntry = entry
            // Preserve method and URL from original request
            let originalEntry = logHistory[index]
            logHistory[index] = NetworkLogEntry(
                id: originalEntry.id,
                timestamp: originalEntry.timestamp,
                method: originalEntry.method,
                url: originalEntry.url,
                statusCode: entry.statusCode,
                requestHeaders: originalEntry.requestHeaders,
                requestBody: originalEntry.requestBody,
                responseBody: entry.responseBody,
                duration: entry.duration,
                error: entry.error
            )
        }
    }
}

// MARK: - AnyEncodable Helper

/// Type-erased Encodable wrapper
struct AnyEncodable: Encodable {
    private let encode: (Encoder) throws -> Void

    init(_ wrapped: any Encodable) {
        self.encode = wrapped.encode
    }

    func encode(to encoder: Encoder) throws {
        try encode(encoder)
    }
}
