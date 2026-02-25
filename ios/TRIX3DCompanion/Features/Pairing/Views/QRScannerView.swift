//
//  QRScannerView.swift
//  TRIX3DCompanion
//
//  QR code scanner view for device pairing
//

import SwiftUI
import AVFoundation
import CodeScanner

// MARK: - QR Scanner View

/// QR code scanner view with camera preview and scanning animation
struct QRScannerView: View {
    // MARK: - Properties

    /// Callback when QR code is scanned
    let onCodeScanned: (String) -> Void

    /// Callback when scanner is dismissed
    let onDismiss: () -> Void

    /// Current torch mode
    @State private var isTorchOn = false

    /// Whether scanning is in progress
    @State private var isScanning = true

    /// Camera permission status
    @State private var cameraPermission: AVAuthorizationStatus = .notDetermined

    /// Show error alert
    @State private var showError = false

    /// Error message
    @State private var errorMessage = ""

    // MARK: - Body

    var body: some View {
        ZStack {
            // Camera background
            Color.black
                .ignoresSafeArea()

            if cameraPermission == .authorized {
                // Scanner
                CodeScannerView(
                    codeTypes: [.qr],
                    scanMode: .continuous,
                    simulatedData: "trix:pair:abc123def456",
                    completion: handleScanResult
                )
                .ignoresSafeArea()
                .overlay(
                    // Scanner overlay
                    scannerOverlay
                )
                .overlay(
                    // Controls
                    controlsOverlay
                )

            } else if cameraPermission == .denied || cameraPermission == .restricted {
                // Permission denied view
                permissionDeniedView
            } else {
                // Loading/Requesting permission
                Color.black
                    .overlay(
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            .scaleEffect(1.5)
                    )
            }
        }
        .onAppear {
            checkCameraPermission()
        }
        .alert("Camera Access", isPresented: $showError) {
            Button("OK", role: .cancel) {
                onDismiss()
            }
        } message: {
            Text(errorMessage)
        }
    }

    // MARK: - Scanner Overlay

