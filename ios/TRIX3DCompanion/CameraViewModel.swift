//
//  CameraViewModel.swift
//  TRIX3DCompanion
//
//  Camera ViewModel for managing camera capture and photo management
//

import Foundation
import UIKit
import AVFoundation
import Combine

/// Camera ViewModel for managing camera capture and photo management
@MainActor
final class CameraViewModel: ObservableObject {

    // MARK: - Published Properties

    @Published var capturedImage: UIImage?
    @Published var isCapturing: Bool = false
    @Published var isSessionRunning: Bool = false
    @Published var flashMode: AVCaptureDevice.FlashMode = .off
    @Published var cameraPosition: AVCaptureDevice.Position = .back
    @Published var errorMessage: String?

    // MARK: - Dependencies

    private let cameraService: CameraServiceProtocol
    private let imageUploadService: ImageUploadService

    // MARK: - Private Properties

    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    init(
        cameraService: CameraServiceProtocol = CameraService.shared,
        imageUploadService: ImageUploadService = .shared
    ) {
        self.cameraService = cameraService
        self.imageUploadService = imageUploadService

        setupBindings()
    }

    // MARK: - Setup

    private func setupBindings() {
        // Bind flash mode from service
        flashMode = cameraService.flashMode

        // Bind camera position from service
        cameraPosition = cameraService.cameraPosition
    }

    // MARK: - Permission

    /// Request camera permission
    func requestPermission() async -> Bool {
        return await cameraService.requestPermission()
    }

    // MARK: - Session Management

    /// Start camera session
    func startSession() async {
        let result = await cameraService.startCameraSession()

        switch result {
        case .success:
            isSessionRunning = true
            errorMessage = nil
        case .failure(let error):
            isSessionRunning = false
            errorMessage = error.localizedDescription
        }
    }

    /// Stop camera session
    func stopSession() {
        cameraService.stopCameraSession()
        isSessionRunning = false
    }

    // MARK: - Photo Capture

    /// Capture a photo
    func capturePhoto() async {
        guard !isCapturing else { return }

        isCapturing = true
        errorMessage = nil

        let result = await cameraService.capturePhoto()

        switch result {
        case .success(let image):
            capturedImage = image
        case .failure(let error):
            errorMessage = error.localizedDescription
            capturedImage = nil
        }

        isCapturing = false
    }

    /// Retake photo - clears captured image
    func retakePhoto() {
        capturedImage = nil
        errorMessage = nil
    }

    /// Save and upload photo
    func savePhoto() async -> String? {
        guard let image = capturedImage else {
            errorMessage = "没有可保存的照片"
            return nil
        }

        isCapturing = true
        errorMessage = nil

        let result = await imageUploadService.uploadImage(image)

        switch result {
        case .success(let url):
            capturedImage = nil
            isCapturing = false
            return url
        case .failure(let error):
            errorMessage = error.localizedDescription
            isCapturing = false
            return nil
        }
    }

    // MARK: - Camera Controls

    /// Toggle between front and back camera
    func toggleCamera() {
        cameraService.switchCamera()
        cameraPosition = cameraService.cameraPosition
    }

    /// Cycle through flash modes
    func toggleFlash() {
        cameraService.toggleFlash()
        flashMode = cameraService.flashMode
    }

    /// Set specific flash mode
    func setFlashMode(_ mode: AVCaptureDevice.FlashMode) {
        cameraService.setFlashMode(mode)
        flashMode = mode
    }

    // MARK: - Cleanup

    /// Clean up resources
    func cleanup() {
        stopSession()
        capturedImage = nil
        errorMessage = nil
    }

    // MARK: - Computed Properties

    /// Check if photo is ready to save
    var canSavePhoto: Bool {
        capturedImage != nil && !isCapturing
    }

    /// Check if can retake photo
    var canRetakePhoto: Bool {
        capturedImage != nil
    }

    /// Check if can capture photo
    var canCapturePhoto: Bool {
        isSessionRunning && !isCapturing
    }

    /// Get flash mode display name
    var flashModeDisplayName: String {
        flashMode.displayName
    }

    /// Get camera position display name
    var cameraPositionDisplayName: String {
        switch cameraPosition {
        case .back:
            return "后置"
        case .front:
            return "前置"
        case .unspecified:
            return "未知"
        @unknown default:
            return "未知"
        }
    }
}
