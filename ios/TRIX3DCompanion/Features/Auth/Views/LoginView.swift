//
//  LoginView.swift
//  TRIX3DCompanion
//
//  Login screen with native iOS design
//

import SwiftUI
import AuthenticationServices
import UIKit

// MARK: - Login View

/// Native iOS login screen with clean, familiar design patterns
struct LoginView: View {

    // MARK: - State

    @StateObject private var authService = AuthService.shared

    @State private var email = ""
    @State private var password = ""
    @State private var showingError = false
    @State private var errorMessage = ""
    @State private var isOAuthLoading = false

    @FocusState private var focusedField: Field?

    private let showsDebugLoadingPreview = ProcessInfo.processInfo.arguments.contains("--debug-show-login-loading")

    enum Field: Hashable {
        case email
        case password
    }

    // MARK: - Callbacks

    var onSwitchToRegister: () -> Void

    // MARK: - Body

    var body: some View {
        ZStack {
            // Native iOS background with mesh gradient (iOS 18+)
            nativeBackground

            VStack(spacing: 0) {
                // Header
                headerSection
                    .padding(.top, 60)
                    .padding(.horizontal, 24)

                // Main content
                ScrollView(showsIndicators: false) {
                    VStack(spacing: 20) {
                        loginForm
                        loginButton
                        oauthDivider
                        oauthButtons
                        switchToRegister
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 24)
                    .padding(.bottom, 40)
                }
            }

            // Loading overlay
            if authService.isLoading || showsDebugLoadingPreview {
                nativeLoadingOverlay
            }
        }
        .alert("登录失败", isPresented: $showingError) {
            Button("确定", role: .cancel) {
                authService.clearError()
            }
        } message: {
            Text(errorMessage)
        }
        .onChange(of: authService.lastError) { newError in
            if let error = newError {
                errorMessage = error.localizedDescription
            }
            showingError = newError != nil
        }
    }

    // MARK: - Background

