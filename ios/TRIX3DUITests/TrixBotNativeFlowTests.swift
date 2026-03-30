import Foundation
import XCTest

final class TrixBotNativeFlowTests: RealAppUITestCase {
    func test_sameAccountRestoresNativePairingAndReceivesStatusReply() throws {
        try ensureNativePairingRestored()

        try launchAuthenticated(
            initialTab: "chat",
            expectedIdentifier: AppUIIdentifiers.trixBotScreen,
            extraArguments: [
                "--ui-auto-login",
                "--ui-open-trixbot",
                "--ui-trixbot-prefill=/status",
                "--ui-trixbot-auto-send",
                "--ui-trixbot-auto-send-delay-ms=1200",
            ]
        )

        let pairedBanner = element(withIdentifier: AppUIIdentifiers.trixBotPairedBanner)
        XCTAssertTrue(
            pairedBanner.waitForExistence(timeout: 15),
            "Expected paired banner to appear for the restored native session."
        )

        let reply = app.staticTexts.containing(NSPredicate(format: "label CONTAINS[c] %@", "OpenClaw")).firstMatch
        XCTAssertTrue(reply.waitForExistence(timeout: 90), "Expected /status to receive an OpenClaw status reply.")
    }

    func test_sameAccountRestoresNativePairingAndSendsImageMessage() throws {
        try ensureNativePairingRestored()

        let token = "IOS_IMAGE_ACK_\(Int(Date().timeIntervalSince1970))"

        try launchAuthenticated(
            initialTab: "chat",
            expectedIdentifier: AppUIIdentifiers.trixBotScreen,
            extraArguments: [
                "--ui-auto-login",
                "--ui-open-trixbot",
                "--ui-trixbot-prefill=请只回复 \(token)",
                "--ui-trixbot-attach-image",
                "--ui-trixbot-auto-send",
                "--ui-trixbot-auto-send-delay-ms=12000",
            ]
        )

        let trixBotScreen = element(withIdentifier: AppUIIdentifiers.trixBotScreen)
        let pairedBanner = element(withIdentifier: AppUIIdentifiers.trixBotPairedBanner)
        let attachmentPreview = element(withIdentifier: AppUIIdentifiers.trixBotAttachmentPreview)
        let sendButton = button(withIdentifier: AppUIIdentifiers.trixBotSendButton)

        XCTAssertTrue(
            trixBotScreen.waitForExistence(timeout: 15),
            "Expected TRIX Bot screen to open for image send validation."
        )
        XCTAssertTrue(
            pairedBanner.waitForExistence(timeout: 15),
            "Expected paired banner to appear for restored image send validation."
        )
        XCTAssertTrue(
            attachmentPreview.waitForExistence(timeout: 8),
            "Expected UI-test image attachment preview to appear."
        )
        XCTAssertTrue(waitForHittable(sendButton, timeout: 8), "Expected send button to become hittable for image send.")

        let reply = app.staticTexts.containing(NSPredicate(format: "label CONTAINS[c] %@", token)).firstMatch
        XCTAssertTrue(
            reply.waitForExistence(timeout: 120),
            "Expected image-backed prompt to receive tokenized reply."
        )
    }

    private func ensureNativePairingRestored() throws {
        try launchChatList()
        try openTrixBotEntry()

        let pairingScreen = element(withIdentifier: AppUIIdentifiers.pairingScreen)
        let trixBotScreen = element(withIdentifier: AppUIIdentifiers.trixBotScreen)

        let bootstrapState = waitForBootstrapState(pairingScreen: pairingScreen, trixBotScreen: trixBotScreen, timeout: 30)

        if bootstrapState == .pairing {
            let pairingCode = try createPairingCode()
            try completePairing(code: pairingCode)
        } else if bootstrapState != .chat {
            attachDebugHierarchy(named: "trixbot-restore-bootstrap-failed")
            XCTFail("Expected TRIX Bot entry to open either the pairing screen or the native chat.")
        }

        app.terminate()

        try launchChatList()
        try openTrixBotEntry()

        XCTAssertTrue(
            trixBotScreen.waitForExistence(timeout: 30),
            "Expected same account to restore the native TRIX Bot chat after pairing."
        )
        XCTAssertFalse(
            pairingScreen.exists,
            "Same account should restore native pairing instead of showing the pairing screen."
        )
        XCTAssertTrue(
            element(withIdentifier: AppUIIdentifiers.trixBotPairedBanner).waitForExistence(timeout: 10),
            "Expected paired banner to appear for the restored native session."
        )
    }

    private enum BootstrapState {
        case pairing
        case chat
        case unknown
    }

    private enum PairingCompletionState {
        case startChat
        case chatReady
        case unknown
    }

    private func waitForBootstrapState(
        pairingScreen: XCUIElement,
        trixBotScreen: XCUIElement,
        timeout: TimeInterval
    ) -> BootstrapState {
        let deadline = Date().addingTimeInterval(timeout)

        while Date() < deadline {
            if pairingScreen.exists {
                return .pairing
            }

            if trixBotScreen.exists {
                return .chat
            }

            RunLoop.current.run(until: Date().addingTimeInterval(0.25))
        }

        return .unknown
    }

