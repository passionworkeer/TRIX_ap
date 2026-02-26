//
//  CameraViewModelTests.swift
//  TRIX3DCompanionTests
//
//  Unit tests for CameraViewModel
//

import XCTest
import UIKit
import AVFoundation
import Combine
@testable import TRIX3DCompanion

/// Unit tests for CameraViewModel
final class CameraViewModelTests: XCTestCase {

    // MARK: - Properties

    var cameraViewModel: CameraViewModel!
    var mockCameraService: MockCameraService!
    var mockImageUploadService: MockImageUploadService!
    var cancellables: Set<AnyCancellable>!

    // MARK: - Test Lifecycle

    override func setUpWithError() throws {
        mockCameraService = MockCameraService()
        mockImageUploadService = MockImageUploadService()
        cameraViewModel = CameraViewModel(
            cameraService: mockCameraService,
            imageUploadService: mockImageUploadService
        )
        cancellables = Set<AnyCancellable>()
    }

    override func tearDownWithError() throws {
        cameraViewModel = nil
        mockCameraService = nil
        mockImageUploadService = nil
        cancellables = nil
    }

    // MARK: - Capture Photo Tests

    func test_capturePhoto_updatesCapturedImage() async throws {
        // Arrange
        let testImage = mockCameraService.createTestImage()
        mockCameraService.setMockPhoto(testImage)
        mockCameraService.isSessionRunning = true
        mockCameraService.mockStartSessionResult = .success(())

        await cameraViewModel.startSession()

        // Act
        await cameraViewModel.capturePhoto()

        // Assert
        XCTAssertNotNil(cameraViewModel.capturedImage, "Should have captured image")
        XCTAssertFalse(cameraViewModel.isCapturing, "Should not be capturing")
        XCTAssertNil(cameraViewModel.errorMessage, "Should not have error")
    }

    func test_capturePhoto_handlesError() async throws {
        // Arrange
        mockCameraService.setMockError(.sessionNotRunning)
        mockCameraService.isSessionRunning = false

        // Act
        await cameraViewModel.capturePhoto()

        // Assert
        XCTAssertNil(cameraViewModel.capturedImage, "Should not have image")
        XCTAssertNotNil(cameraViewModel.errorMessage, "Should have error message")
    }

    func test_capturePhoto_whileCapturing() async throws {
        // Arrange
        cameraViewModel.isCapturing = true

        // Act - Try to capture while already capturing
        await cameraViewModel.capturePhoto()

        // Assert - Should not make service call
        XCTAssertEqual(mockCameraService.capturePhotoCallCount, 0, "Should not call service")
    }

    // MARK: - Retake Photo Tests

    func test_retakePhoto_clearsCapturedImage() async throws {
        // Arrange
        let testImage = mockCameraService.createTestImage()
        cameraViewModel.capturedImage = testImage

        // Act
        cameraViewModel.retakePhoto()

        // Assert
        XCTAssertNil(cameraViewModel.capturedImage, "Should clear captured image")
        XCTAssertNil(cameraViewModel.errorMessage, "Should clear error")
    }

    // MARK: - Save Photo Tests

    func test_savePhoto_uploadsImage() async throws {
        // Arrange
        let testImage = mockCameraService.createTestImage()
        cameraViewModel.capturedImage = testImage
        mockImageUploadService.setMockUploadSuccess(url: "https://example.com/photo.jpg")

        // Act
        let result = await cameraViewModel.savePhoto()

        // Assert
        XCTAssertNotNil(result, "Should return URL")
        XCTAssertEqual(result, "https://example.com/photo.jpg")
        XCTAssertEqual(mockImageUploadService.uploadImageCallCount, 1, "Should call upload once")
        XCTAssertNil(cameraViewModel.capturedImage, "Should clear image after save")
    }

    func test_savePhoto_handlesError() async throws {
        // Arrange
        let testImage = mockCameraService.createTestImage()
        cameraViewModel.capturedImage = testImage
        mockImageUploadService.setMockUploadFailure(.networkError(NSError(domain: "test", code: 0)))

        // Act
        let result = await cameraViewModel.savePhoto()

        // Assert
        XCTAssertNil(result, "Should return nil on error")
        XCTAssertNotNil(cameraViewModel.errorMessage, "Should have error message")
    }

    func test_savePhoto_noImage() async throws {
        // Arrange - No captured image
        cameraViewModel.capturedImage = nil

        // Act
        let result = await cameraViewModel.savePhoto()

        // Assert
        XCTAssertNil(result, "Should return nil when no image")
        XCTAssertNotNil(cameraViewModel.errorMessage, "Should have error message")
    }

    // MARK: - Toggle Camera Tests

    func test_toggleCamera_switchesPosition() throws {
        // Arrange
        let initialPosition = cameraViewModel.cameraPosition

        // Act
        cameraViewModel.toggleCamera()

        // Assert
        XCTAssertNotEqual(
            cameraViewModel.cameraPosition,
            initialPosition,
            "Position should change"
        )
        XCTAssertEqual(
            mockCameraService.switchCameraCallCount,
            1,
            "Should call service"
        )
    }

    func test_toggleCamera_cyclesThroughPositions() throws {
        // Arrange
        let initialPosition = cameraViewModel.cameraPosition

        // Act - Toggle twice
        cameraViewModel.toggleCamera()
        let secondPosition = cameraViewModel.cameraPosition

        cameraViewModel.toggleCamera()
        let thirdPosition = cameraViewModel.cameraPosition

        // Assert
        XCTAssertNotEqual(initialPosition, secondPosition)
        XCTAssertEqual(initialPosition, thirdPosition) // Should cycle back
    }

    // MARK: - Toggle Flash Tests

