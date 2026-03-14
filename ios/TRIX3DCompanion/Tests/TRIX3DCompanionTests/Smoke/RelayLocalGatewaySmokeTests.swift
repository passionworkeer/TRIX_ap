import XCTest
@testable import TRIX3DCompanion

final class RelayLocalGatewaySmokeTests: XCTestCase {
    func testRelayCanConnectLocalOpenClawGatewayAndSendMessage() async throws {
        guard let token = loadGatewayToken() else {
            throw XCTSkip("Missing OPENCLAW_ACCESS_CODE in test process environment")
        }

        let relay = RelayClient.shared
        relay.disconnect()

        do {
            try await relay.connect(
                server: "http://127.0.0.1:18789",
                gatewayId: "agent:main:main",
                accessCode: token
            )
            XCTAssertTrue(relay.isConnected, "Relay should be connected after successful gateway auth")

            try await relay.sendToDevice(
                method: "chat.send",
                params: [
                    "message": "TRIX iOS relay smoke \(UUID().uuidString.prefix(8))",
                    "stream": true
                ]
            )
        } catch {
            XCTFail("Local relay-gateway roundtrip failed: \(error.localizedDescription)")
            throw error
        }

        relay.disconnect()
        XCTAssertFalse(relay.isConnected, "Relay should be disconnected after explicit disconnect()")
    }

    private func loadGatewayToken() -> String? {
        guard let token = ProcessInfo.processInfo.environment["OPENCLAW_ACCESS_CODE"] else {
            return nil
        }
        let trimmed = token.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
