//
//  UserRegistrationFlowTests.swift
//  TRIX3DCompanionE2ETests
//
//  E2E tests for user registration flow
//

import XCTest

/// E2E tests for user registration flow
final class UserRegistrationFlowTests: XCTestCase {

    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
    }

    // MARK: - Complete Registration Flow

    func test_completeRegistrationFlow() throws {
        // Launch fresh
        app.launchArguments = ["--reset-onboarding", "--mock-server"]
        app.launch()

        // Step 1: Welcome screen
        let getStarted = app.buttons["Get Started"]
        XCTAssertTrue(getStarted.waitForExistence(timeout: 5))
        getStarted.tap()

        // Step 2: Feature tour (skip through)
        for _ in 0..<3 {
            if app.buttons["Continue"].exists {
                app.buttons["Continue"].tap()
            }
        }

        // Step 3: Registration
        if app.buttons["Create Account"].exists {
            app.buttons["Create Account"].tap()
        }

        // Fill registration form
        let username = app.textFields["Username"]
        username.tap()
        username.typeText("testuser\(Int.random(in: 1000...9999))")

        let email = app.textFields["Email"]
        email.tap()
        email.typeText("test\(Int.random(in: 1000...9999))@example.com")

        let password = app.secureTextFields["Password"]
        password.tap()
        password.typeText("TestPassword123!")

        let confirmPassword = app.secureTextFields["Confirm Password"]
        confirmPassword.tap()
        confirmPassword.typeText("TestPassword123!")

        // Submit registration
        app.buttons["Create Account"].tap()

        // Wait for email verification or home screen
        let tabBar = app.tabBars["Main Tab Bar"]
        XCTAssertTrue(tabBar.waitForExistence(timeout: 15))
    }

    func test_registrationWithEmailVerification() throws {
        app.launchArguments = ["--reset-onboarding", "--mock-server", "--require-email-verification"]
        app.launch()

        // Navigate to registration
        app.buttons["Create Account"].tap()

        // Fill form
        app.textFields["Username"].typeText("newuser")
        app.textFields["Email"].typeText("verify@example.com")
        app.secureTextFields["Password"].typeText("Password123!")
        app.secureTextFields["Confirm Password"].typeText("Password123!")

        app.buttons["Create Account"].tap()

        // Should show verification message
        let verifyMessage = app.staticTexts["Please verify your email"]
        XCTAssertTrue(verifyMessage.waitForExistence(timeout: 10))
    }

    func test_registrationValidatesInput() throws {
        app.launchArguments = ["--reset-onboarding"]
        app.launch()

        // Navigate to registration
        app.buttons["Create Account"].tap()

        // Submit empty form
        app.buttons["Create Account"].tap()

        // Should show validation errors
        let usernameError = app.staticTexts["Username is required"]
        let emailError = app.staticTexts["Valid email is required"]
        let passwordError = app.staticTexts["Password must be at least 8 characters"]

        XCTAssertTrue(usernameError.exists || emailError.exists || passwordError.exists)
    }
}
