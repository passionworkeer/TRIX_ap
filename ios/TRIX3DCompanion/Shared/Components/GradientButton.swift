//
//  GradientButton.swift
//  TRIX3DCompanion
//
//  Beautiful gradient button with animations and haptic feedback
//

import SwiftUI

// MARK: - Gradient Button Style

/// A beautiful button style with gradient background and animations
struct GradientButtonStyle: ButtonStyle {
    var gradientColors: [Color] = [.purple, .pink]
    var cornerRadius: CGFloat = 12
    var shadowOpacity: Double = 0.3
    var isDisabled: Bool = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundColor(.white)
            .padding(.horizontal, 24)
            .padding(.vertical, 14)
            .frame(minWidth: 120)
            .background(
                LinearGradient(
                    colors: isDisabled ? [.gray, .gray.opacity(0.8)] : gradientColors,
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .stroke(
                        LinearGradient(
                            colors: [.white.opacity(0.3), .clear],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 1
                    )
            )
            .shadow(
                color: gradientColors[0].opacity(configuration.isPressed ? 0.1 : shadowOpacity),
                radius: configuration.isPressed ? 5 : 12,
                x: 0,
                y: configuration.isPressed ? 2 : 6
            )
            .scaleEffect(configuration.isPressed ? 0.96 : 1.0)
            .animation(.spring(response: 0.2, dampingFraction: 0.6), value: configuration.isPressed)
    }
}

// MARK: - Gradient Button

/// A gradient button with haptic feedback
struct GradientButton: View {
    let title: String
    let icon: String?
    let gradientColors: [Color]
    let action: () -> Void

    init(
        _ title: String,
        icon: String? = nil,
        gradientColors: [Color] = [.purple, .pink],
        action: @escaping () -> Void
    ) {
        self.title = title
        self.icon = icon
        self.gradientColors = gradientColors
        self.action = action
    }

    var body: some View {
        Button(action: {
            // Haptic feedback
            let generator = UIImpactFeedbackGenerator(style: .medium)
            generator.impactOccurred()
            action()
        }) {
            HStack(spacing: 8) {
                if let icon = icon {
                    Image(systemName: icon)
                }
                Text(title)
            }
        }
        .buttonStyle(GradientButtonStyle(gradientColors: gradientColors))
    }
}

// MARK: - Outline Gradient Button

/// An outline button with gradient border
struct OutlineGradientButton: View {
    let title: String
    let icon: String?
    let gradientColors: [Color]
    let action: () -> Void

    init(
        _ title: String,
        icon: String? = nil,
        gradientColors: [Color] = [.purple, .pink],
        action: @escaping () -> Void
    ) {
        self.title = title
        self.icon = icon
        self.gradientColors = gradientColors
        self.action = action
    }

    var body: some View {
        Button(action: {
            let generator = UIImpactFeedbackGenerator(style: .light)
            generator.impactOccurred()
            action()
        }) {
            HStack(spacing: 8) {
                if let icon = icon {
                    Image(systemName: icon)
                }
                Text(title)
            }
            .font(.headline)
            .foregroundStyle(
                LinearGradient(
                    colors: gradientColors,
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .padding(.horizontal, 24)
            .padding(.vertical, 14)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(.ultraThinMaterial)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(
                        LinearGradient(
                            colors: gradientColors,
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 2
                    )
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Pill Button

/// A pill-shaped button with gradient
struct PillButton: View {
    let title: String
    let icon: String?
    let gradientColors: [Color]
    let size: PillButtonSize
    let action: () -> Void

    enum PillButtonSize {
        case small
        case medium
        case large

        var padding: EdgeInsets {
            switch self {
            case .small:
                return EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16)
            case .medium:
                return EdgeInsets(top: 12, leading: 20, bottom: 12, trailing: 20)
            case .large:
                return EdgeInsets(top: 16, leading: 28, bottom: 16, trailing: 28)
            }
        }

        var font: Font {
            switch self {
            case .small:
                return .subheadline
            case .medium:
                return .body
            case .large:
                return .headline
            }
        }
    }

    init(
        _ title: String,
        icon: String? = nil,
        gradientColors: [Color] = [.purple, .pink],
        size: PillButtonSize = .medium,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.icon = icon
        self.gradientColors = gradientColors
        self.size = size
        self.action = action
    }

    var body: some View {
        Button(action: {
            let generator = UIImpactFeedbackGenerator(style: .light)
            generator.impactOccurred()
            action()
        }) {
            HStack(spacing: 6) {
                if let icon = icon {
                    Image(systemName: icon)
                        .font(.system(size: size == .large ? 18 : 14))
                }
                Text(title)
                    .font(size.font)
            }
            .foregroundColor(.white)
            .padding(size.padding)
            .background(
                Capsule()
                    .fill(
                        LinearGradient(
                            colors: gradientColors,
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
            )
            .shadow(color: gradientColors[0].opacity(0.3), radius: 8, y: 4)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - View Extension

extension View {
    /// Apply gradient button style
    func gradientButtonStyle(
        colors: [Color] = [.purple, .pink],
        cornerRadius: CGFloat = 12
    ) -> some View {
        self.buttonStyle(GradientButtonStyle(gradientColors: colors, cornerRadius: cornerRadius))
    }
}

// MARK: - Previews

#Preview("Gradient Buttons") {
    ScrollView {
        VStack(spacing: 30) {
            // GradientButton
            VStack(spacing: 12) {
                Text("GradientButton")
                    .font(.caption)
                    .foregroundColor(.secondary)

                GradientButton("Primary Action", icon: "checkmark") {}
                GradientButton("Blue Style", icon: "star.fill", gradientColors: [.blue, .cyan]) {}
                GradientButton("Orange Style", icon: "flame.fill", gradientColors: [.orange, .red]) {}
            }

            // OutlineGradientButton
            VStack(spacing: 12) {
                Text("OutlineGradientButton")
                    .font(.caption)
                    .foregroundColor(.secondary)

                OutlineGradientButton("Outline Style") {}
                OutlineGradientButton("With Icon", icon: "heart.fill", gradientColors: [.pink, .red]) {}
            }

            // PillButton
            VStack(spacing: 12) {
                Text("PillButton")
                    .font(.caption)
                    .foregroundColor(.secondary)

                HStack(spacing: 12) {
                    PillButton("Small", size: .small) {}
                    PillButton("Medium", size: .medium) {}
                    PillButton("Large", size: .large) {}
                }

                PillButton("Tag", icon: "tag.fill", gradientColors: [.green, .mint]) {}
                PillButton("Download", icon: "arrow.down.circle.fill", gradientColors: [.blue, .purple]) {}
            }

            // Standard Button with style
            VStack(spacing: 12) {
                Text("Button with gradientButtonStyle()")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Button("Styled Button") {}
                    .gradientButtonStyle()

                Button(action: {}) {
                    HStack {
                        Image(systemName: "plus.circle.fill")
                        Text("Add Item")
                    }
                }
                .gradientButtonStyle(colors: [.green, .mint])
            }
        }
        .padding()
    }
    .background(Color(.systemGroupedBackground))
}
