//
//  QRScannerView.swift
//  TRIX3DCompanion
//
//  QR code scanner view for device pairing
//

import SwiftUI
import AVFoundation
import CodeScanner

// MARK: - Localization Helper
private func L(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

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

    /// Animated scan line position (0-1)
    @State private var scanLineProgress: CGFloat = 0.1

    /// Camera permission status
    @State private var cameraPermission: AVAuthorizationStatus = .notDetermined

    /// Show error alert
    @State private var showError = false

    /// Error message
    @State private var errorMessage = ""

    // MARK: - Computed Properties

    /// Loading indicator for indeterminate progress
    @ViewBuilder
    private var loadingIndicator: some View {
        ProgressView(value: 0)
    }

    // MARK: - Body

    var body: some View {
        ZStack {
            // Camera background
            Color.black
                .ignoresSafeArea()

            if cameraPermission == .authorized {
                // Scanner - real camera for 真机测试
                CodeScannerView(
                    codeTypes: [.qr],
                    scanMode: .continuous,
                    shouldVibrateOnSuccess: true,
                    isTorchOn: isTorchOn,
                    completion: handleScanResult
                )
                .ignoresSafeArea()
                .onAppear {
                    startScanLineAnimation()
                }
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
                        loadingIndicator
                    )
            }
        }
        .onAppear {
            checkCameraPermission()
        }
        .alert(L("pairing.camera.access"), isPresented: $showError) {
            Button(L("action.confirm"), role: .cancel) {
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
            let scanRect = CGRect(
                x: (geometry.size.width - frameWidth) / 2,
                y: (geometry.size.height - frameHeight) / 2,
                width: frameWidth,
                height: frameHeight
            )

            ZStack {
                // Dimmed overlay with transparent center so live camera feed remains visible
                Path { path in
                    path.addRect(CGRect(origin: .zero, size: geometry.size))
                    path.addRoundedRect(
                        in: scanRect,
                        cornerSize: CGSize(width: 16, height: 16)
                    )
                }
                .fill(Color.black.opacity(0.55), style: FillStyle(eoFill: true))

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
                    Text(L("pairing.align.qr"))
                        .font(.subheadline)
                        .foregroundColor(.white)
                        .padding(.bottom, 40)
                        .glassPanel(cornerRadius: 12, padding: 12)
                }
            }
        }
        .compositingGroup()
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
                .offset(y: -frameHeight / 2 + frameHeight * scanLineProgress)
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
                        .trixSurfaceCard(cornerRadius: 22, borderOpacity: 0.22, shadowOpacity: 0.08, shadowRadius: 8)
                }

                Spacer()

                // Title
                Text(L("pairing.scan.qr"))
                    .font(.headline)
                    .foregroundColor(.white)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .trixSurfaceCard(cornerRadius: 14, borderOpacity: 0.2, shadowOpacity: 0.05, shadowRadius: 6)

                Spacer()

                // Torch toggle
                Button(action: toggleTorch) {
                    Image(systemName: isTorchOn ? "flashlight.fill" : "flashlight.off.fill")
                        .font(.title2)
                        .foregroundColor(.white)
                        .frame(width: 44, height: 44)
                        .trixSurfaceCard(cornerRadius: 22, borderOpacity: 0.22, shadowOpacity: 0.08, shadowRadius: 8)
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
                Text(L("pairing.camera.required"))
                    .font(.title2)
                    .fontWeight(.bold)
                    .foregroundColor(.white)

                Text(L("pairing.camera.description"))
                    .font(.body)
                    .foregroundColor(.white.opacity(0.8))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
            }

            VStack(spacing: 12) {
                Button(action: openSettings) {
                    Text(L("pairing.open.settings"))
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
                    Text(L("workbench.cancel"))
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
            errorMessage = NSLocalizedString("pairing.camera.required.error", comment: "")
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
                    errorMessage = NSLocalizedString("pairing.camera.required.error", comment: "")
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
                SecureLogger.shared.error("Failed to toggle torch: \(error)")
            }
        }
    }

    /// Open app settings
    private func openSettings() {
        if let settingsUrl = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(settingsUrl)
        }
    }

    /// Start vertical scan line animation
    private func startScanLineAnimation() {
        scanLineProgress = 0.1
        withAnimation(.linear(duration: 2).repeatForever(autoreverses: true)) {
            scanLineProgress = 0.9
        }
    }

    /// Handle scan result
    private func handleScanResult(result: Result<ScanResult, ScanError>) {
        isScanning = false

        switch result {
        case .success(let scanResult):
            // Validate that it's a valid pairing QR/code
            let code = scanResult.string.trimmingCharacters(in: .whitespacesAndNewlines)
            var isValid = false

            // Check supported native formats only:
            // 1. JSON with claimUrl/url/code(+secret/serverUrl)
            if let data = code.data(using: .utf8),
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                if (json["claimUrl"] as? String)?.isEmpty == false ||
                    (json["url"] as? String)?.isEmpty == false ||
                    (json["code"] as? String)?.isEmpty == false {
                    isValid = true
                }
            }
            // 2. 6 character alphanumeric pairing code
            if code.range(of: "^[A-Z0-9]{6}$", options: .regularExpression) != nil {
                isValid = true
            }
            // 3. Native channel URL format: http://host/pair?code=XXX&secret=YYY
            if (code.hasPrefix("http://") || code.hasPrefix("https://")),
               let url = URL(string: code),
               let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
               components.queryItems?.contains(where: { $0.name == "code" }) == true {
                isValid = true
            }
            // 4. Compact native format: CODE:SECRET
            let compact = code.replacingOccurrences(of: "[^a-zA-Z0-9:|_ -]", with: "", options: .regularExpression)
            if compact.contains(":"),
               let pairCode = compact.split(separator: ":", maxSplits: 1).first,
               String(pairCode).range(of: "^[A-Z0-9]{6}$", options: .regularExpression) != nil {
                isValid = true
            }

            if isValid {
                // Provide haptic feedback
                let generator = UINotificationFeedbackGenerator()
                generator.notificationOccurred(.success)

                // Call completion handler
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    self.onCodeScanned(code)
                }
            } else {
                // Invalid QR code
                let generator = UINotificationFeedbackGenerator()
                generator.notificationOccurred(.error)

                errorMessage = NSLocalizedString("pairing.invalid.qr", comment: "")
                showError = true

                // Resume scanning after delay
                DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                    self.isScanning = true
                }
            }

        case .failure(let error):
            SecureLogger.shared.error("Scan error: \(error)")

            // Resume scanning
            DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
                self.isScanning = true
            }
        }
    }
}

// MARK: - Preview

#Preview("QR Scanner") {
    QRScannerView(
        onCodeScanned: { code in
            SecureLogger.shared.debug("Scanned: \(code)")
        },
        onDismiss: {
            SecureLogger.shared.debug("Dismissed")
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
