//
//  ChatDetailViewModelTests.swift
//  TRIX3DCompanionTests
//
//  Comprehensive test suite for ChatDetailViewModel
//  Covers message sending, input state machine, scroll behavior, and error handling
//

import XCTest
import Combine
@testable import TRIX3DCompanion

// MARK: - ChatDetailViewModel Tests

@MainActor
final class ChatDetailViewModelTests: XCTestCase {

    // MARK: - Properties

    private var sut: ChatDetailViewModel!
    private var mockChatService: MockChatService!
    private var mockAuthService: MockAuthService!
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Lifecycle

    override func setUp() async throws {
        try await super.setUp()
        mockChatService = MockChatService()
        mockAuthService = MockAuthService()

        let conversation = ChatConversation(
            id: "test-room",
            name: "Test Chat",
            avatarUrl: nil,
            lastMessage: "Hello",
            time: "Now",
            unreadCount: 0,
            avatarColor: .blue,
            isOnline: true
        )

        sut = ChatDetailViewModel(
            conversation: conversation,
            chatServiceProto: mockChatService,
            authServiceProto: mockAuthService
        )

        cancellables = []
    }

    override func tearDown() async throws {
        sut = nil
        mockChatService = nil
        mockAuthService = nil
        cancellables = []
        try await super.tearDown()
    }

    // MARK: - Initialization Tests

    func testInit_SetsConversation() {
        XCTAssertEqual(sut.conversation.id, "test-room")
        XCTAssertEqual(sut.conversation.name, "Test Chat")
    }

    func testInit_SetsDefaultUIState() {
        XCTAssertEqual(sut.uiState.inputText, "")
        XCTAssertNil(sut.uiState.pendingMedia)
        XCTAssertFalse(sut.uiState.isLoading)
        XCTAssertFalse(sut.uiState.isLoadingMore)
        XCTAssertNil(sut.uiState.error)
        XCTAssertFalse(sut.uiState.showAttachmentMenu)
        XCTAssertFalse(sut.uiState.showCamera)
        XCTAssertFalse(sut.uiState.showImagePicker)
        XCTAssertFalse(sut.uiState.isVoiceRecording)
    }

    // MARK: - Input State Machine Tests

    func testInputState_Empty_WhenNoInput() {
        // Given - no text, no media
        sut.uiState.inputText = ""
        sut.uiState.pendingMedia = nil

        // Then
        XCTAssertEqual(sut.uiState.inputState, .empty)
        XCTAssertFalse(sut.uiState.inputState.canSend)
    }

    func testInputState_HasText_WhenOnlyText() {
        // Given - has text only
        sut.uiState.inputText = "Hello"
        sut.uiState.pendingMedia = nil

        // Then
        if case .hasText(let text) = sut.uiState.inputState {
            XCTAssertEqual(text, "Hello")
        } else {
            XCTFail("Expected .hasText state")
        }
        XCTAssertTrue(sut.uiState.inputState.canSend)
    }

    func testInputState_HasMedia_WhenOnlyMedia() {
        // Given - has media only
        sut.uiState.inputText = ""
        sut.uiState.pendingMedia = MediaAttachment(
            type: .image,
            url: URL(string: "file:///test/image.jpg")!,
            thumbnail: nil,
            fileSize: 1024,
            duration: nil
        )

        // Then
        if case .hasMedia = sut.uiState.inputState {
            // Expected
        } else {
            XCTFail("Expected .hasMedia state")
        }
        XCTAssertTrue(sut.uiState.inputState.canSend)
    }

    func testInputState_Both_WhenTextAndMedia() {
        // Given - has both text and media
        sut.uiState.inputText = "Hello"
        sut.uiState.pendingMedia = MediaAttachment(
            type: .image,
            url: URL(string: "file:///test/image.jpg")!,
            thumbnail: nil,
            fileSize: 1024,
            duration: nil
        )

        // Then
        if case .both(let text, let media) = sut.uiState.inputState {
            XCTAssertEqual(text, "Hello")
            XCTAssertEqual(media.type, .image)
        } else {
            XCTFail("Expected .both state")
        }
        XCTAssertTrue(sut.uiState.inputState.canSend)
    }

    func testInputState_VoiceRecording_WhenRecording() {
        // Given
        sut.uiState.isVoiceRecording = true

        // Then
        XCTAssertTrue(sut.uiState.inputState.isRecording)
        XCTAssertFalse(sut.uiState.inputState.canSend)
    }

    func testInputState_CanSend_FalseForEmptyAndRecording() {
        // Empty
        XCTAssertFalse(sut.uiState.inputState.canSend)

        // Voice recording
        sut.uiState.isVoiceRecording = true
        XCTAssertFalse(sut.uiState.inputState.canSend)
    }

