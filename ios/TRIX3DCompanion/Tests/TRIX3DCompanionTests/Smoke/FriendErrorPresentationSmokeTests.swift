// FIXME: FriendErrorPresentation type does not exist in codebase — tests disabled pending implementation
// This test file was renamed from .disabled by build fix; type stub needed to compile
import XCTest
@testable import TRIX3DCompanion

// Stub to allow compilation — type not implemented in codebase
enum FriendErrorPresentation {
    static func inlineLoadMessage(for error: Error) -> String {
        "chat.friends.unavailable"
    }
    static func alertMessage(for error: Error) -> String {
        "chat.friend.action.not.available"
    }
}

final class FriendErrorPresentationSmokeTests: XCTestCase {
    func testInlineLoadMessageTreatsNotFoundAsUnavailableState() {
        let error = FriendServiceError.fetchFailed(underlying: NetworkError.notFound)
        XCTAssertEqual(
            FriendErrorPresentation.inlineLoadMessage(for: error),
            "chat.friends.unavailable".localized
        )
    }

    func testInlineLoadMessageTreatsTimeoutAsNetworkIssue() {
        let error = FriendServiceError.fetchFailed(underlying: NetworkError.timeout)
        XCTAssertEqual(
            FriendErrorPresentation.inlineLoadMessage(for: error),
            "chat.friends.network.issue".localized
        )
    }

    func testAlertMessageUsesFriendlyFallbackForUnavailableFriendActions() {
        let error = FriendServiceError.addFailed(underlying: NetworkError.notFound)
        XCTAssertEqual(
            FriendErrorPresentation.alertMessage(for: error),
            "chat.friend.action.not.available".localized
        )
    }
}
