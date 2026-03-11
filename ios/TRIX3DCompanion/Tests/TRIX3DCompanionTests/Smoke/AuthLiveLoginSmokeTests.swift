import XCTest
@testable import TRIX3DCompanion

final class AuthLiveLoginSmokeTests: XCTestCase {
    func testSupabaseEmailLogin() async throws {
        guard let email = credentialValue(for: "TRIX_TEST_EMAIL"),
              let password = credentialValue(for: "TRIX_TEST_PASSWORD") else {
            throw XCTSkip("Missing TRIX_TEST_EMAIL / TRIX_TEST_PASSWORD")
        }

        let response = try await APIClient.shared.login(email: email, password: password)

        XCTAssertFalse(response.accessToken.isEmpty)
        XCTAssertEqual(response.user.email?.lowercased(), email.lowercased())
    }

    private func credentialValue(for key: String) -> String? {
        let env = ProcessInfo.processInfo.environment
        if let value = env[key], !value.isEmpty {
            return value
        }

        let infoValue = Bundle(for: Self.self).object(forInfoDictionaryKey: key) as? String
        guard let infoValue, !infoValue.isEmpty, !infoValue.contains("$(") else {
            return nil
        }
        return infoValue
    }
}
