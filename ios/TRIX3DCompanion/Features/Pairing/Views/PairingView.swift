//
//  PairingView.swift
//  TRIX3DCompanion
//
//  Device pairing view - 对齐 Web 端配对方式 (扫码/输入配对码)
//

import SwiftUI

// MARK: - Localization Helper
private func L(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

// MARK: - Pairing Mode

enum PairingMode: String, CaseIterable {
    case scan = "scan"
    case input = "input"
    case waiting = "waiting"
    case success = "success"
}

// MARK: - Pairing View

/// Main view for device pairing - 对齐 Web 端配对方式
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
        .uiTestMarker(PairingAccessibilityIdentifiers.screen)
        .onAppear {
            UITestEventLogger.log("PairingView onAppear")
        }
        .sheet(isPresented: $showQRScanner) {
            QRScannerView(
                onCodeScanned: handleQRScanned,
                onDismiss: { showQRScanner = false }
            )
        }
        .alert(L("pairing.failed"), isPresented: $showError) {
            Button(L("action.confirm"), role: .cancel) {}
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

            Text(L("pairing.device.title"))
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

                    Text(L("pairing.scan.qrcode.computer"))
                        .font(.body)
                        .foregroundColor(.textSecondary)
                        .multilineTextAlignment(.center)
                }
                .padding(40)
            }
            .frame(maxWidth: 300)
            .accessibilityIdentifier(PairingAccessibilityIdentifiers.cameraButton)
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
                    Text(L("pairing.open.camera"))
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

                Text(L("common.or"))
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
                    Text(L("pairing.manual.input"))
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
            .accessibilityIdentifier(PairingAccessibilityIdentifiers.manualInputButton)
        }
    }

    // MARK: - Input Content

    private var inputContent: some View {
        VStack(spacing: 32) {
            // Input field
            VStack(spacing: 16) {
                Text(L("pairing.input.6.digit"))
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
                    .accessibilityIdentifier(PairingAccessibilityIdentifiers.codeField)

                // Verify button
                Button(action: {
                    Task {
                        await pairWithCode()
                    }
                }) {
                    HStack {
                        if isLoading {
                            SwiftUI.ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        } else {
                            Text(L("pairing.verify.code"))
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
                .accessibilityIdentifier(PairingAccessibilityIdentifiers.verifyButton)
            }
            .padding(24)
            .trixSurfaceCard(cornerRadius: 24, borderOpacity: 0.28, shadowOpacity: 0.08, shadowRadius: 12)
            .frame(maxWidth: 320)

            // Back to scan button
            Button(action: {
                withAnimation(.spring(response: 0.3)) {
                    mode = .scan
                }
            }) {
                HStack {
                    Image(systemName: "qrcode.viewfinder")
                    Text(L("pairing.back.to.scan"))
                }
                .font(.subheadline)
                .foregroundColor(.textSecondary)
            }
        }
    }

    // MARK: - Waiting Content

    private var waitingContent: some View {
        VStack(spacing: 24) {
            SwiftUI.ProgressView()
                .progressViewStyle(CircularProgressViewStyle(tint: .brandPurple))
                .scaleEffect(1.5)

            Text(L("pairing.waiting.confirm"))
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(.textPrimary)

            Text(L("pairing.confirm.on.computer"))
                .font(.body)
                .foregroundColor(.textSecondary)
                .multilineTextAlignment(.center)

            Button(action: {
                withAnimation(.spring(response: 0.3)) {
                    mode = .scan
                }
            }) {
                Text(L("action.cancel"))
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

            Text(L("pairing.success"))
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(.textPrimary)

            Text(L("pairing.connected.to.trixbot"))
                .font(.body)
                .foregroundColor(.textSecondary)
                .multilineTextAlignment(.center)

            Button(action: {
                dismiss()
            }) {
                Text(L("pairing.start.chatting"))
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

    /// 使用配对码配对 - 对齐 Web 端
    private func pairWithCode() async {
        guard codeInput.count == 6 else { return }

        isLoading = true
        errorMessage = ""

        // 对齐 Web 端: 先连接到 Clawbot Channel
        if !clawbotChannel.isConnected {
            await clawbotChannel.connect()
        }

        // 解析配对码
        let normalizedCode = codeInput.uppercased().trimmingCharacters(in: .whitespacesAndNewlines)

        // 调用配对
        let success = await clawbotChannel.pairWithCode(normalizedCode)

        isLoading = false

        if success || clawbotChannel.isPaired {
            withAnimation(.spring(response: 0.3)) {
                mode = .success
            }
        } else {
            errorMessage = clawbotChannel.lastError ?? L("pairing.failed.please.retry")
            showError = true
            codeInput = ""
        }
    }

    /// 处理扫码结果 - 对齐 Web 端 parseQrOrClaimPayload
    private func handleQRScanned(_ code: String) {
        showQRScanner = false
        isLoading = true
        errorMessage = ""

        Task {
            // 对齐 Web 端: 解析二维码格式
            let parsed = parseQRCode(code)

            // 确保已连接
            if !clawbotChannel.isConnected {
                await clawbotChannel.connect()
            }

            let success: Bool
            if let qrPayload = parsed.qrPayload {
                success = await clawbotChannel.pairWithQR(qrPayload)
            } else if parsed.code.count == 6 {
                success = await clawbotChannel.pairWithCode(parsed.code)
            } else {
                // 无法解析
                isLoading = false
                errorMessage = L("pairing.invalid.qr")
                showError = true
                return
            }

            isLoading = false

            if success || clawbotChannel.isPaired {
                withAnimation(.spring(response: 0.3)) {
                    mode = .success
                }
            } else {
                errorMessage = clawbotChannel.lastError ?? L("pairing.qr.failed")
                showError = true
            }
        }
    }

    /// 解析二维码 - 对齐 Web 端 parseQrOrClaimPayload
    private func parseQRCode(_ raw: String) -> (code: String, qrPayload: String?) {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)

        // 1. 尝试 JSON 格式
        if let data = trimmed.data(using: .utf8),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            // 处理 claimUrl
            if let claimUrl = json["claimUrl"] as? String {
                return parseQRCode(claimUrl)
            }
            // 处理 url
            if let url = json["url"] as? String {
                return parseQRCode(url)
            }
            // 处理 code
            if let code = json["code"] as? String {
                let hasContext = (json["secret"] as? String)?.isEmpty == false || (json["serverUrl"] as? String)?.isEmpty == false
                return hasContext ? ("", trimmed) : (code.uppercased(), nil)
            }
        }

        // 2. URL 格式: http://host/pair?code=XXX&secret=YYY
        if let url = URL(string: trimmed), url.scheme?.hasPrefix("http") == true {
            let code = URLComponents(string: trimmed)?.queryItems?.first(where: { $0.name == "code" })?.value ?? ""
            if !code.isEmpty {
                return ("", trimmed)
            }
        }

        // 3. Compact 格式: CODE:SECRET
        let compact = trimmed.replacingOccurrences(of: "[^a-zA-Z0-9:|_ -]", with: "", options: .regularExpression)
        if compact.contains(":") {
            let parts = compact.split(separator: ":", maxSplits: 1).map(String.init)
            if let code = parts.first, !code.isEmpty {
                let secret = parts.count > 1 ? parts[1].trimmingCharacters(in: .whitespacesAndNewlines) : ""
                if !secret.isEmpty {
                    return ("", "\(code.uppercased()):\(secret)")
                }
            }
        }

        // 4. 纯配对码 (6 位)
        let normalized = trimmed.uppercased().filter { $0.isLetter || $0.isNumber }
        if normalized.count == 6 {
            return (normalized, nil)
        }

        return ("", nil)
    }
}

// MARK: - Preview

struct PairingViewPreview: PreviewProvider {
    static var previews: some View {
        PairingView()
            .environmentObject(ClawbotChannelViewModel.shared)
    }
}
