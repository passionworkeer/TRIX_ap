//
//  LoginView.swift
//  TRIX3DCompanion
//
//  Login screen with native iOS design
//

import SwiftUI
import AuthenticationServices
import UIKit

// MARK: - Localization Helper
private func L(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

// MARK: - Login View

/// Native iOS login screen with clean, familiar design patterns
struct LoginView: View {

    // MARK: - Dependencies

    @State private var viewModel = AuthViewModel()

    // MARK: - State

    @State private var email = ""
    @State private var password = ""

    @State private var showingError = false
    @State private var errorMessage = ""
    @State private var hasAttemptedUITestAutoLogin = false

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
            if viewModel.isLoginLoading || viewModel.isOAuthLoading || showsDebugLoadingPreview {
                nativeLoadingOverlay
            }
        }
        .alert(L("auth.login.failed"), isPresented: $showingError) {
            Button(L("action.confirm")) {
                viewModel.clearErrors()
            }
        } message: {
            Text(errorMessage)
        }
        .onChange(of: viewModel.loginValidationError) { _, newError in
            if let error = newError {
                errorMessage = error
                showingError = true
            }
        }
        .onChange(of: viewModel.loginApiError) { _, newError in
            if let error = newError {
                errorMessage = error
                showingError = true
            }
        }
        .task {
            await performUITestAutoLoginIfNeeded()
        }
        .accessibilityIdentifier(AuthAccessibilityIdentifiers.loginScene)
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
                    Text(L("auth.login.title"))
                        .font(.title)
                        .fontWeight(.bold)

                    Text(L("auth.login.subtitle"))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }

            // Feature pills (native style)
            HStack(spacing: 8) {
                FeaturePill(icon: "arrow.triangle.2.circlepath", text: L("auth.login.feature.sync"))
                FeaturePill(icon: "link.badge.plus", text: L("auth.login.feature.pairing"))
            }

            Text(L("auth.login.helper"))
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

                TextField(L("auth.email.placeholder"), text: $email)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .focused($focusedField, equals: .email)
                    .submitLabel(.next)
                    .onSubmit {
                        focusedField = .password
                    }
                    .accessibilityIdentifier(AuthAccessibilityIdentifiers.loginEmailField)
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

                SecureField(L("auth.password.placeholder"), text: $password)
                    .textContentType(.password)
                    .focused($focusedField, equals: .password)
                    .submitLabel(.go)
                    .onSubmit {
                        focusedField = nil
                        Task { await handleLogin() }
                    }
                    .accessibilityIdentifier(AuthAccessibilityIdentifiers.loginPasswordField)
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
                Text(L("action.login"))
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
        .accessibilityIdentifier(AuthAccessibilityIdentifiers.loginSubmitButton)
    }

    // MARK: - OAuth Divider

    private var oauthDivider: some View {
        HStack {
            Capsule()
                .fill(Color(.separator))
                .frame(height: 1)

            Text(L("auth.or"))
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
                        Text(L("auth.signin.apple"))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Color.black)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
            }

            if WeChatConfiguration.isConfigured {
                Button {
                    Task { await handleWeChatSignIn() }
                } label: {
                    HStack {
                        Image(systemName: "message.fill")
                        Text(L("auth.signin.wechat"))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Color.green)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
            }
        }
    }

    // MARK: - Switch to Register

    private var switchToRegister: some View {
        HStack(spacing: 4) {
            Text(L("auth.no.account"))
                .foregroundStyle(.secondary)

            Button(L("action.signup")) {
                onSwitchToRegister()
            }
            .fontWeight(.semibold)
            .accessibilityIdentifier(AuthAccessibilityIdentifiers.loginSwitchToRegisterButton)
        }
        .font(.subheadline)
        .padding(.top, 8)
    }

    // MARK: - Loading Overlay

    private var nativeLoadingOverlay: some View {
        AuthLoadingOverlay(
            title: L("auth.login.loading.title"),
            subtitle: L("auth.login.loading.subtitle"),
            steps: [
                L("auth.login.loading.step.auth"),
                L("auth.login.loading.step.session"),
                L("auth.login.loading.step.workspace")
            ],
            accessibilityIdentifier: AuthAccessibilityIdentifiers.loginLoadingOverlay
        )
    }

    // MARK: - Computed Properties

    private var isSubmitDisabled: Bool {
        email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
        password.isEmpty ||
        viewModel.isLoginLoading ||
        showsDebugLoadingPreview
    }

    private var uiAutoLoginCredentials: (email: String, password: String)? {
        let info = ProcessInfo.processInfo
        guard info.arguments.contains("--ui-auto-login") else { return nil }

        let environment = info.environment
        guard let email = environment["TRIX_TEST_EMAIL"]?.trimmingCharacters(in: .whitespacesAndNewlines),
              let password = environment["TRIX_TEST_PASSWORD"],
              !email.isEmpty,
              !password.isEmpty else {
            return nil
        }

        return (email, password)
    }

    // MARK: - Actions

    @MainActor
    private func performUITestAutoLoginIfNeeded() async {
        guard !hasAttemptedUITestAutoLogin,
              let credentials = uiAutoLoginCredentials else {
            return
        }

        hasAttemptedUITestAutoLogin = true
        email = credentials.email
        password = credentials.password

        // Give SwiftUI one render pass so the auth scene is fully mounted before starting login.
        try? await Task.sleep(nanoseconds: 250_000_000)
        await handleLogin()
    }

    private func handleLogin() async {
        focusedField = nil
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)

        // Sync state to viewModel
        viewModel.loginEmail = email
        viewModel.loginPassword = password

        let result = await viewModel.login()

        switch result {
        case .success:
            break
        case .failure:
            // Error is handled via onChange
            break
        }
    }

    private func handleAppleSignIn() async {
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let window = windowScene.windows.first else {
            return
        }

        _ = await viewModel.signInWithApple(presentationAnchor: window)
    }

    private func handleWeChatSignIn() async {
        _ = await viewModel.signInWithWeChat()
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
        // Preview action - switch to register
    }
}
