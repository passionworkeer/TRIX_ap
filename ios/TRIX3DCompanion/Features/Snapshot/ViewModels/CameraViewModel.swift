//
//  CameraViewModel.swift
//  TRIX3DCompanion
//
//  Camera feature ViewModel - manages camera state and photo capture
//

import Foundation
import UIKit
import AVFoundation
import Combine

// MARK: - Camera ViewModel

/// Camera view model managing camera state and photo capture
@MainActor
final class CameraViewModel: ObservableObject {

    // MARK: - Published Properties

    /// Captured image
    @Published var capturedImage: UIImage?

    /// Whether currently capturing
    @Published var isCapturing: Bool = false

    /// Whether to show preview mode
    @Published var showPreview: Bool = false

    /// Camera permission status
    @Published var cameraPermission: AVAuthorizationStatus = .notDetermined

    /// Whether camera session is active
    @Published var isSessionActive: Bool = false

    /// Current flash mode
    @Published var flashMode: AVCaptureDevice.FlashMode = .off

    /// Current camera position
    @Published var cameraPosition: AVCaptureDevice.Position = .back

    /// Whether grid overlay is visible
    @Published var showGrid: Bool = false

    /// Error message to display
    @Published var errorMessage: String?

    /// Whether upload is in progress
    @Published var isUploading: Bool = false

    /// Upload progress (0.0 - 1.0)
    @Published var uploadProgress: Double = 0.0

    /// Captured image URL after upload
    @Published var uploadedImageURL: String?

    // MARK: - Dependencies

    private let cameraService: any CameraServiceProtocol
    private let imageUploadService: any ImageUploadServiceProtocol
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    /// Initialize CameraViewModel
    /// - Parameters:
    ///   - cameraService: Camera service dependency
    ///   - imageUploadService: Image upload service dependency
    init(
        cameraService: (any CameraServiceProtocol)? = nil,
        imageUploadService: (any ImageUploadServiceProtocol)? = nil
    ) {
        self.cameraService = cameraService ?? CameraService.shared
        self.imageUploadService = imageUploadService ?? ImageUploadService.shared

        // Setup bindings
        setupBindings()

        // Check permission
        checkCameraPermission()
    }

    // MARK: - Setup

    /// Setup Combine bindings
    private func setupBindings() {
        // Bind flash mode from service
        cameraService.flashModePublisher
            .receive(on: DispatchQueue.main)
            .assign(to: &$flashMode)

        // Bind camera position from service
        cameraService.cameraPositionPublisher
            .receive(on: DispatchQueue.main)
            .assign(to: &$cameraPosition)

        // Bind session running state
        cameraService.isSessionRunningPublisher
            .receive(on: DispatchQueue.main)
            .assign(to: &$isSessionActive)

        // Bind upload progress
        imageUploadService.uploadProgressPublisher
            .assign(to: &$uploadProgress)

        // Bind uploading state
        imageUploadService.isUploadingPublisher
            .assign(to: &$isUploading)
    }

    // MARK: - Public Methods

    /// Check camera permission status
    func checkCameraPermission() {
        cameraPermission = AVCaptureDevice.authorizationStatus(for: .video)
    }

    /// Request camera permission
    func requestCameraPermission() async {
        let granted = await cameraService.requestPermission()
        cameraPermission = granted ? .authorized : .denied
    }

    /// Start camera session
    func startCamera() async {
        guard cameraPermission == .authorized else {
            await requestCameraPermission()
            return
        }

        let result = await cameraService.startCameraSession()

        switch result {
        case .success:
            errorMessage = nil

        case .failure(let error):
            errorMessage = error.errorDescription
        }
    }

    /// Stop camera session
    func stopCamera() {
        cameraService.stopCameraSession()
        isSessionActive = false
    }

    /// Capture photo
    func capturePhoto() async {
        guard !isCapturing else { return }

        isCapturing = true
        errorMessage = nil

        let result = await cameraService.capturePhoto()

        switch result {
        case .success(let image):
            capturedImage = image
            showPreview = true

        case .failure(let error):
            errorMessage = error.errorDescription
            capturedImage = nil
            showPreview = false
        }

        isCapturing = false
    }

