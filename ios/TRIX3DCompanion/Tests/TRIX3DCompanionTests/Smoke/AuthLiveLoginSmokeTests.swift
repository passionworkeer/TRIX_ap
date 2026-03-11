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

    @MainActor
    func testLoginThenFetchCurrentUserKeepsAuthState() async throws {
        guard let email = credentialValue(for: "TRIX_TEST_EMAIL"),
              let password = credentialValue(for: "TRIX_TEST_PASSWORD") else {
            throw XCTSkip("Missing TRIX_TEST_EMAIL / TRIX_TEST_PASSWORD")
        }

        let auth = AuthService.shared
        _ = await auth.logout()

        let loginResult = await auth.login(email: email, password: password)
        switch loginResult {
        case .success(let user):
            XCTAssertEqual(user.email?.lowercased(), email.lowercased())
        case .failure(let error):
            XCTFail("Login failed: \(error.localizedDescription)")
            return
        }

        let fetchResult = await auth.fetchCurrentUser()
        switch fetchResult {
        case .success(let fetchedUser):
            XCTAssertEqual(fetchedUser.email?.lowercased(), email.lowercased())
            XCTAssertTrue(auth.isLoggedIn)
        case .failure(let error):
            XCTFail("Fetch current user failed after login: \(error.localizedDescription)")
        }
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
