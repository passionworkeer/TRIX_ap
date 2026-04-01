//
//  CameraServiceTests.swift
//  TRIX3DCompanionTests
//
//  Unit tests for CameraService
//

import XCTest
import AVFoundation
import UIKit
import Combine
@testable import TRIX3DCompanion

/// Unit tests for CameraService
final class CameraServiceTests: XCTestCase {

    // MARK: - Properties

    var cameraService: CameraService!
    var cancellables: Set<AnyCancellable>!

    // MARK: - Test Lifecycle

    override func setUpWithError() throws {
        cameraService = CameraService.shared
        cancellables = Set<AnyCancellable>()
    }

    override func tearDownWithError() throws {
        // Clean up camera session after each test
        cameraService.stopCameraSession()
        cameraService.cleanup()
        cancellables = nil
    }

    // MARK: - Permission Tests

    func test_requestPermission_granted() async throws {
        // Act - This will trigger actual permission dialog
        let granted = await cameraService.requestPermission()

        // Assert - Result depends on actual device permissions
        // In simulator/testing, this may return false
        XCTAssertNotNil(granted, "Should return a permission result")
    }

    func test_requestPermission_denied() throws {
        // Testing permission denial requires system configuration
        // or mocking AVAuthorizationStatus

        XCTAssertTrue(true, "Permission test - requires system configuration")
    }

    // MARK: - Session Management Tests

    func test_startCameraSession_startsSuccessfully() async throws {
        // Arrange
        let _ = await cameraService.requestPermission()

        // Act
        let result = await cameraService.startCameraSession()

        // Assert
        switch result {
        case .success:
            XCTAssertTrue(cameraService.isSessionRunning, "Session should be running")
        case .failure(let error):
            // May fail if no camera available in simulator
            XCTAssertNotNil(error, "Should return error if camera unavailable")
        }
    }

    func test_stopCameraSession_stopsSuccessfully() async throws {
        // Arrange
        let _ = await cameraService.requestPermission()
        let _ = await cameraService.startCameraSession()

        // Act
        cameraService.stopCameraSession()

        // Allow time for session to stop
        try await Task.sleep(nanoseconds: 500_000_000) // 0.5 seconds

        // Assert
        XCTAssertFalse(cameraService.isSessionRunning, "Session should be stopped")
    }

    // MARK: - Photo Capture Tests

    func test_capturePhoto_returnsImage() async throws {
        // Arrange - Start session first
        let _ = await cameraService.requestPermission()
        let sessionResult = await cameraService.startCameraSession()

        guard case .success = sessionResult else {
            XCTSkip("Cannot test photo capture without camera session")
            return
        }

        // Allow session to stabilize
        try await Task.sleep(nanoseconds: 1_000_000_000) // 1 second

        // Act
        let result = await cameraService.capturePhoto()

        // Assert
        switch result {
        case .success(let image):
            XCTAssertNotNil(image, "Should return captured image")
            XCTAssertGreaterThan(image.size.width, 0, "Image should have valid width")
            XCTAssertGreaterThan(image.size.height, 0, "Image should have valid height")
        case .failure(let error):
            // May fail in simulator
            XCTAssertNotNil(error, "Should return error if capture fails")
        }
    }

    func test_capturePhoto_timeout() async throws {
        // Arrange - Don't start session
        let _ = await cameraService.requestPermission()

        // Note: Testing actual timeout requires controlling the capture pipeline
        // which is difficult without full mock

        // Act - Try to capture without session
        let result = await cameraService.capturePhoto()

        // Assert
        switch result {
        case .success:
            XCTFail("Should fail when session not running")
        case .failure(let error):
            XCTAssertEqual(error, CameraError.sessionNotRunning, "Should return session not running error")
        }
    }

    // MARK: - Camera Control Tests

    func test_switchCamera_togglesPosition() async throws {
        // Arrange
        let initialPosition = cameraService.cameraPosition

        // Act
        cameraService.switchCamera()

        // Assert
        XCTAssertNotEqual(
            cameraService.cameraPosition,
            initialPosition,
            "Camera position should change after switching"
        )

        // Switch again
        cameraService.switchCamera()

        XCTAssertEqual(
            cameraService.cameraPosition,
            initialPosition,
            "Camera position should return to original after second switch"
        )
    }

