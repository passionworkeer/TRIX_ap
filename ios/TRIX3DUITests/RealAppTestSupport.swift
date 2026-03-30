import XCTest

struct LiveUITestConfig: Decodable {
    let email: String?
    let password: String?
    let screenshotDirectory: String?
    let serviceUrl: String?
    let serviceToken: String?

    static let defaultPath = "/tmp/trix-ui-config.json"

    static func load() -> LiveUITestConfig {
        let environment = ProcessInfo.processInfo.environment
        let envConfig = LiveUITestConfig(
            email: environment["TRIX_TEST_EMAIL"],
            password: environment["TRIX_TEST_PASSWORD"],
            screenshotDirectory: environment["TRIX_UI_SCREENSHOT_DIR"],
            serviceUrl: environment["TRIX_NATIVE_SERVICE_URL"] ?? environment["TRIX_TEST_SERVICE_URL"],
            serviceToken: environment["TRIX_NATIVE_SERVICE_TOKEN"]
        )

        if let configPath = environment["TRIX_UI_CONFIG_PATH"] ?? environment["UITEST_CONFIG_PATH"],
           let config = load(from: configPath) {
            return config.merging(envConfig)
        }

        if let config = load(from: defaultPath) {
            return config.merging(envConfig)
        }

        return envConfig
    }

