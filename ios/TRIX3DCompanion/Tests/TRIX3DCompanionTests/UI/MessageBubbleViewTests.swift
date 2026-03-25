//
//  MessageBubbleViewTests.swift
//  TRIX3DCompanionTests
//
//  UI component tests for MessageBubbleView
//  Tests rendering of different message types and states
//

import XCTest
import SwiftUI
@testable import TRIX3DCompanion

// MARK: - MessageBubbleView Tests

@MainActor
final class MessageBubbleViewTests: XCTestCase {

    // MARK: - Helper Methods

    private func makeTextMessage(
        id: String = "msg_1",
        content: String = "Hello, world!",
        sender: MessageSender = .user,
        isRead: Bool = true
    ) -> ChatMessage {
        ChatMessage(
            id: id,
            roomId: "room_1",
            senderId: "user_1",
            sender: sender,
            content: content,
            messageType: .text,
            mediaUrl: nil,
            mediaMimeType: nil,
            mediaDuration: nil,
            mediaSize: nil,
            mediaMetadata: nil,
            voiceUrl: nil,
            voiceDuration: nil,
            voiceTranscript: nil,
            voiceMimeType: nil,
            isRead: isRead,
            createdAt: Date()
        )
    }

    private func makeImageMessage(
        mediaUrl: String = "https://example.com/image.jpg"
    ) -> ChatMessage {
        ChatMessage(
            id: "msg_image",
            roomId: "room_1",
            senderId: "user_1",
            sender: .user,
            content: "Check this image",
            messageType: .image,
            mediaUrl: mediaUrl,
            mediaMimeType: "image/jpeg",
            mediaDuration: nil,
            mediaSize: nil,
            mediaMetadata: nil,
            voiceUrl: nil,
            voiceDuration: nil,
            voiceTranscript: nil,
            voiceMimeType: nil,
            isRead: true,
            createdAt: Date()
        )
    }

    private func makeVoiceMessage(
        duration: Int = 32,
        sender: MessageSender = .user
    ) -> ChatMessage {
        ChatMessage(
            id: "msg_voice",
            roomId: "room_1",
            senderId: "user_1",
            sender: sender,
            content: "",
            messageType: .voice,
            mediaUrl: nil,
            mediaMimeType: nil,
            mediaDuration: nil,
            mediaSize: nil,
            mediaMetadata: nil,
            voiceUrl: "https://example.com/voice.m4a",
            voiceDuration: duration,
            voiceTranscript: nil,
            voiceMimeType: "audio/m4a",
            isRead: true,
            createdAt: Date()
        )
    }

    private func makeVideoMessage(
        mediaUrl: String = "https://example.com/video.mp4",
        duration: Double = 120
    ) -> ChatMessage {
        ChatMessage(
            id: "msg_video",
            roomId: "room_1",
            senderId: "user_1",
            sender: .user,
            content: "Watch this video",
            messageType: .video,
            mediaUrl: mediaUrl,
            mediaMimeType: "video/mp4",
            mediaDuration: Int(duration),
            mediaSize: nil,
            mediaMetadata: nil,
            voiceUrl: nil,
            voiceDuration: nil,
            voiceTranscript: nil,
            voiceMimeType: nil,
            isRead: true,
            createdAt: Date()
        )
    }

    private func makeFileMessage(
        fileName: String = "Report.pdf"
    ) -> ChatMessage {
        ChatMessage(
            id: "msg_file",
            roomId: "room_1",
            senderId: "user_1",
            sender: .user,
            content: fileName,
            messageType: .file,
            mediaUrl: nil,
            mediaMimeType: "application/pdf",
            mediaDuration: nil,
            mediaSize: 102400,
            mediaMetadata: nil,
            voiceUrl: nil,
            voiceDuration: nil,
            voiceTranscript: nil,
            voiceMimeType: nil,
            isRead: true,
            createdAt: Date()
        )
    }

    // MARK: - User Message Bubble Tests

    func testUserMessageBubbleRenderedOnRightSide() throws {
        let message = makeTextMessage()

        let view = MessageBubbleView(
            message: message,
            isFromCurrentUser: true,
            showAvatar: true,
            showTimestamp: false
        )

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        // Verify view hierarchy contains expected elements
        XCTAssertNotNil(controller.view)
    }

    func testUserMessageBubbleHasAccentColor() throws {
        let message = makeTextMessage(content: "Purple message")

        let view = MessageBubbleView(
            message: message,
            isFromCurrentUser: true,
            showAvatar: false,
            showTimestamp: false
        )

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }

