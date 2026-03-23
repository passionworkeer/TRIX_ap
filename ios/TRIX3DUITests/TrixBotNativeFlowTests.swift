import XCTest

final class TrixBotNativeFlowTests: RealAppUITestCase {
    func test_sameAccountRestoresNativePairingAndReceivesStatusReply() throws {
        try launchAuthenticated(
            initialTab: "chat",
            expectedIdentifier: AppUIIdentifiers.chatScreen,
            extraArguments: ["--ui-auto-login", "--ui-open-trixbot", "--ui-trixbot-prefill=/status", "--ui-trixbot-auto-send"]
        )
        XCTAssertTrue(waitForMainNavigationReady(selectedTabIdentifier: AppUIIdentifiers.selectedChatTab))

        let trixBotScreen = element(withIdentifier: AppUIIdentifiers.trixBotScreen)
        let trixBotCloseButton = element(withIdentifier: AppUIIdentifiers.trixBotCloseButton)
        let pairedBanner = element(withIdentifier: AppUIIdentifiers.trixBotPairedBanner)
        let pairingScreen = element(withIdentifier: AppUIIdentifiers.pairingScreen)

        let didOpenTrixBotScreen = trixBotScreen.waitForExistence(timeout: 15)
        if !didOpenTrixBotScreen {
            attachDebugHierarchy(named: "trixbot-open-failed")
            if pairingScreen.exists {
                XCTFail("TRIX Bot card routed to pairing screen instead of restored native chat.")
            }
            if trixBotCloseButton.exists || pairedBanner.exists {
                XCTFail("TRIX Bot controls appeared, but the screen identifier did not. Accessibility marker is likely missing.")
            }
            XCTFail("Expected TRIX Bot screen to open.")
        }
        XCTAssertFalse(
            pairingScreen.exists,
            "Same account should restore native pairing instead of showing pairing screen."
        )
        XCTAssertTrue(
            trixBotCloseButton.waitForExistence(timeout: 5),
            "Expected TRIX Bot close button to appear."
        )
        XCTAssertTrue(
            element(withIdentifier: AppUIIdentifiers.trixBotSendButton).waitForExistence(timeout: 5),
            "Expected TRIX Bot send button to appear."
        )
        XCTAssertTrue(
            pairedBanner.waitForExistence(timeout: 15),
            "Expected paired banner to appear for the restored native session."
        )

        let input = textField(withIdentifier: AppUIIdentifiers.trixBotInputField)
        XCTAssertTrue(input.waitForExistence(timeout: 8))

        let sendButton = button(withIdentifier: AppUIIdentifiers.trixBotSendButton)
        XCTAssertTrue(sendButton.waitForExistence(timeout: 5))
        XCTAssertTrue(waitForHittable(sendButton, timeout: 8), "Expected send button to become hittable.")

        let reply = app.staticTexts.containing(NSPredicate(format: "label CONTAINS[c] %@", "OpenClaw")).firstMatch
        XCTAssertTrue(
            reply.waitForExistence(timeout: 90),
            "Expected /status to receive an OpenClaw status reply."
        )
    }

    func test_sameAccountRestoresNativePairingAndSendsImageMessage() throws {
        let token = "IOS_IMAGE_ACK_\(Int(Date().timeIntervalSince1970))"

        try launchAuthenticated(
            initialTab: "chat",
            expectedIdentifier: AppUIIdentifiers.chatScreen,
            extraArguments: [
                "--ui-auto-login",
                "--ui-open-trixbot",
                "--ui-trixbot-prefill=请只回复 \(token)",
                "--ui-trixbot-attach-image",
                "--ui-trixbot-auto-send",
                "--ui-trixbot-auto-send-delay-ms=12000",
            ]
        )
        XCTAssertTrue(waitForMainNavigationReady(selectedTabIdentifier: AppUIIdentifiers.selectedChatTab))

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
}
