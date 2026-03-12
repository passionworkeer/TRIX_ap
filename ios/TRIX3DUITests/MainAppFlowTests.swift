import XCTest

final class MainAppFlowTests: RealAppUITestCase {
    func test_homeWorkbench_showsCurrentQuickActions() throws {
        try launchAuthenticated(initialTab: "home", expectedIdentifier: AppUIIdentifiers.homeScreen)

        let homeTab = button(withIdentifier: AppUIIdentifiers.homeTab)
        XCTAssertTrue(homeTab.waitForExistence(timeout: 5))
        homeTab.tap()

        XCTAssertNotNil(waitForElement(withIdentifier: AppUIIdentifiers.workbenchOverlay, timeout: 8))
        XCTAssertNotNil(waitForElement(withIdentifier: AppUIIdentifiers.workbenchSnapshotCard, timeout: 5))
        XCTAssertNotNil(waitForElement(withIdentifier: AppUIIdentifiers.workbenchLocationCard, timeout: 5))
        XCTAssertNotNil(waitForElement(withIdentifier: AppUIIdentifiers.workbenchScheduleCard, timeout: 5))
        XCTAssertNotNil(waitForElement(withIdentifier: AppUIIdentifiers.workbenchTodoCard, timeout: 5))
    }

    func test_chatTab_loadsRealScreen() throws {
        try launchAuthenticated(initialTab: "home", expectedIdentifier: AppUIIdentifiers.homeScreen)

        let chatTab = button(withIdentifier: AppUIIdentifiers.chatTab)
        XCTAssertTrue(chatTab.waitForExistence(timeout: 5))
        chatTab.tap()

        XCTAssertNotNil(waitForSelectedTab(AppUIIdentifiers.selectedChatTab, timeout: 5))
        XCTAssertNotNil(waitForElement(withIdentifier: AppUIIdentifiers.chatScreen, timeout: 12))
        XCTAssertNotNil(waitForElement(withIdentifier: AppUIIdentifiers.chatSearchField, timeout: 8))
    }

    func test_mapTab_loadsRealScreen() throws {
        try launchAuthenticated(initialTab: "home", expectedIdentifier: AppUIIdentifiers.homeScreen)

        let mapTab = button(withIdentifier: AppUIIdentifiers.mapTab)
        XCTAssertTrue(mapTab.waitForExistence(timeout: 5))
        mapTab.tap()

        XCTAssertNotNil(waitForSelectedTab(AppUIIdentifiers.selectedMapTab, timeout: 5))
        XCTAssertNotNil(waitForElement(withIdentifier: AppUIIdentifiers.mapScreen, timeout: 8))
        XCTAssertNotNil(waitForElement(withIdentifier: AppUIIdentifiers.mapSearchField, timeout: 10))
    }

    func test_studyTab_loadsRealScreen() throws {
        try launchAuthenticated(initialTab: "home", expectedIdentifier: AppUIIdentifiers.homeScreen)

        let studyTab = button(withIdentifier: AppUIIdentifiers.studyTab)
        XCTAssertTrue(studyTab.waitForExistence(timeout: 5))
        studyTab.tap()

        XCTAssertNotNil(waitForElement(withIdentifier: AppUIIdentifiers.studyScreen, timeout: 8))
    }

    func test_profileTab_loadsRealScreen() throws {
        try launchAuthenticated(initialTab: "home", expectedIdentifier: AppUIIdentifiers.homeScreen)

        let profileTab = button(withIdentifier: AppUIIdentifiers.profileTab)
        XCTAssertTrue(profileTab.waitForExistence(timeout: 5))
        profileTab.tap()

        XCTAssertNotNil(waitForElement(withIdentifier: AppUIIdentifiers.profileScreen, timeout: 8))
    }

    func test_homeBotBubble_opensTrixBotChat() throws {
        try launchAuthenticated(initialTab: "home", expectedIdentifier: AppUIIdentifiers.homeScreen)

        guard let bubble = waitForElement(withIdentifier: AppUIIdentifiers.homeBotBubble, timeout: 8) else {
            return XCTFail("Expected TRIX bot bubble to appear on the home screen.")
        }
        tapCenter(of: bubble)

        XCTAssertNotNil(waitForElement(withIdentifier: AppUIIdentifiers.trixBotScreen, timeout: 8))
        XCTAssertNotNil(waitForElement(withIdentifier: AppUIIdentifiers.trixBotInputField, timeout: 5))
    }
}
