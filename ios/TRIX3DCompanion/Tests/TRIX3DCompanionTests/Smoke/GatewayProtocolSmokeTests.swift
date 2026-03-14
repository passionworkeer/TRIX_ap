import XCTest
@testable import TRIX3DCompanion

final class GatewayProtocolSmokeTests: XCTestCase {
    func testAnyCodableRoundTripDictionary() throws {
        let source: [String: Any] = [
            "paired": true,
            "count": 3,
            "device": [
                "id": "gw-001",
                "name": "TRIX Bot"
            ],
            "tags": ["ios", "relay"]
        ]

        let value = AnyCodable(source)
        let data = try JSONEncoder().encode(value)
        let decoded = try JSONDecoder().decode(AnyCodable.self, from: data)

        let object = try XCTUnwrap(decoded.value as? [String: Any])
        XCTAssertEqual(object["paired"] as? Bool, true)
        XCTAssertEqual(object["count"] as? Int, 3)

        let device = try XCTUnwrap(object["device"] as? [String: Any])
        XCTAssertEqual(device["id"] as? String, "gw-001")
    }

    func testGatewayPairingStatusDecodes() throws {
        let json = """
        {
          "paired": true,
          "deviceId": "gw-001",
          "deviceName": "TRIX Bot",
          "botOnline": true,
          "pairedAt": "2026-03-10T12:00:00Z"
        }
        """

        let data = Data(json.utf8)
        let status = try JSONDecoder().decode(GatewayPairingStatus.self, from: data)

        XCTAssertTrue(status.paired)
        XCTAssertEqual(status.deviceId, "gw-001")
        XCTAssertEqual(status.deviceName, "TRIX Bot")
        XCTAssertEqual(status.botOnline, true)
    }
}

final class MainTabDockVisibilitySmokeTests: XCTestCase {
    func testDockHiddenOnHomeWhenWorkbenchCollapsed() {
        XCTAssertFalse(
            MainTabView.shouldShowDock(
                selectedTab: .home,
                isWorkbenchPresented: false,
                isNavigating: false
            )
        )
    }

    func testDockVisibleOnHomeWhenWorkbenchExpanded() {
        XCTAssertTrue(
            MainTabView.shouldShowDock(
                selectedTab: .home,
                isWorkbenchPresented: true,
                isNavigating: false
            )
        )
    }

    func testDockVisibilityPreservesNonHomeRootNavigation() {
        XCTAssertTrue(
            MainTabView.shouldShowDock(
                selectedTab: .chat,
                isWorkbenchPresented: false,
                isNavigating: false
            )
        )
        XCTAssertFalse(
            MainTabView.shouldShowDock(
                selectedTab: .chat,
                isWorkbenchPresented: false,
                isNavigating: true
            )
        )
    }
}
