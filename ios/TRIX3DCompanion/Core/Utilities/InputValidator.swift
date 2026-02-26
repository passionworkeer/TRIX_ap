//
//  InputValidator.swift
//  TRIX3DCompanion
//
//  Comprehensive input validation for security
//  Created: Phase 6F Security Audit
//

import Foundation
import LocalAuthentication

/// Validation error types
enum ValidationError: Error, LocalizedError {
    case emailInvalid
    case emailTooLong
    case emailMalformed
    case passwordTooShort
    case passwordNoUppercase
    case passwordNoLowercase
    case passwordNoNumber
    case passwordNoSpecialChar
    case passwordCommon
    case usernameTooShort
    case usernameTooLong
    case usernameInvalidCharacters
    case usernameReserved
    case inputEmpty
    case inputTooLong(maxLength: Int)
    case invalidFormat

    var errorDescription: String? {
        switch self {
        case .emailInvalid:
            return "Please enter a valid email address."
        case .emailTooLong:
            return "Email address is too long."
        case .emailMalformed:
            return "Email address format is invalid."
        case .passwordTooShort:
            return "Password must be at least 8 characters."
        case .passwordNoUppercase:
            return "Password must contain at least one uppercase letter."
        case .passwordNoLowercase:
            return "Password must contain at least one lowercase letter."
        case .passwordNoNumber:
            return "Password must contain at least one number."
        case .passwordNoSpecialChar:
            return "Password must contain at least one special character (!@#$%^&*)."
        case .passwordCommon:
            return "This password is too common. Please choose a more secure password."
        case .usernameTooShort:
            return "Username must be at least 3 characters."
        case .usernameTooLong:
            return "Username must be less than 30 characters."
        case .usernameInvalidCharacters:
            return "Username can only contain letters, numbers, and underscores."
        case .usernameReserved:
            return "This username is reserved and cannot be used."
        case .inputEmpty:
            return "This field cannot be empty."
        case .inputTooLong(let maxLength):
            return "This field cannot exceed \(maxLength) characters."
        case .invalidFormat:
            return "Invalid format."
        }
    }
}

/// Password strength level
enum PasswordStrength: Int, Comparable {
    case veryWeak = 0
    case weak = 1
    case fair = 2
    case good = 3
    case strong = 4

    var description: String {
        switch self {
        case .veryWeak: return "Very Weak"
        case .weak: return "Weak"
        case .fair: return "Fair"
        case .good: return "Good"
        case .strong: return "Strong"
        }
    }

    var color: String {
        switch self {
        case .veryWeak: return "red"
        case .weak: return "orange"
        case .fair: return "yellow"
        case .good: return "lightgreen"
        case .strong: return "green"
        }
    }

    static func < (lhs: PasswordStrength, rhs: PasswordStrength) -> Bool {
        return lhs.rawValue < rhs.rawValue
    }
}

/// Comprehensive input validator
final class InputValidator {

    // MARK: - Singleton

    static let shared = InputValidator()

    // MARK: - Constants

    /// Maximum email length per RFC 5321
    private let maxEmailLength = 254

    /// Minimum password length
    private let minPasswordLength = 8

    /// Maximum password length
    private let maxPasswordLength = 128

    /// Minimum username length
    private let minUsernameLength = 3

    /// Maximum username length
    private let maxUsernameLength = 30

    /// Reserved usernames
    private let reservedUsernames = Set([
        "admin", "administrator", "root", "system", "api",
        "support", "help", "info", "blog", "www",
        "mail", "email", "ftp", "localhost", "webmaster",
        "noreply", "no-reply", "test", "demo", "example"
    ])

    /// Common passwords blacklist (top 100 for demo - should be 10,000+ in production)
    private let commonPasswords = Set([
        "12345678", "password", "123456789", "12345678",
        "12345", "1234567", "1234567890", "qwerty",
        "abc123", "Password1", "123456", "111111",
        "12345678910", "iloveyou", "adobe123", "123abc",
        "admin", "123123", "sunshine", "princess",
        "azerty", "trustno1", "000000", "password123"
        // In production, load from file containing 10,000+ common passwords
    ])

