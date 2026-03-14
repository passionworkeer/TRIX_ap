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
    case relayInput = "relayInput"
    case waiting = "waiting"
    case success = "success"
}

// MARK: - Pairing View

/// Main view for device pairing - single screen like Web version
struct PairingView: View {
    private struct OpenClawSetupPayload {
        let server: String
        let gatewayId: String
        let accessCode: String
    }

    // MARK: - Properties

    /// Current pairing mode
    @State private var mode: PairingMode = .scan

    /// Connection mode (Relay / Gateway / Socket.IO)
    @State private var connectionMode: ConnectionMode = .relay

    /// Manual pairing code input
    @State private var codeInput = ""

    // Relay inputs
    @State private var relayServer = ""
    @State private var relayGatewayId = ""
    @State private var relayAccessCode = ""

    /// Loading state
    @State private var isLoading = false

    /// Show QR scanner
    @State private var showQRScanner = false

    /// Show error alert
    @State private var showError = false

    /// Error message
    @State private var errorMessage = ""

    // Persist last successful Relay config for faster reconnect.
    private let relayServerDefaultsKey = "pairing.relay.server"
    private let relayGatewayDefaultsKey = "pairing.relay.gatewayId"
    private let relayAccessCodeDefaultsKey = "pairing.relay.accessCode"

    private let localRelayServerCandidates = [
        "http://127.0.0.1:18789",
        "http://localhost:18789",
        "http://127.0.0.1:8765",
        "http://localhost:8765",
        "http://127.0.0.1:3000",
        "http://localhost:3000"
    ]

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

                // Connection mode selector
                connectionModeSelector

                // Content
                Spacer()

                switch mode {
                case .scan:
                    scanContent
                case .input:
                    inputContent
                case .relayInput:
                    relayInputContent
                case .waiting:
                    waitingContent
                case .success:
                    successContent
                }

