//
//  AuthenticationFlowTests.swift
//  TRIX3DUITests
//
//  UI automation tests for authentication flow
//

import XCTest

/// UI tests for authentication flow
final class AuthenticationFlowTests: XCTestCase {

    // MARK: - Properties

    var app: XCUIApplication!

    // MARK: - Lifecycle

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
    }

    override func tearDownWithError() throws {
        app = nil
    }

    // MARK: - Login Tests

    func test_loginScreen_displaysLoginForm() throws {
        app.launchArguments = ["--skip-onboarding"]
        app.launch()

        // Navigate to login
        let loginButton = app.buttons["Log In"]
        if loginButton.waitForExistence(timeout: 5) {
            loginButton.tap()
        } else {
            // Already logged out, navigate to login
            app.buttons["Profile"].tap()
            app.buttons["Log In"].tap()
        }

        // Verify login form
        let emailField = app.textFields["Email"]
        let passwordField = app.secureTextFields["Password"]
        XCTAssertTrue(emailField.waitForExistence(timeout: 5))
        XCTAssertTrue(passwordField.waitForExistence(timeout: 5))
    }

    func test_login_withValidCredentials() throws {
        app.launchArguments = ["--skip-onboarding"]
        app.launch()

        // Navigate to login screen
        navigateToLoginScreen()

        // Enter credentials
        let emailField = app.textFields["Email"]
        emailField.tap()
        emailField.typeText("test@example.com")

        let passwordField = app.secureTextFields["Password"]
        passwordField.tap()
        passwordField.typeText("password123")

        // Tap login
        app.buttons["Log In"].tap()

        // Wait for home screen
        let tabBar = app.tabBars["Main Tab Bar"]
        XCTAssertTrue(tabBar.waitForExistence(timeout: 10))
    }

    func test_login_withInvalidCredentials_showsError() throws {
        app.launchArguments = ["--skip-onboarding"]
        app.launch()

        // Navigate to login screen
        navigateToLoginScreen()

        // Enter invalid credentials
        let emailField = app.textFields["Email"]
        emailField.tap()
        emailField.typeText("invalid@example.com")

        let passwordField = app.secureTextFields["Password"]
        passwordField.tap()
        passwordField.typeText("wrongpassword")

        // Tap login
        app.buttons["Log In"].tap()

        // Verify error message
        let errorMessage = app.staticTexts["Invalid email or password"]
        XCTAssertTrue(errorMessage.waitForExistence(timeout: 5))
    }

    func test_login_emptyFields_showsValidationError() throws {
        app.launchArguments = ["--skip-onboarding"]
        app.launch()

        // Navigate to login screen
        navigateToLoginScreen()

        // Try to login without entering credentials
        app.buttons["Log In"].tap()

        // Verify validation errors
        let emailError = app.staticTexts["Email is required"]
        let passwordError = app.staticTexts["Password is required"]

        // At least one should show
        XCTAssertTrue(emailError.exists || passwordError.exists)
    }

    // MARK: - Registration Tests

    func test_registrationScreen_displaysForm() throws {
        app.launchArguments = ["--skip-onboarding"]
        app.launch()

        // Navigate to registration
        navigateToLoginScreen()
        app.buttons["Create Account"].tap()

        // Verify form fields
        let usernameField = app.textFields["Username"]
        let emailField = app.textFields["Email"]
        let passwordField = app.secureTextFields["Password"]
        let confirmPasswordField = app.secureTextFields["Confirm Password"]

        XCTAssertTrue(usernameField.waitForExistence(timeout: 5))
        XCTAssertTrue(emailField.waitForExistence(timeout: 5))
        XCTAssertTrue(passwordField.waitForExistence(timeout: 5))
        XCTAssertTrue(confirmPasswordField.waitForExistence(timeout: 5))
    }

    func test_registration_passwordMismatch_showsError() throws {
        app.launchArguments = ["--skip-onboarding"]
        app.launch()

        // Navigate to registration
        navigateToLoginScreen()
        app.buttons["Create Account"].tap()

        // Fill form with mismatching passwords
        app.textFields["Username"].tap()
        app.textFields["Username"].typeText("newuser")

        app.textFields["Email"].tap()
        app.textFields["Email"].typeText("new@example.com")

        app.secureTextFields["Password"].tap()
        app.secureTextFields["Password"].typeText("password123")

        app.secureTextFields["Confirm Password"].tap()
        app.secureTextFields["Confirm Password"].typeText("password456")

        // Tap register
        app.buttons["Create Account"].tap()

        // Verify error
        let errorMessage = app.staticTexts["Passwords do not match"]
        XCTAssertTrue(errorMessage.waitForExistence(timeout: 5))
    }

    // MARK: - Password Reset Tests

    func test_forgotPassword_navigatesToResetScreen() throws {
        app.launchArguments = ["--skip-onboarding"]
        app.launch()

        // Navigate to login
        navigateToLoginScreen()

        // Tap forgot password
        app.buttons["Forgot Password?"].tap()

        // Verify reset screen
        let resetTitle = app.staticTexts["Reset Password"]
        XCTAssertTrue(resetTitle.waitForExistence(timeout: 5))
    }

    func test_forgotPassword_validEmail_sendsResetLink() throws {
        app.launchArguments = ["--skip-onboarding"]
        app.launch()

        // Navigate to forgot password
        navigateToLoginScreen()
        app.buttons["Forgot Password?"].tap()

        // Enter email
        app.textFields["Email"].tap()
        app.textFields["Email"].typeText("test@example.com")

        // Tap send
        app.buttons["Send Reset Link"].tap()

        // Verify success message
        let successMessage = app.staticTexts["Reset link sent"]
        XCTAssertTrue(successMessage.waitForExistence(timeout: 5))
    }

    // MARK: - Logout Tests

    func test_logout_returnsToLogin() throws {
        // Note: Requires logged in state
        // This test would need app setup to be logged in first
    }

    // MARK: - Helper Methods

    private func navigateToLoginScreen() {
        // Try to find and tap login button
        if app.buttons["Log In"].exists {
            app.buttons["Log In"].tap()
        } else if app.buttons["Profile"].exists {
            app.buttons["Profile"].tap()
            if app.buttons["Log Out"].exists {
                // Already logged in, log out first
                app.buttons["Log Out"].tap()
                app.alerts.buttons["Log Out"].tap()
            }
            // Now try login
            if app.buttons["Log In"].exists {
                app.buttons["Log In"].tap()
            }
        }
    }
}
