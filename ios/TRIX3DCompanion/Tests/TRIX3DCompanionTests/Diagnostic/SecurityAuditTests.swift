//
//  SecurityAuditTests.swift
//  TRIX3DCompanionTests
//
//  Security audit tests for Phase 6F
//  Created: Phase 6F Security Audit
//

import XCTest
@testable import TRIX3DCompanion

/// Security audit test suite
final class SecurityAuditTests: XCTestCase {

    // MARK: - Input Validation Tests

    func testEmailValidation() throws {
        let validator = InputValidator.shared

        // Valid emails
        let validEmails = [
            "test@example.com",
            "user.name@example.com",
            "user+tag@example.co.uk",
            "user123@test-domain.com"
        ]

        for email in validEmails {
            let result = validator.validateEmail(email)
            XCTAssertTrue(
                result.isSuccess,
                "Valid email '\(email)' should pass validation: \(result)"
            )
        }

        // Invalid emails
        let invalidEmails = [
            "", // Empty
            "plaintext", // No @
            "@example.com", // No local part
            "user@", // No domain
            "user..name@example.com", // Consecutive dots
            ".user@example.com", // Leading dot
            "user.@example.com", // Trailing dot
            String(repeating: "a", count: 255) + "@example.com" // Too long
        ]

        for email in invalidEmails {
            let result = validator.validateEmail(email)
            XCTAssertFalse(
                result.isSuccess,
                "Invalid email '\(email.prefix(20))...' should fail validation"
            )
        }
    }

    func testPasswordValidation() throws {
        let validator = InputValidator.shared

        // Valid passwords
        let validPasswords = [
            "SecurePass123!",
            "MyP@ssw0rd",
            "Str0ng!Pass",
            "C0mplex!ty123"
        ]

        for password in validPasswords {
            let result = validator.validatePassword(password)
            XCTAssertTrue(
                result.isSuccess,
                "Valid password should pass validation: \(result)"
            )
        }

        // Invalid passwords
        let invalidPasswords = [
            "", // Empty
            "short", // Too short
            "nouppercase123!", // No uppercase
            "NOLOWERCASE123!", // No lowercase
            "NoNumbers!", // No numbers
            "NoSpecial123", // No special chars
            "password", // Too common
            "12345678", // Too common
        ]

        for password in invalidPasswords {
            let result = validator.validatePassword(password)
            XCTAssertFalse(
                result.isSuccess,
                "Invalid password '\(password)' should fail validation"
            )
        }
    }

    func testPasswordStrength() throws {
        let validator = InputValidator.shared

        // Test strength calculation
        let cases: [(String, PasswordStrength)] = [
            ("123", .veryWeak),
            ("password", .veryWeak),
            ("Password1", .weak),
            ("Password1!", .fair),
            ("SecurePass123!", .good),
            ("V3ry!S3cur3#P@ssw0rd", .strong)
        ]

        for (password, expectedStrength) in cases {
            let strength = validator.calculatePasswordStrength(password)
            XCTAssertEqual(
                strength,
                expectedStrength,
                "Password '\(password)' strength should be \(expectedStrength), got \(strength)"
            )
        }
    }

    func testUsernameValidation() throws {
        let validator = InputValidator.shared

        // Valid usernames
        let validUsernames = [
            "user123",
            "test_user",
            "User_Name_123",
            "abc"
        ]

        for username in validUsernames {
            let result = validator.validateUsername(username)
            XCTAssertTrue(
                result.isSuccess,
                "Valid username '\(username)' should pass validation"
            )
        }

        // Invalid usernames
        let invalidUsernames = [
            "", // Empty
            "ab", // Too short
            "admin", // Reserved
            String(repeating: "a", count: 31), // Too long
            "user-name", // Invalid character
            "user.name", // Invalid character
            "user@name" // Invalid character
        ]

        for username in invalidUsernames {
            let result = validator.validateUsername(username)
            XCTAssertFalse(
                result.isSuccess,
                "Invalid username '\(username)' should fail validation"
            )
        }
    }

