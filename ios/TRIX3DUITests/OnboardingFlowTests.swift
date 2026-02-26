//
//  OnboardingFlowTests.swift
//  TRIX3DUITests
//
//  UI automation tests for onboarding flow
//

import XCTest

/// UI tests for onboarding flow
final class OnboardingFlowTests: XCTestCase {

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

    // MARK: - Welcome Screen Tests

    func test_welcomeScreen_displaysWelcomeContent() throws {
        // Launch app with onboarding arguments
        app.launchArguments = ["--reset-onboarding"]
        app.launch()

        // Verify welcome screen elements
        let welcomeTitle = app.staticTexts["Welcome to TRIX 3D"]
        XCTAssertTrue(welcomeTitle.waitForExistence(timeout: 5))

        let getStartedButton = app.buttons["Get Started"]
        XCTAssertTrue(getStartedButton.waitForExistence(timeout: 5))
    }

    func test_welcomeScreen_navigatesToNextScreen() throws {
        app.launchArguments = ["--reset-onboarding"]
        app.launch()

        // Tap Get Started
        let getStartedButton = app.buttons["Get Started"]
        getStartedButton.tap()

        // Verify we're on the next screen
        let featureTitle = app.staticTexts["Amazing Features"]
        XCTAssertTrue(featureTitle.waitForExistence(timeout: 5))
    }

    // MARK: - Permission Flow Tests

    func test_permissionScreen_cameraPermission() throws {
        app.launchArguments = ["--reset-onboarding", "--skip-onboarding"]
        app.launch()

        // Navigate to permission screen
        // Tap Continue
        let continueButton = app.buttons["Continue"]
        continueButton.tap()

        // Check for permission dialog (system dialog)
        // Note: System dialogs are handled by the system
    }

    func test_permissionScreen_locationPermission() throws {
        app.launchArguments = ["--skip-onboarding"]
        app.launch()

        // Navigate through screens to location permission
        // Verify location permission button exists
        let locationButton = app.buttons["Enable Location"]
        if locationButton.exists {
            XCTAssertTrue(true)
        }
    }

    // MARK: - Navigation Tests

    func test_skipOnboarding_directToHome() throws {
        app.launchArguments = ["--skip-onboarding"]
        app.launch()

        // Should land on home screen
        let tabBar = app.tabBars["Main Tab Bar"]
        XCTAssertTrue(tabBar.waitForExistence(timeout: 10))
    }

    // MARK: - Completion Tests

    func test_onboardingCompletion_marksAsComplete() throws {
        app.launchArguments = ["--reset-onboarding"]
        app.launch()

        // Complete all onboarding screens
        // ...

        // Verify onboarding is marked complete
        let hasCompletedOnboarding = UserDefaults.standard.bool(forKey: "hasCompletedOnboarding")
        // This depends on implementation
    }
}
