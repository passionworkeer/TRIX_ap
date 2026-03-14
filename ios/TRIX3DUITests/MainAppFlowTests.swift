import XCTest

final class MainAppFlowTests: RealAppUITestCase {
    func test_homeWorkbench_showsCurrentQuickActions() throws {
        try launchAuthenticated(initialTab: "home", expectedIdentifier: AppUIIdentifiers.homeScreen)
        XCTAssertTrue(waitForMainNavigationReady(selectedTabIdentifier: AppUIIdentifiers.selectedHomeTab))

        let homeTab = button(withIdentifier: AppUIIdentifiers.homeTab)
        XCTAssertTrue(homeTab.waitForExistence(timeout: 5))

        var openedWorkbench = false
        for _ in 0..<3 where !openedWorkbench {
            _ = tapReliably(homeTab)
            openedWorkbench = waitForElement(withIdentifier: AppUIIdentifiers.workbenchOverlay, timeout: 3) != nil
        }

        XCTAssertTrue(openedWorkbench, "Expected workbench overlay to appear after tapping Home/Core tab.")

        XCTAssertNotNil(waitForElement(withIdentifier: AppUIIdentifiers.workbenchOverlay, timeout: 8))
        XCTAssertNotNil(waitForElement(withIdentifier: AppUIIdentifiers.workbenchSnapshotCard, timeout: 5))
        XCTAssertNotNil(waitForElement(withIdentifier: AppUIIdentifiers.workbenchLocationCard, timeout: 5))
        XCTAssertNotNil(waitForElement(withIdentifier: AppUIIdentifiers.workbenchScheduleCard, timeout: 5))
        XCTAssertNotNil(waitForElement(withIdentifier: AppUIIdentifiers.workbenchTodoCard, timeout: 5))
    }

    func test_chatTab_loadsRealScreen() throws {
        try launchAuthenticated(initialTab: "home", expectedIdentifier: AppUIIdentifiers.homeScreen)
        XCTAssertTrue(waitForMainNavigationReady(selectedTabIdentifier: AppUIIdentifiers.selectedHomeTab))

        let chatTab = button(withIdentifier: AppUIIdentifiers.chatTab)
        XCTAssertTrue(chatTab.waitForExistence(timeout: 5))

        var openedChat = false
        for _ in 0..<3 where !openedChat {
            _ = tapReliably(chatTab)
            openedChat = waitForEither([
                AppUIIdentifiers.selectedChatTab,
                AppUIIdentifiers.chatScreen
            ], timeout: 3) != nil
        }

        XCTAssertTrue(openedChat, "Expected chat tab selection to change after tapping chat tab.")

        if waitForElement(withIdentifier: AppUIIdentifiers.chatSearchField, timeout: 8) == nil {
            attachDebugHierarchy(named: "chat-tab-after-tap")
            XCTFail("Expected chat search field to appear after tapping chat tab.")
        }

        if waitForElement(withIdentifier: AppUIIdentifiers.chatTrixBotCard, timeout: 8) == nil {
            attachDebugHierarchy(named: "chat-tab-missing-trixbot-card")
            XCTFail("Expected TRIX Bot card to appear on chat screen.")
        }
    }

    func test_mapTab_loadsRealScreen() throws {
        try launchAuthenticated(initialTab: "home", expectedIdentifier: AppUIIdentifiers.homeScreen)
        XCTAssertTrue(waitForMainNavigationReady(selectedTabIdentifier: AppUIIdentifiers.selectedHomeTab))

        let mapTab = button(withIdentifier: AppUIIdentifiers.mapTab)
        XCTAssertTrue(mapTab.waitForExistence(timeout: 5))

        var openedMap = false
        for _ in 0..<3 where !openedMap {
            _ = tapReliably(mapTab)
            openedMap = waitForEither([
                AppUIIdentifiers.selectedMapTab,
                AppUIIdentifiers.mapScreen,
                AppUIIdentifiers.mapSearchField
            ], timeout: 3) != nil
        }

        if !openedMap {
            attachDebugHierarchy(named: "map-tab-after-tap")
            XCTFail("Expected map tab selection to change after tapping map tab.")
        }

        if waitForElement(withIdentifier: AppUIIdentifiers.mapSearchField, timeout: 10) == nil {
            attachDebugHierarchy(named: "map-tab-after-tap")
            XCTFail("Expected map search field to appear after tapping map tab.")
        }
    }

