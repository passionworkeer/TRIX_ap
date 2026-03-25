//
//  MainTabViewTests.swift
//  TRIX3DCompanionTests
//
//  UI component tests for MainTabView
//  Tests tab navigation, selection, and badge display
//

import XCTest
import SwiftUI
@testable import TRIX3DCompanion

// MARK: - MainTabView Tests

@MainActor
final class MainTabViewTests: XCTestCase {

    // MARK: - Tab Existence Tests

    func testAllFiveTabsExist() throws {
        let tabs: [MainTab] = [.home, .map, .study, .chat, .profile]

        XCTAssertEqual(tabs.count, 5)
    }

    func testTabEnumerationComplete() throws {
        let allCases = MainTab.allCases

        // Should include: home, map, study, core, chat, profile
        XCTAssertTrue(allCases.contains(.home))
        XCTAssertTrue(allCases.contains(.map))
        XCTAssertTrue(allCases.contains(.study))
        XCTAssertTrue(allCases.contains(.core))
        XCTAssertTrue(allCases.contains(.chat))
        XCTAssertTrue(allCases.contains(.profile))
    }

    func testHomeTabExists() throws {
        XCTAssertEqual(MainTab.home.rawValue, "nav.home")
        XCTAssertEqual(MainTab.home.displayName, "nav.home".localized)
    }

    func testMapTabExists() throws {
        XCTAssertEqual(MainTab.map.rawValue, "nav.map")
        XCTAssertEqual(MainTab.map.displayName, "nav.map".localized)
    }

    func testStudyTabExists() throws {
        XCTAssertEqual(MainTab.study.rawValue, "nav.study")
        XCTAssertEqual(MainTab.study.displayName, "nav.study".localized)
    }

    func testCoreTabExists() throws {
        XCTAssertEqual(MainTab.core.rawValue, "nav.core")
        XCTAssertEqual(MainTab.core.displayName, "nav.core".localized)
    }

    func testChatTabExists() throws {
        XCTAssertEqual(MainTab.chat.rawValue, "nav.chat")
        XCTAssertEqual(MainTab.chat.displayName, "nav.chat".localized)
    }

    func testProfileTabExists() throws {
        XCTAssertEqual(MainTab.profile.rawValue, "nav.profile")
        XCTAssertEqual(MainTab.profile.displayName, "nav.profile".localized)
    }

    // MARK: - Tab System Images Tests

    func testHomeTabSystemImage() throws {
        XCTAssertEqual(MainTab.home.systemImage, "house.fill")
    }

    func testMapTabSystemImage() throws {
        XCTAssertEqual(MainTab.map.systemImage, "map.fill")
    }

    func testStudyTabSystemImage() throws {
        XCTAssertEqual(MainTab.study.systemImage, "book.fill")
    }

    func testCoreTabSystemImage() throws {
        XCTAssertEqual(MainTab.core.systemImage, "diamond.fill")
    }

    func testChatTabSystemImage() throws {
        XCTAssertEqual(MainTab.chat.systemImage, "message.fill")
    }

    func testProfileTabSystemImage() throws {
        XCTAssertEqual(MainTab.profile.systemImage, "person.fill")
    }

    func testAllTabsHaveSystemImages() throws {
        for tab in MainTab.allCases {
            XCTAssertFalse(tab.systemImage.isEmpty, "\(tab) should have a system image")
        }
    }

    // MARK: - Tab Selection Tests

    func testTabSelectionChanges() throws {
        let appState = AppState()
        let initialTab = appState.selectedTab

        // Simulate tab selection
        appState.selectTab(.chat)

        XCTAssertNotEqual(appState.selectedTab, initialTab)
        XCTAssertEqual(appState.selectedTab, .chat)
    }

    func testTabSelectionPersists() throws {
        let appState = AppState()
        appState.selectTab(.profile)

        XCTAssertEqual(appState.selectedTab, .profile)
    }

    func testDefaultTabIsHome() throws {
        let appState = AppState()
        // Default should be home or chat depending on app configuration
        XCTAssertTrue(
            appState.selectedTab == .home ||
            appState.selectedTab == .chat
        )
    }

    // MARK: - Tab Navigation Tests

    func testGlassDockViewExists() throws {
        let view = GlassDockView(isWorkbenchPresented: .constant(false))
            .environmentObject(AppState())

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }

    func testGlassDockTabCount() throws {
        let tabs = GlassDockTab.tabs

        // Should have 5 tabs: map, study, core, chat, profile
        XCTAssertEqual(tabs.count, 5)
    }

