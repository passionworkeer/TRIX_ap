//
//  SecurityHeadersValidator.swift
//  TRIX3DCompanion
//
//  Security headers validator for API responses
//

import Foundation
import Alamofire

/// Security headers validator
/// Validates that responses contain proper security headers
final class SecurityHeadersValidator {

    // MARK: - Singleton

    static let shared = SecurityHeadersValidator()

    // MARK: - Types

    /// Security header requirement
    struct HeaderRequirement {
        let name: String
        let required: Bool
        let validate: ((String?) -> Bool)?

        init(
            name: String,
            required: Bool = true,
            validate: ((String?) -> Bool)? = nil
        ) {
            self.name = name
            self.required = required
            self.validate = validate
        }
    }

    /// Validation result
    enum ValidationResult {
        case valid
        case missing(header: String)
        case invalid(header: String, reason: String)
        case warning(header: String, reason: String)

        var isValid: Bool {
            if case .valid = self {
                return true
            }
            return false
        }
    }

    /// Validation mode
    enum ValidationMode {
        case strict      // Fail on any violation
        case moderate    // Fail on critical violations only
        case lenient     // Only warn, don't fail
    }

    // MARK: - Properties

    /// Current validation mode
    private(set) var mode: ValidationMode

    /// Required security headers
    private let requiredHeaders: [HeaderRequirement]

    /// Enable validation
    private(set) var isEnabled: Bool

    // MARK: - Initialization

    private init() {
        // Use strict mode in production
        #if DEBUG
        self.mode = .moderate
        self.isEnabled = true
        #else
        self.mode = .strict
        self.isEnabled = true
        #endif

        // Define required security headers
        self.requiredHeaders = [
            // Content Security Policy
            HeaderRequirement(
                name: "Content-Security-Policy",
                required: false, // Not typically sent by API
                validate: nil
            ),

            // Strict Transport Security
            HeaderRequirement(
                name: "Strict-Transport-Security",
                required: true,
                validate: { value in
                    guard let value = value else { return false }
                    // Should have max-age and includeSubDomains
                    return value.contains("max-age=") &&
                           (value.contains("includeSubDomains") || value.contains("max-age=31536000"))
                }
            ),

            // X-Content-Type-Options
            HeaderRequirement(
                name: "X-Content-Type-Options",
                required: true,
                validate: { $0 == "nosniff" }
            ),

            // X-Frame-Options
            HeaderRequirement(
                name: "X-Frame-Options",
                required: true,
                validate: { value in
                    guard let value = value else { return false }
                    return value == "DENY" || value == "SAMEORIGIN"
                }
            ),

            // X-XSS-Protection
            HeaderRequirement(
                name: "X-XSS-Protection",
                required: false, // Deprecated but nice to have
                validate: { value in
                    value?.contains("1; mode=block") == true
                }
            ),

            // Cache Control (for sensitive endpoints)
            HeaderRequirement(
                name: "Cache-Control",
                required: true,
                validate: { value in
                    guard let value = value else { return false }
                    return value.contains("no-store") ||
                           value.contains("no-cache") ||
                           value.contains("private")
                }
            ),

            // Pragma (for HTTP/1.0 compatibility)
            HeaderRequirement(
                name: "Pragma",
                required: false,
                validate: { $0 == "no-cache" }
            ),

            // Content Type
            HeaderRequirement(
                name: "Content-Type",
                required: true,
                validate: { value in
                    value?.contains("application/json") == true
                }
            )
        ]
    }

    // MARK: - Public Methods

    /// Enable or disable validation
    /// - Parameter enabled: Whether to enable validation
    func setEnabled(_ enabled: Bool) {
        isEnabled = enabled
        SecureLogger.shared.info("Security headers validation \(enabled ? "enabled" : "disabled")")
    }

    /// Update validation mode
    /// - Parameter newMode: New validation mode
    func updateMode(_ newMode: ValidationMode) {
        mode = newMode
        SecureLogger.shared.info("Security headers validation mode: \(newMode)")
    }

