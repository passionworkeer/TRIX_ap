//
//  CameraViewModelTests.swift
//  TRIX3DCompanionTests
//
//  Regression tests for CameraViewModel's capture/import/upload flow.
//

import XCTest
import UIKit
import AVFoundation
@testable import TRIX3DCompanion

@MainActor
final class CameraViewModelTests: XCTestCase {
    private var sut: CameraViewModel!
    private var mockCameraService: MockCameraService!
    private var mockImageUploadService: MockImageUploadService!

    override func setUpWithError() throws {
        mockCameraService = MockCameraService()
        mockImageUploadService = MockImageUploadService()
        sut = CameraViewModel(
            cameraService: mockCameraService,
            imageUploadService: mockImageUploadService
        )
    }

    override func tearDownWithError() throws {
        sut = nil
        mockCameraService = nil
        mockImageUploadService = nil
    }

    func testRequestCameraPermissionSetsAuthorizedStatus() async {
        mockCameraService.mockPermissionResult = true

        await sut.requestCameraPermission()

        XCTAssertEqual(sut.cameraPermission, .authorized)
        XCTAssertEqual(mockCameraService.requestPermissionCallCount, 1)
    }

    func testStartCameraPublishesSessionActiveOnSuccess() async {
        sut.cameraPermission = .authorized
        mockCameraService.mockStartSessionResult = .success(())

        await sut.startCamera()

        XCTAssertTrue(sut.isSessionActive)
        XCTAssertNil(sut.errorMessage)
    }

    func testStartCameraStoresServiceErrorOnFailure() async {
        sut.cameraPermission = .authorized
        mockCameraService.mockStartSessionResult = .failure(.deviceUnavailable)

        await sut.startCamera()

        XCTAssertFalse(sut.isSessionActive)
        XCTAssertNotNil(sut.errorMessage)
    }

    func testCapturePhotoUpdatesPreviewStateOnSuccess() async {
        sut.cameraPermission = .authorized
        mockCameraService.isSessionRunning = true
        mockCameraService.setMockPhoto(mockCameraService.createTestImage())

        await sut.capturePhoto()

        XCTAssertNotNil(sut.capturedImage)
        XCTAssertTrue(sut.showPreview)
        XCTAssertFalse(sut.isCapturing)
    }

    func testCapturePhotoStoresErrorOnFailure() async {
        mockCameraService.setMockError(.sessionNotRunning)

        await sut.capturePhoto()

        XCTAssertNil(sut.capturedImage)
        XCTAssertFalse(sut.showPreview)
        XCTAssertNotNil(sut.errorMessage)
    }

    func testUseImportedImageReusesPreviewFlow() {
        let importedImage = mockCameraService.createTestImage(size: CGSize(width: 240, height: 240))

        sut.useImportedImage(importedImage)

        XCTAssertEqual(sut.capturedImage?.size.width, importedImage.size.width)
        XCTAssertTrue(sut.showPreview)
        XCTAssertNil(sut.errorMessage)
    }

    func testConfirmAndUploadReturnsUploadedURL() async {
        sut.capturedImage = mockCameraService.createTestImage(size: CGSize(width: 120, height: 120))
        mockImageUploadService.setMockUploadSuccess(url: "https://example.com/chat-photo.jpg")

        let result = await sut.confirmAndUpload()

        XCTAssertEqual(result, "https://example.com/chat-photo.jpg")
        XCTAssertEqual(sut.uploadedImageURL, "https://example.com/chat-photo.jpg")
        XCTAssertEqual(mockImageUploadService.uploadImageCallCount, 1)
    }

    func testConfirmAndUploadStoresUploadFailure() async {
        sut.capturedImage = mockCameraService.createTestImage()
        mockImageUploadService.setMockUploadFailure(.networkError(NSError(domain: "test", code: 1)))

        let result = await sut.confirmAndUpload()

        XCTAssertNil(result)
        XCTAssertNotNil(sut.errorMessage)
    }

    func testRetakePhotoClearsPreviewState() {
        sut.capturedImage = mockCameraService.createTestImage()
        sut.showPreview = true
        sut.uploadedImageURL = "https://example.com/old.jpg"
        sut.errorMessage = "Old error"

        sut.retakePhoto()

        XCTAssertNil(sut.capturedImage)
        XCTAssertFalse(sut.showPreview)
        XCTAssertNil(sut.uploadedImageURL)
        XCTAssertNil(sut.errorMessage)
    }

    func testToggleFlashDelegatesToService() {
        let initialMode = sut.flashMode

        sut.toggleFlash()

        XCTAssertNotEqual(sut.flashMode, initialMode)
        XCTAssertEqual(mockCameraService.toggleFlashCallCount, 1)
    }

    func testSwitchCameraDelegatesToService() {
        let initialPosition = sut.cameraPosition

        sut.switchCamera()

        XCTAssertNotEqual(sut.cameraPosition, initialPosition)
        XCTAssertEqual(mockCameraService.switchCameraCallCount, 1)
    }
}
