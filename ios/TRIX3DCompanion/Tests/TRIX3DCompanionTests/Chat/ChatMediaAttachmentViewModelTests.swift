//
//  ChatMediaAttachmentViewModelTests.swift
//  TRIX3DCompanionTests
//
//  Verifies chat attachment uploads keep error state and success state explicit.
//

import XCTest
@testable import TRIX3DCompanion

@MainActor
final class ChatMediaAttachmentViewModelTests: XCTestCase {
    private var sut: ChatMediaAttachmentViewModel!
    private var mockUploadService: MockImageUploadService!
    private var mockCameraService: MockCameraService!

    override func setUpWithError() throws {
        mockUploadService = MockImageUploadService()
        mockCameraService = MockCameraService()
        sut = ChatMediaAttachmentViewModel(imageUploadService: mockUploadService)
    }

    override func tearDownWithError() throws {
        sut = nil
        mockUploadService = nil
        mockCameraService = nil
    }

    func testUploadReturnsURLOnSuccess() async {
        let image = mockCameraService.createTestImage()
        mockUploadService.setMockUploadSuccess(url: "https://example.com/attachment.jpg")

        let result = await sut.upload(image: image)

        XCTAssertEqual(result, "https://example.com/attachment.jpg")
        XCTAssertNil(sut.errorMessage)
        XCTAssertEqual(mockUploadService.uploadImageCallCount, 1)
    }

    func testUploadStoresFailureMessage() async {
        let image = mockCameraService.createTestImage()
        mockUploadService.setMockUploadFailure(.fileTooLarge)

        let result = await sut.upload(image: image)

        XCTAssertNil(result)
        XCTAssertEqual(sut.errorMessage, UploadError.fileTooLarge.errorDescription)
    }

    func testClearErrorResetsPresentationState() {
        sut.errorMessage = "error"

        sut.clearError()

        XCTAssertNil(sut.errorMessage)
    }
}