    /// Validate response headers
    /// - Parameter response: HTTP URL response
    /// - Returns: Validation result
    func validate(_ response: HTTPURLResponse) -> ValidationResult {
        guard isEnabled else {
            return .valid
        }

        var criticalIssues: [String] = []
        var warnings: [String] = []

        for requirement in requiredHeaders {
            let headerValue = response.value(forHTTPHeaderField: requirement.name)

            // Check if required header is missing
            if requirement.required && headerValue == nil {
                if mode == .strict {
                    return .missing(header: requirement.name)
                } else {
                    criticalIssues.append(requirement.name)
                }
            }

            // Validate header value if validator exists
            if let validator = requirement.validate {
                if !validator(headerValue) {
                    if requirement.required {
                        if mode == .strict {
                            return .invalid(
                                header: requirement.name,
                                reason: "Header value does not meet security requirements"
                            )
                        } else {
                            criticalIssues.append(requirement.name)
                        }
                    } else {
                        warnings.append(
                            "\(requirement.name): Optional header does not meet recommended value"
                        )
                    }
                }
            }
        }

        // Return based on mode and issues found
        if !criticalIssues.isEmpty {
            return .invalid(
                header: criticalIssues.first!,
                reason: "Critical security headers missing or invalid"
            )
        }

        if !warnings.isEmpty && mode == .strict {
            return .warning(
                header: warnings.first!,
                reason: "Optional security headers not properly configured"
            )
        }

        return .valid
    }

    /// Validate response and log issues
    /// - Parameter response: HTTP URL response
    /// - Returns: True if validation passed
    @discardableResult
    func validateAndLog(_ response: HTTPURLResponse) -> Bool {
        let result = validate(response)

        switch result {
        case .valid:
            return true

        case .missing(let header):
            SecureLogger.shared.error("Missing required security header: \(header)")

        case .invalid(let header, let reason):
            SecureLogger.shared.error("Invalid security header '\(header)': \(reason)")

        case .warning(let header, let reason):
            SecureLogger.shared.warning("Security header warning '\(header)': \(reason)")
        }

        return result.isValid
    }

    /// Get detailed validation report
    /// - Parameter response: HTTP URL response
    /// - Returns: Detailed validation report
    func getValidationReport(for response: HTTPURLResponse) -> ValidationReport {
        var report = ValidationReport(url: response.url?.absoluteString ?? "unknown")

        for requirement in requiredHeaders {
            let headerValue = response.value(forHTTPHeaderField: requirement.name)
            let isPresent = headerValue != nil
            let isValid = requirement.validate?(headerValue) ?? true

            report.addHeader(
                name: requirement.name,
                isPresent: isPresent,
                isValid: isValid,
                value: headerValue
            )
        }

        report.overallResult = validate(response)

        return report
    }

    // MARK: - Configuration

    /// Add custom header requirement
    /// - Parameter requirement: Custom header requirement
    func addHeaderRequirement(_ requirement: HeaderRequirement) {
        // This would require making requiredHeaders mutable
        // For now, we'll log a warning
        SecureLogger.shared.warning("Custom header requirements not yet implemented")
    }

    /// Remove header requirement
    /// - Parameter headerName: Name of header to remove
    func removeHeaderRequirement(_ headerName: String) {
        // This would require making requiredHeaders mutable
        SecureLogger.shared.warning("Header requirement removal not yet implemented")
    }
}

// MARK: - Validation Report

/// Detailed validation report
struct ValidationReport {
    let url: String
    private(set) var headers: [String: HeaderValidation] = [:]
    private(set) var overallResult: SecurityHeadersValidator.ValidationResult = .valid

    mutating func addHeader(
        name: String,
        isPresent: Bool,
        isValid: Bool,
        value: String?
    ) {
        headers[name] = HeaderValidation(
            name: name,
            isPresent: isPresent,
            isValid: isValid,
            value: value
        )
    }

    /// Generate human-readable report
    func generateReport() -> String {
        var report = "Security Headers Validation Report\n"
        report += "===================================\n"
        report += "URL: \(url)\n\n"

        for (name, validation) in headers.sorted(by: { $0.key < $1.key }) {
            let status = validation.isValid ? "✓" : "✗"
            let presence = validation.isPresent ? "Present" : "Missing"

            report += "\(status) \(name)\n"
            report += "   Status: \(presence)"

            if let value = validation.value {
                report += "\n   Value: \(value)"
            }

            if !validation.isValid {
                report += " [INVALID]"
            }

            report += "\n\n"
        }

        switch overallResult {
        case .valid:
            report += "Overall: VALID ✓"
        case .missing(let header):
            report += "Overall: INVALID - Missing '\(header)'"
        case .invalid(let header, let reason):
            report += "Overall: INVALID - '\(header)': \(reason)"
        case .warning(let header, let reason):
            report += "Overall: WARNING - '\(header)': \(reason)"
        }

        return report
    }
}

/// Header validation information
struct HeaderValidation {
    let name: String
    let isPresent: Bool
    let isValid: Bool
    let value: String?
}

// MARK: - Response Validator Extension

extension SecurityHeadersValidator {

    /// Create response validator for use with Alamofire
    /// - Returns: Closure that validates responses
    func makeResponseValidator() -> (HTTPURLResponse) -> Bool {
        return { [weak self] response in
            guard let self = self else { return true }
            return self.validateAndLog(response)
        }
    }
}