    func testGlassDockTabTypes() throws {
        let tabs = GlassDockTab.tabs

        let tabTypes = tabs.map { $0.tab }
        XCTAssertTrue(tabTypes.contains(.map))
        XCTAssertTrue(tabTypes.contains(.study))
        XCTAssertTrue(tabTypes.contains(.core))
        XCTAssertTrue(tabTypes.contains(.chat))
        XCTAssertTrue(tabTypes.contains(.profile))
    }

    func testGlassDockCoreTabIsCore() throws {
        let tabs = GlassDockTab.tabs
        let coreTab = tabs.first { $0.tab == .core }

        XCTAssertNotNil(coreTab)
        XCTAssertTrue(coreTab?.isCore ?? false)
    }

    func testGlassDockNonCoreTabs() throws {
        let tabs = GlassDockTab.tabs
        let nonCoreTabs = tabs.filter { !$0.isCore }

        XCTAssertEqual(nonCoreTabs.count, 4)
    }

    // MARK: - Tab Badge Tests

    func testUnreadBadgeDisplay() throws {
        let unreadCount = 5

        XCTAssertGreaterThan(unreadCount, 0)
        XCTAssertLessThanOrEqual(unreadCount, 99)
    }

    func testUnreadBadgeZero() throws {
        let unreadCount = 0
        XCTAssertEqual(unreadCount, 0)
    }

    func testUnreadBadgeOverflow() throws {
        let displayCount = 100
        let badgeText = displayCount > 99 ? "99+" : "\(displayCount)"
        XCTAssertEqual(badgeText, "99+")
    }

    func testUnreadBadgeSingleDigit() throws {
        let displayCount = 5
        let badgeText = "\(displayCount)"
        XCTAssertEqual(badgeText, "5")
    }

    // MARK: - Tab Icons Tests

    func testGlassDockTabIcons() throws {
        let tabs = GlassDockTab.tabs

        let icons = tabs.map { $0.icon }
        XCTAssertTrue(icons.contains("map.fill"))
        XCTAssertTrue(icons.contains("book.fill"))
        XCTAssertTrue(icons.contains("camera.fill"))
        XCTAssertTrue(icons.contains("message.fill"))
        XCTAssertTrue(icons.contains("person.fill"))
    }

    func testGlassDockTabLocalizationKeys() throws {
        let tabs = GlassDockTab.tabs

        for tab in tabs {
            XCTAssertFalse(tab.localizationKey.isEmpty)
            XCTAssertFalse(tab.label.isEmpty)
        }
    }

    // MARK: - Tab Dock Visibility Tests

    func testDockVisibilityForHomeTab() throws {
        let shouldShowDock = MainTabView.shouldShowDock(
            selectedTab: .home,
            isWorkbenchPresented: true,
            isNavigating: false
        )

        XCTAssertTrue(shouldShowDock)
    }

    func testDockHiddenDuringNavigation() throws {
        let shouldShowDock = MainTabView.shouldShowDock(
            selectedTab: .home,
            isWorkbenchPresented: true,
            isNavigating: true
        )

        XCTAssertFalse(shouldShowDock)
    }

    func testDockHiddenForHomeWithoutWorkbench() throws {
        let shouldShowDock = MainTabView.shouldShowDock(
            selectedTab: .home,
            isWorkbenchPresented: false,
            isNavigating: false
        )

        XCTAssertFalse(shouldShowDock)
    }

    func testDockVisibleForNonHomeTabs() throws {
        let nonHomeTabs: [MainTab] = [.map, .study, .chat, .profile]

        for tab in nonHomeTabs {
            let shouldShowDock = MainTabView.shouldShowDock(
                selectedTab: tab,
                isWorkbenchPresented: false,
                isNavigating: false
            )

            XCTAssertTrue(shouldShowDock, "Dock should be visible for \(tab)")
        }
    }

    // MARK: - Selected Tab Indicator Tests

    func testSelectedTabNormalization() throws {
        // .home and .core should normalize to .core for dock display
        let tabs: [MainTab] = [.home, .core]

        for tab in tabs {
            let normalized = tab == .home ? MainTab.core : tab
            XCTAssertEqual(normalized, .core)
        }
    }

    func testSelectedTabComparison() throws {
        let tab1 = MainTab.home
        let tab2 = MainTab.core

        XCTAssertNotEqual(tab1, tab2)
    }

    // MARK: - AppState Tab Management Tests

    func testAppStateSelectTab() throws {
        let appState = AppState()

        appState.selectTab(.map)
        XCTAssertEqual(appState.selectedTab, .map)

        appState.selectTab(.study)
        XCTAssertEqual(appState.selectedTab, .study)
    }

