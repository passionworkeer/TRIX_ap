//
//  RegisterView.swift
//  TRIX3DCompanion
//
//  Registration view with purple-pink gradient and glassmorphism design
//

import SwiftUI

// Helper function for localization
private func loc(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

struct RegisterView: View {
    // MARK: - Environment

    @Environment(\.dismiss) private var dismiss

    // MARK: - Observed Objects

    @StateObject private var authService = AuthService.shared

    // MARK: - State

    @State private var username = ""
    @State private var email = ""
    @State private var password = ""
    @State private var confirmPassword = ""
    @State private var showingError = false
    @State private var errorMessage = ""
    @State private var showingSuccess = false

    // MARK: - Focus State

    @FocusState private var focusedField: Field?

    enum Field: Hashable {
        case username
        case email
        case password
        case confirmPassword
    }

    // MARK: - Callbacks

    let onSwitchToLogin: () -> Void

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

                    // Registration form
                    registerForm

                    // Register button
                    registerButton

                    // Switch to login
                    switchToLoginLink
                }
                .padding(.horizontal, 24)
                .padding(.top, 40)
                .padding(.bottom, 40)
            }
            .scrollDismissesKeyboard(.interactively)

            // Loading overlay
            if authService.isLoading {
                loadingOverlay
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
            Button("OK") {
                // Registration successful - will auto-login
            }
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
            Image(systemName: "person.badge.plus")
                .font(.system(size: 60))
                .foregroundStyle(.white)
                .shadow(color: .black.opacity(0.3), radius: 10, x: 0, y: 5)

            // Title
            Text(loc("auth.register.title"))
                .font(.system(size: 32, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .shadow(color: .black.opacity(0.2), radius: 5)

            // Subtitle
            Text(loc("auth.register.subtitle"))
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(.white.opacity(0.9))
        }
        .padding(.bottom, 20)
    }

    private var registerForm: some View {
        VStack(spacing: 16) {
            // Username field
            authTextField(
                icon: "person.fill",
                placeholder: loc("auth.username.placeholder"),
                text: $username,
                autocapitalization: false
            )
            .focused($focusedField, equals: .username)
            .onSubmit {
                focusedField = .email
            }

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
                focusedField = .confirmPassword
            }

            // Confirm password field
            authSecureField(
                icon: "lock.fill",
                placeholder: loc("auth.confirm.password"),
                text: $confirmPassword
            )
            .focused($focusedField, equals: .confirmPassword)
            .onSubmit {
                focusedField = nil
                Task {
                    await handleRegister()
                }
            }
        }
        .padding(24)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.1), radius: 20, x: 0, y: 10)
    }

    private var registerButton: some View {
        Button {
            Task {
                await handleRegister()
            }
        } label: {
            Text(loc("action.register"))
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

    private var switchToLoginLink: some View {
        Button {
            onSwitchToLogin()
        } label: {
            HStack(spacing: 4) {
                Text(loc("auth.has.account"))
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(.white.opacity(0.8))

                Text(loc("action.login"))
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(.white)
                    .underline()
            }
        }
    }

    private var loadingOverlay: some View {
        ZStack {
            Color.black.opacity(0.3)
                .ignoresSafeArea()

            VStack(spacing: 16) {
                ProgressView(value: 0)
                    .tint(.white)
                    .scaleEffect(1.5)

                Text(loc("auth.register.creating"))
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

    private func handleRegister() async {
        // Validate inputs
        guard !username.isEmpty else {
            errorMessage = loc("auth.username.placeholder") + " is required"
            showingError = true
            return
        }

        guard username.count >= 3 else {
            errorMessage = loc("auth.username.min.length")
            showingError = true
            return
        }

        guard !email.isEmpty else {
            errorMessage = loc("auth.email.placeholder") + " is required"
            showingError = true
            return
        }

        guard !password.isEmpty else {
            errorMessage = loc("auth.password.placeholder") + " is required"
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

        // Attempt registration
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
}

// MARK: - Preview

#Preview {
    RegisterView {
        SecureLogger.shared.debug("Switch to login")
    }
}