    private var scannerOverlay: some View {
        GeometryReader { geometry in
            let size = min(geometry.size.width, geometry.size.height) * 0.7
            let frameWidth: CGFloat = size
            let frameHeight: CGFloat = size

            ZStack {
                // Dimmed overlay
                Color.black.opacity(0.6)

                // Clear scanning frame
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.clear)
                    .frame(width: frameWidth, height: frameHeight)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(Color.brandPurple, lineWidth: 2)
                    )
                    .overlay(
                        // Corner accents
                        cornerAccents(frameWidth: frameWidth, frameHeight: frameHeight)
                    )
                    .overlay(
                        // Scanning animation
                        scanningLine(frameHeight: frameHeight)
                            .opacity(isScanning ? 1 : 0)
                    )

                // Instruction text
                VStack {
                    Spacer()
                    Text("Align QR code within the frame")
                        .font(.subheadline)
                        .foregroundColor(.white)
                        .padding(.bottom, 40)
                        .glassPanel(cornerRadius: 12, padding: 12)
                }
            }
        }
    }

    // MARK: - Corner Accents

    private func cornerAccents(frameWidth: CGFloat, frameHeight: CGFloat) -> some View {
        ZStack {
            // Top-left corner
            cornerLine(.topLeading)
                .offset(x: -frameWidth / 2 + 20, y: -frameHeight / 2 + 20)

            // Top-right corner
            cornerLine(.topTrailing)
                .offset(x: frameWidth / 2 - 20, y: -frameHeight / 2 + 20)

            // Bottom-left corner
            cornerLine(.bottomLeading)
                .offset(x: -frameWidth / 2 + 20, y: frameHeight / 2 - 20)

            // Bottom-right corner
            cornerLine(.bottomTrailing)
                .offset(x: frameWidth / 2 - 20, y: frameHeight / 2 - 20)
        }
    }

    private func cornerLine(_ position: UnitPoint) -> some View {
        let size: CGFloat = 30
        let thickness: CGFloat = 4

        return ZStack {
            if position == .topLeading {
                VStack(spacing: 0) {
                    Rectangle()
                        .fill(Color.brandPink)
                        .frame(width: size, height: thickness)
                    HStack(spacing: 0) {
                        Rectangle()
                            .fill(Color.brandPink)
                            .frame(width: thickness, height: size)
                        Spacer()
                    }
                }
            } else if position == .topTrailing {
                VStack(spacing: 0) {
                    Rectangle()
                        .fill(Color.brandPink)
                        .frame(width: size, height: thickness)
                    HStack(spacing: 0) {
                        Spacer()
                        Rectangle()
                            .fill(Color.brandPink)
                            .frame(width: thickness, height: size)
                    }
                }
            } else if position == .bottomLeading {
                HStack(spacing: 0) {
                    Rectangle()
                        .fill(Color.brandPink)
                        .frame(width: thickness, height: size)
                    VStack(spacing: 0) {
                        Spacer()
                        Rectangle()
                            .fill(Color.brandPink)
                            .frame(width: size, height: thickness)
                    }
                }
            } else { // bottomTrailing
                HStack(spacing: 0) {
                    Spacer()
                    Rectangle()
                        .fill(Color.brandPink)
                        .frame(width: thickness, height: size)
                    VStack(spacing: 0) {
                        Spacer()
                        Rectangle()
                            .fill(Color.brandPink)
                            .frame(width: size, height: thickness)
                    }
                }
            }
        }
    }

    // MARK: - Scanning Line

    private func scanningLine(frameHeight: CGFloat) -> some View {
        GeometryReader { geometry in
            let lineWidth = min(geometry.size.width, geometry.size.height) * 0.7

            Rectangle()
                .fill(
                    LinearGradient(
                        colors: [
                            Color.brandPurple.opacity(0),
                            Color.brandPurple,
                            Color.brandPink,
                            Color.brandPink.opacity(0)
                        ],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .frame(height: 2)
                .frame(width: lineWidth)
                .shadow(color: Color.brandPurple.opacity(0.5), radius: 8)
                .offset(y: -frameHeight / 2 + frameHeight * 0.1)
                .animation(
                    Animation.linear(duration: 2)
                        .repeatForever(autoreverses: true),
                    value: isScanning
                )
        }
        .frame(height: frameHeight)
    }

    // MARK: - Controls Overlay

    private var controlsOverlay: some View {
        VStack {
            // Top bar
            HStack {
                // Dismiss button
                Button(action: onDismiss) {
                    Image(systemName: "xmark")
                        .font(.title2)
                        .fontWeight(.semibold)
                        .foregroundColor(.white)
                        .frame(width: 44, height: 44)
                        .background(Color.black.opacity(0.5))
                        .clipShape(Circle())
                }

                Spacer()

                // Title
                Text("Scan QR Code")
                    .font(.headline)
                    .foregroundColor(.white)

                Spacer()

                // Torch toggle
                Button(action: toggleTorch) {
                    Image(systemName: isTorchOn ? "flashlight.fill" : "flashlight.off.fill")
                        .font(.title2)
                        .foregroundColor(.white)
                        .frame(width: 44, height: 44)
                        .background(Color.black.opacity(0.5))
                        .clipShape(Circle())
                }
            }
            .padding()

            Spacer()
        }
    }

    // MARK: - Permission Denied View

    private var permissionDeniedView: some View {
        VStack(spacing: 24) {
            Image(systemName: "camera.fill")
                .font(.system(size: 60))
                .foregroundStyle(
                    LinearGradient(
                        colors: [.brandPurple, .brandPink],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )

            VStack(spacing: 12) {
                Text("Camera Access Required")
                    .font(.title2)
                    .fontWeight(.bold)
                    .foregroundColor(.white)

                Text("To scan QR codes for device pairing, please allow camera access in Settings.")
                    .font(.body)
                    .foregroundColor(.white.opacity(0.8))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
            }

            VStack(spacing: 12) {
                Button(action: openSettings) {
                    Text("Open Settings")
                        .font(.headline)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(
                            LinearGradient(
                                colors: [.brandPurple, .brandPink],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .cornerRadius(12)
                }

                Button(action: onDismiss) {
                    Text("Cancel")
                        .font(.headline)
                        .foregroundColor(.white.opacity(0.8))
                        .frame(maxWidth: .infinity)
                        .padding()
                }
            }
            .padding(.horizontal, 40)
        }
        .padding()
    }

    // MARK: - Methods

    /// Check camera permission status
    private func checkCameraPermission() {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            cameraPermission = .authorized
        case .denied, .restricted:
            cameraPermission = .denied
            showError = true
            errorMessage = "Camera access is required to scan QR codes. Please enable it in Settings."
        case .notDetermined:
            requestCameraPermission()
        @unknown default:
            cameraPermission = .denied
        }
    }

    /// Request camera permission
    private func requestCameraPermission() {
        AVCaptureDevice.requestAccess(for: .video) { granted in
            DispatchQueue.main.async {
                if granted {
                    cameraPermission = .authorized
                } else {
                    cameraPermission = .denied
                    showError = true
                    errorMessage = "Camera access is required to scan QR codes. Please enable it in Settings."
                }
            }
        }
    }

    /// Toggle torch on/off
    private func toggleTorch() {
        guard let device = AVCaptureDevice.default(for: .video) else { return }

        if device.hasTorch {
            do {
                try device.lockForConfiguration()
                if isTorchOn {
                    device.torchMode = .off
                } else {
                    try device.setTorchModeOn(level: 1.0)
                }
                device.unlockForConfiguration()
                isTorchOn.toggle()
            } catch {
                print("Failed to toggle torch: \(error)")
            }
        }
    }

    /// Open app settings
    private func openSettings() {
        if let settingsUrl = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(settingsUrl)
        }
    }

    /// Handle scan result
    private func handleScanResult(result: Result<ScanResult, ScanError>) {
        isScanning = false

        switch result {
        case .success(let scanResult):
            // Validate that it's a TRIX pairing QR code
            let code = scanResult.string

            // Check if it's a valid pairing code
            if code.hasPrefix("trix:pair:") || code.count >= 10 {
                // Provide haptic feedback
                let generator = UINotificationFeedbackGenerator()
                generator.notificationOccurred(.success)

                // Call completion handler
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    onCodeScanned(code)
                }
            } else {
                // Invalid QR code
                let generator = UINotificationFeedbackGenerator()
                generator.notificationOccurred(.error)

                errorMessage = "This is not a valid TRIX pairing QR code. Please scan a code generated by another TRIX device."
                showError = true

                // Resume scanning after delay
                DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                    isScanning = true
                }
            }

        case .failure(let error):
            print("Scan error: \(error)")

            // Resume scanning
            DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
                isScanning = true
            }
        }
    }
}

// MARK: - Preview

#Preview("QR Scanner") {
    QRScannerView(
        onCodeScanned: { code in
            print("Scanned: \(code)")
        },
        onDismiss: {
            print("Dismissed")
        }
    )
}

#Preview("Permission Denied") {
    QRScannerView(
        onCodeScanned: { _ in },
        onDismiss: {}
    )
    .onAppear {
        // Simulate permission denied state
        AVCaptureDevice.requestAccess(for: .video) { _ in }
    }
}
