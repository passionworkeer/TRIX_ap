//
//  CameraView.swift
//  TRIX3DCompanion
//
//  Camera view for capturing photos with controls and preview
//

import SwiftUI
import AVFoundation

// MARK: - Camera View

/// Full-screen camera view with capture controls
struct CameraView: View {

    // MARK: - State Objects

    @StateObject private var viewModel: CameraViewModel

    // MARK: - Environment

    @Environment(\.dismiss) private var dismiss

    // MARK: - State

    @State private var showPermissionDenied = false

    // MARK: - Callbacks

    let onImageCaptured: ((UIImage, String?) -> Void)?

    // MARK: - Initialization

    init(
        viewModel: CameraViewModel = CameraViewModel(),
        onImageCaptured: ((UIImage, String?) -> Void)? = nil
    ) {
        _viewModel = StateObject(wrappedValue: viewModel)
        self.onImageCaptured = onImageCaptured
    }

    // MARK: - Body

    var body: some View {
        ZStack {
            if viewModel.showPreview {
                // Preview mode
                previewMode
            } else {
                // Camera mode
                cameraMode
            }
        }
        .background(.black)
        .statusBar(hidden: true)
        .task {
            await viewModel.startCamera()
        }
        .onDisappear {
            viewModel.stopCamera()
        }
        .alert("Camera Permission Required", isPresented: $showPermissionDenied) {
            Button("Settings") {
                openAppSettings()
            }
            Button("Cancel", role: .cancel) {
                dismiss()
            }
        } message: {
            Text("Please enable camera access in Settings to take photos.")
        }
        .alert("Error", isPresented: .constant(viewModel.errorMessage != nil)) {
            Button("OK") {
                viewModel.clearError()
            }
        } message: {
            if let error = viewModel.errorMessage {
                Text(error)
            }
        }
    }

    // MARK: - Camera Mode

    /// Camera capture mode
    private var cameraMode: some View {
        ZStack {
            // Camera preview
            if viewModel.isSessionActive {
                CameraPreviewView(viewModel: viewModel)
                    .ignoresSafeArea()
            } else {
                // Loading/permission state
                cameraLoadingView
            }

            // Grid overlay
            if viewModel.showGrid {
                gridOverlay
            }

            // Top controls
            VStack {
                topControlsBar
                Spacer()
            }

            // Bottom controls
            VStack {
                Spacer()
                bottomControlsBar
            }
        }
    }

    /// Camera loading/permission view
    private var cameraLoadingView: some View {
        VStack(spacing: 20) {
            if viewModel.cameraPermission == .denied {
                Image(systemName: "camera.fill")
                    .font(.system(size: 60))
                    .foregroundColor(.white.opacity(0.5))

                Text("Camera Access Denied")
                    .font(.title2)
                    .foregroundColor(.white)

                Button("Open Settings") {
                    showPermissionDenied = true
                }
                .buttonStyle(.borderedProminent)
            } else {
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                    .scaleEffect(1.5)

                Text("Starting Camera...")
                    .font(.subheadline)
                    .foregroundColor(.white.opacity(0.7))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.black)
    }

    /// Top controls bar
    private var topControlsBar: some View {
        HStack(spacing: 24) {
            // Flash button
            ControlButton(
                icon: viewModel.flashMode.iconName,
                label: viewModel.flashMode.displayName
            ) {
                viewModel.toggleFlash()
            }

            Spacer()

            // Grid toggle
            ControlButton(
                icon: viewModel.showGrid ? "grid" : "grid",
                label: "Grid",
                isActive: viewModel.showGrid
            ) {
                viewModel.toggleGrid()
            }

            // Switch camera
            ControlButton(
                icon: "camera.rotate.fill",
                label: "Flip"
            ) {
                viewModel.switchCamera()
            }

            // Close button
            ControlButton(
                icon: "xmark",
                label: "Close"
            ) {
                dismiss()
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 50)
    }

    /// Bottom controls bar
    private var bottomControlsBar: some View {
        HStack(spacing: 40) {
            // Album shortcut
            AlbumButton()

            // Capture button
            CaptureButton(isCapturing: viewModel.isCapturing) {
                Task {
                    await viewModel.capturePhoto()
                }
            }

            // Placeholder for symmetry
            Color.clear
                .frame(width: 60, height: 60)
        }
        .padding(.bottom, 50)
    }

    /// Grid overlay
    private var gridOverlay: some View {
        GeometryReader { geometry in
            let width = geometry.size.width
            let height = geometry.size.height

            ZStack {
                // Vertical lines
                Path { path in
                    path.move(to: CGPoint(x: width / 3, y: 0))
                    path.addLine(to: CGPoint(x: width / 3, y: height))
                    path.move(to: CGPoint(x: 2 * width / 3, y: 0))
                    path.addLine(to: CGPoint(x: 2 * width / 3, y: height))
                }
                .stroke(Color.white.opacity(0.3), lineWidth: 1)

                // Horizontal lines
                Path { path in
                    path.move(to: CGPoint(x: 0, y: height / 3))
                    path.addLine(to: CGPoint(x: width, y: height / 3))
                    path.move(to: CGPoint(x: 0, y: 2 * height / 3))
                    path.addLine(to: CGPoint(x: width, y: 2 * height / 3))
                }
                .stroke(Color.white.opacity(0.3), lineWidth: 1)
            }
        }
        .ignoresSafeArea()
    }

    // MARK: - Preview Mode

    /// Photo preview mode
    private var previewMode: some View {
        ZStack {
            // Captured image
            if let image = viewModel.capturedImage {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }

            // Top controls
            VStack {
                previewTopBar
                Spacer()
            }

            // Bottom controls
            VStack {
                Spacer()
                previewBottomBar
            }

            // Upload progress overlay
            if viewModel.isUploading {
                uploadProgressOverlay
            }
        }
    }

    /// Preview top bar
    private var previewTopBar: some View {
        HStack {
            // Retake button
            Button(action: { viewModel.retakePhoto() }) {
                HStack(spacing: 8) {
                    Image(systemName: "arrow.counterclockwise")
                    Text("Retake")
                }
                .font(.headline)
                .foregroundColor(.white)
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
                .background(.ultraThinMaterial)
                .clipShape(Capsule())
            }

            Spacer()

            // Save to album
            Button(action: { saveToAlbum() }) {
                Image(systemName: "square.and.arrow.down")
                    .font(.title2)
                    .foregroundColor(.white)
                    .padding(12)
                    .background(.ultraThinMaterial)
                    .clipShape(Circle())
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 50)
    }

    /// Preview bottom bar
    private var previewBottomBar: some View {
        VStack(spacing: 16) {
            // Upload status
            if let url = viewModel.uploadedImageURL {
                HStack(spacing: 8) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.green)
                    Text("Uploaded successfully")
                        .font(.subheadline)
                        .foregroundColor(.white)
                }
            }

            // Confirm button
            Button(action: { confirmPhoto() }) {
                HStack(spacing: 12) {
                    if viewModel.isUploading {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                    } else {
                        Image(systemName: "checkmark.circle.fill")
                    }

                    Text("Use Photo")
                        .font(.headline)
                }
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(Color.brandGradient)
                .clipShape(RoundedRectangle(cornerRadius: 16))
            }
            .disabled(viewModel.isUploading)
            .padding(.horizontal, 20)
        }
        .padding(.bottom, 50)
    }

    /// Upload progress overlay
    private var uploadProgressOverlay: some View {
        ZStack {
            Color.black.opacity(0.5)
                .ignoresSafeArea()

            VStack(spacing: 16) {
                ProgressView(value: viewModel.uploadProgress)
                    .progressViewStyle(LinearProgressViewStyle(tint: .brandPurple))

                Text("Uploading... \(Int(viewModel.uploadProgress * 100))%")
                    .font(.subheadline)
                    .foregroundColor(.white)
            }
            .padding(24)
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 16))
        }
    }

    // MARK: - Actions

    /// Save photo to album
    private func saveToAlbum() {
        Task {
            _ = await viewModel.saveToPhotoLibrary()
        }
    }

    /// Confirm and use photo
    private func confirmPhoto() {
        Task {
            if let url = await viewModel.confirmAndUpload() {
                if let image = viewModel.capturedImage {
                    onImageCaptured?(image, url)
                }
                dismiss()
            }
        }
    }

    /// Open app settings
    private func openAppSettings() {
        if let url = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(url)
        }
    }
}