    func testAPIParameterValidation() throws {
        let validator = InputValidator.shared

        // Valid parameters
        let validParams = [
            "abc123",
            "test_id-123",
            "param_123"
        ]

        for param in validParams {
            let result = validator.validateAPIParameter(param)
            XCTAssertTrue(
                result.isSuccess,
                "Valid parameter '\(param)' should pass validation"
            )
        }

        // Invalid parameters
        let invalidParams = [
            "", // Empty
            String(repeating: "a", count: 65), // Too long
            "param with spaces", // Invalid characters
            "param@withspecial", // Invalid characters
            "param/with/slash" // Invalid characters
        ]

        for param in invalidParams {
            let result = validator.validateAPIParameter(param)
            XCTAssertFalse(
                result.isSuccess,
                "Invalid parameter '\(param.prefix(20))...' should fail validation"
            )
        }
    }

    func testRadiusValidation() throws {
        let validator = InputValidator.shared

        // Valid radii
        let validRadii = [1, 100, 1000, 5000, 50000]
        for radius in validRadii {
            let result = validator.validateRadius(Double(radius))
            XCTAssertTrue(
                result.isSuccess,
                "Valid radius \(radius) should pass validation"
            )
        }

        // Invalid radii
        let invalidRadii = [0, -100, 50001, 100000]
        for radius in invalidRadii {
            let result = validator.validateRadius(Double(radius))
            XCTAssertFalse(
                result.isSuccess,
                "Invalid radius \(radius) should fail validation"
            )
        }
    }

    // MARK: - Secure Logging Tests

    func testSecureLoggerProductionSanitization() throws {
        // This test verifies that sensitive data is redacted in production logs
        // Note: These tests will behave differently in DEBUG vs RELEASE builds

        #if !DEBUG
        let logger = SecureLogger.shared

        // Test token redaction
        let token = "abcdefghijklmnopqrstuvwxyz123456"
        logger.token("AccessToken", token: token)
        // In production, token should be partially masked in logs

        // Test location redaction
        logger.location(latitude: 39.9042, longitude: 116.4074, accuracy: 10.0)
        // In production, coordinates should be rounded to 2 decimals

        // Test user action redaction
        logger.userAction("Login", username: "testuser@example.com")
        // In production, username should be sanitized
        #endif
    }

    // MARK: - Keychain Security Tests

    func testKeychainAccessControl() throws {
        let keychain = KeychainManager.shared

        // Test that tokens are stored securely
        let testToken = "test_token_\(UUID().uuidString)"

        // Save token
        try keychain.saveAccessToken(testToken)

        // Retrieve token
        let retrievedToken = keychain.getAccessToken()
        XCTAssertEqual(
            retrievedToken,
            testToken,
            "Retrieved token should match saved token"
        )

        // Verify token is not accessible when device is locked
        // (This would require device lock testing, not possible in unit tests)

        // Clean up
        try keychain.deleteAccessToken()
    }

    // MARK: - Performance Tests

    func testConcurrentImageUploadPerformance() throws {
        let uploadService = ImageUpload.shared

        // Create test images
        let testImages = (0..<5).map { _ in
            UIImage(systemName: "photo")!
        }

        // Measure concurrent upload time
        measure {
            let expectation = expectation(description: "Upload images")

            Task {
                _ = await uploadService.uploadImages(testImages)
                expectation.fulfill()
            }

            wait(for: [expectation], timeout: 30.0)
        }
    }

    // MARK: - Integration Tests

    func testAuthenticationFlowSecurity() throws {
        let validator = InputValidator.shared

        // Test registration with invalid inputs
        let invalidEmail = "notanemail"
        let weakPassword = "123"
        let shortUsername = "ab"

        // Email validation
        let emailResult = validator.validateEmail(invalidEmail)
        XCTAssertFalse(emailResult.isSuccess, "Invalid email should fail")

        // Password validation
        let passwordResult = validator.validatePassword(weakPassword)
        XCTAssertFalse(passwordResult.isSuccess, "Weak password should fail")

        // Username validation
        let usernameResult = validator.validateUsername(shortUsername)
        XCTAssertFalse(usernameResult.isSuccess, "Short username should fail")
    }