    private func merging(_ overlay: LiveUITestConfig) -> LiveUITestConfig {
        LiveUITestConfig(
            email: overlay.email ?? email,
            password: overlay.password ?? password,
            screenshotDirectory: overlay.screenshotDirectory ?? screenshotDirectory,
            serviceUrl: overlay.serviceUrl ?? serviceUrl,
            serviceToken: overlay.serviceToken ?? serviceToken
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
    static let homeBotExpandedCard = "home.bot.expanded"
    static let homeBotInputField = "home.bot.input"
    static let homeBotSendButton = "home.bot.send"
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
    static let pairingStartChatButton = "pairing.start-chat.button"
    static let trixBotScreen = "trixbot.screen"
    static let trixBotPairedBanner = "trixbot.banner.paired"
    static let trixBotUnpairedBanner = "trixbot.banner.unpaired"
    static let trixBotInputField = "trixbot.input.field"
    static let trixBotSendButton = "trixbot.send.button"
    static let trixBotCloseButton = "trixbot.close.button"
    static let trixBotAttachmentPreview = "trixbot.attachment.preview"
    static let trixBotBotMessagePrefix = "trixbot.message.bot"
    static let trixBotUserMessagePrefix = "trixbot.message.user"
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
        app.launchEnvironment = baseLaunchEnvironment()
        app.launch()
    }

    func launchAuthenticated(
        initialTab: String? = nil,
        expectedIdentifier: String,
        extraArguments: [String] = []
    ) throws {
        let shouldUseAutoLogin = (config.email?.isEmpty == false) && (config.password?.isEmpty == false)
        var launchArguments = baseLaunchArguments(forceLoggedOut: true, initialTab: initialTab) + extraArguments

        if shouldUseAutoLogin && !launchArguments.contains("--ui-auto-login") {
            launchArguments.append("--ui-auto-login")
        }

        app.launchArguments = launchArguments
        app.launchEnvironment = baseLaunchEnvironment()
        app.launch()

        if element(withIdentifier: expectedIdentifier).waitForExistence(timeout: 5) {
            return
        }

        if launchArguments.contains("--ui-auto-login"),
           element(withIdentifier: expectedIdentifier).waitForExistence(timeout: 20) {
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

    func textInput(withIdentifier identifier: String) -> XCUIElement {
        let textView = app.textViews[identifier]
        if textView.exists {
            return textView
        }

        let textField = app.textFields[identifier]
        if textField.exists {
            return textField
        }

        return app.descendants(matching: .any).matching(identifier: identifier).firstMatch
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

    func waitForHittable(_ element: XCUIElement, timeout: TimeInterval = 5) -> Bool {
        let deadline = Date().addingTimeInterval(timeout)

        while Date() < deadline {
            if element.exists && element.isHittable {
                return true
            }

            RunLoop.current.run(until: Date().addingTimeInterval(0.2))
        }

        return element.exists && element.isHittable
    }

    @discardableResult
    func tapReliably(
        _ element: XCUIElement,
        timeout: TimeInterval = 6
    ) -> Bool {
        XCTAssertTrue(element.waitForExistence(timeout: timeout))

        if waitForHittable(element, timeout: timeout) {
            element.tap()
            return true
        }

        element.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        return true
    }

    func waitForMainNavigationReady(
        selectedTabIdentifier: String,
        timeout: TimeInterval = 10
    ) -> Bool {
        guard waitForElement(withIdentifier: AppUIIdentifiers.mainTabView, timeout: timeout) != nil else {
            return false
        }

        guard waitForElement(withIdentifier: selectedTabIdentifier, timeout: timeout) != nil else {
            return false
        }

        return waitForHittable(button(withIdentifier: AppUIIdentifiers.mapTab), timeout: timeout)
    }

    func tapCenter(of element: XCUIElement, timeout: TimeInterval = 5) {
        _ = tapReliably(element, timeout: timeout)
    }

    func tapAbsoluteCenter(of element: XCUIElement, timeout: TimeInterval = 5) {
        XCTAssertTrue(element.waitForExistence(timeout: timeout))

        let frame = element.frame
        let appFrame = app.frame
        guard appFrame.width > 0, appFrame.height > 0 else {
            XCTFail("App frame is invalid for absolute tap.")
            return
        }

        let normalized = CGVector(
            dx: min(max(frame.midX / appFrame.width, 0.01), 0.99),
            dy: min(max(frame.midY / appFrame.height, 0.01), 0.99)
        )

        app.coordinate(withNormalizedOffset: normalized).tap()
    }

    func tapCenterOfApp() {
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    }

    func elements(withIdentifierPrefix prefix: String) -> XCUIElementQuery {
        app.descendants(matching: .any).matching(NSPredicate(format: "identifier BEGINSWITH %@", prefix))
    }

    func waitForElementCountToExceed(
        _ minimumCount: Int,
        query: XCUIElementQuery,
        timeout: TimeInterval = 10
    ) -> Bool {
        let deadline = Date().addingTimeInterval(timeout)

        while Date() < deadline {
            if query.count > minimumCount {
                return true
            }

            RunLoop.current.run(until: Date().addingTimeInterval(0.25))
        }

        return query.count > minimumCount
    }

    func uniqueElementIdentifiers(matchingPrefix prefix: String) -> Set<String> {
        Set(
            elements(withIdentifierPrefix: prefix)
                .allElementsBoundByIndex
                .compactMap { element in
                    let identifier = element.identifier.trimmingCharacters(in: .whitespacesAndNewlines)
                    return identifier.isEmpty ? nil : identifier
                }
        )
    }

    func waitForNewElementIdentifiers(
        after existingIdentifiers: Set<String>,
        matchingPrefix prefix: String,
        timeout: TimeInterval = 10
    ) -> Set<String> {
        let deadline = Date().addingTimeInterval(timeout)

        while Date() < deadline {
            let newIdentifiers = uniqueElementIdentifiers(matchingPrefix: prefix).subtracting(existingIdentifiers)
            if !newIdentifiers.isEmpty {
                return newIdentifiers
            }

            RunLoop.current.run(until: Date().addingTimeInterval(0.25))
        }

        return uniqueElementIdentifiers(matchingPrefix: prefix).subtracting(existingIdentifiers)
    }

    func scrollToInteractiveElement(_ element: XCUIElement, maxSwipes: Int = 6) {
        scrollToElement(element, maxSwipes: maxSwipes)

        var remainingSwipes = maxSwipes
        while element.exists && element.frame.maxY > app.frame.maxY - 180 && remainingSwipes > 0 {
            app.swipeUp()
            remainingSwipes -= 1
        }
    }

    func waitForKeyboard(timeout: TimeInterval = 5) -> Bool {
        let deadline = Date().addingTimeInterval(timeout)

        while Date() < deadline {
            if app.keyboards.count > 0 {
                return true
            }

            RunLoop.current.run(until: Date().addingTimeInterval(0.2))
        }

        return app.keyboards.count > 0
    }

    @discardableResult
    func focusAndTypeText(
        _ text: String,
        into element: XCUIElement,
        timeout: TimeInterval = 8,
        file: StaticString = #filePath,
        line: UInt = #line
    ) -> Bool {
        XCTAssertTrue(
            element.waitForExistence(timeout: timeout),
            "Expected input element to exist before typing.",
            file: file,
            line: line
        )

        _ = tapReliably(element, timeout: timeout)

        if !waitForKeyboard(timeout: 1.5) {
            element.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        }
        _ = waitForKeyboard(timeout: timeout)

        app.typeText(text)
        return true
    }

    func scrollToElement(_ element: XCUIElement, maxSwipes: Int = 5) {
        var remainingSwipes = maxSwipes

        while !(element.exists && element.isHittable) && remainingSwipes > 0 {
            app.swipeUp()
            remainingSwipes -= 1
        }
    }

    func attachDebugHierarchy(named name: String) {
        let hierarchy = XCTAttachment(string: app.debugDescription)
        hierarchy.name = "\(name)-hierarchy"
        hierarchy.lifetime = .keepAlways
        add(hierarchy)

        guard app.exists else {
            let note = XCTAttachment(string: "Screenshot skipped because app no longer exists.")
            note.name = "\(name)-screenshot-skipped"
            note.lifetime = .keepAlways
            add(note)
            return
        }

        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = "\(name)-screenshot"
        screenshot.lifetime = .keepAlways
        add(screenshot)
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

    func waitForSwitchState(
        _ expected: Bool,
        identifier: String,
        timeout: TimeInterval = 5
    ) -> Bool {
        let deadline = Date().addingTimeInterval(timeout)

        while Date() < deadline {
            let candidate = switchControl(withIdentifier: identifier)
            if switchState(for: candidate) == expected {
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

    private func baseLaunchEnvironment() -> [String: String] {
        var environment: [String: String] = [:]

        if let email = config.email, !email.isEmpty {
            environment["TRIX_TEST_EMAIL"] = email
        }

        if let password = config.password, !password.isEmpty {
            environment["TRIX_TEST_PASSWORD"] = password
        }

        if let screenshotDirectory = config.screenshotDirectory, !screenshotDirectory.isEmpty {
            environment["TRIX_UI_SCREENSHOT_DIR"] = screenshotDirectory
        }

        if let serviceUrl = config.serviceUrl, !serviceUrl.isEmpty {
            environment["TRIX_NATIVE_SERVICE_URL"] = serviceUrl
        }

        if let serviceToken = config.serviceToken, !serviceToken.isEmpty {
            environment["TRIX_NATIVE_SERVICE_TOKEN"] = serviceToken
        }

        return environment
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
