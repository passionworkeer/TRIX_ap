//
//  MockCameraService.swift
//  TRIX3DCompanionTests
//
//  Mock implementation of CameraServiceProtocol for testing
//

import Foundation
import AVFoundation
import UIKit
import Combine
@testable import TRIX3DCompanion

/// Mock implementation of CameraServiceProtocol for unit testing
@MainActor
final class MockCameraService: CameraServiceProtocol {

    // MARK: - Mock Properties

    var isSessionRunning: Bool = false {
        didSet { isSessionRunningSubject.send(isSessionRunning) }
    }
    var flashMode: AVCaptureDevice.FlashMode = .off {
        didSet { flashModeSubject.send(flashMode) }
    }
    var cameraPosition: AVCaptureDevice.Position = .back {
        didSet { cameraPositionSubject.send(cameraPosition) }
    }
    var lastError: CameraError?
    var flashModePublisher: AnyPublisher<AVCaptureDevice.FlashMode, Never> {
        flashModeSubject.eraseToAnyPublisher()
    }
    var cameraPositionPublisher: AnyPublisher<AVCaptureDevice.Position, Never> {
        cameraPositionSubject.eraseToAnyPublisher()
    }
    var isSessionRunningPublisher: AnyPublisher<Bool, Never> {
        isSessionRunningSubject.eraseToAnyPublisher()
    }

    // Mock configuration
    var mockPermissionResult: Bool = true
    var mockCapturePhotoResult: Result<UIImage, CameraError>?
    var mockStartSessionResult: Result<Void, CameraError>?
    var mockFlashModes: [AVCaptureDevice.FlashMode] = [.off, .on, .auto]
    var mockCameraPositions: [AVCaptureDevice.Position] = [.back, .front]

    // Call tracking
    var requestPermissionCallCount: Int = 0
    var capturePhotoCallCount: Int = 0
    var switchCameraCallCount: Int = 0
    var toggleFlashCallCount: Int = 0
    var startCameraSessionCallCount: Int = 0
    var stopCameraSessionCallCount: Int = 0

    // Flash mode cycling
    private var flashModeIndex: Int = 0

    // Camera position cycling
    private var cameraPositionIndex: Int = 0
    private let flashModeSubject = CurrentValueSubject<AVCaptureDevice.FlashMode, Never>(.off)
    private let cameraPositionSubject = CurrentValueSubject<AVCaptureDevice.Position, Never>(.back)
    private let isSessionRunningSubject = CurrentValueSubject<Bool, Never>(false)

    // MARK: - Initialization

    init() {}

    // MARK: - CameraServiceProtocol

    func requestPermission() async -> Bool {
        requestPermissionCallCount += 1
        return mockPermissionResult
    }

    func capturePhoto() async -> Result<UIImage, CameraError> {
        capturePhotoCallCount += 1
        return mockCapturePhotoResult ?? .failure(.sessionNotRunning)
    }

    func switchCamera() {
        switchCameraCallCount += 1

        guard !mockCameraPositions.isEmpty else { return }

        cameraPositionIndex = (cameraPositionIndex + 1) % mockCameraPositions.count
        cameraPosition = mockCameraPositions[cameraPositionIndex]
        cameraPositionSubject.send(cameraPosition)
    }

    func toggleFlash() {
        toggleFlashCallCount += 1

        guard !mockFlashModes.isEmpty else { return }

        flashModeIndex = (flashModeIndex + 1) % mockFlashModes.count
        flashMode = mockFlashModes[flashModeIndex]
        flashModeSubject.send(flashMode)
    }

    func startCameraSession() async -> Result<Void, CameraError> {
        startCameraSessionCallCount += 1
        let result = mockStartSessionResult ?? .success(())
        if case .success = result {
            isSessionRunning = true
            isSessionRunningSubject.send(true)
        }
        return result
    }

    func stopCameraSession() {
        stopCameraSessionCallCount += 1
        isSessionRunning = false
        isSessionRunningSubject.send(false)
    }

    // MARK: - Helper Methods

    func setMockPhoto(_ image: UIImage) {
        mockCapturePhotoResult = .success(image)
    }

    func setMockError(_ error: CameraError) {
        mockCapturePhotoResult = .failure(error)
    }

    func setPermissionDenied() {
        mockPermissionResult = false
    }

    func resetCallCounts() {
        requestPermissionCallCount = 0
        capturePhotoCallCount = 0
        switchCameraCallCount = 0
        toggleFlashCallCount = 0
        startCameraSessionCallCount = 0
        stopCameraSessionCallCount = 0
    }

    func createTestImage(size: CGSize = CGSize(width: 100, height: 100)) -> UIImage {
        UIGraphicsBeginImageContextWithOptions(size, true, 1.0)
        UIColor.red.setFill()
        UIRectFill(CGRect(origin: .zero, size: size))
        let image = UIGraphicsGetImageFromCurrentImageContext() ?? UIImage()
        UIGraphicsEndImageContext()
        return image
    }
}
