import XCTest
@testable import TRIX3DCompanion

@MainActor
final class AuthLiveLoginSmokeTests: LiveBackendSmokeTestCase {
    func testSupabaseEmailLogin() async throws {
        let credentials = try requireCredentials()
        let response = try await APIClient.shared.login(email: credentials.email, password: credentials.password)

        XCTAssertFalse(response.accessToken.isEmpty)
        XCTAssertEqual(response.user.email?.lowercased(), credentials.email.lowercased())
    }

    func testLoginThenFetchCurrentUserKeepsAuthState() async throws {
        let credentials = try requireCredentials()
        let user = try await loginWithAuthService()

        XCTAssertEqual(user.email?.lowercased(), credentials.email.lowercased())

        let fetchResult = await AuthService.shared.fetchCurrentUser()
        switch fetchResult {
        case .success(let fetchedUser):
            XCTAssertEqual(fetchedUser.email?.lowercased(), credentials.email.lowercased())
            XCTAssertTrue(AuthService.shared.isLoggedIn)
        case .failure(let error):
            XCTFail("Fetch current user failed after login: \(error.localizedDescription)")
        }
    }
}
