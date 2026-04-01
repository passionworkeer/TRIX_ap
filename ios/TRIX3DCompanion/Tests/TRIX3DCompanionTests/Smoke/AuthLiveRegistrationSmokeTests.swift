import XCTest
@testable import TRIX3DCompanion

@MainActor
final class AuthLiveRegistrationSmokeTests: LiveBackendSmokeTestCase {
    override func setUpWithError() throws {
        try super.setUpWithError()

        guard isLiveSignupEnabled() else {
            throw XCTSkip(
                "Live signup smoke is opt-in. Set TRIX_RUN_LIVE_SIGNUP=1 or pass --live-backend-signup to enable."
            )
        }
    }

    func testRegisterClassifiesEmailConfirmationPolicy() async throws {
        let baseEmail = try requireCredentials().email
        let signupEmail = uniqueSignupEmail(from: baseEmail)
        let signupPassword = "Trix!2026!\(UUID().uuidString.prefix(8))"
        let username = "codex_\(UUID().uuidString.replacingOccurrences(of: "-", with: "").prefix(10))"

        let response: RegisterResponse
        do {
            response = try await APIClient.shared.register(
                username: username,
                email: signupEmail,
                password: signupPassword
            )
        } catch let error as NetworkError {
            if case .custom(let message) = error,
               message.lowercased().contains("rate limit") {
                throw XCTSkip("Live signup blocked by Supabase email rate limit: \(message)")
            }

            throw error
        }

        XCTAssertEqual(response.user.email?.lowercased(), signupEmail.lowercased())

        if response.requiresEmailConfirmation {
            do {
                _ = try await APIClient.shared.login(email: signupEmail, password: signupPassword)
                XCTFail("Signup requires email confirmation, but immediate login succeeded.")
            } catch let error as NetworkError {
                guard case .custom(let message) = error else {
                    XCTFail("Expected custom email confirmation error, got \(error)")
                    return
                }

                XCTAssertTrue(
                    message.lowercased().contains("email not confirmed"),
                    "Unexpected signup classification error: \(message)"
                )
            }
        } else {
            let auth = try await APIClient.shared.login(email: signupEmail, password: signupPassword)
            XCTAssertEqual(auth.user.email?.lowercased(), signupEmail.lowercased())
        }
    }

    private func isLiveSignupEnabled() -> Bool {
        if let value = explicitSmokeToggleValue(for: "TRIX_RUN_LIVE_SIGNUP")?
            .lowercased() {
            return ["1", "true", "yes", "on"].contains(value)
        }

        return ProcessInfo.processInfo.arguments.contains("--live-backend-signup")
    }

    private func uniqueSignupEmail(from baseEmail: String) -> String {
        let parts = baseEmail.split(separator: "@", maxSplits: 1)
        guard parts.count == 2 else {
            return "codex-signup-\(UUID().uuidString.prefix(8))@example.com"
        }

        let localPart = parts[0].split(separator: "+", maxSplits: 1)[0]
        let domainPart = parts[1]
        let suffix = UUID().uuidString.replacingOccurrences(of: "-", with: "").prefix(10)
        return "\(localPart)+signup-\(suffix)@\(domainPart)"
    }
}
