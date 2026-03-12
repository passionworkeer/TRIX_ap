import XCTest

struct LiveUITestConfig: Decodable {
    let email: String?
    let password: String?
    let screenshotDirectory: String?

    static let defaultPath = "/tmp/trix-ui-config.json"

    static func load() -> LiveUITestConfig {
        let environment = ProcessInfo.processInfo.environment

        if let configPath = environment["TRIX_UI_CONFIG_PATH"] ?? environment["UITEST_CONFIG_PATH"],
           let config = load(from: configPath) {
            return config
        }

        if let config = load(from: defaultPath) {
            return config
        }

        return LiveUITestConfig(
            email: environment["TRIX_TEST_EMAIL"],
            password: environment["TRIX_TEST_PASSWORD"],
            screenshotDirectory: environment["TRIX_UI_SCREENSHOT_DIR"]
        )
    }

    private static func load(from path: String) -> LiveUITestConfig? {
        let url = URL(fileURLWithPath: path)
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(LiveUITestConfig.self, from: data)
    }
}

enum AppUIIdentifiers {
    static let loginScene = "auth.login.scene"
    static let registerScene = "auth.register.scene"
    static let loginEmailField = "auth.login.email"
    static let loginPasswordField = "auth.login.password"
    static let loginSubmitButton = "auth.login.submit"
    static let loginSwitchToRegisterButton = "auth.login.switch.register"
    static let registerUsernameField = "auth.register.username"
    static let registerEmailField = "auth.register.email"
    static let registerPasswordField = "auth.register.password"
    static let registerConfirmPasswordField = "auth.register.confirmPassword"
    static let registerSubmitButton = "auth.register.submit"
    static let registerSwitchToLoginButton = "auth.register.switch.login"
    static let mainTabView = "main.tab.view"
    static let homeTab = "nav.tab.home"
    static let mapTab = "nav.tab.map"
    static let studyTab = "nav.tab.study"
    static let chatTab = "nav.tab.chat"
    static let profileTab = "nav.tab.profile"
    static let selectedHomeTab = "nav.selected.home"
    static let selectedMapTab = "nav.selected.map"
    static let selectedStudyTab = "nav.selected.study"
    static let selectedChatTab = "nav.selected.chat"
    static let selectedProfileTab = "nav.selected.profile"
    static let homeScreen = "home.screen"
    static let homeBotBubble = "home.bot.bubble"
    static let workbenchOverlay = "home.workbench.overlay"
    static let workbenchSnapshotCard = "home.workbench.snapshot.card"
    static let workbenchLocationCard = "home.workbench.location.card"
    static let workbenchScheduleCard = "home.workbench.schedule.card"
    static let workbenchTodoCard = "home.workbench.todo.card"
    static let chatScreen = "chat.screen"
    static let chatSearchField = "chat.search.field"
    static let chatTrixBotCard = "chat.trixbot.card"
    static let mapScreen = "map.screen"
    static let mapSearchField = "map.search.field"
    static let studyScreen = "study.screen"
    static let profileScreen = "profile.screen"
    static let profileDarkModeToggle = "profile.darkmode.toggle"
    static let profileNotificationsToggle = "profile.notifications.toggle"
    static let profileMoreSettingsButton = "profile.settings.more.button"
    static let profileAboutButton = "profile.about.button"
    static let profileLogoutButton = "profile.logout.button"
    static let profileSettingsSheet = "profile.settings.sheet"
    static let profileAboutSheet = "profile.about.sheet"
    static let profileSettingsSyncButton = "profile.settings.sync.button"
    static let profileSettingsSyncMessage = "profile.settings.sync.message"
    static let profileSettingsDoneButton = "profile.settings.done.button"
    static let profileAboutDoneButton = "profile.about.done.button"
    static let pairingScreen = "pairing.screen"
    static let pairingCameraButton = "pairing.camera.button"
    static let pairingManualButton = "pairing.manual.button"
    static let pairingCodeField = "pairing.code.field"
    static let pairingVerifyButton = "pairing.verify.button"
    static let trixBotScreen = "trixbot.screen"
    static let trixBotInputField = "trixbot.input.field"
    static let trixBotSendButton = "trixbot.send.button"
    static let trixBotCloseButton = "trixbot.close.button"
}