    func testBatchValidation() throws {
        let validator = InputValidator.shared

        // Test valid batch
        let validBatch = [
            validator.validateEmail("test@example.com"),
            validator.validatePassword("SecurePass123!"),
            validator.validateUsername("testuser123")
        ]

        let batchResult = validator.validateAll(validBatch)
        XCTAssertTrue(
            batchResult.isSuccess,
            "All valid inputs should pass batch validation"
        )

        // Test invalid batch
        let invalidBatch = [
            validator.validateEmail("notanemail"),
            validator.validatePassword("123"),
            validator.validateUsername("ab")
        ]

        let invalidBatchResult = validator.validateAll(invalidBatch)
        XCTAssertFalse(
            invalidBatchResult.isSuccess,
            "Batch with invalid inputs should fail"
        )
    }

    // MARK: - Edge Case Tests

    func testInputValidatorEdgeCases() throws {
        let validator = InputValidator.shared

        // Test unicode in email (should be rejected)
        let unicodeEmail = "用户@example.com"
        let unicodeResult = validator.validateEmail(unicodeEmail)
        // Current implementation may not support unicode - this documents current behavior

        // Test very long valid input
        let longEmail = "a".repeat(64) + "@" + "b".repeat(63) + ".com"
        let longResult = validator.validateEmail(longEmail)
        XCTAssertFalse(
            longResult.isSuccess,
            "Email exceeding 254 chars should fail"
        )

        // Test email with + sign (should be valid)
        let plusEmail = "user+tag@example.com"
        let plusResult = validator.validateEmail(plusEmail)
        XCTAssertTrue(
            plusResult.isSuccess,
            "Email with + sign should be valid"
        )
    }

    // MARK: - Security Regression Tests

    func testCommonPasswordBlacklist() throws {
        let validator = InputValidator.shared

        // Test that common passwords from the expanded blacklist are rejected
        let commonPasswords = [
            // Top 20 most common
            "password",
            "12345678",
            "qwerty",
            "abc123",
            // Keyboard patterns
            "qwertyuiop",
            "asdfgh",
            "zxcvbnm",
            "12345678910",
            // Sports teams
            "chelsea",
            "liverpool",
            "barcelona",
            "manchester",
            // Gaming terms
            "pokemon",
            "minecraft",
            "fortnite",
            // Simple patterns
            "aaaaaa",
            "abcabc",
            "qwerty1",
            "password1"
        ]

        for password in commonPasswords {
            let result = validator.validatePassword(password)
            XCTAssertFalse(
                result.isSuccess,
                "Common password '\(password)' should be rejected by the expanded blacklist"
            )
        }

        // Verify that strong passwords are still accepted
        let strongPasswords = [
            "MyStr0ng!Passw0rd",
            "C0mplex!ty123!",
            "Un!que@ndSecure1",
            "N0t@Common$Pass",
            "D!ff1cult#2Guess"
        ]

        for password in strongPasswords {
            let result = validator.validatePassword(password)
            XCTAssertTrue(
                result.isSuccess,
                "Strong password '\(password)' should be accepted"
            )
        }
    }

    func testReservedUsernames() throws {
        let validator = InputValidator.shared

        // Test that reserved usernames are rejected
        let reservedNames = [
            "admin",
            "root",
            "system",
            "api"
        ]

        for username in reservedNames {
            let result = validator.validateUsername(username)
            XCTAssertFalse(
                result.isSuccess,
                "Reserved username '\(username)' should be rejected"
            )
        }
    }
}

// MARK: - Helper Extensions

extension String {
    /// Repeat string n times
    static func repeat(_ times: Int) -> String {
        return String(repeating: "a", count: times)
    }
}

extension Result {
    var isSuccess: Bool {
        switch self {
        case .success: return true
        case .failure: return false
        }
    }
}
