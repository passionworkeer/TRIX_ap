//
//  PairingView.swift
//  TRIX3DCompanion
//
//  Device pairing view - Single screen like Web version
//

import SwiftUI

// MARK: - Pairing Mode

enum PairingMode: String, CaseIterable {
    case scan = "scan"
    case input = "input"
    case waiting = "waiting"
    case success = "success"
}

// MARK: - Pairing View

/// Main view for device pairing - single screen like Web version
struct PairingView: View {
    // MARK: - Properties

    /// Current pairing mode
    @State private var mode: PairingMode = .scan

    /// Manual pairing code input
    @State private var codeInput = ""

    /// Loading state
    @State private var isLoading = false

    /// Show QR scanner
    @State private var showQRScanner = false

    /// Show error alert
    @State private var showError = false

    /// Error message
    @State private var errorMessage = ""

    /// Clawbot Channel service
    @EnvironmentObject private var clawbotChannel: ClawbotChannelViewModel

    /// Dismiss action
    @Environment(\.dismiss) private var dismiss

    // MARK: - Body

    var body: some View {
        ZStack {
            // Background gradient
            Color.clear.trixPageBackground(
                colors: [
                    Color.brandPurple.opacity(0.16),
                    Color.brandPink.opacity(0.12),
                    Color.cyan.opacity(0.08),
                    Color.clear
                ]
            )

            VStack(spacing: 0) {
                // Header
                header

                // Content
                Spacer()

                switch mode {
                case .scan:
                    scanContent
                case .input:
                    inputContent
                case .waiting:
                    waitingContent
                case .success:
                    successContent
                }

                Spacer()
            }
            .padding(.horizontal, 24)
        }
        .safeAreaInset(edge: .bottom) {
            Color.clear
                .frame(height: 12)
        }
        .sheet(isPresented: $showQRScanner) {
            QRScannerView(
                onCodeScanned: handleQRScanned,
                onDismiss: { showQRScanner = false }
            )
        }
        .alert("配对失败", isPresented: $showError) {
            Button("确定", role: .cancel) {}
        } message: {
            Text(errorMessage)
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack {
            Button(action: {
                dismiss()
            }) {
                Image(systemName: "chevron.left")
                    .font(.title2)
                    .fontWeight(.semibold)
                    .foregroundStyle(
                        LinearGradient(
                            colors: [.brandPurple, .brandPink],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 44, height: 44)
                    .trixSurfaceCard(cornerRadius: 22, borderOpacity: 0.24, shadowOpacity: 0.07, shadowRadius: 8)
            }

            Spacer()

            Text("设备配对")
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(.textPrimary)

            Spacer()

            // Placeholder for balance
            Color.clear
                .frame(width: 44, height: 44)
        }
        .padding(.top, 16)
        .padding(.horizontal, 8)
    }

    // MARK: - Scan Content

    private var scanContent: some View {
        VStack(spacing: 32) {
            // QR Scanner preview area
            ZStack {
                VStack(spacing: 16) {
                    Image(systemName: "qrcode.viewfinder")
                        .font(.system(size: 80))
                        .foregroundStyle(
                            LinearGradient(
                                colors: [.brandPurple, .brandPink],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )

                    Text("扫描电脑端展示的配对二维码")
                        .font(.body)
                        .foregroundColor(.textSecondary)
                        .multilineTextAlignment(.center)
                }
                .padding(40)
            }
            .frame(maxWidth: 300)
            .frame(height: 300)
            .trixSurfaceCard(cornerRadius: 32, borderOpacity: 0.32, shadowOpacity: 0.1, shadowRadius: 18)
            .onTapGesture {
                showQRScanner = true
            }

            // Open camera button
            Button(action: {
                showQRScanner = true
            }) {
                HStack {
                    Image(systemName: "camera.fill")
                    Text("开启摄像头")
                }
                .font(.headline)
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(
                    LinearGradient(
                        colors: [.brandPurple, .brandPink],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .clipShape(Capsule())
                .shadow(color: .brandPurple.opacity(0.25), radius: 10, x: 0, y: 4)
            }
            .frame(maxWidth: 300)

            // Or divider
            HStack {
                Rectangle()
                    .fill(Color.textTertiary)
                    .frame(height: 1)

                Text("或")
                    .font(.subheadline)
                    .foregroundColor(.textSecondary)

                Rectangle()
                    .fill(Color.textTertiary)
                    .frame(height: 1)
            }
            .frame(maxWidth: 300)

            // Switch to manual input
            Button(action: {
                withAnimation(.spring(response: 0.3)) {
                    mode = .input
                }
            }) {
                HStack {
                    Image(systemName: "keyboard")
                    Text("手动输入配对码")
                }
                .font(.headline)
                .foregroundStyle(
                    LinearGradient(
                        colors: [.brandPurple, .brandPink],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
            }
        }
    }

    // MARK: - Input Content

    private var inputContent: some View {
        VStack(spacing: 32) {
            // Input field
            VStack(spacing: 16) {
                Text("输入 6 位配对码")
                    .font(.headline)
                    .foregroundColor(.textPrimary)

                TextField("ABC123", text: $codeInput)
                    .font(.system(.title, design: .monospaced))
                    .fontWeight(.bold)
                    .multilineTextAlignment(.center)
                    .textInputAutocapitalization(.characters)
                    .disableAutocorrection(true)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 14)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(Color.brandPurple.opacity(0.5), lineWidth: 2)
                    )
                    .trixSurfaceCard(cornerRadius: 16, borderOpacity: 0.16, shadowOpacity: 0.03, shadowRadius: 4)
                    .onChange(of: codeInput) { newValue in
                        codeInput = String(newValue.uppercased().prefix(6).filter { $0.isLetter || $0.isNumber })
                    }

                // Verify button
                Button(action: {
                    Task {
                        await pairWithCode()
                    }
                }) {
                    HStack {
                        if isLoading {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        } else {
                            Text("验证配对码")
                        }
                    }
                    .font(.headline)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(
                        codeInput.count == 6 && !isLoading ?
                        LinearGradient(
                            colors: [.brandPurple, .brandPink],
                            startPoint: .leading,
                            endPoint: .trailing
                        ) : LinearGradient(colors: [.gray], startPoint: .leading, endPoint: .trailing)
                    )
                    .cornerRadius(28)
                }
                .disabled(codeInput.count != 6 || isLoading)
            }
            .padding(24)
            .trixSurfaceCard(cornerRadius: 24, borderOpacity: 0.28, shadowOpacity: 0.08, shadowRadius: 12)
            .frame(maxWidth: 320)

            // Back to scan button
            Button(action: {
                withAnimation(.spring(response: 0.3)) {
                    mode = .scan
                    showQRScanner = true
                }
            }) {
                HStack {
                    Image(systemName: "qrcode.viewfinder")
                    Text("返回扫码")
                }
                .font(.subheadline)
                .foregroundColor(.textSecondary)
            }
        }
    }

    // MARK: - Waiting Content

    private var waitingContent: some View {
        VStack(spacing: 24) {
            ProgressView()
                .progressViewStyle(CircularProgressViewStyle(tint: .brandPurple))
                .scaleEffect(1.5)

            Text("等待设备确认")
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(.textPrimary)

            Text("请在电脑端确认本次配对")
                .font(.body)
                .foregroundColor(.textSecondary)
                .multilineTextAlignment(.center)

            Button(action: {
                withAnimation(.spring(response: 0.3)) {
                    mode = .scan
                }
            }) {
                Text("取消")
                    .font(.headline)
                    .foregroundColor(.textSecondary)
            }
            .padding(.top, 16)
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 28)
        .trixSurfaceCard(cornerRadius: 28, borderOpacity: 0.24, shadowOpacity: 0.08, shadowRadius: 12)
        .frame(maxWidth: 320)
    }

    // MARK: - Success Content

    private var successContent: some View {
        VStack(spacing: 24) {
            // Success icon
            ZStack {
                Circle()
                    .fill(Color.success.opacity(0.2))
                    .frame(width: 100, height: 100)

                Image(systemName: "checkmark")
                    .font(.system(size: 50, weight: .bold))
                    .foregroundColor(.success)
            }

            Text("配对成功")
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(.textPrimary)

            Text("你的设备已连接到 TRIX Bot")
                .font(.body)
                .foregroundColor(.textSecondary)
                .multilineTextAlignment(.center)

            Button(action: {
                dismiss()
            }) {
                Text("开始聊天")
                    .font(.headline)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(
                        LinearGradient(
                            colors: [.brandPurple, .brandPink],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .cornerRadius(28)
            }
            .frame(maxWidth: 280)
            .padding(.top, 16)
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 28)
        .trixSurfaceCard(cornerRadius: 28, borderOpacity: 0.24, shadowOpacity: 0.08, shadowRadius: 12)
        .frame(maxWidth: 340)
    }

    // MARK: - Actions

    private func pairWithCode() async {
        guard codeInput.count == 6 else { return }

        isLoading = true

        // Ensure connected to Clawbot Channel
        if !clawbotChannel.isConnected {
            await clawbotChannel.connect()
        }

        let success = await clawbotChannel.pairWithCode(codeInput.uppercased())

        isLoading = false

        if success {
            withAnimation(.spring(response: 0.3)) {
                mode = .waiting
            }

            // Check for pairing success after a delay
            try? await Task.sleep(nanoseconds: 2_000_000_000)

            if clawbotChannel.isPaired {
                withAnimation(.spring(response: 0.3)) {
                    mode = .success
                }
            }
        } else {
            errorMessage = clawbotChannel.lastError ?? "配对失败，请重试"
            showError = true
            codeInput = ""
        }
    }

    private func handleQRScanned(_ code: String) {
        showQRScanner = false

        Task {
            await processQRCode(code)
        }
    }

    private func processQRCode(_ code: String) async {
        let normalized = code.trimmingCharacters(in: .whitespacesAndNewlines)
        var qrToken: String?

        // Try to parse as JSON
        if let data = normalized.data(using: .utf8),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            if let token = json["token"] as? String, !token.isEmpty {
                qrToken = token.trimmingCharacters(in: .whitespacesAndNewlines)
            } else if let token = json["pairingToken"] as? String, !token.isEmpty {
                qrToken = token.trimmingCharacters(in: .whitespacesAndNewlines)
            }
        }

        isLoading = true

        // Ensure connected to Clawbot Channel
        if !clawbotChannel.isConnected {
            await clawbotChannel.connect()
        }

        var success = false

        if let token = qrToken {
            // QR token from JSON
            success = await clawbotChannel.pairWithToken(token)
        } else if normalized.count == 6 && normalized.range(of: "^[A-Z0-9]+$", options: .regularExpression) != nil {
            // 6-character pairing code
            success = await clawbotChannel.pairWithCode(normalized.uppercased())
        } else if normalized.count >= 10 {
            // Try as direct token
            success = await clawbotChannel.pairWithToken(normalized)
        }

        isLoading = false

        if success {
            withAnimation(.spring(response: 0.3)) {
                mode = .waiting
            }

            // Check for pairing success after a delay
            try? await Task.sleep(nanoseconds: 2_000_000_000)

            if clawbotChannel.isPaired {
                withAnimation(.spring(response: 0.3)) {
                    mode = .success
                }
            }
        } else {
            errorMessage = "二维码配对失败"
            showError = true
        }
    }
}

// MARK: - Preview

struct PairingViewPreview: PreviewProvider {
    static var previews: some View {
        // Note: ClawbotChannelViewModel has private init,
        // so we use a simplified preview without the environment object
        PairingViewPreviewContent()
    }
}

struct PairingViewPreviewContent: View {
    var body: some View {
        PairingView()
            .environmentObject(ClawbotChannelViewModel.shared)
    }
}
