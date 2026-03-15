//
//  RegisterView.swift
//  TRIX3DCompanion
//
//  Registration screen with native iOS design
//

import SwiftUI
import UIKit

// MARK: - Register View

/// Native iOS registration screen with clean, familiar design patterns
struct RegisterView: View {

    // MARK: - State

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
            if authService.isLoading {
                nativeLoadingOverlay
            }
        }
        .alert("注册失败", isPresented: $showingError) {
            Button("确定", role: .cancel) {
                authService.clearError()
            }
        } message: {
            Text(errorMessage)
        }
        .alert("注册成功", isPresented: $showingSuccess) {
            Button("确定") {}
        } message: {
            Text("您的账户已创建成功")
        }
        .onChange(of: authService.lastError) { newError in
            if let error = newError {
                errorMessage = error.localizedDescription
                showingError = true
            }
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

                    Image(systemName: "person.badge.plus")
                        .font(.system(size: 32, weight: .semibold))
                        .foregroundStyle(.purple)
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text("创建账户")
                        .font(.title)
                        .fontWeight(.bold)

                    Text("注册一个新账户")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }

            // Feature pills (native style)
            HStack(spacing: 8) {
                FeaturePill(icon: "checkmark.seal.fill", text: "身份验证")
                FeaturePill(icon: "person.2.fill", text: "好友配对")
            }

            Text("注册后即可与 TRIX Bot 配对，开始智能学习之旅")
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
                placeholder: "用户名",
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
                placeholder: "邮箱",
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
                placeholder: "密码",
                text: $password
            )
            .focused($focusedField, equals: .password)
            .onSubmit {
                focusedField = .confirmPassword
            }

            // Confirm Password field - native iOS style
            formSecureField(
                icon: "checkmark.shield.fill",
                placeholder: "确认密码",
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
        case "用户名": return .username
        case "邮箱": return .email
        case "密码": return .password
        case "确认密码": return .confirmPassword
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
                Text("注册")
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
    }

    // MARK: - Switch to Login

    private var switchToLogin: some View {
        HStack(spacing: 4) {
            Text("已有账户?")
                .foregroundStyle(.secondary)

            Button("立即登录") {
                onSwitchToLogin()
            }
            .fontWeight(.semibold)
        }
        .font(.subheadline)
        .padding(.top, 8)
    }

    // MARK: - Loading Overlay

    private var nativeLoadingOverlay: some View {
        ZStack {
            Color(.systemBackground)
                .opacity(0.9)
                .ignoresSafeArea()

            VStack(spacing: 20) {
                ProgressView()
                    .scaleEffect(1.5)
                    .tint(.purple)

                Text("正在注册...")
                    .font(.headline)

                Text("请稍候")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .padding(40)
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 20))
        }
    }

    // MARK: - Computed Properties

    private var isSubmitDisabled: Bool {
        username.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
        email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
        password.isEmpty ||
        confirmPassword.isEmpty ||
        authService.isLoading
    }

    // MARK: - Actions

    private func handleRegister() async {
        focusedField = nil
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)

        let normalizedUsername = username.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalizedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let normalizedPassword = password.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalizedConfirmPassword = confirmPassword.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !normalizedUsername.isEmpty else {
            errorMessage = "请输入用户名"
            showingError = true
            return
        }

        guard normalizedUsername.count >= 3 else {
            errorMessage = "用户名至少需要3个字符"
            showingError = true
            return
        }

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

        guard normalizedPassword.count >= 6 else {
            errorMessage = "密码至少需要6个字符"
            showingError = true
            return
        }

        guard !normalizedConfirmPassword.isEmpty else {
            errorMessage = "请确认密码"
            showingError = true
            return
        }

        guard normalizedPassword == normalizedConfirmPassword else {
            errorMessage = "两次输入的密码不一致"
            showingError = true
            return
        }

        let result = await authService.register(
            username: normalizedUsername,
            email: normalizedEmail,
            password: normalizedPassword
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
        print("Switch to login")
    }
}
