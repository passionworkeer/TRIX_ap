import XCTest

private enum VisualUIIdentifiers {
    static let loginScene = "auth.login.scene"
    static let loginEmailField = "auth.login.email"
    static let loginPasswordField = "auth.login.password"
    static let loginSubmitButton = "auth.login.submit"
    static let loginLoadingOverlay = "auth.login.loading.overlay"
    static let chatScreen = "chat.screen"
    static let chatSearchField = "chat.search.field"
    static let mapScreen = "map.screen"
    static let mapSearchField = "map.search.field"
}

private struct VisualTestConfig: Decodable {
    let email: String?
    let password: String?
    let screenshotDirectory: String?

    static let defaultPath = "/tmp/trix-ui-config.json"

    static func load() -> VisualTestConfig {
        let environment = ProcessInfo.processInfo.environment

        if let configPath = environment["TRIX_UI_CONFIG_PATH"] ?? environment["UITEST_CONFIG_PATH"],
           let config = load(from: configPath) {
            return config
        }

        if let config = load(from: defaultPath) {
            return config
        }

        return VisualTestConfig(
            email: environment["TRIX_TEST_EMAIL"],
            password: environment["TRIX_TEST_PASSWORD"],
            screenshotDirectory: environment["TRIX_UI_SCREENSHOT_DIR"]
        )
    }

    private static func load(from path: String) -> VisualTestConfig? {
        let url = URL(fileURLWithPath: path)
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(VisualTestConfig.self, from: data)
    }
}

final class VisualPolishFlowTests: XCTestCase {
    private var app: XCUIApplication!
    private let config = VisualTestConfig.load()

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
    }

    override func tearDownWithError() throws {
        app = nil
    }

    func test_captureLoginScreen() throws {
        app.launchArguments = baseLaunchArguments()
        app.launch()

        XCTAssertTrue(element(withIdentifier: VisualUIIdentifiers.loginScene).waitForExistence(timeout: 5))
        saveScreenshot(named: "01-login-screen")
    }

    func test_loginEnglishCopyDoesNotMentionWeb() throws {
        app.launchArguments = [
            "--skip-onboarding",
            "--force-logged-out",
            "-AppleLanguages", "(en)",
            "-AppleLocale", "en_US"
        ]
        app.launch()

        XCTAssertTrue(element(withIdentifier: VisualUIIdentifiers.loginScene).waitForExistence(timeout: 5))

        let webLabel = app.staticTexts.containing(NSPredicate(format: "label CONTAINS[c] %@", "web")).firstMatch
        XCTAssertFalse(webLabel.exists)
    }

    func test_captureLoginLoadingOverlay() throws {
        app.launchArguments = baseLaunchArguments() + ["--debug-show-login-loading"]
        app.launch()

        XCTAssertTrue(element(withIdentifier: VisualUIIdentifiers.loginScene).waitForExistence(timeout: 8))
        XCTAssertTrue(element(withIdentifier: VisualUIIdentifiers.loginLoadingOverlay).waitForExistence(timeout: 5))
        saveScreenshot(named: "02-login-loading")
    }

    func test_captureAuthenticatedChatScreen() throws {
        try launchAndAuthenticate(initialTab: "chat", expectedIdentifier: VisualUIIdentifiers.chatScreen)
        XCTAssertTrue(
            waitForAnyIdentifier(
                [VisualUIIdentifiers.chatSearchField, VisualUIIdentifiers.chatScreen],
                timeout: 8
            )
        )
        saveScreenshot(named: "03-chat-screen")
    }

    func test_captureAuthenticatedMapScreen() throws {
        try launchAndAuthenticate(initialTab: "map", expectedIdentifier: VisualUIIdentifiers.mapScreen)
        XCTAssertTrue(
            waitForAnyIdentifier(
                [VisualUIIdentifiers.mapSearchField, VisualUIIdentifiers.mapScreen],
                timeout: 8
            )
        )
        saveScreenshot(named: "04-map-screen")
    }

    private func launchAndAuthenticate(initialTab: String, expectedIdentifier: String) throws {
        app.launchArguments = baseLaunchArguments() + ["--initial-tab=\(initialTab)"]
        app.launch()

        if element(withIdentifier: expectedIdentifier).waitForExistence(timeout: 5) {
            return
        }

        let email = try requiredCredential(\.email, name: "email")
        let password = try requiredCredential(\.password, name: "password")

        let emailField = app.textFields[VisualUIIdentifiers.loginEmailField]
        XCTAssertTrue(emailField.waitForExistence(timeout: 8))
        emailField.tap()
        emailField.typeText(email)

        let passwordField = app.secureTextFields[VisualUIIdentifiers.loginPasswordField]
        XCTAssertTrue(passwordField.waitForExistence(timeout: 5))
        passwordField.tap()
        passwordField.typeText(password)

        app.buttons[VisualUIIdentifiers.loginSubmitButton].tap()

        XCTAssertTrue(element(withIdentifier: expectedIdentifier).waitForExistence(timeout: 15))
    }

    private func baseLaunchArguments() -> [String] {
        [
            "--skip-onboarding",
            "--force-logged-out",
            "-AppleLanguages", "(zh-Hans)",
            "-AppleLocale", "zh-Hans_CN"
        ]
    }

    private func requiredCredential(
        _ keyPath: KeyPath<VisualTestConfig, String?>,
        name: String
    ) throws -> String {
        guard let value = config[keyPath: keyPath], !value.isEmpty else {
            throw XCTSkip("Missing visual test \(name) in \(VisualTestConfig.defaultPath)")
        }
        return value
    }

    private func element(withIdentifier identifier: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: identifier).firstMatch
    }

    private func waitForAnyIdentifier(_ identifiers: [String], timeout: TimeInterval) -> Bool {
        let deadline = Date().addingTimeInterval(timeout)

        while Date() < deadline {
            if identifiers.contains(where: { element(withIdentifier: $0).exists }) {
                return true
            }
            RunLoop.current.run(until: Date().addingTimeInterval(0.2))
        }

        return identifiers.contains(where: { element(withIdentifier: $0).exists })
    }

    private func saveScreenshot(named name: String) {
        let screenshot = XCUIScreen.main.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)

        let directoryPath = config.screenshotDirectory ?? NSTemporaryDirectory()
        let directoryURL = URL(fileURLWithPath: directoryPath, isDirectory: true)

        do {
            try FileManager.default.createDirectory(at: directoryURL, withIntermediateDirectories: true, attributes: nil)
            let screenshotURL = directoryURL.appendingPathComponent("\(name).png")
            try screenshot.pngRepresentation.write(to: screenshotURL)
        } catch {
            XCTFail("Failed to save screenshot \(name): \(error.localizedDescription)")
        }
    }
}