    private func waitForPairingCompletion(
        startChatButton: XCUIElement,
        trixBotScreen: XCUIElement,
        timeout: TimeInterval
    ) -> PairingCompletionState {
        let deadline = Date().addingTimeInterval(timeout)

        while Date() < deadline {
            if startChatButton.exists {
                return .startChat
            }

            if trixBotScreen.exists {
                return .chatReady
            }

            RunLoop.current.run(until: Date().addingTimeInterval(0.25))
        }

        return .unknown
    }

    private func launchChatList(extraArguments: [String] = []) throws {
        try launchAuthenticated(
            initialTab: "chat",
            expectedIdentifier: AppUIIdentifiers.chatScreen,
            extraArguments: ["--ui-auto-login"] + extraArguments
        )
    }

    private func openTrixBotEntry() throws {
        let trixBotCard = element(withIdentifier: AppUIIdentifiers.chatTrixBotCard)
        XCTAssertTrue(trixBotCard.waitForExistence(timeout: 15), "Expected TRIX Bot card to appear on the chat list.")
        XCTAssertTrue(waitForHittable(trixBotCard, timeout: 10), "Expected TRIX Bot card to become tappable.")
        trixBotCard.tap()
    }

    private func completePairing(code: String) throws {
        let manualButton = button(withIdentifier: AppUIIdentifiers.pairingManualButton)
        XCTAssertTrue(manualButton.waitForExistence(timeout: 8), "Expected pairing screen manual input button to appear.")
        manualButton.tap()

        let codeField = textField(withIdentifier: AppUIIdentifiers.pairingCodeField)
        XCTAssertTrue(codeField.waitForExistence(timeout: 8), "Expected pairing code field to appear.")
        codeField.tap()
        codeField.typeText(code)

        let verifyButton = button(withIdentifier: AppUIIdentifiers.pairingVerifyButton)
        XCTAssertTrue(waitForHittable(verifyButton, timeout: 8), "Expected verify button to become tappable.")
        verifyButton.tap()

        let startChatButton = button(withIdentifier: AppUIIdentifiers.pairingStartChatButton)
        let trixBotScreen = element(withIdentifier: AppUIIdentifiers.trixBotScreen)

        switch waitForPairingCompletion(startChatButton: startChatButton, trixBotScreen: trixBotScreen, timeout: 45) {
        case .startChat:
            XCTAssertTrue(waitForHittable(startChatButton, timeout: 8), "Expected pairing success CTA to become tappable.")
            startChatButton.tap()
        case .chatReady:
            break
        case .unknown:
            attachDebugHierarchy(named: "pairing-completion-timeout")
            XCTFail("Expected pairing to finish by showing the success CTA or opening TRIX Bot chat directly.")
        }
    }

    private func createPairingCode(accountId: String = "default") throws -> String {
        let config = try resolvePairingBootstrapConfig()
        let url = config.serviceURL.appendingPathComponent("api/pairings")

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(config.serviceToken)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "accountId": accountId,
            "label": "iOS UI Test"
        ])

        struct PairingResponse: Decodable {
            let code: String
        }

        let semaphore = DispatchSemaphore(value: 0)
        let lock = NSLock()
        var outcome: Result<String, Error>?

        URLSession.shared.dataTask(with: request) { data, response, error in
            defer { semaphore.signal() }

            if let error {
                lock.lock()
                outcome = .failure(error)
                lock.unlock()
                return
            }

            guard let httpResponse = response as? HTTPURLResponse else {
                lock.lock()
                outcome = .failure(NSError(domain: "TrixBotNativeFlowTests", code: 1, userInfo: [NSLocalizedDescriptionKey: "Missing HTTP response while creating pairing code."]))
                lock.unlock()
                return
            }

            guard (200..<300).contains(httpResponse.statusCode), let data else {
                let body = data.flatMap { String(data: $0, encoding: .utf8) } ?? ""
                lock.lock()
                outcome = .failure(NSError(domain: "TrixBotNativeFlowTests", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: "Failed to create pairing code: HTTP \(httpResponse.statusCode) \(body)"]))
                lock.unlock()
                return
            }

            do {
                let payload = try JSONDecoder().decode(PairingResponse.self, from: data)
                lock.lock()
                outcome = .success(payload.code)
                lock.unlock()
            } catch {
                lock.lock()
                outcome = .failure(error)
                lock.unlock()
            }
        }.resume()

        XCTAssertEqual(semaphore.wait(timeout: .now() + 15), .success, "Timed out while creating pairing code.")
        return try XCTUnwrap(outcome).get()
    }

    private func resolvePairingBootstrapConfig() throws -> (serviceURL: URL, serviceToken: String) {
        if let serviceToken = config.serviceToken?.trimmingCharacters(in: .whitespacesAndNewlines),
           !serviceToken.isEmpty {
            let serviceURLString = config.serviceUrl?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
                ? config.serviceUrl!
                : "http://127.0.0.1:8788"
            let serviceURL = try XCTUnwrap(URL(string: serviceURLString), "Invalid service URL in UI test config.")
            return (serviceURL, serviceToken)
        }
        throw XCTSkip("Missing trix-native serviceToken in UI test config. Populate /tmp/trix-ui-config.json with serviceUrl/serviceToken before running native pairing UI tests.")
    }
}
