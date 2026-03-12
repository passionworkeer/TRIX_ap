import SwiftUI

enum AuthAccessibilityIdentifiers {
    static let loginScene = "auth.login.scene"
    static let registerScene = "auth.register.scene"
    static let loginEmailField = "auth.login.email"
    static let loginPasswordField = "auth.login.password"
    static let loginSubmitButton = "auth.login.submit"
    static let loginSwitchToRegisterButton = "auth.login.switch.register"
    static let loginLoadingOverlay = "auth.login.loading.overlay"
    static let registerUsernameField = "auth.register.username"
    static let registerEmailField = "auth.register.email"
    static let registerPasswordField = "auth.register.password"
    static let registerConfirmPasswordField = "auth.register.confirmPassword"
    static let registerSubmitButton = "auth.register.submit"
    static let registerSwitchToLoginButton = "auth.register.switch.login"
    static let registerLoadingOverlay = "auth.register.loading.overlay"
}

struct AuthAtmosphereBackground: View {
    var body: some View {
        ZStack {
            Color.clear.trixPageBackground(
                colors: [
                    Color.brandPurple.opacity(0.42),
                    Color.brandPink.opacity(0.28),
                    Color.blue.opacity(0.14),
                    Color.black.opacity(0.18)
                ]
            )

            RadialGradient(
                colors: [Color.white.opacity(0.18), .clear],
                center: .topLeading,
                startRadius: 40,
                endRadius: 320
            )
            .offset(x: -40, y: -80)

            RadialGradient(
                colors: [Color.brandPink.opacity(0.24), .clear],
                center: .bottomTrailing,
                startRadius: 20,
                endRadius: 280
            )
            .offset(x: 80, y: 140)

            VStack {
                HStack {
                    Circle()
                        .fill(Color.white.opacity(0.1))
                        .frame(width: 148, height: 148)
                        .blur(radius: 18)
                    Spacer()
                }
                Spacer()
                HStack {
                    Spacer()
                    Circle()
                        .fill(Color.brandPurple.opacity(0.16))
                        .frame(width: 196, height: 196)
                        .blur(radius: 26)
                }
            }
            .ignoresSafeArea()
        }
        .ignoresSafeArea()
    }
}

struct AuthHeroBadge: View {
    let icon: String
    let title: String

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 13, weight: .bold))
            Text(title)
                .font(.system(size: 13, weight: .semibold, design: .rounded))
        }
        .foregroundStyle(.white.opacity(0.96))
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color.white.opacity(0.18))
        .overlay(
            Capsule()
                .stroke(Color.white.opacity(0.24), lineWidth: 1)
        )
        .clipShape(Capsule())
    }
}

struct AuthFeaturePill: View {
    let icon: String
    let text: String

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 13, weight: .semibold))
            Text(text)
                .font(.system(size: 13, weight: .semibold, design: .rounded))
                .lineLimit(1)
        }
        .foregroundStyle(.white.opacity(0.96))
        .padding(.horizontal, 13)
        .padding(.vertical, 10)
        .background(Color.white.opacity(0.16))
        .overlay(
            Capsule()
                .stroke(Color.white.opacity(0.22), lineWidth: 1)
        )
        .clipShape(Capsule())
    }
}

struct AuthFormPanel<Content: View>: View {
    let title: String
    let subtitle: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 6) {
                Text(title)
                    .font(.system(size: 20, weight: .bold, design: .rounded))
                    .foregroundStyle(Color.textPrimary)

                Text(subtitle)
                    .font(.system(size: 14, weight: .medium, design: .rounded))
                    .foregroundStyle(Color.textSecondary)
            }

            content
        }
        .padding(24)
        .background(
            LinearGradient(
                colors: [
                    Color.white.opacity(0.94),
                    Color(hex: "FFF7FB").opacity(0.9)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 28, style: .continuous)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .stroke(Color.white.opacity(0.96), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.1), radius: 24, x: 0, y: 14)
    }
}

