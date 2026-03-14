//
//  RegisterView.swift
//  TRIX3DCompanion
//
//  Refined registration scene aligned with the updated login experience
//

import SwiftUI
import UIKit

private func loc(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

struct RegisterView: View {
    @StateObject private var authService = AuthService.shared

    @State private var username = ""
    @State private var email = ""
    @State private var password = ""
    @State private var confirmPassword = ""
    @State private var showingError = false
    @State private var errorMessage = ""
    @State private var showingSuccess = false

    @FocusState private var focusedField: Field?

    enum Field: Hashable {
        case username
        case email
        case password
        case confirmPassword
    }

    let onSwitchToLogin: () -> Void

    var body: some View {
        ZStack {
            AuthAtmosphereBackground()

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 22) {
                    headerView
                    registerForm
                    registerButton
                    helperFootnote
                    switchToLoginLink
                }
                .frame(maxWidth: 540, alignment: .leading)
                .padding(.horizontal, 24)
                .padding(.top, 28)
                .padding(.bottom, 40)
                .frame(maxWidth: .infinity)
            }
            .scrollDismissesKeyboard(.interactively)
            .accessibilityIdentifier(AuthAccessibilityIdentifiers.registerScene)

            if authService.isLoading {
                AuthLoadingOverlay(
                    title: loc("auth.register.creating"),
                    subtitle: loc("auth.register.success.message"),
                    steps: [
                        "auth.register.loading.step.account".localized,
                        "auth.register.loading.step.profile".localized,
                        "auth.register.loading.step.workspace".localized
                    ],
                    accessibilityIdentifier: AuthAccessibilityIdentifiers.registerLoadingOverlay
                )
            }
        }
        .alert(loc("error.register.failed"), isPresented: $showingError) {
            Button("OK", role: .cancel) {
                authService.clearError()
            }
        } message: {
            Text(errorMessage)
        }
        .alert(loc("auth.register.success"), isPresented: $showingSuccess) {
            Button("OK") {}
        } message: {
            Text(loc("auth.register.success.message"))
        }
        .onChange(of: authService.lastError) { newError in
            if let error = newError {
                errorMessage = error.localizedDescription
                showingError = true
            }
        }
    }

    private var headerView: some View {
        VStack(alignment: .leading, spacing: 18) {
            AuthHeroBadge(icon: "person.crop.circle.badge.plus", title: "auth.register.badge".localized)

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

                    Image(systemName: "person.badge.plus")
                        .font(.system(size: 28, weight: .bold))
                        .foregroundStyle(.white)
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text(loc("auth.register.title"))
                        .font(.system(size: 38, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                        .fixedSize(horizontal: false, vertical: true)

                    Text(loc("auth.register.subtitle"))
                        .font(.system(size: 16, weight: .medium, design: .rounded))
                        .foregroundStyle(.white.opacity(0.8))
                }
            }

            Text("auth.register.helper".localized)
                .font(.system(size: 15, weight: .medium, design: .rounded))
                .foregroundStyle(.white.opacity(0.84))
                .fixedSize(horizontal: false, vertical: true)

            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 10) {
                    AuthFeaturePill(icon: "checkmark.seal.fill", text: "auth.register.feature.identity".localized)
                    AuthFeaturePill(icon: "person.2.fill", text: "auth.register.feature.companion".localized)
                }
                AuthFeaturePill(icon: "book.closed.fill", text: "auth.register.feature.study".localized)
            }
        }
    }

    private var registerForm: some View {
        AuthFormPanel(
            title: "auth.register.form.title".localized,
            subtitle: "auth.register.form.subtitle".localized
        ) {
            VStack(spacing: 14) {
                authTextField(
                    icon: "person.fill",
                    placeholder: loc("auth.username.placeholder"),
                    text: $username,
                    autocapitalization: false,
                    textContentType: .username,
                    accessibilityIdentifier: AuthAccessibilityIdentifiers.registerUsernameField
                )
                .focused($focusedField, equals: .username)
                .onSubmit {
                    focusedField = .email
                }

                authTextField(
                    icon: "envelope.fill",
                    placeholder: loc("auth.email.placeholder"),
                    text: $email,
                    keyboardType: .emailAddress,
                    autocapitalization: false,
                    textContentType: .emailAddress,
                    accessibilityIdentifier: AuthAccessibilityIdentifiers.registerEmailField
                )
                .focused($focusedField, equals: .email)
                .onSubmit {
                    focusedField = .password
                }

                authSecureField(
                    icon: "lock.fill",
                    placeholder: loc("auth.password.placeholder"),
                    text: $password,
                    textContentType: .newPassword,
                    accessibilityIdentifier: AuthAccessibilityIdentifiers.registerPasswordField
                )
                .focused($focusedField, equals: .password)
                .onSubmit {
                    focusedField = .confirmPassword
                }

                authSecureField(
                    icon: "checkmark.shield.fill",
                    placeholder: loc("auth.confirm.password"),
                    text: $confirmPassword,
                    textContentType: .newPassword,
                    accessibilityIdentifier: AuthAccessibilityIdentifiers.registerConfirmPasswordField
                )
                .focused($focusedField, equals: .confirmPassword)
                .onSubmit {
                    focusedField = nil
                    Task {
                        await handleRegister()
                    }
                }
            }
        }
    }

    private var registerButton: some View {
        Button {
            Task {
                await handleRegister()
            }
        } label: {
            HStack(spacing: 10) {
                Image(systemName: "person.badge.plus.fill")
                    .font(.system(size: 18, weight: .bold))
                Text(loc("action.register"))
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
        .disabled(authService.isLoading)
        .opacity(authService.isLoading ? 0.7 : 1.0)
        .accessibilityIdentifier(AuthAccessibilityIdentifiers.registerSubmitButton)
    }

    private var helperFootnote: some View {
        Text("auth.register.security.note".localized)
            .font(.system(size: 12, weight: .medium, design: .rounded))
            .foregroundStyle(.white.opacity(0.68))
            .frame(maxWidth: .infinity, alignment: .center)
    }

    private var switchToLoginLink: some View {
        Button {
            onSwitchToLogin()
        } label: {
            HStack(spacing: 4) {
                Text(loc("auth.has.account"))
                    .font(.system(size: 15, weight: .medium, design: .rounded))
                    .foregroundStyle(.white.opacity(0.86))

                Text(loc("action.login"))
                    .font(.system(size: 15, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .underline()
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(AuthAccessibilityIdentifiers.registerSwitchToLoginButton)
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
                .foregroundStyle(AuthFormPalette.iconTint)
                .frame(width: 22)

            Group {
                if autocapitalization {
                    TextField(
                        "",
                        text: text,
                        prompt: Text(placeholder).foregroundColor(AuthFormPalette.placeholderText)
                    )
                        .textInputAutocapitalization(.sentences)
                } else {
                    TextField(
                        "",
                        text: text,
                        prompt: Text(placeholder).foregroundColor(AuthFormPalette.placeholderText)
                    )
                        .textInputAutocapitalization(.never)
                }
            }
            .font(.system(size: 16, weight: .medium, design: .rounded))
            .foregroundStyle(AuthFormPalette.primaryText)
            .keyboardType(keyboardType)
            .textContentType(textContentType)
            .tint(Color.brandPurple)
            .autocorrectionDisabled()
            .accessibilityIdentifier(accessibilityIdentifier)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 16)
        .background(AuthFormPalette.fieldBackground)
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(AuthFormPalette.fieldBorder, lineWidth: 1)
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
                .foregroundStyle(AuthFormPalette.iconTint)
                .frame(width: 22)

            SecureField(
                "",
                text: text,
                prompt: Text(placeholder).foregroundColor(AuthFormPalette.placeholderText)
            )
                .font(.system(size: 16, weight: .medium, design: .rounded))
                .foregroundStyle(AuthFormPalette.primaryText)
                .textContentType(textContentType)
                .tint(Color.brandPurple)
                .accessibilityIdentifier(accessibilityIdentifier)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 16)
        .background(AuthFormPalette.fieldBackground)
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(AuthFormPalette.fieldBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private func handleRegister() async {
        dismissInputFocus()

        guard !username.isEmpty else {
            errorMessage = loc("auth.username.required")
            showingError = true
            return
        }

        guard username.count >= 3 else {
            errorMessage = loc("auth.username.min.length")
            showingError = true
            return
        }

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

        guard password.count >= 6 else {
            errorMessage = loc("auth.password.min.length")
            showingError = true
            return
        }

        guard !confirmPassword.isEmpty else {
            errorMessage = loc("auth.confirm.password.required")
            showingError = true
            return
        }

        guard password == confirmPassword else {
            errorMessage = loc("auth.password.mismatch")
            showingError = true
            return
        }

        let result = await authService.register(
            username: username,
            email: email,
            password: password
        )

        switch result {
        case .success:
            showingSuccess = true
        case .failure(let error):
            errorMessage = error.localizedDescription
            showingError = true
        }
    }

    private func dismissInputFocus() {
        focusedField = nil
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
    }
}

#Preview {
    RegisterView {
        SecureLogger.shared.debug("Switch to login")
    }
}
