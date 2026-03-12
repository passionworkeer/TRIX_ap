import XCTest

final class AuthenticationFlowTests: RealAppUITestCase {
    func test_loginScreen_displaysLiveForm() throws {
        launchLoggedOut()

        XCTAssertTrue(element(withIdentifier: AppUIIdentifiers.loginScene).waitForExistence(timeout: 5))
        XCTAssertTrue(app.textFields[AppUIIdentifiers.loginEmailField].exists)
        XCTAssertTrue(app.secureTextFields[AppUIIdentifiers.loginPasswordField].exists)
        XCTAssertTrue(app.buttons[AppUIIdentifiers.loginSubmitButton].exists)
    }

    func test_switchToRegisterAndBack_usesCurrentScenes() throws {
        launchLoggedOut()

        let switchToRegister = element(withIdentifier: AppUIIdentifiers.loginSwitchToRegisterButton)
        XCTAssertTrue(switchToRegister.waitForExistence(timeout: 5))
        switchToRegister.tap()

        XCTAssertTrue(element(withIdentifier: AppUIIdentifiers.registerScene).waitForExistence(timeout: 5))

        let switchToLogin = element(withIdentifier: AppUIIdentifiers.registerSwitchToLoginButton)
        XCTAssertTrue(switchToLogin.waitForExistence(timeout: 5))
        switchToLogin.tap()

        XCTAssertTrue(element(withIdentifier: AppUIIdentifiers.loginScene).waitForExistence(timeout: 5))
    }

    func test_registrationPasswordMismatch_showsErrorAlert() throws {
        launchLoggedOut()

        element(withIdentifier: AppUIIdentifiers.loginSwitchToRegisterButton).tap()
        XCTAssertTrue(element(withIdentifier: AppUIIdentifiers.registerScene).waitForExistence(timeout: 5))

        let usernameField = app.textFields[AppUIIdentifiers.registerUsernameField]
        let emailField = app.textFields[AppUIIdentifiers.registerEmailField]
        let passwordField = app.secureTextFields[AppUIIdentifiers.registerPasswordField]
        let confirmField = app.secureTextFields[AppUIIdentifiers.registerConfirmPasswordField]

        XCTAssertTrue(usernameField.waitForExistence(timeout: 5))
        usernameField.tap()
        usernameField.typeText("codex_ui_mismatch")

        emailField.tap()
        emailField.typeText("codex-ui-mismatch@example.com")

        passwordField.tap()
        passwordField.typeText("password123")

        confirmField.tap()
        confirmField.typeText("password456")

        element(withIdentifier: AppUIIdentifiers.registerSubmitButton).tap()

        XCTAssertTrue(app.alerts.firstMatch.waitForExistence(timeout: 5))
    }

    func test_realLogin_reachesCurrentMainApp() throws {
        try launchAuthenticated(initialTab: "home", expectedIdentifier: AppUIIdentifiers.homeScreen)

        XCTAssertTrue(element(withIdentifier: AppUIIdentifiers.mainTabView).exists)
        XCTAssertTrue(element(withIdentifier: AppUIIdentifiers.homeScreen).exists)
    }
}