    func test_studyTab_loadsRealScreen() throws {
        try launchAuthenticated(initialTab: "home", expectedIdentifier: AppUIIdentifiers.homeScreen)
        XCTAssertTrue(waitForMainNavigationReady(selectedTabIdentifier: AppUIIdentifiers.selectedHomeTab))

        let studyTab = button(withIdentifier: AppUIIdentifiers.studyTab)
        XCTAssertTrue(studyTab.waitForExistence(timeout: 5))

        var openedStudy = false
        for _ in 0..<3 where !openedStudy {
            _ = tapReliably(studyTab)
            openedStudy = waitForEither([
                AppUIIdentifiers.selectedStudyTab,
                AppUIIdentifiers.studyScreen
            ], timeout: 3) != nil
        }

        XCTAssertTrue(openedStudy, "Expected study tab selection to change after tapping study tab.")
        XCTAssertNotNil(waitForElement(withIdentifier: AppUIIdentifiers.studyScreen, timeout: 8))
    }

    func test_profileTab_loadsRealScreen() throws {
        try launchAuthenticated(initialTab: "home", expectedIdentifier: AppUIIdentifiers.homeScreen)
        XCTAssertTrue(waitForMainNavigationReady(selectedTabIdentifier: AppUIIdentifiers.selectedHomeTab))

        let profileTab = button(withIdentifier: AppUIIdentifiers.profileTab)
        XCTAssertTrue(profileTab.waitForExistence(timeout: 5))

        var openedProfile = false
        for _ in 0..<3 where !openedProfile {
            _ = tapReliably(profileTab)
            openedProfile = waitForEither([
                AppUIIdentifiers.selectedProfileTab,
                AppUIIdentifiers.profileScreen
            ], timeout: 3) != nil
        }

        XCTAssertTrue(openedProfile, "Expected profile tab selection to change after tapping profile tab.")
        XCTAssertNotNil(waitForElement(withIdentifier: AppUIIdentifiers.profileScreen, timeout: 8))
    }

    func test_homeBotBubble_opensTrixBotChat() throws {
        try launchAuthenticated(initialTab: "home", expectedIdentifier: AppUIIdentifiers.homeScreen)
        XCTAssertTrue(waitForMainNavigationReady(selectedTabIdentifier: AppUIIdentifiers.selectedHomeTab))

        guard let bubble = waitForElement(withIdentifier: AppUIIdentifiers.homeBotBubble, timeout: 8) else {
            return XCTFail("Expected TRIX bot bubble to appear on the home screen.")
        }
        _ = tapReliably(bubble)

        let destination = waitForEither(
            [
                AppUIIdentifiers.trixBotScreen,
                AppUIIdentifiers.pairingScreen,
                AppUIIdentifiers.selectedChatTab
            ],
            timeout: 10
        )

        if destination == nil {
            attachDebugHierarchy(named: "home-bot-after-tap")
            XCTFail("Expected Home bot bubble to open chat, pairing, or TRIX Bot flow.")
        }

        let finalDestination = waitForEither(
            [AppUIIdentifiers.trixBotScreen, AppUIIdentifiers.pairingScreen],
            timeout: 10
        )

        if finalDestination == nil {
            attachDebugHierarchy(named: "home-bot-after-tap")
            XCTFail("Expected Home bot bubble to present pairing or TRIX Bot screen.")
        }

        if element(withIdentifier: AppUIIdentifiers.trixBotScreen).exists,
           waitForElement(withIdentifier: AppUIIdentifiers.trixBotSendButton, timeout: 5) == nil {
            attachDebugHierarchy(named: "home-bot-missing-send")
            XCTFail("Expected TRIX Bot send button to appear.")
        }
    }
}