                Spacer()
            }
            .padding(.horizontal, 24)
            .accessibilityIdentifier(PairingAccessibilityIdentifiers.screen)
        }
        .safeAreaInset(edge: .bottom) {
            Color.clear
                .frame(height: 12)
        }
        .onAppear {
            UITestEventLogger.log("PairingView onAppear")
            restoreRelayDefaults()
            connectionMode = .relay
            mode = .relayInput
            clawbotChannel.connectionMode = .relay
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

    // MARK: - Connection Mode Selector

    private var connectionModeSelector: some View {
        HStack(spacing: 12) {
            ForEach([ConnectionMode.relay, .gateway, .socketIO], id: \.self) { mode in
                Button(action: {
                    withAnimation(.spring(response: 0.3)) {
                        connectionMode = mode
                        clawbotChannel.connectionMode = mode
                        self.mode = mode == .relay ? .relayInput : .scan
                    }
                }) {
                    Text(modeLabel(for: mode))
                        .font(.subheadline)
                        .fontWeight(connectionMode == mode ? .semibold : .regular)
                        .foregroundColor(connectionMode == mode ? .white : .textSecondary)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(
                            connectionMode == mode
                            ? AnyView(LinearGradient(
                                colors: [.brandPurple, .brandPink],
                                startPoint: .leading,
                                endPoint: .trailing
                            ))
                            : AnyView(Color.clear)
                        )
                        .cornerRadius(20)
                        .overlay(
                            RoundedRectangle(cornerRadius: 20)
                                .stroke(
                                    connectionMode == mode ? Color.clear : Color.textTertiary.opacity(0.5),
                                    lineWidth: 1
                                )
                        )
                }
            }
        }
        .padding(.top, 16)
    }

    private func modeLabel(for mode: ConnectionMode) -> String {
        switch mode {
        case .relay: return "中继"
        case .gateway: return "直连"
        case .socketIO: return "配对"
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
            .accessibilityIdentifier(PairingAccessibilityIdentifiers.manualInputButton)
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
                .accessibilityIdentifier(PairingAccessibilityIdentifiers.verifyButton)
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

    // MARK: - Relay Input Content

    private var relayInputContent: some View {
        ScrollView {
            VStack(spacing: 24) {
                // QR Scanner for Relay
                VStack(spacing: 16) {
                    Image(systemName: "qrcode.viewfinder")
                        .font(.system(size: 60))
                        .foregroundStyle(
                            LinearGradient(
                                colors: [.brandPurple, .brandPink],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )

                    Text("扫描中继二维码")
                        .font(.headline)
                        .foregroundColor(.textPrimary)

                    Text("扫描 OpenClaw 设备显示的中继二维码")
                        .font(.caption)
                        .foregroundColor(.textSecondary)
                        .multilineTextAlignment(.center)
                }
                .padding(24)
                .frame(maxWidth: .infinity)
                .trixSurfaceCard(cornerRadius: 20, borderOpacity: 0.28, shadowOpacity: 0.08, shadowRadius: 12)
                .onTapGesture {
                    showQRScanner = true
                }

                // Divider
                HStack {
                    Rectangle()
                        .fill(Color.textTertiary)
                        .frame(height: 1)

                    Text("或手动输入")
                        .font(.subheadline)
                        .foregroundColor(.textSecondary)

                    Rectangle()
                        .fill(Color.textTertiary)
                        .frame(height: 1)
                }

                // Manual input fields
                VStack(spacing: 16) {
                    Button(action: {
                        Task {
                            await quickConnectLocalRelay()
                        }
                    }) {
                        HStack(spacing: 10) {
                            Image(systemName: "desktopcomputer")
                            Text(isLoading ? "正在连接本机..." : "同机快速连接")
                                .fontWeight(.bold)
                            if isLoading {
                                Spacer(minLength: 0)
                                SwiftUI.ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            }
                        }
                        .font(.subheadline)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 13)
                        .padding(.horizontal, 14)
                        .background(
                            LinearGradient(
                                colors: isLoading
                                    ? [Color.gray.opacity(0.9), Color.gray.opacity(0.75)]
                                    : [Color.brandPurple, Color.brandPink],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .cornerRadius(14)
                    }
                    .disabled(isLoading)

                    // Server URL
                    VStack(alignment: .leading, spacing: 8) {
                        Text("服务器地址")
                            .font(.subheadline)
                            .foregroundColor(.textSecondary)

                        TextField("https://your-server.com", text: $relayServer)
                            .font(.body)
                            .keyboardType(.URL)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .padding(12)
                            .background(Color.textTertiary.opacity(0.1))
                            .cornerRadius(12)
                    }

                    // Gateway ID
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Gateway ID")
                            .font(.subheadline)
                            .foregroundColor(.textSecondary)

                        TextField("gateway-xxx", text: $relayGatewayId)
                            .font(.body)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .padding(12)
                            .background(Color.textTertiary.opacity(0.1))
                            .cornerRadius(12)
                    }

                    // Access Code
                    VStack(alignment: .leading, spacing: 8) {
                        Text("访问码")
                            .font(.subheadline)
                            .foregroundColor(.textSecondary)

                        SecureField("访问码", text: $relayAccessCode)
                            .font(.body)
                            .textInputAutocapitalization(.characters)
                            .padding(12)
                            .background(Color.textTertiary.opacity(0.1))
                            .cornerRadius(12)
                    }

                    // Connect button
                    Button(action: {
                        Task {
                            await connectRelay()
                        }
                    }) {
                        HStack(spacing: 10) {
                            if isLoading {
                                SwiftUI.ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                Text("连接中...")
                            } else {
                                Image(systemName: "link")
                                Text("连接")
                            }
                        }
                        .font(.headline)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(
                            isRelayInputValid && !isLoading
                            ? LinearGradient(
                                colors: [.brandPurple, .brandPink],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                            : LinearGradient(colors: [.gray], startPoint: .leading, endPoint: .trailing)
                        )
                        .cornerRadius(24)
                    }
                    .disabled(!isRelayInputValid || isLoading)
                }
                .padding(20)
                .trixSurfaceCard(cornerRadius: 20, borderOpacity: 0.28, shadowOpacity: 0.08, shadowRadius: 12)
            }
            .padding(.horizontal, 8)
        }
    }

    private var isRelayInputValid: Bool {
        !relayServer.isEmpty && !relayGatewayId.isEmpty && !relayAccessCode.isEmpty
    }

    // MARK: - Waiting Content

    private var waitingContent: some View {
        VStack(spacing: 24) {
            SwiftUI.ProgressView()
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

        // Check if it's a Relay QR code
        if clawbotChannel.parseRelayQR(code) != nil {
            // Relay QR format: {version, server, gatewayId, accessCode, displayName}
            Task {
                await connectRelayWithQR(code)
            }
            return
        }

        if let setup = parseOpenClawSetupPayload(from: code) {
            Task {
                await connectRelayWithSetupPayload(setup)
            }
            return
        }

        // Otherwise, process as normal pairing QR
        Task {
            await processQRCode(code)
        }
    }

    private func processQRCode(_ code: String) async {
        let normalized = code.trimmingCharacters(in: .whitespacesAndNewlines)
        var qrToken: String?

        if let setup = parseOpenClawSetupPayload(from: normalized) {
            await connectRelayWithSetupPayload(setup)
            return
        }

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

    private func parseOpenClawSetupPayload(from rawCode: String) -> OpenClawSetupPayload? {
        let normalized = rawCode.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else { return nil }

        if let components = URLComponents(string: normalized),
           let scheme = components.scheme?.lowercased(),
           ["trix", "openclaw"].contains(scheme) {
            var queryDict: [String: String] = [:]
            for item in components.queryItems ?? [] {
                guard let value = item.value?.trimmingCharacters(in: .whitespacesAndNewlines),
                      !value.isEmpty else { continue }
                queryDict[item.name] = value
            }
            if let payload = parseSetupPayload(from: queryDict) {
                return payload
            }
        }

        if let data = normalized.data(using: .utf8),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let payload = parseSetupPayload(from: json) {
            return payload
        }

        if normalized.contains("=") {
            var kvPairs: [String: String] = [:]
            let entries = normalized.components(separatedBy: CharacterSet(charactersIn: "&;,\n"))
            for entry in entries {
                let parts = entry.split(separator: "=", maxSplits: 1).map(String.init)
                guard parts.count == 2 else { continue }
                let key = parts[0].trimmingCharacters(in: .whitespacesAndNewlines)
                let value = parts[1].trimmingCharacters(in: .whitespacesAndNewlines)
                if !key.isEmpty, !value.isEmpty {
                    kvPairs[key] = value
                }
            }
            if let payload = parseSetupPayload(from: kvPairs) {
                return payload
            }
        }

        return nil
    }

    private func parseSetupPayload(from json: [String: Any]) -> OpenClawSetupPayload? {
        let explicitURL = firstString(
            in: json,
            keys: ["url", "gatewayUrl", "gateway_url", "gateway", "g"]
        )
        let serverFallback = firstString(in: json, keys: ["server"])
        let hasRelayCredentials = firstString(in: json, keys: ["gatewayId", "gateway_id", "accessCode", "access_code"]) != nil
        let rawServer = explicitURL ?? (hasRelayCredentials ? serverFallback : nil)

        let rawAccessCode = firstString(
            in: json,
            keys: ["accessCode", "access_code", "token", "gatewayToken", "gateway_token", "pairingToken", "pairing_token", "t"]
        )
        let rawGatewayId = firstString(
            in: json,
            keys: ["gatewayId", "gateway_id", "sessionKey", "session_key", "agentId", "agent_id"]
        ) ?? "agent:main:main"

        guard let rawServer, let rawAccessCode else { return nil }
        guard let normalizedServer = normalizeRelayServerURL(rawServer) else { return nil }

        return OpenClawSetupPayload(
            server: normalizedServer,
            gatewayId: rawGatewayId,
            accessCode: rawAccessCode
        )
    }

    private func parseSetupPayload(from values: [String: String]) -> OpenClawSetupPayload? {
        let rawServer = firstString(
            in: values,
            keys: ["url", "server", "gatewayUrl", "gateway_url", "gateway", "g"]
        )
        let rawAccessCode = firstString(
            in: values,
            keys: ["accessCode", "access_code", "token", "gatewayToken", "gateway_token", "pairingToken", "pairing_token", "t"]
        )
        let rawGatewayId = firstString(
            in: values,
            keys: ["gatewayId", "gateway_id", "sessionKey", "session_key", "agentId", "agent_id"]
        ) ?? "agent:main:main"

        guard let rawServer, let rawAccessCode else { return nil }
        guard let normalizedServer = normalizeRelayServerURL(rawServer) else { return nil }

        return OpenClawSetupPayload(
            server: normalizedServer,
            gatewayId: rawGatewayId,
            accessCode: rawAccessCode
        )
    }

    private func firstString(in values: [String: Any], keys: [String]) -> String? {
        for key in keys {
            if let value = values[key] as? String {
                let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
                if !trimmed.isEmpty {
                    return trimmed
                }
            }
        }
        return nil
    }

    private func firstString(in values: [String: String], keys: [String]) -> String? {
        for key in keys {
            if let value = values[key] {
                let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
                if !trimmed.isEmpty {
                    return trimmed
                }
            }
        }
        return nil
    }

    private func normalizeRelayServerURL(_ value: String) -> String? {
        var raw = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !raw.isEmpty else { return nil }

        if raw.hasPrefix("ws://") {
            raw = raw.replacingOccurrences(of: "ws://", with: "http://")
        } else if raw.hasPrefix("wss://") {
            raw = raw.replacingOccurrences(of: "wss://", with: "https://")
        } else if !raw.contains("://") {
            raw = "http://\(raw)"
        }

        guard var components = URLComponents(string: raw), components.host != nil else {
            return nil
        }

        if components.path.lowercased() == "/relay" || components.path == "/" {
            components.path = ""
        }
        components.query = nil
        components.fragment = nil

        guard let url = components.url else { return nil }
        var normalized = url.absoluteString
        while normalized.hasSuffix("/") {
            normalized.removeLast()
        }
        return normalized
    }

    private func connectRelayWithSetupPayload(_ payload: OpenClawSetupPayload) async {
        relayServer = payload.server
        relayGatewayId = payload.gatewayId
        relayAccessCode = payload.accessCode
        connectionMode = .relay
        clawbotChannel.connectionMode = .relay

        isLoading = true
        let success = await clawbotChannel.connectRelayManual(
            server: payload.server,
            gatewayId: payload.gatewayId,
            accessCode: payload.accessCode
        )
        isLoading = false

        if success {
            persistRelayDefaults(
                server: payload.server,
                gatewayId: payload.gatewayId,
                accessCode: payload.accessCode
            )
            withAnimation(.spring(response: 0.3)) {
                mode = .success
            }
        } else {
            errorMessage = clawbotChannel.lastError ?? "连接失败，请检查配对信息"
            showError = true
            withAnimation(.spring(response: 0.3)) {
                mode = .relayInput
            }
        }
    }

    // MARK: - Relay Actions

    private func connectRelay() async {
        guard isRelayInputValid else { return }

        isLoading = true

        let server = relayServer.trimmingCharacters(in: .whitespacesAndNewlines)
        let gatewayId = relayGatewayId.trimmingCharacters(in: .whitespacesAndNewlines)
        let accessCode = relayAccessCode.trimmingCharacters(in: .whitespacesAndNewlines)

        let success = await clawbotChannel.connectRelayManual(
            server: server,
            gatewayId: gatewayId,
            accessCode: accessCode
        )

        isLoading = false

        if success {
            persistRelayDefaults(server: server, gatewayId: gatewayId, accessCode: accessCode)
            withAnimation(.spring(response: 0.3)) {
                mode = .success
            }
        } else {
            errorMessage = clawbotChannel.lastError ?? "连接失败，请检查配置"
            showError = true
        }
    }

    private func quickConnectLocalRelay() async {
        let gatewayId = relayGatewayId.trimmingCharacters(in: .whitespacesAndNewlines)
        let accessCode = relayAccessCode.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !gatewayId.isEmpty, !accessCode.isEmpty else {
            errorMessage = "请先输入 Gateway ID 和访问码，再使用同机快速连接"
            showError = true
            return
        }

        isLoading = true
        for candidate in localRelayServerCandidates {
            let success = await clawbotChannel.connectRelayManual(
                server: candidate,
                gatewayId: gatewayId,
                accessCode: accessCode
            )
            if success {
                relayServer = candidate
                persistRelayDefaults(server: candidate, gatewayId: gatewayId, accessCode: accessCode)
                isLoading = false
                withAnimation(.spring(response: 0.3)) {
                    mode = .success
                }
                return
            }
        }

        isLoading = false
        errorMessage = clawbotChannel.lastError ?? "同机快速连接失败，请确认 OpenClaw/Relay 服务已在本机启动"
        showError = true
    }

    private func restoreRelayDefaults() {
        let defaults = UserDefaults.standard
        relayServer = defaults.string(forKey: relayServerDefaultsKey) ?? relayServer
        relayGatewayId = defaults.string(forKey: relayGatewayDefaultsKey) ?? relayGatewayId
        relayAccessCode = defaults.string(forKey: relayAccessCodeDefaultsKey) ?? relayAccessCode
        if relayServer.isEmpty {
            relayServer = localRelayServerCandidates.first ?? ""
        }
    }

    private func persistRelayDefaults(server: String, gatewayId: String, accessCode: String) {
        let defaults = UserDefaults.standard
        defaults.set(server, forKey: relayServerDefaultsKey)
        defaults.set(gatewayId, forKey: relayGatewayDefaultsKey)
        defaults.set(accessCode, forKey: relayAccessCodeDefaultsKey)
    }

    private func handleRelayQRScanned(_ code: String) {
        showQRScanner = false

        Task {
            await connectRelayWithQR(code)
        }
    }

    private func connectRelayWithQR(_ qrContent: String) async {
        isLoading = true

        let success = await clawbotChannel.connectRelayWithQR(qrContent)

        isLoading = false

        if success {
            withAnimation(.spring(response: 0.3)) {
                mode = .success
            }
        } else {
            errorMessage = clawbotChannel.lastError ?? "二维码连接失败"
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
