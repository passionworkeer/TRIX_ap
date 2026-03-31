//
//  RegisterView.swift
//  TRIX3DCompanion
//
//  Registration screen with native iOS design
//

import SwiftUI
import UIKit

// MARK: - Localization Helper
private func L(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

// MARK: - Register View

/// Native iOS registration screen with clean, familiar design patterns
struct RegisterView: View {

    // MARK: - Dependencies

    @State private var viewModel = AuthViewModel()

    // MARK: - State

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

    // MARK: - Callbacks

    var onSwitchToLogin: () -> Void

    // MARK: - Body

    var body: some View {
        ZStack {
            // Native iOS background
            nativeBackground

            VStack(spacing: 0) {
                // Header
                headerSection
                    .padding(.top, 60)
                    .padding(.horizontal, 24)

                // Main content
                ScrollView(showsIndicators: false) {
                    VStack(spacing: 20) {
                        registerForm
                        registerButton
                        switchToLogin
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 24)
                    .padding(.bottom, 40)
                }
            }

            // Loading overlay
            if viewModel.isRegisterLoading {
                nativeLoadingOverlay
            }
        }
        .alert(L("auth.register.failed"), isPresented: $showingError) {
            Button(L("action.confirm")) {
                viewModel.clearErrors()
            }
        } message: {
            Text(errorMessage)
        }
        .alert(L("auth.register.success"), isPresented: $showingSuccess) {
            Button(L("action.confirm")) {
                viewModel.clearRegisterState()
                onSwitchToLogin()
            }
        } message: {
            Text(viewModel.registerSuccessMessage ?? L("auth.register.success.message"))
        }
        .onChange(of: viewModel.registerValidationError) { _, newError in
            if let error = newError {
                errorMessage = error
                showingError = true
            }
        }
        .onChange(of: viewModel.registerApiError) { _, newError in
            if let error = newError {
                errorMessage = error
                showingError = true
            }
        }
        .onChange(of: viewModel.isRegisterSuccess) { _, success in
            if success {
                showingSuccess = true
            }
        }
        .accessibilityIdentifier(AuthAccessibilityIdentifiers.registerScene)
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

                    Image(systemName: "person.badge.plus")
                        .font(.system(size: 32, weight: .semibold))
                        .foregroundStyle(.purple)
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text(L("auth.register.title"))
                        .font(.title)
                        .fontWeight(.bold)

                    Text(L("auth.register.subtitle"))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }

            // Feature pills (native style)
            HStack(spacing: 8) {
                FeaturePill(icon: "checkmark.seal.fill", text: L("auth.register.feature.identity"))
                FeaturePill(icon: "person.2.fill", text: L("auth.register.feature.companion"))
            }

            Text(L("auth.register.helper"))
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: - Register Form

    private var registerForm: some View {
        VStack(spacing: 16) {
            // Username field - native iOS style
            formTextField(
                icon: "person.fill",
                placeholder: L("auth.username.placeholder"),
                text: $username,
                textContentType: .username
            )
            .focused($focusedField, equals: .username)
            .onSubmit {
                focusedField = .email
            }

            // Email field - native iOS style
            formTextField(
                icon: "envelope.fill",
                placeholder: L("auth.email.placeholder"),
                text: $email,
                keyboardType: .emailAddress,
                textContentType: .emailAddress
            )
            .focused($focusedField, equals: .email)
            .onSubmit {
                focusedField = .password
            }

            // Password field - native iOS style
            formSecureField(
                icon: "lock.fill",
                placeholder: L("auth.password.placeholder"),
                text: $password
            )
            .focused($focusedField, equals: .password)
            .onSubmit {
                focusedField = .confirmPassword
            }

            // Confirm Password field - native iOS style
            formSecureField(
                icon: "checkmark.shield.fill",
                placeholder: L("auth.confirm.password"),
                text: $confirmPassword
            )
            .focused($focusedField, equals: .confirmPassword)
            .onSubmit {
                focusedField = nil
                Task { await handleRegister() }
            }
        }
        .padding(20)
        .background(Color(.systemBackground).opacity(0.8))
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .shadow(color: .black.opacity(0.05), radius: 10, x: 0, y: 4)
    }

    private func formTextField(
        icon: String,
        placeholder: String,
        text: Binding<String>,
        keyboardType: UIKeyboardType = .default,
        textContentType: UITextContentType? = nil
    ) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(.secondary)
                .frame(width: 20)

            TextField(placeholder, text: text)
                .textContentType(textContentType)
                .keyboardType(keyboardType)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .accessibilityIdentifier(textFieldAccessibilityIdentifier(for: placeholder))
        }
        .padding(16)
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(focusedField == getField(for: placeholder) ? Color.purple : Color.clear, lineWidth: 2)
        )
    }

    private func getField(for placeholder: String) -> Field? {
        switch placeholder {
        case L("auth.username.placeholder"): return .username
        case L("auth.email.placeholder"): return .email
        case L("auth.password.placeholder"): return .password
        case L("auth.confirm.password"): return .confirmPassword
        default: return nil
        }
    }

    private func formSecureField(
        icon: String,
        placeholder: String,
        text: Binding<String>
    ) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(.secondary)
                .frame(width: 20)

            SecureField(placeholder, text: text)
                .textContentType(.newPassword)
                .accessibilityIdentifier(secureFieldAccessibilityIdentifier(for: placeholder))
        }
        .padding(16)
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(focusedField == getField(for: placeholder) ? Color.purple : Color.clear, lineWidth: 2)
        )
    }

    // MARK: - Register Button

    private var registerButton: some View {
        Button {
            Task { await handleRegister() }
        } label: {
            HStack {
                Image(systemName: "person.badge.plus.fill")
                Text(L("action.register"))
                    .fontWeight(.semibold)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(Color.purple)
            .foregroundStyle(.white)
            .clipShape(RoundedRectangle(cornerRadius: 14))
        }
        .disabled(isSubmitDisabled)
        .opacity(isSubmitDisabled ? 0.6 : 1)
        .accessibilityIdentifier(AuthAccessibilityIdentifiers.registerSubmitButton)
    }

    // MARK: - Switch to Login

    private var switchToLogin: some View {
        HStack(spacing: 4) {
            Text(L("auth.has.account"))
                .foregroundStyle(.secondary)

            Button(L("action.login")) {
                onSwitchToLogin()
            }
            .fontWeight(.semibold)
            .accessibilityIdentifier(AuthAccessibilityIdentifiers.registerSwitchToLoginButton)
        }
        .font(.subheadline)
        .padding(.top, 8)
    }

    private func textFieldAccessibilityIdentifier(for placeholder: String) -> String {
        switch placeholder {
        case L("auth.username.placeholder"):
            return AuthAccessibilityIdentifiers.registerUsernameField
        case L("auth.email.placeholder"):
            return AuthAccessibilityIdentifiers.registerEmailField
        default:
            return ""
        }
    }

    private func secureFieldAccessibilityIdentifier(for placeholder: String) -> String {
        switch placeholder {
        case L("auth.password.placeholder"):
            return AuthAccessibilityIdentifiers.registerPasswordField
        case L("auth.confirm.password"):
            return AuthAccessibilityIdentifiers.registerConfirmPasswordField
        default:
            return ""
        }
    }

    // MARK: - Loading Overlay

    private var nativeLoadingOverlay: some View {
        AuthLoadingOverlay(
            title: L("auth.register.loading.title"),
            subtitle: L("auth.register.loading.subtitle"),
            steps: [
                L("auth.register.loading.step.account"),
                L("auth.register.loading.step.profile"),
                L("auth.register.loading.step.workspace")
            ],
            accessibilityIdentifier: AuthAccessibilityIdentifiers.registerLoadingOverlay
        )
    }

    // MARK: - Computed Properties

    private var isSubmitDisabled: Bool {
        username.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
        email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
        password.isEmpty ||
        confirmPassword.isEmpty ||
        viewModel.isRegisterLoading
    }

    // MARK: - Actions

    private func handleRegister() async {
        focusedField = nil
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)

        // Sync state to viewModel
        viewModel.registerUsername = username
        viewModel.registerEmail = email
        viewModel.registerPassword = password
        viewModel.registerConfirmPassword = confirmPassword

        let result = await viewModel.register()

        switch result {
        case .success:
            // Success is handled via onChange
            break
        case .failure:
            // Error is handled via onChange
            break
        }
    }
}

// MARK: - Preview

#Preview {
    RegisterView {
        // Preview action - switch to login
    }
}