    private var nativeBackground: some View {
        LinearGradient(
            colors: [
                .purple.opacity(0.3),
                .blue.opacity(0.2),
                .pink.opacity(0.15)
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .background(Color(.systemBackground))
        .ignoresSafeArea()
    }

    // MARK: - Header Section

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            // App icon and welcome
            HStack(spacing: 16) {
                // App icon with native iOS styling
                ZStack {
                    Circle()
                        .fill(.ultraThinMaterial)
                        .frame(width: 72, height: 72)

                    Image(systemName: "cube.transparent")
                        .font(.system(size: 32, weight: .semibold))
                        .foregroundStyle(.purple)
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text("欢迎回来")
                        .font(.title)
                        .fontWeight(.bold)

                    Text("登录您的账户")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }

            // Feature pills (native style)
            HStack(spacing: 8) {
                FeaturePill(icon: "arrow.triangle.2.circlepath", text: "数据同步")
                FeaturePill(icon: "link.badge.plus", text: "设备配对")
            }

            Text("登录后即可与 TRIX Bot 配对，开始智能学习之旅")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: - Login Form

    private var loginForm: some View {
        VStack(spacing: 16) {
            // Email field - native iOS style
            HStack(spacing: 12) {
                Image(systemName: "envelope.fill")
                    .foregroundStyle(.secondary)
                    .frame(width: 20)

                TextField("邮箱", text: $email)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .focused($focusedField, equals: .email)
                    .submitLabel(.next)
                    .onSubmit {
                        focusedField = .password
                    }
            }
            .padding(16)
            .background(Color(.secondarySystemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(focusedField == .email ? Color.purple : Color.clear, lineWidth: 2)
            )

            // Password field - native iOS style
            HStack(spacing: 12) {
                Image(systemName: "lock.fill")
                    .foregroundStyle(.secondary)
                    .frame(width: 20)

                SecureField("密码", text: $password)
                    .textContentType(.password)
                    .focused($focusedField, equals: .password)
                    .submitLabel(.go)
                    .onSubmit {
                        focusedField = nil
                        Task { await handleLogin() }
                    }
            }
            .padding(16)
            .background(Color(.secondarySystemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(focusedField == .password ? Color.purple : Color.clear, lineWidth: 2)
            )
        }
        .padding(20)
        .background(Color(.systemBackground).opacity(0.8))
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .shadow(color: .black.opacity(0.05), radius: 10, x: 0, y: 4)
    }

    // MARK: - Login Button

    private var loginButton: some View {
        Button {
            Task { await handleLogin() }
        } label: {
            HStack {
                Text("登录")
                    .fontWeight(.semibold)

                Image(systemName: "arrow.right")
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(Color.purple)
            .foregroundStyle(.white)
            .clipShape(RoundedRectangle(cornerRadius: 14))
        }
        .disabled(isSubmitDisabled)
        .opacity(isSubmitDisabled ? 0.6 : 1)
    }

    // MARK: - OAuth Divider

    private var oauthDivider: some View {
        HStack {
            Capsule()
                .fill(Color(.separator))
                .frame(height: 1)

            Text("或")
                .font(.caption)
                .foregroundStyle(.secondary)

            Capsule()
                .fill(Color(.separator))
                .frame(height: 1)
        }
        .padding(.vertical, 8)
    }

    // MARK: - OAuth Buttons

    private var oauthButtons: some View {
        VStack(spacing: 12) {
            // Apple Sign In - native style
            if true { // Assuming Apple Sign In is available
                Button {
                    Task { await handleAppleSignIn() }
                } label: {
                    HStack {
                        Image(systemName: "applelogo")
                        Text("使用 Apple 继续")
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Color.black)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
            }

            // WeChat Sign In
            Button {
                Task { await handleWeChatSignIn() }
            } label: {
                HStack {
                    Image(systemName: "message.fill")
                    Text("使用微信登录")
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Color.green)
                .foregroundStyle(.white)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
        }
    }

    // MARK: - Switch to Register

    private var switchToRegister: some View {
        HStack(spacing: 4) {
            Text("还没有账户?")
                .foregroundStyle(.secondary)

            Button("立即注册") {
                onSwitchToRegister()
            }
            .fontWeight(.semibold)
        }
        .font(.subheadline)
        .padding(.top, 8)
    }

    // MARK: - Loading Overlay

    private var nativeLoadingOverlay: some View {
        AuthLoadingOverlay(
            title: "正在登录",
            subtitle: "正在安全连接你的 TRIX 空间",
            steps: [
                "验证账户信息",
                "同步会话状态",
                "准备你的学习空间"
            ],
            accessibilityIdentifier: AuthAccessibilityIdentifiers.loginLoadingOverlay
        )
    }

    // MARK: - Computed Properties

    private var isSubmitDisabled: Bool {
        email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
        password.isEmpty ||
        authService.isLoading ||
        showsDebugLoadingPreview
    }

    // MARK: - Actions

    private func handleLogin() async {
        focusedField = nil
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)

        let normalizedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let normalizedPassword = password.trimmingCharacters(in: .newlines)

        guard !normalizedEmail.isEmpty else {
            errorMessage = "请输入邮箱地址"
            showingError = true
            return
        }

        guard !normalizedPassword.isEmpty else {
            errorMessage = "请输入密码"
            showingError = true
            return
        }

        let result = await authService.login(email: normalizedEmail, password: normalizedPassword)

        switch result {
        case .success:
            break
        case .failure(let error):
            let trimmedPassword = normalizedPassword.trimmingCharacters(in: .whitespacesAndNewlines)
            if error == .invalidCredentials, trimmedPassword != normalizedPassword {
                let retryResult = await authService.login(email: normalizedEmail, password: trimmedPassword)
                switch retryResult {
                case .success:
                    break
                case .failure(let retryError):
                    errorMessage = retryError.localizedDescription
                    showingError = true
                }
            } else {
                errorMessage = error.localizedDescription
                showingError = true
            }
        }
    }

    private func handleAppleSignIn() async {
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let window = windowScene.windows.first else {
            errorMessage = "无法打开 Apple 登录"
            showingError = true
            return
        }

        isOAuthLoading = true
        let result = await OAuthManager.shared.signIn(with: .apple, presentationAnchor: window)
        isOAuthLoading = false

        if case .failure(let error) = result {
            errorMessage = error.localizedDescription
            showingError = true
        }
    }

    private func handleWeChatSignIn() async {
        isOAuthLoading = true
        let result = await OAuthManager.shared.signIn(with: .wechat, presentationAnchor: nil)
        isOAuthLoading = false

        if case .failure(let error) = result {
            errorMessage = error.localizedDescription
            showingError = true
        }
    }
}

// MARK: - Feature Pill

/// Native iOS style feature pill
struct FeaturePill: View {
    let icon: String
    let text: String

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.caption)
            Text(text)
                .font(.caption)
                .fontWeight(.medium)
        }
        .foregroundStyle(.secondary)
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color(.secondarySystemBackground))
        .clipShape(Capsule())
    }
}

// MARK: - Preview

#Preview {
    LoginView {
        print("Switch to register")
    }
    .environmentObject(AuthService.shared)
}
