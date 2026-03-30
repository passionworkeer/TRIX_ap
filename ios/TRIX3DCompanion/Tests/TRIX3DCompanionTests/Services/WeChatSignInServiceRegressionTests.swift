import XCTest
@testable import TRIX3DCompanion

@MainActor
final class WeChatSignInServiceRegressionTests: XCTestCase {

    func testHandleOpen_acceptsConfiguredUniversalLinkCallback() {
        let sut = WeChatSignInService.shared
        let url = URL(string: "https://trix.love/wechat/callback?code=test-code")!

        let handled = sut.handleOpen(url)

        XCTAssertTrue(handled)
    }

    func testHandleOpen_rejectsDifferentUniversalLinkHost() {
        let sut = WeChatSignInService.shared
        let url = URL(string: "https://example.com/wechat/callback?code=test-code")!

        let handled = sut.handleOpen(url)

        XCTAssertFalse(handled)
    }
}