    // MARK: - Email Validation

    /// Validate email address with comprehensive checks
    func validateEmail(_ email: String) -> Result<Void, ValidationError> {
        // Check empty
        let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return .failure(.inputEmpty)
        }

        // Check length (RFC 5321: max 254 characters)
        guard trimmed.count <= maxEmailLength else {
            return .failure(.emailTooLong)
        }

        // Check basic format with improved regex
        let emailRegex = #"^[A-Za-z0-9](?:[A-Za-z0-9._%+-]{0,61}[A-Za-z0-9])?@[A-Za-z0-9](?:[A-Za-z0-9.-]{0,61}[A-Za-z0-9])?\.[A-Za-z]{2,}$"#
        guard trimmed.range(of: emailRegex, options: .regularExpression) != nil else {
            return .failure(.emailMalformed)
        }

        // Check for consecutive dots (not allowed)
        guard !trimmed.contains("..") else {
            return .failure(.emailMalformed)
        }

        // Check for leading/trailing dots
        guard !trimmed.hasPrefix(".") || !trimmed.hasSuffix(".") else {
            return .failure(.emailMalformed)
        }

        // Check for invalid characters in local part
        let components = trimmed.split(separator: "@")
        if components.count == 2 {
            let localPart = String(components[0])
            let invalidChars = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._%+-").inverted
            guard localPart.unicodeScalars.allSatisfy({ !invalidChars.contains($0) }) else {
                return .failure(.emailMalformed)
            }
        }