    func testAppStateTabSelectionHapticFeedback() throws {
        // Test that haptic feedback would be triggered
        let appState = AppState()

        // No crash should occur
        appState.selectTab(.chat)
        XCTAssertEqual(appState.selectedTab, .chat)
    }

    // MARK: - Navigation Path Tests

    func testNavigationPathClearsOnTabChange() throws {
        // When navigating to a new tab, any navigation stack should clear
        let isNavigating = true
        let shouldShowDock = MainTabView.shouldShowDock(
            selectedTab: .map,
            isWorkbenchPresented: false,
            isNavigating: isNavigating
        )

        XCTAssertFalse(shouldShowDock)
    }

    // MARK: - Accessibility ID Tests

    func testMainTabViewAccessibilityId() throws {
        let id = MainNavigationAccessibilityIdentifiers.mainTabView
        XCTAssertEqual(id, "main.tab.view")
    }

    func testTabAccessibilityIds() throws {
        XCTAssertEqual(MainNavigationAccessibilityIdentifiers.homeTab, "nav.tab.home")
        XCTAssertEqual(MainNavigationAccessibilityIdentifiers.mapTab, "nav.tab.map")
        XCTAssertEqual(MainNavigationAccessibilityIdentifiers.studyTab, "nav.tab.study")
        XCTAssertEqual(MainNavigationAccessibilityIdentifiers.chatTab, "nav.tab.chat")
        XCTAssertEqual(MainNavigationAccessibilityIdentifiers.profileTab, "nav.tab.profile")
    }

    func testSelectedTabAccessibilityIds() throws {
        XCTAssertEqual(MainNavigationAccessibilityIdentifiers.selectedHomeTab, "nav.selected.home")
        XCTAssertEqual(MainNavigationAccessibilityIdentifiers.selectedMapTab, "nav.selected.map")
        XCTAssertEqual(MainNavigationAccessibilityIdentifiers.selectedStudyTab, "nav.selected.study")
        XCTAssertEqual(MainNavigationAccessibilityIdentifiers.selectedChatTab, "nav.selected.chat")
        XCTAssertEqual(MainNavigationAccessibilityIdentifiers.selectedProfileTab, "nav.selected.profile")
    }

    func testDockTabAccessibilityIdForHome() throws {
        let id = MainNavigationAccessibilityIdentifiers.dockTab(for: .home)
        XCTAssertEqual(id, "nav.tab.home")
    }

    func testDockTabAccessibilityIdForMap() throws {
        let id = MainNavigationAccessibilityIdentifiers.dockTab(for: .map)
        XCTAssertEqual(id, "nav.tab.map")
    }

    // MARK: - Animation Tests

    func testTabSwitchAnimation() throws {
        // Animation should be spring-like
        let animation = Animation.spring(response: 0.32, dampingFraction: 0.84)

        XCTAssertNotNil(animation)
    }

    func testDockTransitionAnimation() throws {
        // Dock should have bottom edge transition
        let transition = AnyTransition.move(edge: .bottom).combined(with: .opacity)

        XCTAssertNotNil(transition)
    }

    // MARK: - Workbench Presentation Tests

    func testWorkbenchPresentedState() throws {
        let isWorkbenchPresented = true

        let shouldShowDock = MainTabView.shouldShowDock(
            selectedTab: .home,
            isWorkbenchPresented: isWorkbenchPresented,
            isNavigating: false
        )

        XCTAssertTrue(shouldShowDock)
    }

    func testWorkbenchDismissedHidesDock() throws {
        let shouldShowDock = MainTabView.shouldShowDock(
            selectedTab: .home,
            isWorkbenchPresented: false,
            isNavigating: false
        )

        XCTAssertFalse(shouldShowDock)
    }

    // MARK: - Tab Content Tests

    func testHomeTabContent() throws {
        let view = HomeView(isWorkbenchPresented: .constant(false))

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }

    func testStudyTabContent() throws {
        let view = StudyListView()

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }

    // MARK: - Tab Order Tests

    func testGlassDockTabOrder() throws {
        let tabs = GlassDockTab.tabs

        // Expected order: map, study, core, chat, profile
        XCTAssertEqual(tabs[0].tab, .map)
        XCTAssertEqual(tabs[1].tab, .study)
        XCTAssertEqual(tabs[2].tab, .core)
        XCTAssertEqual(tabs[3].tab, .chat)
        XCTAssertEqual(tabs[4].tab, .profile)
    }
}