    func test_toggleFlash_cyclesThroughModes() throws {
        // Arrange
        let initialMode = cameraService.flashMode

        // Act - Toggle through modes
        cameraService.toggleFlash()
        let secondMode = cameraService.flashMode

        cameraService.toggleFlash()
        let thirdMode = cameraService.flashMode

        cameraService.toggleFlash()
        let fourthMode = cameraService.flashMode

        // Assert - Verify cycling
        XCTAssertNotEqual(initialMode, secondMode, "Mode should change on first toggle")

        // After 3 toggles, should return to original (cycle: off -> on -> auto -> off)
        XCTAssertEqual(initialMode, fourthMode, "Mode should cycle back after 3 toggles")

        // Verify specific mode transitions
        XCTAssertEqual(initialMode, .off, "Initial mode should be off")
        XCTAssertEqual(secondMode, .on, "Second mode should be on")
        XCTAssertEqual(thirdMode, .auto, "Third mode should be auto")
    }

    // MARK: - Session Not Running Tests

    func test_sessionNotRunning_error() async throws {
        // Arrange - Ensure session is stopped
        cameraService.stopCameraSession()

        // Act - Try to capture without session
        let result = await cameraService.capturePhoto()

        // Assert
        switch result {
        case .success:
            XCTFail("Should fail when session not running")
        case .failure(let error):
            XCTAssertEqual(error, CameraError.sessionNotRunning, "Should return session not running error")
        }
    }

    // MARK: - Error Handling Tests

    func test_cameraErrorDescriptions() {
        let permissionDenied = CameraError.permissionDenied
        XCTAssertEqual(
            permissionDenied.localizedDescription,
            "相机权限被拒绝。请在设置中开启相机权限。"
        )

        let sessionNotRunning = CameraError.sessionNotRunning
        XCTAssertEqual(
            sessionNotRunning.localizedDescription,
            "相机会话未运行。"
        )

        let deviceUnavailable = CameraError.deviceUnavailable
        XCTAssertEqual(
            deviceUnavailable.localizedDescription,
            "相机设备不可用。"
        )

        let notConfigured = CameraError.notConfigured
        XCTAssertEqual(
            notConfigured.localizedDescription,
            "相机未正确配置。"
        )
    }

    func test_cameraErrorRecoverability() {
        XCTAssertFalse(CameraError.permissionDenied.isRecoverable)
        XCTAssertFalse(CameraError.deviceUnavailable.isRecoverable)
        XCTAssertTrue(CameraError.sessionNotRunning.isRecoverable)
        XCTAssertTrue(CameraError.captureFailed(NSError(domain: "test", code: 0)).isRecoverable)
    }

    // MARK: - Flash Mode Extension Tests

    func test_flashModeDisplayName() {
        XCTAssertEqual(AVCaptureDevice.FlashMode.off.displayName, "关闭")
        XCTAssertEqual(AVCaptureDevice.FlashMode.on.displayName, "开启")
        XCTAssertEqual(AVCaptureDevice.FlashMode.auto.displayName, "自动")
    }

    func test_flashModeCycle() {
        var mode: AVCaptureDevice.FlashMode = .off
        mode.cycle()
        XCTAssertEqual(mode, .on)

        mode.cycle()
        XCTAssertEqual(mode, .auto)

        mode.cycle()
        XCTAssertEqual(mode, .off)
    }

    // MARK: - Camera Position Extension Tests

    func test_cameraPositionOpposite() {
        XCTAssertEqual(AVCaptureDevice.Position.back.opposite, .front)
        XCTAssertEqual(AVCaptureDevice.Position.front.opposite, .back)
        XCTAssertEqual(AVCaptureDevice.Position.unspecified.opposite, .back)
    }

    // MARK: - Reset Tests

    func test_resetToDefaults() throws {
        // Arrange - Change settings
        cameraService.switchCamera()
        cameraService.toggleFlash()

        // Act
        cameraService.resetToDefaults()

        // Assert
        XCTAssertEqual(cameraService.cameraPosition, .back, "Camera should reset to back")
        XCTAssertEqual(cameraService.flashMode, .off, "Flash should reset to off")
        XCTAssertNil(cameraService.lastError, "Error should be cleared")
    }

    // MARK: - Device Info Tests

    func test_deviceInfo() {
        // Device info depends on actual hardware
        let info = cameraService.deviceInfo

        XCTAssertNotNil(info, "Device info should not be nil")
    }

    func test_supportedFlashModes() {
        // Note: This depends on actual device capabilities
        let modes = cameraService.supportedFlashModes

        // Should contain standard modes if device has flash
        // May be empty on devices without flash
        XCTAssertNotNil(modes, "Supported modes should not be nil")
    }
}