    /// Toggle flash mode
    func toggleFlash() {
        cameraService.toggleFlash()
    }

    /// Switch camera (front/back)
    func switchCamera() {
        cameraService.switchCamera()
    }

    /// Toggle grid overlay
    func toggleGrid() {
        showGrid.toggle()
    }

    /// Upload captured image
    /// - Parameter quality: Compression quality (0.0 - 1.0)
    /// - Returns: Uploaded image URL or nil if failed
    @discardableResult
    func uploadCapturedImage(quality: CGFloat = 0.8) async -> String? {
        guard let image = capturedImage else {
            errorMessage = NSLocalizedString("error.camera.no.image.upload", comment: "")
            return nil
        }

        isUploading = true
        errorMessage = nil

        let result = await imageUploadService.uploadImage(image, quality: quality)

        switch result {
        case .success(let url):
            uploadedImageURL = url
            isUploading = false
            return url

        case .failure(let error):
            errorMessage = error.errorDescription
            isUploading = false
            return nil
        }
    }

    /// Retake photo - discard current and return to camera
    func retakePhoto() {
        capturedImage = nil
        showPreview = false
        uploadedImageURL = nil
        errorMessage = nil
    }

    /// Confirm photo and upload
    /// - Parameter quality: Compression quality
    /// - Returns: Uploaded image URL
    func confirmAndUpload(quality: CGFloat = 0.8) async -> String? {
        return await uploadCapturedImage(quality: quality)
    }

    /// Use an image picked from photo library as captured image.
    /// This reuses the same preview/upload flow as camera capture.
    /// - Parameter image: Picked UIImage
    func useImportedImage(_ image: UIImage) {
        capturedImage = image
        showPreview = true
        uploadedImageURL = nil
        errorMessage = nil
    }

    /// Clear error message
    func clearError() {
        errorMessage = nil
    }

    /// Save captured image to photo library
    /// - Returns: Whether save was successful
    func saveToPhotoLibrary() async -> Bool {
        guard let image = capturedImage else {
            errorMessage = NSLocalizedString("error.camera.no.image.save", comment: "")
            return false
        }

        // Use UIImageWriteToSavedPhotosAlbum
        return await withCheckedContinuation { continuation in
            UIImageWriteToSavedPhotosAlbum(image, nil, nil, nil)
            continuation.resume(returning: true)
        }
    }
}

// MARK: - Flash Mode Extensions

extension AVCaptureDevice.FlashMode {
    /// Icon name for flash mode
    var iconName: String {
        switch self {
        case .off:
            return "bolt.slash.fill"
        case .on:
            return "bolt.fill"
        case .auto:
            return "bolt.badge.automatic.fill"
        @unknown default:
            return "bolt.slash"
        }
    }

    /// Display name for flash mode
    var displayName: String {
        switch self {
        case .off:
            return "Off"
        case .on:
            return "On"
        case .auto:
            return "Auto"
        @unknown default:
            return "Unknown"
        }
    }
}

// MARK: - Camera Position Extensions

extension AVCaptureDevice.Position {
    /// Icon name for camera position
    var iconName: String {
        switch self {
        case .back:
            return "camera.aperture"
        case .front:
            return "person.circle.fill"
        case .unspecified:
            return "camera"
        @unknown default:
            return "camera"
        }
    }

    /// Display name for camera position
    var displayName: String {
        switch self {
        case .back:
            return "Rear"
        case .front:
            return "Front"
        case .unspecified:
            return "Camera"
        @unknown default:
            return "Camera"
        }
    }
}

// MARK: - Preview Helpers

#if DEBUG
extension CameraViewModel {
    /// Create preview view model with sample image
    static var preview: CameraViewModel {
        let vm = CameraViewModel()
        vm.capturedImage = UIImage(systemName: "photo")
        vm.cameraPermission = .authorized
        return vm
    }
}
#endif
