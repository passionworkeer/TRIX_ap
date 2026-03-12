import XCTest

final class ProfileSettingsFlowTests: RealAppUITestCase {
    func test_profileToggles_canToggleAndRestore() throws {
        try launchAuthenticated(initialTab: "profile", expectedIdentifier: AppUIIdentifiers.profileScreen)

        let darkModeToggle = switchControl(withIdentifier: AppUIIdentifiers.profileDarkModeToggle)
        let notificationsToggle = switchControl(withIdentifier: AppUIIdentifiers.profileNotificationsToggle)

        XCTAssertTrue(darkModeToggle.waitForExistence(timeout: 8))
        XCTAssertTrue(notificationsToggle.waitForExistence(timeout: 8))

        let initialDarkMode = switchState(for: darkModeToggle)
        let initialNotifications = switchState(for: notificationsToggle)

        darkModeToggle.tap()
        notificationsToggle.tap()

        if let initialDarkMode {
            XCTAssertTrue(waitForSwitchState(!initialDarkMode, for: darkModeToggle))
        }
        if let initialNotifications {
            XCTAssertTrue(waitForSwitchState(!initialNotifications, for: notificationsToggle))
        }

        darkModeToggle.tap()
        notificationsToggle.tap()

        if let initialDarkMode {
            XCTAssertTrue(waitForSwitchState(initialDarkMode, for: darkModeToggle))
        }
        if let initialNotifications {
            XCTAssertTrue(waitForSwitchState(initialNotifications, for: notificationsToggle))
        }
    }

    func test_settingsSheet_opensAndRunsSync() throws {
        try launchAuthenticated(initialTab: "profile", expectedIdentifier: AppUIIdentifiers.profileScreen)

        let settingsButton = button(withIdentifier: AppUIIdentifiers.profileMoreSettingsButton)
        scrollToElement(settingsButton)
        XCTAssertTrue(settingsButton.waitForExistence(timeout: 5))
        settingsButton.tap()

        XCTAssertTrue(element(withIdentifier: AppUIIdentifiers.profileSettingsSheet).waitForExistence(timeout: 5))

        let syncButton = button(withIdentifier: AppUIIdentifiers.profileSettingsSyncButton)
        XCTAssertTrue(syncButton.waitForExistence(timeout: 5))
        syncButton.tap()

        XCTAssertTrue(element(withIdentifier: AppUIIdentifiers.profileSettingsSyncMessage).waitForExistence(timeout: 20))

        let doneButton = button(withIdentifier: AppUIIdentifiers.profileSettingsDoneButton)
        XCTAssertTrue(doneButton.waitForExistence(timeout: 5))
        doneButton.tap()

        XCTAssertFalse(element(withIdentifier: AppUIIdentifiers.profileSettingsSheet).exists)
    }

    func test_aboutSheet_opensFromProfile() throws {
        try launchAuthenticated(initialTab: "profile", expectedIdentifier: AppUIIdentifiers.profileScreen)

        let aboutButton = button(withIdentifier: AppUIIdentifiers.profileAboutButton)
        scrollToElement(aboutButton)
        XCTAssertTrue(aboutButton.waitForExistence(timeout: 5))
        aboutButton.tap()

        XCTAssertTrue(element(withIdentifier: AppUIIdentifiers.profileAboutSheet).waitForExistence(timeout: 5))

        let doneButton = button(withIdentifier: AppUIIdentifiers.profileAboutDoneButton)
        XCTAssertTrue(doneButton.waitForExistence(timeout: 5))
        doneButton.tap()

        XCTAssertFalse(element(withIdentifier: AppUIIdentifiers.profileAboutSheet).exists)
    }

    func test_chatTrixBotEntry_opensCurrentCompanionFlow() throws {
        try launchAuthenticated(initialTab: "chat", expectedIdentifier: AppUIIdentifiers.chatScreen)

        guard let trixBotCard = waitForElement(withIdentifier: AppUIIdentifiers.chatTrixBotCard, timeout: 10) else {
            return XCTFail("Expected the chat TRIX Bot entry card to appear.")
        }
        tapCenter(of: trixBotCard)

        let destination = waitForEither(
            [AppUIIdentifiers.trixBotScreen, AppUIIdentifiers.pairingScreen],
            timeout: 10
        )

        XCTAssertNotNil(destination)
    }
}