        return .success(())
    }

    // MARK: - Password Validation

    /// Validate password with comprehensive security checks
    func validatePassword(_ password: String) -> Result<Void, ValidationError> {
        // Check empty
        let trimmed = password.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return .failure(.inputEmpty)
        }

        // Check length
        guard trimmed.count >= minPasswordLength else {
            return .failure(.passwordTooShort)
        }

        guard trimmed.count <= maxPasswordLength else {
            return .failure(.inputTooLong(maxLength: maxPasswordLength))
        }

        // Check for uppercase letter
        guard trimmed.range(of: "[A-Z]", options: .regularExpression) != nil else {
            return .failure(.passwordNoUppercase)
        }

        // Check for lowercase letter
        guard trimmed.range(of: "[a-z]", options: .regularExpression) != nil else {
            return .failure(.passwordNoLowercase)
        }

        // Check for number
        guard trimmed.range(of: "[0-9]", options: .regularExpression) != nil else {
            return .failure(.passwordNoNumber)
        }

        // Check for special character
        let specialChars = CharacterSet(charactersIn: "!@#$%^&*")
        guard trimmed.rangeOfCharacter(from: specialChars) != nil else {
            return .failure(.passwordNoSpecialChar)
        }

        // Check against common passwords
        let lowercased = trimmed.lowercased()
        guard !commonPasswords.contains(lowercased) else {
            return .failure(.passwordCommon)
        }

        return .success(())
    }

    /// Calculate password strength (0-4)
    func calculatePasswordStrength(_ password: String) -> PasswordStrength {
        var score = 0

        // Length check
        if password.count >= 8 { score += 1 }
        if password.count >= 12 { score += 1 }

        // Character variety
        if password.range(of: "[a-z]", options: .regularExpression) != nil { score += 1 }
        if password.range(of: "[A-Z]", options: .regularExpression) != nil { score += 1 }
        if password.range(of: "[0-9]", options: .regularExpression) != nil { score += 1 }
        if password.range(of: "[!@#$%^&*]", options: .regularExpression) != nil { score += 1 }

        // Complexity bonus
        if password.count >= 16 { score += 1 }

        // Common password penalty
        if commonPasswords.contains(password.lowercased()) {
            score = 0
        }

        // Map to strength levels
        switch score {
        case 0...2: return .veryWeak
        case 3: return .weak
        case 4: return .fair
        case 5: return .good
        case 6...: return .strong
        default: return .veryWeak
        }
    }

    // MARK: - Username Validation

    /// Validate username with security checks
    func validateUsername(_ username: String) -> Result<Void, ValidationError> {
        // Check empty
        let trimmed = username.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return .failure(.inputEmpty)
        }

        // Check length
        guard trimmed.count >= minUsernameLength else {
            return .failure(.usernameTooShort)
        }

        guard trimmed.count <= maxUsernameLength else {
            return .failure(.usernameTooLong)
        }

        // Check for valid characters (letters, numbers, underscores only)
        let usernameRegex = #"^[a-zA-Z0-9_]+$"#
        guard trimmed.range(of: usernameRegex, options: .regularExpression) != nil else {
            return .failure(.usernameInvalidCharacters)
        }

        // Check if reserved
        let lowercased = trimmed.lowercased()
        guard !reservedUsernames.contains(lowercased) else {
            return .failure(.usernameReserved)
        }

        return .success(())
    }

    // MARK: - Generic Validation

    /// Validate that input is not empty
    func validateNotEmpty(_ input: String) -> Result<Void, ValidationError> {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return .failure(.inputEmpty)
        }
        return .success(())
    }

    /// Validate input length
    func validateLength(_ input: String, min: Int? = nil, max: Int? = nil) -> Result<Void, ValidationError> {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        let length = trimmed.count

        if let min = min, length < min {
            return .failure(.inputEmpty)
        }

        if let max = max, length > max {
            return .failure(.inputTooLong(maxLength: max))
        }

        return .success(())
    }

    /// Validate numeric input
    func validateNumeric(_ input: String) -> Result<Void, ValidationError> {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return .failure(.inputEmpty)
        }

        let numericRegex = #"^[0-9]+$"#
        guard trimmed.range(of: numericRegex, options: .regularExpression) != nil else {
            return .failure(.invalidFormat)
        }

        return .success(())
    }

    // MARK: - API Parameter Validation

    /// Validate API parameter (ID, code, etc.)
    func validateAPIParameter(_ parameter: String, maxLength: Int = 64) -> Result<Void, ValidationError> {
        let trimmed = parameter.trimmingCharacters(in: .whitespacesAndNewlines)

        // Check empty
        guard !trimmed.isEmpty else {
            return .failure(.inputEmpty)
        }

        // Check length
        guard trimmed.count <= maxLength else {
            return .failure(.inputTooLong(maxLength: maxLength))
        }

        // Check for valid characters (alphanumeric, dash, underscore)
        let paramRegex = #"^[a-zA-Z0-9_-]+$"#
        guard trimmed.range(of: paramRegex, options: .regularExpression) != nil else {
            return .failure(.invalidFormat)
        }

        return .success(())
    }

    /// Validate radius parameter for location queries
    func validateRadius(_ radius: Double) -> Result<Void, ValidationError> {
        guard radius > 0 else {
            return .failure(.invalidFormat)
        }

        guard radius <= 50000 else { // Max 50km
            return .failure(.inputTooLong(maxLength: 50000))
        }

        return .success(())
    }

    // MARK: - Batch Validation

    /// Validate multiple inputs and return first error or success
    func validateAll(_ validations: [Result<Void, ValidationError>]) -> Result<Void, ValidationError> {
        for validation in validations {
            switch validation {
            case .failure(let error):
                return .failure(error)
            case .success:
                continue
            }
        }
        return .success(())
    }
}

// MARK: - Convenience Extensions

extension InputValidator {

    /// Quick email validation check
    func isValidEmail(_ email: String) -> Bool {
        switch validateEmail(email) {
        case .success: return true
        case .failure: return false
        }
    }

    /// Quick password validation check
    func isValidPassword(_ password: String) -> Bool {
        switch validatePassword(password) {
        case .success: return true
        case .failure: return false
        }
    }

    /// Quick username validation check
    func isValidUsername(_ username: String) -> Bool {
        switch validateUsername(username) {
        case .success: return true
        case .failure: return false
        }
    }
}
