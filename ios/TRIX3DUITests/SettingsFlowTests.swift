//
//  SettingsFlowTests.swift
//  TRIX3DUITests
//
//  UI automation tests for settings flow
//

import XCTest

/// UI tests for settings flow
final class SettingsFlowTests: XCTestCase {

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

    // MARK: - Settings Screen Tests

    func test_settingsScreen_opensFromProfile() throws {
        app.launchArguments = ["--skip-onboarding"]
        app.launch()

        // Navigate to profile
        app.buttons["Profile"].tap()

        // Open settings
        app.buttons["Settings"].tap()

        // Verify settings screen
        let settingsTitle = app.staticTexts["Settings"]
        XCTAssertTrue(settingsTitle.waitForExistence(timeout: 5))
    }

    // MARK: - Theme Settings Tests

    func test_themeSettings_lightMode() throws {
        app.launchArguments = ["--skip-onboarding"]
        app.launch()

        navigateToSettings()

        // Find and tap theme option
        app.staticTexts["Theme"].tap()

        // Select light
        app.buttons["Light"].tap()

        // Verify selection
        XCTAssertTrue(app.buttons["Light"].isSelected)
    }

    func test_themeSettings_darkMode() throws {
        app.launchArguments = ["--skip-onboarding"]
        app.launch()

        navigateToSettings()

        // Find and tap theme option
        app.staticTexts["Theme"].tap()

        // Select dark
        app.buttons["Dark"].tap()

        // Verify selection
        XCTAssertTrue(app.buttons["Dark"].isSelected)
    }

    // MARK: - Notification Settings Tests

    func test_notificationToggle_enablesNotifications() throws {
        app.launchArguments = ["--skip-onboarding"]
        app.launch()

        navigateToSettings()

        // Find notifications toggle
        let notificationsToggle = app.switches["Notifications"]
        if notificationsToggle.exists {
            notificationsToggle.tap()
            // Toggle should be on (using isSelected for switches)
            XCTAssertTrue(notificationsToggle.isSelected)
        }
    }

    // MARK: - Cache Management Tests

    func test_cacheSize_displaysCurrentSize() throws {
        app.launchArguments = ["--skip-onboarding", "--mock-cache:50000000"]
        app.launch()

        navigateToSettings()

        // Find cache size
        let cacheSize = app.staticTexts["Cache Size"]
        XCTAssertTrue(cacheSize.waitForExistence(timeout: 5))

        // Should show formatted size
        let sizeValue = app.staticTexts["~50 MB"]
        XCTAssertTrue(sizeValue.exists)
    }

    func test_clearCache_showsConfirmation() throws {
        app.launchArguments = ["--skip-onboarding"]
        app.launch()

        navigateToSettings()

        // Find clear cache option
        let clearCacheButton = app.buttons["Clear Cache"]
        clearCacheButton.tap()

        // Verify confirmation
        let confirmTitle = app.staticTexts["Clear Cache"]
        XCTAssertTrue(confirmTitle.waitForExistence(timeout: 5))
    }

    // MARK: - Data Export Tests

    func test_exportData_optionsAvailable() throws {
        app.launchArguments = ["--skip-onboarding"]
        app.launch()

        navigateToSettings()

        // Find export option
        let exportButton = app.buttons["Export Data"]
        if exportButton.exists {
            exportButton.tap()

            // Verify format options
            let jsonOption = app.buttons["JSON"]
            let csvOption = app.buttons["CSV"]

            XCTAssertTrue(jsonOption.exists || csvOption.exists)
        }
    }

    // MARK: - Privacy Settings Tests

    func test_privacySettings_opensPrivacyScreen() throws {
        app.launchArguments = ["--skip-onboarding"]
        app.launch()

        navigateToSettings()

        // Find privacy option
        app.staticTexts["Privacy"].tap()

        // Verify privacy screen
        let privacyTitle = app.staticTexts["Privacy Settings"]
        XCTAssertTrue(privacyTitle.waitForExistence(timeout: 5))
    }

    // MARK: - About Tests

    func test_aboutScreen_displaysAppInfo() throws {
        app.launchArguments = ["--skip-onboarding"]
        app.launch()

        navigateToSettings()

        // Find about option
        app.staticTexts["About"].tap()

        // Verify about screen
        let versionLabel = app.staticTexts["Version"]
        XCTAssertTrue(versionLabel.waitForExistence(timeout: 5))
    }

    // MARK: - Helper Methods

    private func navigateToSettings() {
        // Navigate to profile
        app.buttons["Profile"].tap()

        // Open settings
        if app.buttons["Settings"].exists {
            app.buttons["Settings"].tap()
        }
    }
}
