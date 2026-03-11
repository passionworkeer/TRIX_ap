//
//  LoginView.swift
//  TRIX3DCompanion
//
//  Refined login scene with branded hero, glass surfaces, and live loading overlay
//

import SwiftUI
import AuthenticationServices

private func loc(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

struct LoginView: View {
    @StateObject private var authService = AuthService.shared
    @StateObject private var oauthManager = OAuthManager.shared

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

    let onSwitchToRegister: () -> Void

    var body: some View {
        ZStack {
            AuthAtmosphereBackground()

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 22) {
                    headerView
                    loginForm
                    loginButton
                    helperFootnote
                    oauthDividerView
                    oauthSignInView
                    switchToRegisterLink
                }
                .frame(maxWidth: 540, alignment: .leading)
                .padding(.horizontal, 24)
                .padding(.top, 34)
                .padding(.bottom, 40)
                .frame(maxWidth: .infinity)
            }
            .scrollDismissesKeyboard(.interactively)
            .accessibilityIdentifier(AuthAccessibilityIdentifiers.loginScene)

            if authService.isLoading || showsDebugLoadingPreview {
                AuthLoadingOverlay(
                    title: loc("auth.login.loading.title"),
                    subtitle: loc("auth.login.loading.subtitle"),
                    steps: [
                        "auth.login.loading.step.auth".localized,
                        "auth.login.loading.step.session".localized,
                        "auth.login.loading.step.workspace".localized
                    ],
                    accessibilityIdentifier: AuthAccessibilityIdentifiers.loginLoadingOverlay
                )
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

    private var headerView: some View {
        VStack(alignment: .leading, spacing: 18) {
            AuthHeroBadge(icon: "sparkles", title: "auth.login.badge".localized)

            HStack(alignment: .center, spacing: 16) {
                ZStack {
                    Circle()
                        .fill(Color.white.opacity(0.12))
                        .frame(width: 78, height: 78)
                        .overlay(
                            Circle()
                                .stroke(Color.white.opacity(0.18), lineWidth: 1)
                        )

                    RoundedRectangle(cornerRadius: 24, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [Color.white.opacity(0.22), Color.white.opacity(0.08)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 58, height: 58)

                    Image(systemName: "cube.transparent")
                        .font(.system(size: 30, weight: .bold))
                        .foregroundStyle(.white)
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text(loc("auth.login.title"))
                        .font(.system(size: 38, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                        .fixedSize(horizontal: false, vertical: true)

                    Text(loc("auth.login.subtitle"))
                        .font(.system(size: 16, weight: .medium, design: .rounded))
                        .foregroundStyle(.white.opacity(0.8))
                }
            }

            Text("auth.login.helper".localized)
                .font(.system(size: 15, weight: .medium, design: .rounded))
                .foregroundStyle(.white.opacity(0.84))
                .fixedSize(horizontal: false, vertical: true)

            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 10) {
                    AuthFeaturePill(icon: "arrow.triangle.2.circlepath", text: "auth.login.feature.sync".localized)
                    AuthFeaturePill(icon: "link.badge.plus", text: "auth.login.feature.pairing".localized)
                }
                AuthFeaturePill(icon: "bubble.left.and.bubble.right.fill", text: "auth.login.feature.chat".localized)
            }
        }
    }

    private var loginForm: some View {
        AuthFormPanel(
            title: "auth.login.form.title".localized,
            subtitle: "auth.login.form.subtitle".localized
        ) {
            VStack(spacing: 14) {
                authTextField(
                    icon: "envelope.fill",
                    placeholder: loc("auth.email.placeholder"),
                    text: $email,
                    keyboardType: .emailAddress,
                    autocapitalization: false,
                    textContentType: .emailAddress,
                    accessibilityIdentifier: AuthAccessibilityIdentifiers.loginEmailField
                )
                .focused($focusedField, equals: .email)
                .onSubmit {
                    focusedField = .password
                }

                authSecureField(
                    icon: "lock.fill",
                    placeholder: loc("auth.password.placeholder"),
                    text: $password,
                    textContentType: .password,
                    accessibilityIdentifier: AuthAccessibilityIdentifiers.loginPasswordField
                )
                .focused($focusedField, equals: .password)
                .onSubmit {
                    focusedField = nil
                    Task {
                        await handleLogin()
                    }
                }
            }
        }
    }

    private var loginButton: some View {
        Button {
            Task {
                await handleLogin()
            }
        } label: {
            HStack(spacing: 10) {
                Image(systemName: "arrow.right.circle.fill")
                    .font(.system(size: 18, weight: .bold))
                Text(loc("action.login"))
                    .font(.system(size: 18, weight: .semibold, design: .rounded))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 58)
            .background(
                LinearGradient(
                    colors: [Color.brandPurple, Color.brandPink],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(Color.white.opacity(0.14), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .shadow(color: Color.brandPurple.opacity(0.34), radius: 16, x: 0, y: 10)
        }
        .buttonStyle(.plain)
        .disabled(isSubmitDisabled)
        .opacity(isSubmitDisabled ? 0.7 : 1)
        .accessibilityIdentifier(AuthAccessibilityIdentifiers.loginSubmitButton)
    }

    private var helperFootnote: some View {
        Text("auth.login.security.note".localized)
            .font(.system(size: 12, weight: .medium, design: .rounded))
            .foregroundStyle(.white.opacity(0.68))
            .frame(maxWidth: .infinity, alignment: .center)
    }

    private var switchToRegisterLink: some View {
        Button {
            onSwitchToRegister()
        } label: {
            HStack(spacing: 4) {
                Text(loc("auth.no.account"))
                    .font(.system(size: 15, weight: .medium, design: .rounded))
                    .foregroundStyle(.white.opacity(0.86))

                Text(loc("action.signup"))
                    .font(.system(size: 15, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .underline()
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
    }

    private var oauthDividerView: some View {
        HStack(spacing: 16) {
            Capsule()
                .fill(Color.white.opacity(0.18))
                .frame(height: 1)

            Text(loc("auth.or"))
                .font(.system(size: 13, weight: .semibold, design: .rounded))
                .foregroundStyle(.white.opacity(0.62))

            Capsule()
                .fill(Color.white.opacity(0.18))
                .frame(height: 1)
        }
        .padding(.top, 4)
    }

    private var oauthSignInView: some View {
        VStack(spacing: 12) {
            if oauthManager.isProviderAvailable(.apple) {
                appleSignInButton
            }

            if oauthManager.isProviderAvailable(.wechat) {
                weChatSignInButton
            }
        }
    }

    private var appleSignInButton: some View {
        Button {
            Task {
                await handleAppleSignIn()
            }
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "applelogo")
                    .font(.system(size: 20, weight: .semibold))
                Text(loc("auth.signin.apple"))
                    .font(.system(size: 16, weight: .semibold, design: .rounded))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 54)
            .background(Color.black.opacity(0.88))
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(Color.white.opacity(0.1), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .shadow(color: .black.opacity(0.22), radius: 10, x: 0, y: 6)
        }
        .buttonStyle(.plain)
        .disabled(isOAuthLoading || authService.isLoading)
        .opacity(isOAuthLoading || authService.isLoading ? 0.7 : 1.0)
    }

    private var weChatSignInButton: some View {
        Button {
            Task {
                await handleWeChatSignIn()
            }
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "message.fill")
                    .font(.system(size: 20, weight: .semibold))
                Text(loc("auth.signin.wechat"))
                    .font(.system(size: 16, weight: .semibold, design: .rounded))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 54)
            .background(Color.green.opacity(0.86))
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(Color.white.opacity(0.1), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .shadow(color: .green.opacity(0.24), radius: 10, x: 0, y: 6)
        }
        .buttonStyle(.plain)
        .disabled(isOAuthLoading || authService.isLoading)
        .opacity(isOAuthLoading || authService.isLoading ? 0.7 : 1.0)
    }

    private var isSubmitDisabled: Bool {
        authService.isLoading || showsDebugLoadingPreview
    }

    private func authTextField(
        icon: String,
        placeholder: String,
        text: Binding<String>,
        keyboardType: UIKeyboardType = .default,
        autocapitalization: Bool = true,
        textContentType: UITextContentType? = nil,
        accessibilityIdentifier: String
    ) -> some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Color.brandPurple.opacity(0.82))
                .frame(width: 22)

            Group {
                if autocapitalization {
                    TextField(placeholder, text: text)
                        .textInputAutocapitalization(.sentences)
                } else {
                    TextField(placeholder, text: text)
                        .textInputAutocapitalization(.never)
                }
            }
            .font(.system(size: 16, weight: .medium, design: .rounded))
            .foregroundStyle(Color.textPrimary)
            .keyboardType(keyboardType)
            .textContentType(textContentType)
            .autocorrectionDisabled()
            .accessibilityIdentifier(accessibilityIdentifier)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 16)
        .background(Color.white.opacity(0.84))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(Color.white.opacity(0.96), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private func authSecureField(
        icon: String,
        placeholder: String,
        text: Binding<String>,
        textContentType: UITextContentType? = nil,
        accessibilityIdentifier: String
    ) -> some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Color.brandPurple.opacity(0.82))
                .frame(width: 22)

            SecureField(placeholder, text: text)
                .font(.system(size: 16, weight: .medium, design: .rounded))
                .foregroundStyle(Color.textPrimary)
                .textContentType(textContentType)
                .accessibilityIdentifier(accessibilityIdentifier)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 16)
        .background(Color.white.opacity(0.84))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(Color.white.opacity(0.96), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private func handleLogin() async {
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

        let result = await authService.login(email: email, password: password)

        switch result {
        case .success:
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
            break
        case .failure(let error):
            errorMessage = error.localizedDescription
            showingError = true
        }
    }
}

#Preview {
    LoginView {
        SecureLogger.shared.debug("Switch to register")
    }
}