    func testInputState_WhitespaceOnly_IsEmpty() {
        // Given - whitespace only
        sut.uiState.inputText = "   \n\t  "

        // Then
        XCTAssertEqual(sut.uiState.inputState, .empty)
    }

    // MARK: - Message Sending Tests

    func testSendMessage_WithText_CallsService() async {
        // Given
        sut.uiState.inputText = "Hello world"
        mockChatService.setMockMessages([])

        // When
        await sut.sendMessage()

        // Then
        XCTAssertEqual(mockChatService.sendMessageCallCount, 1)
        XCTAssertEqual(mockChatService.lastSendMessageRoomId, "test-room")
        XCTAssertEqual(mockChatService.lastSendMessageContent, "Hello world")
        XCTAssertEqual(sut.uiState.inputText, "", "Should clear input after send")
        XCTAssertNil(sut.uiState.pendingMedia, "Should clear media after send")
    }

    func testSendMessage_WithMedia_CallsServiceWithImageType() async {
        // Given
        sut.uiState.inputText = "Check this"
        sut.uiState.pendingMedia = MediaAttachment(
            type: .image,
            url: URL(string: "file:///test/image.jpg")!,
            thumbnail: nil,
            fileSize: 2048,
            duration: nil
        )
        mockChatService.setMockMessages([])

        // When
        await sut.sendMessage()

        // Then
        XCTAssertEqual(mockChatService.sendMessageCallCount, 1)
        XCTAssertNotNil(mockChatService.lastSendMessageRoomId)
    }

    func testSendMessage_CannotSendWhenEmpty() async {
        // Given - empty input
        sut.uiState.inputText = ""
        sut.uiState.pendingMedia = nil

        // When
        await sut.sendMessage()

        // Then
        XCTAssertEqual(mockChatService.sendMessageCallCount, 0, "Should not send when cannot send")
    }

    func testSendMessage_WhenServiceFails_SetsError() async {
        // Given
        sut.uiState.inputText = "Hello"
        mockChatService.shouldSendMessageThrowError = true
        mockChatService.errorToThrow = .networkError(underlying: NSError(domain: "Test", code: -1))
        mockChatService.setMockMessages([])

        // When
        await sut.sendMessage()

        // Then
        XCTAssertNotNil(sut.uiState.error, "Should set error on failure")
    }

    func testSendMessage_TrimsWhitespace() async {
        // Given
        sut.uiState.inputText = "  Hello world  \n"
        mockChatService.setMockMessages([])

        // When
        await sut.sendMessage()

        // Then
        XCTAssertEqual(mockChatService.lastSendMessageContent, "Hello world")
    }

    // MARK: - Media Attachment Tests

    func testSelectMedia_SetsPendingMedia() {
        // Given
        let media = MediaAttachment(
            type: .image,
            url: URL(string: "file:///test/photo.jpg")!,
            thumbnail: nil,
            fileSize: 512,
            duration: nil
        )

        // When
        sut.selectMedia(media)

        // Then
        XCTAssertEqual(sut.uiState.pendingMedia?.type, .image)
    }

    func testRemovePendingMedia_ClearsMedia() {
        // Given
        sut.uiState.pendingMedia = MediaAttachment(
            type: .image,
            url: URL(string: "file:///test/photo.jpg")!,
            thumbnail: nil,
            fileSize: 512,
            duration: nil
        )

        // When
        sut.removePendingMedia()

        // Then
        XCTAssertNil(sut.uiState.pendingMedia)
    }

    func testShowAttachmentMenu_SetsFlag() {
        // When
        sut.showAttachmentMenu()

        // Then
        XCTAssertTrue(sut.uiState.showAttachmentMenu)
    }

    func testShowCamera_SetsFlag() {
        // When
        sut.showCamera()

        // Then
        XCTAssertTrue(sut.uiState.showCamera)
    }

    func testShowImagePicker_SetsFlag() {
        // When
        sut.showImagePicker()

        // Then
        XCTAssertTrue(sut.uiState.showImagePicker)
    }

    // MARK: - Lifecycle Tests

    func testOnAppear_LoadsConversation() async {
        // Given
        mockChatService.setMockMessages([])
        mockChatService.setMockRooms([])

        // When
        sut.onAppear()

        // Allow async operations to complete
        try? await Task.sleep(nanoseconds: 100_000_000)

        // Then - should select room
        XCTAssertEqual(mockChatService.selectRoomCallCount, 1)
        XCTAssertEqual(mockChatService.lastSelectRoomId, "test-room")
    }

    func testOnDisappear_DisconnectsWebSocket() {
        // Given
        mockChatService.isConnected = true

        // When
        sut.onDisappear()

        // Then
        XCTAssertEqual(mockChatService.disconnectWebSocketCallCount, 1)
    }

    // MARK: - Scroll Behavior Tests