// MARK: - Camera Preview View

/// UIKit camera preview view wrapped in SwiftUI
struct CameraPreviewView: UIViewRepresentable {
    @ObservedObject var viewModel: CameraViewModel

    func makeUIView(context: Context) -> UIView {
        let view = CameraPreviewUIView()
        view.backgroundColor = .black
        view.videoPreviewLayer.session = CameraService.shared.previewCaptureSession
        view.videoPreviewLayer.videoGravity = .resizeAspectFill
        return view
    }

    func updateUIView(_ uiView: UIView, context: Context) {
        // Ensure the preview layer frame is updated
        if let previewView = uiView as? CameraPreviewUIView {
            DispatchQueue.main.async {
                previewView.videoPreviewLayer.frame = previewView.bounds
            }
        }
    }
}

/// Custom UIView with AVCaptureVideoPreviewLayer
class CameraPreviewUIView: UIView {
    /// The video preview layer
    override class var layerClass: AnyClass {
        return AVCaptureVideoPreviewLayer.self
    }

    /// Convenience accessor for the video preview layer
    var videoPreviewLayer: AVCaptureVideoPreviewLayer {
        return layer as! AVCaptureVideoPreviewLayer
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        videoPreviewLayer.frame = bounds
    }
}

// MARK: - Capture Button

/// Photo capture button
struct CaptureButton: View {
    let isCapturing: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                // Outer ring
                Circle()
                    .stroke(.white, lineWidth: 4)
                    .frame(width: 80, height: 80)

                // Inner circle
                if isCapturing {
                    // Capturing animation
                    Circle()
                        .fill(.brandGradient)
                        .frame(width: 60, height: 60)
                        .overlay(
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        )
                } else {
                    Circle()
                        .fill(.white)
                        .frame(width: 60, height: 60)
                }
            }
        }
        .disabled(isCapturing)
        .scaleEffect(isCapturing ? 0.9 : 1.0)
        .animation(.spring(response: 0.3), value: isCapturing)
    }
}

// MARK: - Album Button

/// Photo album shortcut button
struct AlbumButton: View {
    var body: some View {
        Button(action: {}) {
            RoundedRectangle(cornerRadius: 8)
                .fill(.ultraThinMaterial)
                .frame(width: 60, height: 60)
                .overlay(
                    Image(systemName: "photo.on.rectangle")
                        .font(.title3)
                        .foregroundColor(.white)
                )
        }
    }
}

// MARK: - Preview

#Preview("Camera View") {
    CameraView()
}

#Preview("Preview Mode") {
    CameraView(viewModel: {
        let vm = CameraViewModel()
        vm.capturedImage = UIImage(systemName: "photo")
        vm.showPreview = true
        return vm
    }())
}

#Preview("Dark Mode") {
    CameraView()
        .preferredColorScheme(.dark)
}