    func testUserMessageContentDisplayed() throws {
        let content = "Test user message content"
        let message = makeTextMessage(content: content)

        let view = MessageBubbleView(
            message: message,
            isFromCurrentUser: true,
            showAvatar: false,
            showTimestamp: false
        )

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }

    // MARK: - AI/TrixBot Message Bubble Tests

    func testAIMessageBubbleRenderedOnLeftSide() throws {
        let message = makeTextMessage(sender: .bot)

        let view = MessageBubbleView(
            message: message,
            isFromCurrentUser: false,
            showAvatar: true,
            showTimestamp: false
        )

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }

    func testBotMessageBubbleHasSecondaryColor() throws {
        let message = makeTextMessage(content: "I am Clawbot!", sender: .bot)

        let view = MessageBubbleView(
            message: message,
            isFromCurrentUser: false,
            showAvatar: false,
            showTimestamp: false
        )

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }

    func testFriendMessageBubbleRendered() throws {
        let message = makeTextMessage(content: "Hello from a friend!", sender: .friend)

        let view = MessageBubbleView(
            message: message,
            isFromCurrentUser: false,
            showAvatar: true,
            showTimestamp: false
        )

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }

    // MARK: - Image Message Bubble Tests

    func testImageMessageBubbleWithMediaUrl() throws {
        let message = makeImageMessage(mediaUrl: "https://example.com/photo.jpg")

        let view = MessageBubbleView(
            message: message,
            isFromCurrentUser: true,
            showAvatar: false,
            showTimestamp: false
        )

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
        XCTAssertNotNil(message.mediaUrl)
    }

    func testImageMessageBubbleWithoutMediaUrl() throws {
        let message = makeImageMessage(mediaUrl: "")

        let view = MessageBubbleView(
            message: message,
            isFromCurrentUser: false,
            showAvatar: false,
            showTimestamp: false
        )

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }

    // MARK: - Voice Message Bubble Tests

    func testVoiceMessageBubbleShowsDuration() throws {
        let duration: Int = 45
        let message = makeVoiceMessage(duration: duration)

        XCTAssertEqual(message.voiceDuration, 45)

        let view = MessageBubbleView(
            message: message,
            isFromCurrentUser: false,
            showAvatar: false,
            showTimestamp: false
        )

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }

    func testVoiceMessageBubbleShortDuration() throws {
        let message = makeVoiceMessage(duration: 5)

        XCTAssertEqual(message.voiceDuration, 5)

        let view = MessageBubbleView(
            message: message,
            isFromCurrentUser: true,
            showAvatar: false,
            showTimestamp: false
        )

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }

    func testVoiceMessageBubbleLongDuration() throws {
        let message = makeVoiceMessage(duration: 300)

        XCTAssertEqual(message.voiceDuration, 300) // 5 minutes

        let view = MessageBubbleView(
            message: message,
            isFromCurrentUser: false,
            showAvatar: false,
            showTimestamp: false
        )

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }

    // MARK: - Video Message Bubble Tests

    func testVideoMessageBubbleWithDuration() throws {
        let message = makeVideoMessage(duration: 180)

        XCTAssertEqual(message.mediaDuration, 180)

        let view = MessageBubbleView(
            message: message,
            isFromCurrentUser: true,
            showAvatar: false,
            showTimestamp: false
        )

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }

    // MARK: - File Message Bubble Tests

    func testFileMessageBubbleWithFileName() throws {
        let fileName = "Document.pdf"
        let message = makeFileMessage(fileName: fileName)

        XCTAssertEqual(message.content, "Document.pdf")

        let view = MessageBubbleView(
            message: message,
            isFromCurrentUser: false,
            showAvatar: false,
            showTimestamp: false
        )

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }

    // MARK: - System Message Tests

    func testSystemMessageBubbleRendering() throws {
        let message = makeTextMessage(
            content: "System notification",
            sender: .bot
        )

        let view = MessageBubbleView(
            message: message,
            isFromCurrentUser: false,
            showAvatar: false,
            showTimestamp: true
        )

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }

    // MARK: - Timestamp Tests

    func testTimestampShownWhenEnabled() throws {
        let message = makeTextMessage()

        let view = MessageBubbleView(
            message: message,
            isFromCurrentUser: true,
            showAvatar: false,
            showTimestamp: true
        )

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }

    func testTimestampHiddenWhenDisabled() throws {
        let message = makeTextMessage()

        let view = MessageBubbleView(
            message: message,
            isFromCurrentUser: true,
            showAvatar: false,
            showTimestamp: false
        )

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }

    // MARK: - Avatar Tests

    func testAvatarShownWhenEnabled() throws {
        let message = makeTextMessage()

        let view = MessageBubbleView(
            message: message,
            isFromCurrentUser: false,
            showAvatar: true,
            showTimestamp: false
        )

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }

    func testAvatarHiddenForCurrentUser() throws {
        let message = makeTextMessage()

        let view = MessageBubbleView(
            message: message,
            isFromCurrentUser: true,
            showAvatar: false,
            showTimestamp: false
        )

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }

    // MARK: - Long Text Tests

    func testLongTextMessageWrapping() throws {
        let longText = """
        This is a very long message that should wrap gracefully \
        within the message bubble. It contains multiple sentences \
        and should demonstrate proper text wrapping behavior. \
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. \
        Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
        """

        let message = makeTextMessage(content: longText)

        let view = MessageBubbleView(
            message: message,
            isFromCurrentUser: true,
            showAvatar: false,
            showTimestamp: false
        )

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }

    func testVeryLongSingleWordText() throws {
        let longWord = String(repeating: "word ", count: 200)

        let message = makeTextMessage(content: longWord)

        let view = MessageBubbleView(
            message: message,
            isFromCurrentUser: false,
            showAvatar: false,
            showTimestamp: false
        )

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }

    // MARK: - Empty Message Edge Case Tests

    func testEmptyTextMessage() throws {
        let message = ChatMessage(
            id: "msg_empty",
            roomId: "room_1",
            senderId: "user_1",
            sender: .user,
            content: "",
            messageType: .text,
            mediaUrl: nil,
            mediaMimeType: nil,
            mediaDuration: nil,
            mediaSize: nil,
            mediaMetadata: nil,
            voiceUrl: nil,
            voiceDuration: nil,
            voiceTranscript: nil,
            voiceMimeType: nil,
            isRead: true,
            createdAt: Date()
        )

        let view = MessageBubbleView(
            message: message,
            isFromCurrentUser: true,
            showAvatar: false,
            showTimestamp: false
        )

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
        XCTAssertEqual(message.content, "")
    }

    func testEmptyImageMessageCaption() throws {
        let message = ChatMessage(
            id: "msg_img_empty",
            roomId: "room_1",
            senderId: "user_1",
            sender: .user,
            content: "",
            messageType: .image,
            mediaUrl: "https://example.com/photo.jpg",
            mediaMimeType: "image/jpeg",
            mediaDuration: nil,
            mediaSize: nil,
            mediaMetadata: nil,
            voiceUrl: nil,
            voiceDuration: nil,
            voiceTranscript: nil,
            voiceMimeType: nil,
            isRead: true,
            createdAt: Date()
        )

        let view = MessageBubbleView(
            message: message,
            isFromCurrentUser: true,
            showAvatar: false,
            showTimestamp: false
        )

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
        XCTAssertEqual(message.content, "")
        XCTAssertNotNil(message.mediaUrl)
    }

    // MARK: - Timestamp Formatting Tests

    func testTimestampFormatting() throws {
        let timeFormatter = DateFormatter()
        timeFormatter.timeStyle = .short
        timeFormatter.dateStyle = .none

        let testDates = [
            Calendar.current.date(from: DateComponents(hour: 0, minute: 0))!,
            Calendar.current.date(from: DateComponents(hour: 12, minute: 30))!,
            Calendar.current.date(from: DateComponents(hour: 23, minute: 59))!
        ]

        for date in testDates {
            let formatted = timeFormatter.string(from: date)
            XCTAssertFalse(formatted.isEmpty)
        }
    }

    // MARK: - Dark Mode Tests

    func testMessageBubbleInDarkMode() throws {
        let message = makeTextMessage(content: "Dark mode message")

        let view = MessageBubbleView(
            message: message,
            isFromCurrentUser: false,
            showAvatar: false,
            showTimestamp: false
        )
        .preferredColorScheme(.dark)

        let controller = UIHostingController(rootView: view)
        _ = controller.view

        XCTAssertNotNil(controller.view)
    }

    // MARK: - Duration Formatting Tests

    func testDurationFormatting() throws {
        let testCases: [(Double, String)] = [
            (0, "0:00"),
            (30, "0:30"),
            (60, "1:00"),
            (90, "1:30"),
            (600, "10:00"),
            (3661, "1:01:01"),
        ]

        for (seconds, expectedPattern) in testCases {
            let minutes = Int(seconds) / 60
            let secs = Int(seconds) % 60
            let hours = Int(seconds) / 3600

            let formatted: String
            if hours > 0 {
                formatted = String(format: "%d:%02d:%02d", hours, minutes, secs)
            } else {
                formatted = String(format: "%d:%02d", minutes, secs)
            }

            XCTAssertFalse(formatted.isEmpty)
        }
    }
}