    func testShouldScrollToBottom_WhenMessageCountIncreases() {
        // Given
        mockChatService.setMockMessages(MockChatService.makeMockMessages(count: 2))
        sut.trackMessageCount()

        // Add more messages
        mockChatService.addMockMessage(MockChatService.makeMockMessage(id: "msg-new", content: "New message"))

        // Then
        XCTAssertTrue(sut.shouldScrollToBottom, "Should scroll when message count increases")
    }

    func testShouldScrollToBottom_WhenMessageCountSame() {
        // Given
        mockChatService.setMockMessages(MockChatService.makeMockMessages(count: 3))
        sut.trackMessageCount()

        // No new messages

        // Then
        XCTAssertFalse(sut.shouldScrollToBottom, "Should not scroll when message count unchanged")
    }

    func testShouldScrollToBottom_WhenMessageCountDecreases() {
        // Given
        mockChatService.setMockMessages(MockChatService.makeMockMessages(count: 5))
        sut.trackMessageCount()

        // Simulate messages being cleared (e.g., room change)
        mockChatService.setMockMessages([])

        // Then
        XCTAssertFalse(sut.shouldScrollToBottom, "Should not scroll when message count decreases")
    }

    func testTrackMessageCount_UpdatesPreviousCount() {
        // Given
        mockChatService.setMockMessages(MockChatService.makeMockMessages(count: 10))

        // When
        sut.trackMessageCount()

        // Then
        XCTAssertEqual(sut.uiState.previousMessageCount, 10)
    }

    // MARK: - Pagination Tests

    func testLoadMoreMessages_WhenNotLoadingMore() async {
        // Given
        mockChatService.setMockMessages(MockChatService.makeMockMessages(count: 50))

        // When
        await sut.loadMoreMessages()

        // Then
        XCTAssertEqual(mockChatService.fetchMessagesCallCount, 1)
        XCTAssertTrue(sut.uiState.isLoadingMore)
    }

    func testLoadMoreMessages_SetsAndClearsLoadingFlag() async {
        // Given
        mockChatService.setMockMessages(MockChatService.makeMockMessages(count: 50))

        // When
        await sut.loadMoreMessages()

        // Then
        XCTAssertFalse(sut.uiState.isLoadingMore, "Should clear loading flag after load")
    }

    // MARK: - Reconnect Tests

    func testReconnect_CallsConnectWebSocket() async {
        // Given
        mockChatService.isConnected = false

        // When
        await sut.reconnect()

        // Then
        XCTAssertEqual(mockChatService.connectWebSocketCallCount, 1)
        XCTAssertEqual(mockChatService.lastConnectWebSocketUserId, "test-user-id")
    }

    // MARK: - Connection State Tests

    func testIsConnected_ReturnsServiceState() {
        // Given - disconnected
        mockChatService.isConnected = false

        // Then
        XCTAssertFalse(sut.isConnected)

        // Given - connected
        mockChatService.isConnected = true

        // Then
        XCTAssertTrue(sut.isConnected)
    }

    // MARK: - Messages Access Tests

    func testMessages_ReturnsServiceMessages() {
        // Given
        let messages = MockChatService.makeMockMessages(count: 3)
        mockChatService.setMockMessages(messages)

        // Then
        XCTAssertEqual(sut.messages.count, 3)
    }

    func testHasMoreMessages_ReturnsServiceState() {
        // Given
        mockChatService.hasMoreMessages = true

        // Then
        XCTAssertTrue(sut.hasMoreMessages)

        // Given
        mockChatService.hasMoreMessages = false

        // Then
        XCTAssertFalse(sut.hasMoreMessages)
    }

    // MARK: - Current User Tests

    func testCurrentUserId_ReturnsAuthServiceUserId() {
        XCTAssertEqual(sut.currentUserId, "test-user-id")
    }

    func testIsCurrentUserMessage_ChecksSenderId() {
        // Given
        let currentUserMessage = MockChatService.makeMockMessage(sender: .user)
        let botMessage = MockChatService.makeMockMessage(sender: .bot)

        // Then
        XCTAssertTrue(sut.isCurrentUserMessage(currentUserMessage))
        XCTAssertFalse(sut.isCurrentUserMessage(botMessage))
    }

    // MARK: - Preview Tests

    func testPreview_CreatesPreviewInstance() {
        // When
        let preview = ChatDetailViewModel.preview()

        // Then
        XCTAssertEqual(preview.conversation.id, "preview")
        XCTAssertEqual(preview.conversation.name, "Test Chat")
    }
}

// MARK: - ChatInputState Tests

@MainActor
final class ChatInputStateTests: XCTestCase {

    func testChatInputState_Equatable() {
        // Given
        let state1 = ChatInputState.empty
        let state2 = ChatInputState.empty

        // Then
        XCTAssertEqual(state1, state2)
    }

