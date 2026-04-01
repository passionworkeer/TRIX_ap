import XCTest
@testable import TRIX3DCompanion

func smokeEnvironmentValue(for key: String) -> String? {
    let environment = ProcessInfo.processInfo.environment
    if let value = environment[key] ?? environment["SIMCTL_CHILD_\(key)"] {
        return value
    }

    let fileURL = URL(fileURLWithPath: "/tmp/\(key)")
    guard let value = try? String(contentsOf: fileURL, encoding: .utf8) else {
        return nil
    }

    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? nil : trimmed
}

func explicitSmokeToggleValue(for key: String) -> String? {
    let environment = ProcessInfo.processInfo.environment
    guard let value = environment[key] ?? environment["SIMCTL_CHILD_\(key)"] else {
        return nil
    }

    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? nil : trimmed
}

struct LiveBackendTestConfig: Decodable {
    let email: String?
    let password: String?

    static let defaultPath = "/tmp/trix-ui-config.json"

    static func load() -> LiveBackendTestConfig {
        if let configPath = smokeEnvironmentValue(for: "TRIX_UI_CONFIG_PATH")
            ?? smokeEnvironmentValue(for: "UITEST_CONFIG_PATH"),
           let config = load(from: configPath) {
            return config
        }

        if let config = load(from: defaultPath) {
            return config
        }

        return LiveBackendTestConfig(
            email: smokeEnvironmentValue(for: "TRIX_TEST_EMAIL"),
            password: smokeEnvironmentValue(for: "TRIX_TEST_PASSWORD")
        )
    }

    private static func load(from path: String) -> LiveBackendTestConfig? {
        let url = URL(fileURLWithPath: path)
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(LiveBackendTestConfig.self, from: data)
    }
}

@MainActor
class LiveBackendSmokeTestCase: XCTestCase {
    let config = LiveBackendTestConfig.load()

    override func setUpWithError() throws {
        try super.setUpWithError()

        guard isLiveBackendSmokeEnabled() else {
            throw XCTSkip(
                "Live backend smoke tests are opt-in. Set TRIX_RUN_LIVE_SMOKE=1 or pass --live-backend-smoke to enable."
            )
        }
    }

    func requireCredentials() throws -> (email: String, password: String) {
        let email = config.email
            ?? smokeEnvironmentValue(for: "TRIX_TEST_EMAIL")
            ?? credentialValue(for: "TRIX_TEST_EMAIL")
        let password = config.password
            ?? smokeEnvironmentValue(for: "TRIX_TEST_PASSWORD")
            ?? credentialValue(for: "TRIX_TEST_PASSWORD")

        guard let email, !email.isEmpty, let password, !password.isEmpty else {
            throw XCTSkip("Missing live backend credentials in \(LiveBackendTestConfig.defaultPath) or TRIX_TEST_EMAIL / TRIX_TEST_PASSWORD")
        }

        return (email, password)
    }

    func loginWithAuthService() async throws -> User {
        let credentials = try requireCredentials()
        let auth = AuthService.shared
        _ = await auth.logout()

        let loginResult = await auth.login(email: credentials.email, password: credentials.password)
        switch loginResult {
        case .success(let user):
            return user
        case .failure(let error):
            XCTFail("Live login failed: \(error.localizedDescription)")
            throw error
        }
    }

    func poll(
        timeout: TimeInterval = 12,
        interval: TimeInterval = 0.5,
        until condition: () async throws -> Bool
    ) async throws {
        let deadline = Date().addingTimeInterval(timeout)

        while Date() < deadline {
            if try await condition() {
                return
            }

            try await Task.sleep(nanoseconds: UInt64(interval * 1_000_000_000))
        }

        XCTFail("Condition not satisfied within \(timeout) seconds.")
    }

    private func credentialValue(for key: String) -> String? {
        let infoValue = Bundle(for: Self.self).object(forInfoDictionaryKey: key) as? String
        guard let infoValue, !infoValue.isEmpty, !infoValue.contains("$(") else {
            return nil
        }
        return infoValue
    }

    private func isLiveBackendSmokeEnabled() -> Bool {
        // Opt-in must be explicit. Ignore /tmp sentinel files to avoid
        // accidentally running live backend smoke tests during local regressions.
        if let value = explicitSmokeToggleValue(for: "TRIX_RUN_LIVE_SMOKE")?
            .lowercased() {
            return ["1", "true", "yes", "on"].contains(value)
        }

        return ProcessInfo.processInfo.arguments.contains("--live-backend-smoke")
    }
}
