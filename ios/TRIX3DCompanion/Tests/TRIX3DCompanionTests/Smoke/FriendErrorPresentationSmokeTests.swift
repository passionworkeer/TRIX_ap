import XCTest
@testable import TRIX3DCompanion

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