    func test_toggleFlash_cyclesModes() throws {
        // Arrange
        let initialMode = cameraViewModel.flashMode

        // Act
        cameraViewModel.toggleFlash()
        let secondMode = cameraViewModel.flashMode

        cameraViewModel.toggleFlash()
        let thirdMode = cameraViewModel.flashMode

        cameraViewModel.toggleFlash()
        let fourthMode = cameraViewModel.flashMode

        // Assert
        XCTAssertNotEqual(initialMode, secondMode)
        XCTAssertEqual(initialMode, fourthMode) // Should cycle back
        XCTAssertEqual(mockCameraService.toggleFlashCallCount, 3)
    }

    func test_setFlashMode() throws {
        // Act
        cameraViewModel.setFlashMode(.on)

        // Assert
        XCTAssertEqual(cameraViewModel.flashMode, .on)
    }

    // MARK: - Session Management Tests

    func test_startSession_success() async throws {
        // Arrange
        mockCameraService.mockStartSessionResult = .success(())

        // Act
        await cameraViewModel.startSession()

        // Assert
        XCTAssertTrue(cameraViewModel.isSessionRunning)
        XCTAssertNil(cameraViewModel.errorMessage)
    }

    func test_startSession_handlesError() async throws {
        // Arrange
        mockCameraService.mockStartSessionResult = .failure(.deviceUnavailable)

        // Act
        await cameraViewModel.startSession()

        // Assert
        XCTAssertFalse(cameraViewModel.isSessionRunning)
        XCTAssertNotNil(cameraViewModel.errorMessage)
    }

    func test_stopSession() throws {
        // Arrange
        cameraViewModel.isSessionRunning = true

        // Act
        cameraViewModel.stopSession()

        // Assert
        XCTAssertFalse(cameraViewModel.isSessionRunning)
        XCTAssertEqual(mockCameraService.stopCameraSessionCallCount, 1)
    }

    // MARK: - Permission Tests

    func test_requestPermission() async throws {
        // Arrange
        mockCameraService.mockPermissionResult = true

        // Act
        let result = await cameraViewModel.requestPermission()

        // Assert
        XCTAssertTrue(result)
        XCTAssertEqual(mockCameraService.requestPermissionCallCount, 1)
    }

    func test_requestPermission_denied() async throws {
        // Arrange
        mockCameraService.setPermissionDenied()

        // Act
        let result = await cameraViewModel.requestPermission()

        // Assert
        XCTAssertFalse(result)
    }

    // MARK: - Computed Properties Tests

    func test_canSavePhoto() throws {
        // Initially false
        XCTAssertFalse(cameraViewModel.canSavePhoto)

        // Set image
        cameraViewModel.capturedImage = mockCameraService.createTestImage()
        XCTAssertTrue(cameraViewModel.canSavePhoto)

        // While capturing
        cameraViewModel.isCapturing = true
        XCTAssertFalse(cameraViewModel.canSavePhoto)
    }

    func test_canRetakePhoto() throws {
        // Initially false
        XCTAssertFalse(cameraViewModel.canRetakePhoto)

        // Set image
        cameraViewModel.capturedImage = mockCameraService.createTestImage()
        XCTAssertTrue(cameraViewModel.canRetakePhoto)
    }

    func test_canCapturePhoto() throws {
        // Initially false (session not running)
        XCTAssertFalse(cameraViewModel.canCapturePhoto)

        // Session running
        cameraViewModel.isSessionRunning = true
        XCTAssertTrue(cameraViewModel.canCapturePhoto)

        // While capturing
        cameraViewModel.isCapturing = true
        XCTAssertFalse(cameraViewModel.canCapturePhoto)
    }

    func test_flashModeDisplayName() throws {
        cameraViewModel.flashMode = .off
        XCTAssertEqual(cameraViewModel.flashModeDisplayName, "关闭")

        cameraViewModel.flashMode = .on
        XCTAssertEqual(cameraViewModel.flashModeDisplayName, "开启")

        cameraViewModel.flashMode = .auto
        XCTAssertEqual(cameraViewModel.flashModeDisplayName, "自动")
    }

    func test_cameraPositionDisplayName() throws {
        cameraViewModel.cameraPosition = .back
        XCTAssertEqual(cameraViewModel.cameraPositionDisplayName, "后置")

        cameraViewModel.cameraPosition = .front
        XCTAssertEqual(cameraViewModel.cameraPositionDisplayName, "前置")
    }

    // MARK: - Cleanup Tests

    func test_cleanup() throws {
        // Arrange
        cameraViewModel.capturedImage = mockCameraService.createTestImage()
        cameraViewModel.isSessionRunning = true
        cameraViewModel.errorMessage = "Test error"

        // Act
        cameraViewModel.cleanup()

        // Assert
        XCTAssertNil(cameraViewModel.capturedImage)
        XCTAssertFalse(cameraViewModel.isSessionRunning)
        XCTAssertNil(cameraViewModel.errorMessage)
    }

    // MARK: - Loading State Tests

    func test_capturingState_duringCapture() async throws {
        // Arrange
        let testImage = mockCameraService.createTestImage()
        mockCameraService.setMockPhoto(testImage)
        mockCameraService.isSessionRunning = true
        await cameraViewModel.startSession()

        var capturingStates: [Bool] = []
        cameraViewModel.$isCapturing
            .sink { capturing in
                capturingStates.append(capturing)
            }
            .store(in: &cancellables)

        // Act
        await cameraViewModel.capturePhoto()

        // Assert
        XCTAssertTrue(capturingStates.contains(true), "Should show capturing state")
        XCTAssertFalse(cameraViewModel.isCapturing, "Should end not capturing")
    }
}
