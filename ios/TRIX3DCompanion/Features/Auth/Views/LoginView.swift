//
//  LoginView.swift
//  TRIX3DCompanion
//
//  Login view with purple-pink gradient and glassmorphism design
//

import SwiftUI
import AuthenticationServices

// Helper function for localization
private func loc(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

struct LoginView: View {
    // MARK: - Environment

    @Environment(\.dismiss) private var dismiss

    // MARK: - Observed Objects

    @StateObject private var authService = AuthService.shared
    @StateObject private var oauthManager = OAuthManager.shared

    // MARK: - State

    @State private var email = ""
    @State private var password = ""
    @State private var showingError = false
    @State private var errorMessage = ""
    @State private var isOAuthLoading = false

    // MARK: - Focus State

    @FocusState private var focusedField: Field?

    enum Field: Hashable {
        case email
        case password
    }

    // MARK: - Callbacks

    let onSwitchToRegister: () -> Void

    // MARK: - Body

    var body: some View {
        ZStack {
            // Background gradient
            backgroundGradient

            // Content
            ScrollView {
                VStack(spacing: 24) {
                    // Logo and title
                    headerView

                    // Login form
                    loginForm

                    // Login button
                    loginButton

                    // OAuth divider
                    oauthDividerView

                    // OAuth sign-in options
                    oauthSignInView

                    // Switch to register
                    switchToRegisterLink
                }
                .padding(.horizontal, 24)
                .padding(.top, 60)
                .padding(.bottom, 40)
            }
            .scrollDismissesKeyboard(.interactively)

            // Loading overlay
            if authService.isLoading {
                loadingOverlay
            }
        }
        .alert(loc("error.login.failed"), isPresented: $showingError) {
            Button("OK", role: .cancel) {
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

    // MARK: - View Components

    private var backgroundGradient: some View {
        LinearGradient(
            colors: [
                Color.purple.opacity(0.8),
                Color.pink.opacity(0.7)
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .ignoresSafeArea()
    }

    private var headerView: some View {
        VStack(spacing: 16) {
            // App icon
            Image(systemName: "cube.transparent")
                .font(.system(size: 60))
                .foregroundStyle(.white)
                .shadow(color: .black.opacity(0.3), radius: 10, x: 0, y: 5)
                .accessibilityLabel("App logo")

            // Title
            Text(loc("auth.login.title"))
                .font(.system(size: 32, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .shadow(color: .black.opacity(0.2), radius: 5)

            // Subtitle
            Text(loc("auth.login.subtitle"))
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(.white.opacity(0.9))
        }
        .padding(.bottom, 20)
    }

    private var loginForm: some View {
        VStack(spacing: 16) {
            // Email field
            authTextField(
                icon: "envelope.fill",
                placeholder: loc("auth.email.placeholder"),
                text: $email,
                keyboardType: .emailAddress,
                autocapitalization: false
            )
            .focused($focusedField, equals: .email)
            .onSubmit {
                focusedField = .password
            }

            // Password field
            authSecureField(
                icon: "lock.fill",
                placeholder: loc("auth.password.placeholder"),
                text: $password
            )
            .focused($focusedField, equals: .password)
            .onSubmit {
                focusedField = nil
                Task {
                    await handleLogin()
                }
            }
        }
        .padding(24)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.1), radius: 20, x: 0, y: 10)
    }

    private var loginButton: some View {
        Button {
            Task {
                await handleLogin()
            }
        } label: {
            Text(loc("action.login"))
                .font(.system(size: 18, weight: .semibold, design: .rounded))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .frame(height: 56)
                .background(
                    LinearGradient(
                        colors: [.purple, .pink],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .shadow(color: .purple.opacity(0.4), radius: 15, x: 0, y: 8)
        }
        .disabled(authService.isLoading)
        .opacity(authService.isLoading ? 0.6 : 1.0)
    }

    private var switchToRegisterLink: some View {
        Button {
            onSwitchToRegister()
        } label: {
            HStack(spacing: 4) {
                Text(loc("auth.no.account"))
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(.white.opacity(0.8))

                Text(loc("action.signup"))
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(.white)
                    .underline()
            }
        }
    }

    private var oauthDividerView: some View {
        HStack(spacing: 16) {
            VStack { Divider().background(Color.white.opacity(0.3)) }

            Text(loc("auth.or"))
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(.white.opacity(0.6))

            VStack { Divider().background(Color.white.opacity(0.3)) }
        }
        .padding(.horizontal, 8)
    }

    private var oauthSignInView: some View {
        VStack(spacing: 12) {
            // Apple Sign In
            if oauthManager.isProviderAvailable(.apple) {
                appleSignInButton
            }

            // WeChat Sign In
            if oauthManager.isProviderAvailable(.wechat) {
                weChatSignInButton
            }
        }
        .padding(.vertical, 8)
    }

    private var appleSignInButton: some View {
        Button {
            Task {
                await handleAppleSignIn()
            }
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "applelogo")
                    .font(.system(size: 20))
                    .foregroundStyle(.white)

                Text(loc("auth.signin.apple"))
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.white)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 50)
            .background(Color.black)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .shadow(color: .black.opacity(0.2), radius: 8, x: 0, y: 4)
            .accessibilityLabel("Sign in with Apple")
        }
        .disabled(isOAuthLoading || authService.isLoading)
        .opacity(isOAuthLoading || authService.isLoading ? 0.6 : 1.0)
    }

    private var weChatSignInButton: some View {
        Button {
            Task {
                await handleWeChatSignIn()
            }
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "message.fill")
                    .font(.system(size: 20))
                    .foregroundStyle(.white)

                Text(loc("auth.signin.wechat"))
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.white)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 50)
            .background(Color.green)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .shadow(color: .green.opacity(0.3), radius: 8, x: 0, y: 4)
        }
        .accessibilityLabel("Sign in with WeChat")
        .disabled(isOAuthLoading || authService.isLoading)
        .opacity(isOAuthLoading || authService.isLoading ? 0.6 : 1.0)
    }

    private var loadingOverlay: some View {
        ZStack {
            Color.black.opacity(0.3)
                .ignoresSafeArea()

            VStack(spacing: 16) {
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                    .scaleEffect(1.5)

                Text(loc("loading"))
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(.white)
            }
            .padding(32)
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 16))
        }
    }

    // MARK: - Helper Views

    private func authTextField(
        icon: String,
        placeholder: String,
        text: Binding<String>,
        keyboardType: UIKeyboardType = .default,
        autocapitalization: Bool = true
    ) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 18))
                .foregroundStyle(.white.opacity(0.7))
                .frame(width: 24)

            if autocapitalization {
                TextField(placeholder, text: text)
                    .font(.system(size: 16))
                    .foregroundStyle(.white)
                    .keyboardType(keyboardType)
                    .textInputAutocapitalization(.sentences)
                    .autocorrectionDisabled()
            } else {
                TextField(placeholder, text: text)
                    .font(.system(size: 16))
                    .foregroundStyle(.white)
                    .keyboardType(keyboardType)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
            }
        }
        .padding(.vertical, 12)
        .padding(.horizontal, 16)
        .background(Color.white.opacity(0.15))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func authSecureField(
        icon: String,
        placeholder: String,
        text: Binding<String>
    ) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 18))
                .foregroundStyle(.white.opacity(0.7))
                .frame(width: 24)

            SecureField(placeholder, text: text)
                .font(.system(size: 16))
                .foregroundStyle(.white)
        }
        .padding(.vertical, 12)
        .padding(.horizontal, 16)
        .background(Color.white.opacity(0.15))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    // MARK: - Actions

    private func handleLogin() async {
        // Validate inputs
        guard !email.isEmpty else {
            errorMessage = loc("auth.email.required")
            showingError = true
            return
        }

        guard !password.isEmpty else {
            errorMessage = loc("auth.password.required")
            showingError = true
            return
        }

        // Attempt login
        let result = await authService.login(email: email, password: password)

        switch result {
        case .success:
            // Dismiss will be handled by parent view
            break

        case .failure(let error):
            errorMessage = error.localizedDescription
            showingError = true
        }
    }

    private func handleAppleSignIn() async {
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let window = windowScene.windows.first else {
            errorMessage = "Unable to present Apple Sign In"
            showingError = true
            return
        }

        isOAuthLoading = true

        let result = await oauthManager.signIn(with: .apple, presentationAnchor: window)

        isOAuthLoading = false

        switch result {
        case .success:
            // Dismiss will be handled by parent view
            break

        case .failure(let error):
            errorMessage = error.localizedDescription
            showingError = true
        }
    }

    private func handleWeChatSignIn() async {
        isOAuthLoading = true

        let result = await oauthManager.signIn(with: .wechat, presentationAnchor: nil)

        isOAuthLoading = false

        switch result {
        case .success:
            // Dismiss will be handled by parent view
            break

        case .failure(let error):
            errorMessage = error.localizedDescription
            showingError = true
        }
    }
}

// MARK: - Preview

#Preview {
    LoginView {
        SecureLogger.shared.debug("Switch to register")
    }
}
