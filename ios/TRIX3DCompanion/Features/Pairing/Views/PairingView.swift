//
//  PairingView.swift
//  TRIX3DCompanion
//
//  Device pairing view for pairing and managing connected devices
//

import SwiftUI

// Helper function for localization
private func loc(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

// MARK: - Pairing View

/// Main view for device pairing and management
struct PairingView: View {
    // MARK: - Properties

    /// Pairing service
    @State private var pairingService = PairingService.shared

    /// Current tab selection
    @State private var selectedTab: PairingTab = .displayCode

    /// Show QR scanner
    @State private var showQRScanner = false

    /// Show pairing code
    @State private var showPairingCode = false

    /// Manual pairing code input
    @State private var manualCodeInput = ""

    /// Show unpair confirmation dialog
    @State private var showUnpairDialog = false

    /// Device to unpair
    @State private var deviceToUnpair: Device?

    /// Show success animation
    @State private var showSuccessAnimation = false

    /// Show error alert
    @State private var showError = false

    /// Animation scale
    @State private var animationScale: CGFloat = 1.0

    // MARK: - Tabs

    enum PairingTab: String, CaseIterable {
        case displayCode = "Display Code"
        case scanCode = "Scan QR Code"
        case pairedDevices = "Paired Devices"
    }

    // MARK: - Body

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Header
                header

                // Tab selector
                tabSelector

                // Content based on selected tab
                switch selectedTab {
                case .displayCode:
                    displayCodeSection
                case .scanCode:
                    scanCodeSection
                case .pairedDevices:
                    pairedDevicesSection
                }

                Spacer(minLength: 100)
            }
            .padding()
        }
        .background(
            LinearGradient(
                colors: [
                    Color.brandPurple.opacity(0.1),
                    Color.brandPink.opacity(0.1)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .navigationTitle(loc("pairing.title"))
        .navigationBarTitleDisplayMode(.large)
        .sheet(isPresented: $showQRScanner) {
            QRScannerView(
                onCodeScanned: handleQRScanned,
                onDismiss: { showQRScanner = false }
            )
        }
        .alert(loc("pairing.error"), isPresented: $showError) {
            Button("OK", role: .cancel) {
                pairingService.clearError()
            }
        } message: {
            if let error = pairingService.lastError {
                Text(error.localizedDescription)
            }
        }
        .confirmationDialog(
            loc("pairing.unpair"),
            isPresented: $showUnpairDialog,
            presenting: deviceToUnpair
        ) { device in
            Button(loc("pairing.unpair"), role: .destructive) {
                if let device = deviceToUnpair {
                    Task {
                        await unpairDevice(device)
                    }
                }
            }
            Button(loc("action.cancel"), role: .cancel) {}
        } message: { device in
            Text(loc("pairing.unpair.confirm") + " \"\(device.deviceName)\"?")
        }
        .task {
            await loadPairedDevices()
        }
    }

    // MARK: - Header

    private var header: some View {
        VStack(spacing: 12) {
            // Status indicator
            HStack(spacing: 12) {
                Circle()
                    .fill(pairingService.isPaired ? Color.success : Color.warning)
                    .frame(width: 12, height: 12)

                Text(pairingService.isPaired ? "Device Connected" : "No Device Connected")
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(.textSecondary)
            }

            // Paired device info
            if pairingService.isPaired,
               let deviceName = pairingService.pairedDeviceName {
                HStack {
                    Image(systemName: "iphone")
                        .font(.title2)
                        .foregroundStyle(
                            LinearGradient(
                                colors: [.brandPurple, .brandPink],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )

                    VStack(alignment: .leading, spacing: 4) {
                        Text(deviceName)
                            .font(.headline)
                            .foregroundColor(.textPrimary)

                        if let deviceId = pairingService.pairedDeviceId {
                            Text(deviceId)
                                .font(.caption)
                                .foregroundColor(.textSecondary)
                        }
                    }

                    Spacer()
                }
                .glassPanel()
            }
        }
    }

    // MARK: - Tab Selector

    private var tabSelector: some View {
        HStack(spacing: 8) {
            ForEach(PairingTab.allCases, id: \.self) { tab in
                Button(action: {
                    withAnimation(.spring(response: 0.3)) {
                        selectedTab = tab
                    }
                }) {
                    Text(tab.rawValue)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(selectedTab == tab ? .white : .textSecondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(
                            selectedTab == tab ?
                            LinearGradient(
                                colors: [.brandPurple, .brandPink],
                                startPoint: .leading,
                                endPoint: .trailing
                            ) : LinearGradient(
                                colors: [.clear],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .cornerRadius(12)
                }
            }
        }
        .glassPanel(cornerRadius: 16, padding: 8)
    }

    // MARK: - Display Code Section

    private var displayCodeSection: some View {
        VStack(spacing: 20) {
            // Instructions
            VStack(spacing: 8) {
                Image(systemName: "qrcode")
                    .font(.system(size: 40))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [.brandPurple, .brandPink],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )

                Text("Display Pairing Code")
                    .font(.title3)
                    .fontWeight(.bold)

                Text("Generate a pairing code for other devices to scan")
                    .font(.subheadline)
                    .foregroundColor(.textSecondary)
                    .multilineTextAlignment(.center)
            }

            // Generate/Display code button
            Button(action: {
                Task {
                    await generatePairingCode()
                }
            }) {
                HStack {
                    Image(systemName: "plus.circle.fill")
                    Text(showPairingCode ? "Regenerate Code" : "Generate Pairing Code")
                }
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
            .disabled(pairingService.isLoading)

            // Display pairing code
            if showPairingCode, let code = pairingService.currentPairingCode {
                VStack(spacing: 16) {
                    // Code display
                    VStack(spacing: 12) {
                        Text("Your Pairing Code")
                            .font(.caption)
                            .foregroundColor(.textSecondary)
                            .textCase(.uppercase)

                        Text(code.uppercased())
                            .font(.system(.title, design: .monospaced))
                            .fontWeight(.bold)
                            .foregroundColor(.textPrimary)
                            .padding()
                            .frame(maxWidth: .infinity)
                            .background(
                                RoundedRectangle(cornerRadius: 12)
                                    .fill(Color.tertiaryBackground)
                            )
                    }

                    // QR Code generated from pairing code
                    if let qrImage = generateQRCode(from: code) {
                        Image(uiImage: qrImage)
                            .interpolation(.none)
                            .resizable()
                            .frame(width: 200, height: 200)
                            .background(Color.white)
                            .cornerRadius(16)
                            .shadow(color: .black.opacity(0.1), radius: 10, y: 4)
                    } else {
                        // Fallback placeholder if QR generation fails
                        RoundedRectangle(cornerRadius: 16)
                            .fill(Color.white)
                            .frame(height: 200)
                            .overlay(
                                VStack(spacing: 12) {
                                    Image(systemName: "qrcode")
                                        .font(.system(size: 60))
                                        .foregroundColor(.black)

                                    Text("QR Code Generation Failed")
                                        .font(.caption)
                                        .foregroundColor(.textSecondary)
                                }
                            )
                            .shadow(color: .black.opacity(0.1), radius: 10, y: 4)
                    }

                    // Expiration timer
                    if let remainingTime = pairingService.pairingCodeRemainingTime {
                        VStack(spacing: 8) {
                            Text("Expires in")
                                .font(.caption)
                                .foregroundColor(.textSecondary)

                            Text(formatTime(remainingTime))
                                .font(.title2)
                                .fontWeight(.bold)
                                .foregroundColor(.warning)

                            ProgressView(value: remainingTime, total: 300)
                                .progressViewStyle(.linear)
                        }
                    }

                    // Copy button
                    Button(action: {
                        UIPasteboard.general.string = code
                        // Show feedback
                        let generator = UINotificationFeedbackGenerator()
                        generator.notificationOccurred(.success)
                    }) {
                        HStack {
                            Image(systemName: "doc.on.doc")
                            Text("Copy Code")
                        }
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(.brandPurple)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 10)
                        .background(Color.brandPurple.opacity(0.1))
                        .cornerRadius(10)
                    }
                }
                .glassPanel()
            }

            // Loading indicator
            if pairingService.isLoading {
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: .brandPurple))
                    .scaleEffect(1.2)
            }
        }
    }

    // MARK: - Scan Code Section

    private var scanCodeSection: some View {
        VStack(spacing: 20) {
            // Instructions
            VStack(spacing: 8) {
                Image(systemName: "camera.viewfinder")
                    .font(.system(size: 40))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [.brandPurple, .brandPink],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )

                Text("Scan QR Code")
                    .font(.title3)
                    .fontWeight(.bold)

                Text("Scan a QR code from another device to pair")
                    .font(.subheadline)
                    .foregroundColor(.textSecondary)
                    .multilineTextAlignment(.center)
            }

            // Scan QR button
            Button(action: {
                showQRScanner = true
            }) {
                HStack {
                    Image(systemName: "qrcode.viewfinder")
                    Text("Open QR Scanner")
                }
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

            // Divider with "or"
            HStack {
                VStack { Divider() }
                Text("or enter code manually")
                    .font(.caption)
                    .foregroundColor(.textSecondary)
                VStack { Divider() }
            }

            // Manual code input
            VStack(spacing: 12) {
                Text("Enter Pairing Code")
                    .font(.caption)
                    .foregroundColor(.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)

                TextField("Enter 6-character code", text: $manualCodeInput)
                    .textFieldStyle(.plain)
                    .textCase(.uppercase)
                    .autocapitalization(.allCharacters)
                    .font(.system(.title2, design: .monospaced))
                    .fontWeight(.bold)
                    .padding()
                    .frame(maxWidth: .infinity)
                    .background(Color.tertiaryBackground)
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.brandPurple, lineWidth: 2)
                    )

                Button(action: {
                    Task {
                        await pairWithCode(manualCodeInput)
                    }
                }) {
                    Text("Pair with Code")
                        .font(.headline)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(
                            manualCodeInput.count >= 6 ?
                            LinearGradient(
                                colors: [.brandPurple, .brandPink],
                                startPoint: .leading,
                                endPoint: .trailing
                            ) :
                            LinearGradient(
                                colors: [.gray],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .cornerRadius(12)
                }
                .disabled(manualCodeInput.count < 6 || pairingService.isLoading)
            }
            .glassPanel()
        }
    }

    // MARK: - Paired Devices Section

    private var pairedDevicesSection: some View {
        VStack(spacing: 20) {
            // Instructions
            VStack(spacing: 8) {
                Image(systemName: "iphone.and.ipad")
                    .font(.system(size: 40))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [.brandPurple, .brandPink],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )

                Text("Paired Devices")
                    .font(.title3)
                    .fontWeight(.bold)

                Text("Manage your connected devices")
                    .font(.subheadline)
                    .foregroundColor(.textSecondary)
                    .multilineTextAlignment(.center)
            }

            // Devices list
            if pairingService.pairedDevices.isEmpty {
                // Empty state
                VStack(spacing: 16) {
                    Image(systemName: "devices.slash")
                        .font(.system(size: 50))
                        .foregroundColor(.textTertiary)

                    Text("No Paired Devices")
                        .font(.headline)
                        .foregroundColor(.textSecondary)

                    Text("Pair with a device to get started")
                        .font(.subheadline)
                        .foregroundColor(.textTertiary)
                }
                .padding(.vertical, 40)
            } else {
                VStack(spacing: 12) {
                    ForEach(pairingService.pairedDevices) { device in
                        deviceRow(device)
                    }
                }
            }

            // Refresh button
            Button(action: {
                Task {
                    await loadPairedDevices()
                }
            }) {
                HStack {
                    Image(systemName: "arrow.clockwise")
                    Text("Refresh")
                }
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundColor(.brandPurple)
            }
            .disabled(pairingService.isLoading)
        }
    }

    // MARK: - Device Row

    private func deviceRow(_ device: Device) -> some View {
        HStack(spacing: 12) {
            // Device icon
            Image(systemName: deviceIcon(for: device.deviceType))
                .font(.title2)
                .foregroundStyle(
                    LinearGradient(
                        colors: [.brandPurple, .brandPink],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 44, height: 44)
                .background(Color.tertiaryBackground)
                .clipShape(Circle())

            // Device info
            VStack(alignment: .leading, spacing: 4) {
                Text(device.deviceName)
                    .font(.headline)
                    .foregroundColor(.textPrimary)

                HStack(spacing: 8) {
                    Circle()
                        .fill(device.isOnline ? Color.success : Color.textTertiary)
                        .frame(width: 8, height: 8)

                    Text(device.isOnline ? "Online" : "Offline")
                        .font(.caption)
                        .foregroundColor(.textSecondary)

                    Text("•")
                        .foregroundColor(.textTertiary)

                    Text(deviceTypeString(for: device.deviceType))
                        .font(.caption)
                        .foregroundColor(.textSecondary)
                }
            }

            Spacer()

            // Unpair button
            Button(action: {
                deviceToUnpair = device
                showUnpairDialog = true
            }) {
                Image(systemName: "trash")
                    .font(.subheadline)
                    .foregroundColor(.error)
                    .frame(width: 36, height: 36)
                    .background(Color.error.opacity(0.1))
                    .clipShape(Circle())
            }
        }
        .padding()
        .glassPanel(cornerRadius: 12, padding: 12)
    }

    // MARK: - Methods

    /// Generate a new pairing code
    private func generatePairingCode() async {
        let result = await pairingService.generatePairingCode()

        switch result {
        case .success(_):
            withAnimation(.spring(response: 0.3)) {
                showPairingCode = true
            }
        case .failure(let error):
            pairingService.setError(error)
            showError = true
        }
    }

    /// Pair with a manual code
    private func pairWithCode(_ code: String) async {
        let result = await pairingService.pairWithCode(code)

        switch result {
        case .success:
            // Show success animation
            withAnimation(.spring(response: 0.5)) {
                showSuccessAnimation = true
                animationScale = 1.5
            }

            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                withAnimation {
                    animationScale = 1.0
                }
            }

            DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
                withAnimation {
                    showSuccessAnimation = false
                    selectedTab = .pairedDevices
                }
            }

            manualCodeInput = ""

        case .failure(let error):
            pairingService.setError(error)
            showError = true
        }
    }

    /// Handle QR code scan
    private func handleQRScanned(_ code: String) {
        showQRScanner = false

        Task {
            let result = await pairingService.pairWithQRCode(code)

            switch result {
            case .success:
                // Show success animation
                withAnimation(.spring(response: 0.5)) {
                    showSuccessAnimation = true
                    animationScale = 1.5
                }

                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    withAnimation {
                        animationScale = 1.0
                    }
                }

                DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
                    withAnimation {
                        showSuccessAnimation = false
                        selectedTab = .pairedDevices
                    }
                }

            case .failure(let error):
                pairingService.setError(error)
                showError = true
            }
        }
    }

    /// Unpair a device
    private func unpairDevice(_ device: Device) async {
        let result = await pairingService.unpairDevice(device.deviceId)

        if case .failure(let error) = result {
            pairingService.setError(error)
            showError = true
        }

        await loadPairedDevices()
    }

    /// Load paired devices
    private func loadPairedDevices() async {
        _ = await pairingService.fetchPairedDevices()
    }

    // MARK: - Helper Methods

    /// Format time remaining
    private func formatTime(_ timeInterval: TimeInterval) -> String {
        let minutes = Int(timeInterval) / 60
        let seconds = Int(timeInterval) % 60
        return String(format: "%02d:%02d", minutes, seconds)
    }

    /// Get device icon
    private func deviceIcon(for type: DeviceType) -> String {
        switch type {
        case .mobile:
            return "iphone"
        case .desktop:
            return "desktopcomputer"
        case .tablet:
            return "ipad"
        case .web:
            return "globe"
        }
    }

    /// Get device type string
    private func deviceTypeString(for type: DeviceType) -> String {
        switch type {
        case .mobile:
            return "Mobile"
        case .desktop:
            return "Desktop"
        case .tablet:
            return "Tablet"
        case .web:
            return "Web"
        }
    }

    /// Generate QR code image from string
    /// - Parameter string: The string to encode in the QR code
    /// - Returns: UIImage of the QR code, or nil if generation fails
    private func generateQRCode(from string: String) -> UIImage? {
        let context = CIContext()
        let filter = CIFilter.qrCodeGenerator()

        guard let data = string.data(using: .utf8) else { return nil }
        filter.setValue(data, forKey: "inputMessage")
        filter.setValue("H", forKey: "inputCorrectionLevel")

        guard let outputImage = filter.outputImage else { return nil }

        // Scale up the image for better quality
        let transform = CGAffineTransform(scaleX: 10, y: 10)
        let scaledImage = outputImage.transformed(by: transform)

        // Convert to UIImage
        guard let cgImage = context.createCGImage(scaledImage, from: scaledImage.extent) else {
            return nil
        }

        return UIImage(cgImage: cgImage)
    }
}

// MARK: - Preview

#Preview("Pairing View - Unpaired") {
    NavigationStack {
        PairingView()
    }
}

#Preview("Pairing View - Paired") {
    NavigationStack {
        // Create a paired service state using a wrapper
        PairedPairingView()
    }
}

/// Wrapper view to simulate paired state in preview
struct PairedPairingView: View {
    var body: some View {
        PairingView()
            .onAppear {
                // Access via internal method - the service will handle pairing state
            }
    }
}