struct AuthLoadingOverlay: View {
    let title: String
    let subtitle: String
    let steps: [String]
    let accessibilityIdentifier: String

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var isAnimating = false
    @State private var activeStep = 0

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color.black.opacity(0.3),
                    Color.brandPurple.opacity(0.28),
                    Color.brandPink.opacity(0.18)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: 24) {
                ZStack {
                    Circle()
                        .stroke(Color.brandPurple.opacity(0.12), lineWidth: 1)
                        .frame(width: 128, height: 128)

                    Circle()
                        .trim(from: 0.08, to: 0.82)
                        .stroke(
                            AngularGradient(
                                colors: [
                                    Color.white.opacity(0.3),
                                    Color.brandPink,
                                    Color.brandPurple,
                                    Color.white.opacity(0.7)
                                ],
                                center: .center
                            ),
                            style: StrokeStyle(lineWidth: 10, lineCap: .round)
                        )
                        .frame(width: 128, height: 128)
                        .rotationEffect(.degrees(isAnimating ? 360 : 0))
                        .animation(
                            .linear(duration: reduceMotion ? 0 : 1.3)
                                .repeatForever(autoreverses: false),
                            value: isAnimating
                        )
                        .opacity(reduceMotion ? 0.8 : 1)

                    RoundedRectangle(cornerRadius: 30, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [
                                    Color(hex: "F6EEFF").opacity(0.96),
                                    Color.white.opacity(0.92)
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 78, height: 78)
                        .overlay(
                            RoundedRectangle(cornerRadius: 30, style: .continuous)
                                .stroke(Color.white.opacity(0.94), lineWidth: 1)
                        )

                    Image(systemName: "cube.transparent")
                        .font(.system(size: 28, weight: .bold))
                        .foregroundStyle(Color.brandPurple)
                }

                VStack(spacing: 8) {
                    Text(title)
                        .font(.system(size: 22, weight: .bold, design: .rounded))
                        .foregroundStyle(Color.textPrimary)

                    Text(subtitle)
                        .font(.system(size: 14, weight: .medium, design: .rounded))
                        .foregroundStyle(Color.textSecondary)
                        .multilineTextAlignment(.center)
                }

                VStack(spacing: 10) {
                    ForEach(Array(steps.enumerated()), id: \.offset) { index, step in
                        AuthLoadingStepRow(
                            title: step,
                            isActive: index == activeStep,
                            isComplete: index < activeStep
                        )
                    }
                }
            }
            .padding(.horizontal, 28)
            .padding(.vertical, 30)
            .frame(maxWidth: 360)
            .background(
                LinearGradient(
                    colors: [
                        Color.white.opacity(0.94),
                        Color(hex: "FFF4FB").opacity(0.9)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                ),
                in: RoundedRectangle(cornerRadius: 32, style: .continuous)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 32, style: .continuous)
                    .stroke(Color.white.opacity(0.96), lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.18), radius: 24, x: 0, y: 12)
            .accessibilityIdentifier(accessibilityIdentifier)
        }
        .onAppear {
            guard !isAnimating else { return }
            isAnimating = true
        }
        .task(id: accessibilityIdentifier) {
            guard !steps.isEmpty else { return }
            activeStep = 0

            if reduceMotion {
                return
            }

            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 850_000_000)
                await MainActor.run {
                    activeStep = (activeStep + 1) % steps.count
                }
            }
        }
    }
}

private struct AuthLoadingStepRow: View {
    let title: String
    let isActive: Bool
    let isComplete: Bool

    var body: some View {
        HStack(spacing: 10) {
            ZStack {
                Circle()
                    .fill(iconBackground)
                    .frame(width: 24, height: 24)

                Image(systemName: iconName)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(iconForeground)
            }

            Text(title)
                .font(.system(size: 13, weight: .semibold, design: .rounded))
                .foregroundStyle(isActive ? Color.textPrimary : Color.textSecondary)

            Spacer()
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(rowBackground)
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(isActive ? Color.white.opacity(0.18) : Color.white.opacity(0.08), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private var iconName: String {
        if isComplete {
            return "checkmark"
        }
        return isActive ? "bolt.fill" : "circle.fill"
    }

    private var iconBackground: LinearGradient {
        if isComplete {
            return LinearGradient(colors: [Color.green, Color.green.opacity(0.7)], startPoint: .topLeading, endPoint: .bottomTrailing)
        }
        if isActive {
            return LinearGradient(colors: [Color.brandPink, Color.brandPurple], startPoint: .topLeading, endPoint: .bottomTrailing)
        }
        return LinearGradient(colors: [Color.white.opacity(0.16), Color.white.opacity(0.08)], startPoint: .topLeading, endPoint: .bottomTrailing)
    }

    private var iconForeground: Color {
        isComplete || isActive ? .white : Color.textSecondary
    }

    private var rowBackground: LinearGradient {
        if isActive {
            return LinearGradient(
                colors: [
                    Color(hex: "F6EEFF").opacity(0.98),
                    Color(hex: "FFF8FC").opacity(0.96)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
        return LinearGradient(
            colors: [Color.black.opacity(0.02), Color.white.opacity(0.86)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }
}