class RealAppUITestCase: XCTestCase {
    var app: XCUIApplication!
    let config = LiveUITestConfig.load()

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
    }

    override func tearDownWithError() throws {
        app = nil
    }

    func launchLoggedOut(initialTab: String? = nil) {
        app.launchArguments = baseLaunchArguments(forceLoggedOut: true, initialTab: initialTab)
        app.launch()
    }

    func launchAuthenticated(initialTab: String? = nil, expectedIdentifier: String) throws {
        app.launchArguments = baseLaunchArguments(forceLoggedOut: true, initialTab: initialTab)
        app.launch()

        if element(withIdentifier: expectedIdentifier).waitForExistence(timeout: 5) {
            return
        }

        try loginWithConfiguredCredentials(expectedIdentifier: expectedIdentifier)
    }

    func loginWithConfiguredCredentials(expectedIdentifier: String? = nil) throws {
        let email = try requiredCredential(\.email, name: "email")
        let password = try requiredCredential(\.password, name: "password")

        let emailField = textField(withIdentifier: AppUIIdentifiers.loginEmailField)
        XCTAssertTrue(emailField.waitForExistence(timeout: 8))
        emailField.tap()
        emailField.typeText(email)

        let passwordField = secureTextField(withIdentifier: AppUIIdentifiers.loginPasswordField)
        XCTAssertTrue(passwordField.waitForExistence(timeout: 5))
        passwordField.tap()
        passwordField.typeText(password)

        button(withIdentifier: AppUIIdentifiers.loginSubmitButton).tap()

        if let expectedIdentifier {
            XCTAssertTrue(
                element(withIdentifier: expectedIdentifier).waitForExistence(timeout: 15),
                "Expected authenticated screen \(expectedIdentifier) did not appear."
            )
        }
    }

    func element(withIdentifier identifier: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: identifier).firstMatch
    }

    func waitForElement(
        withIdentifier identifier: String,
        timeout: TimeInterval = 10
    ) -> XCUIElement? {
        let deadline = Date().addingTimeInterval(timeout)

        while Date() < deadline {
            let candidate = element(withIdentifier: identifier)
            if candidate.exists {
                return candidate
            }

            RunLoop.current.run(until: Date().addingTimeInterval(0.25))
        }

        return nil
    }

    func button(withIdentifier identifier: String) -> XCUIElement {
        app.buttons[identifier]
    }

    func textField(withIdentifier identifier: String) -> XCUIElement {
        app.textFields[identifier]
    }

    func secureTextField(withIdentifier identifier: String) -> XCUIElement {
        app.secureTextFields[identifier]
    }

    func switchControl(withIdentifier identifier: String) -> XCUIElement {
        app.switches[identifier]
    }

    func waitForEither(_ identifiers: [String], timeout: TimeInterval = 10) -> XCUIElement? {
        let deadline = Date().addingTimeInterval(timeout)

        while Date() < deadline {
            for identifier in identifiers {
                let candidate = element(withIdentifier: identifier)
                if candidate.exists {
                    return candidate
                }
            }

            RunLoop.current.run(until: Date().addingTimeInterval(0.25))
        }

        return nil
    }

    func waitForSelectedTab(_ identifier: String, timeout: TimeInterval = 8) -> XCUIElement? {
        waitForElement(withIdentifier: identifier, timeout: timeout)
    }

    func tapCenter(of element: XCUIElement, timeout: TimeInterval = 5) {
        XCTAssertTrue(element.waitForExistence(timeout: timeout))
        element.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    }

    func tapCenterOfApp() {
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    }

    func scrollToElement(_ element: XCUIElement, maxSwipes: Int = 5) {
        var remainingSwipes = maxSwipes

        while !(element.exists && element.isHittable) && remainingSwipes > 0 {
            app.swipeUp()
            remainingSwipes -= 1
        }
    }

    func switchState(for element: XCUIElement) -> Bool? {
        guard let value = element.value else { return nil }

        if let stringValue = value as? String {
            let normalized = stringValue
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .lowercased()

            switch normalized {
            case "1", "on", "true", "开", "开启", "打开":
                return true
            case "0", "off", "false", "关", "关闭":
                return false
            default:
                return nil
            }
        }

        if let numericValue = value as? NSNumber {
            return numericValue.boolValue
        }

        return nil
    }

    func waitForSwitchState(
        _ expected: Bool,
        for element: XCUIElement,
        timeout: TimeInterval = 5
    ) -> Bool {
        let deadline = Date().addingTimeInterval(timeout)

        while Date() < deadline {
            if switchState(for: element) == expected {
                return true
            }

            RunLoop.current.run(until: Date().addingTimeInterval(0.2))
        }

        return false
    }

    private func baseLaunchArguments(forceLoggedOut: Bool, initialTab: String?) -> [String] {
        var arguments = [
            "--skip-onboarding",
            "-AppleLanguages", "(zh-Hans)",
            "-AppleLocale", "zh-Hans_CN"
        ]

        if forceLoggedOut {
            arguments.append("--force-logged-out")
        }

        if let initialTab {
            arguments.append("--initial-tab=\(initialTab)")
        }

        return arguments
    }

    private func requiredCredential(
        _ keyPath: KeyPath<LiveUITestConfig, String?>,
        name: String
    ) throws -> String {
        guard let value = config[keyPath: keyPath], !value.isEmpty else {
            throw XCTSkip("Missing UI test \(name) in \(LiveUITestConfig.defaultPath)")
        }
        return value
    }
}