    func testChatInputState_HasText_Equatable() {
        // Given
        let state1 = ChatInputState.hasText("Hello")
        let state2 = ChatInputState.hasText("Hello")
        let state3 = ChatInputState.hasText("World")

        // Then
        XCTAssertEqual(state1, state2)
        XCTAssertNotEqual(state1, state3)
    }

    func testChatInputState_isRecording_TrueOnlyForVoiceRecording() {
        // Empty
        XCTAssertFalse(ChatInputState.empty.isRecording)

        // Has text
        XCTAssertFalse(ChatInputState.hasText("Hello").isRecording)

        // Voice recording
        XCTAssertTrue(ChatInputState.voiceRecording.isRecording)
    }
}

// MARK: - MediaAttachment Tests

@MainActor
final class MediaAttachmentTests: XCTestCase {

    func testMediaAttachment_CreatesWithAllProperties() {
        // Given
        let url = URL(string: "file:///test/video.mp4")!
        let thumbnail = UIImage(systemName: "video")

        // When
        let attachment = MediaAttachment(
            type: .video,
            url: url,
            thumbnail: thumbnail,
            fileSize: 1024 * 1024,
            duration: 120.0
        )

        // Then
        XCTAssertEqual(attachment.type, .video)
        XCTAssertEqual(attachment.url, url)
        XCTAssertEqual(attachment.thumbnail, thumbnail)
        XCTAssertEqual(attachment.fileSize, 1024 * 1024)
        XCTAssertEqual(attachment.duration, 120.0)
    }

    func testMediaAttachment_MediaType_AllCases() {
        // Image
        let image = MediaAttachment(type: .image, url: URL(string: "file:///img.jpg")!, thumbnail: nil, fileSize: nil, duration: nil)
        XCTAssertEqual(image.type, .image)

        // Video
        let video = MediaAttachment(type: .video, url: URL(string: "file:///vid.mp4")!, thumbnail: nil, fileSize: nil, duration: nil)
        XCTAssertEqual(video.type, .video)

        // Audio
        let audio = MediaAttachment(type: .audio, url: URL(string: "file:///audio.m4a")!, thumbnail: nil, fileSize: nil, duration: nil)
        XCTAssertEqual(audio.type, .audio)

        // File
        let file = MediaAttachment(type: .file(mimeType: "application/pdf"), url: URL(string: "file:///doc.pdf")!, thumbnail: nil, fileSize: nil, duration: nil)
        if case .file(let mimeType) = file.type {
            XCTAssertEqual(mimeType, "application/pdf")
        } else {
            XCTFail("Expected file type")
        }
    }

    func testMediaAttachment_Identifiable() {
        // Given
        let attachment1 = MediaAttachment(type: .image, url: URL(string: "file:///1.jpg")!, thumbnail: nil, fileSize: nil, duration: nil)
        let attachment2 = MediaAttachment(type: .image, url: URL(string: "file:///2.jpg")!, thumbnail: nil, fileSize: nil, duration: nil)

        // Then - each has unique ID
        XCTAssertNotEqual(attachment1.id, attachment2.id)
    }

    func testMediaAttachment_Equatable() {
        // Given
        let url1 = URL(string: "file:///same.jpg")!
        let url2 = URL(string: "file:///same.jpg")!

        let attachment1 = MediaAttachment(type: .image, url: url1, thumbnail: nil, fileSize: 100, duration: nil)
        let attachment2 = MediaAttachment(type: .image, url: url2, thumbnail: nil, fileSize: 100, duration: nil)

        // Then
        XCTAssertEqual(attachment1, attachment2)
    }
}

// MARK: - ChatUIState Tests

@MainActor
final class ChatUIStateTests: XCTestCase {

    func testChatUIState_DefaultValues() {
        // Given
        let state = ChatUIState()

        // Then
        XCTAssertEqual(state.inputText, "")
        XCTAssertNil(state.pendingMedia)
        XCTAssertFalse(state.isLoading)
        XCTAssertFalse(state.isLoadingMore)
        XCTAssertNil(state.error)
        XCTAssertFalse(state.showAttachmentMenu)
        XCTAssertFalse(state.showCamera)
        XCTAssertFalse(state.showImagePicker)
        XCTAssertFalse(state.isVoiceRecording)
        XCTAssertFalse(state.shouldScrollToBottom)
        XCTAssertEqual(state.previousMessageCount, 0)
    }

    func testChatUIState_InputState_Computed() {
        // Given
        var state = ChatUIState()

        // Empty
        state.inputText = ""
        state.pendingMedia = nil
        state.isVoiceRecording = false
        XCTAssertEqual(state.inputState, .empty)

        // Has text
        state.inputText = "Hello"
        XCTAssertTrue(state.inputState.canSend)

        // Voice recording overrides
        state.isVoiceRecording = true
        XCTAssertTrue(state.inputState.isRecording)
    }
}
