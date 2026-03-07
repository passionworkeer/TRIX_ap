//
//  GlassPanelStyles.swift
//  TRIX3DCompanion
//
//  Additional glass panel styles and modifiers
//

import SwiftUI

// MARK: - TRIX Design System

struct TrixSurfaceCardModifier: ViewModifier {
    let cornerRadius: CGFloat
    let borderOpacity: Double
    let shadowOpacity: Double
    let shadowRadius: CGFloat

    func body(content: Content) -> some View {
        content
            .background(.ultraThinMaterial)
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .stroke(Color.white.opacity(borderOpacity), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
            .shadow(color: .black.opacity(shadowOpacity), radius: shadowRadius, x: 0, y: 4)
    }
}

struct TrixGradientBackgroundModifier: ViewModifier {
    let colors: [Color]

    func body(content: Content) -> some View {
        content
            .background(
                LinearGradient(
                    colors: colors,
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()
            )
    }
}

// MARK: - Glass Panel Style

/// Different styles for glass panels
enum GlassPanelStyle {
    case `default`
    case elevated
    case subtle
    case prominent
    case card
    case input

    var cornerRadius: CGFloat {
        switch self {
        case .default, .card: return 16
        case .elevated, .prominent: return 20
        case .subtle: return 12
        case .input: return 10
        }
    }

    var shadowOpacity: Double {
        switch self {
        case .default: return 0.1
        case .elevated: return 0.2
        case .subtle: return 0.05
        case .prominent: return 0.25
        case .card: return 0.15
        case .input: return 0.08
        }
    }

    var shadowRadius: CGFloat {
        switch self {
        case .default: return 10
        case .elevated: return 20
        case .subtle: return 5
        case .prominent: return 25
        case .card: return 15
        case .input: return 8
        }
    }

    var padding: CGFloat {
        switch self {
        case .default: return 16
        case .elevated, .prominent: return 20
        case .subtle: return 12
        case .card: return 20
        case .input: return 14
        }
    }
}

// MARK: - Styled Glass Panel Modifier

struct StyledGlassPanel: ViewModifier {
    let style: GlassPanelStyle
    let gradientBorder: Bool
    let gradientColors: [Color]

    init(
        style: GlassPanelStyle = .default,
        gradientBorder: Bool = false,
        gradientColors: [Color] = [.purple, .pink]
    ) {
        self.style = style
        self.gradientBorder = gradientBorder
        self.gradientColors = gradientColors
    }

    func body(content: Content) -> some View {
        content
            .padding(style.padding)
            .background(
                RoundedRectangle(cornerRadius: style.cornerRadius)
                    .fill(.ultraThinMaterial)
            )
            .overlay(
                RoundedRectangle(cornerRadius: style.cornerRadius)
                    .stroke(
                        gradientBorder
                            ? LinearGradient(
                                colors: gradientColors.map { $0.opacity(0.5) },
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                            : LinearGradient(
                                colors: [.white.opacity(0.2), .clear],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                        lineWidth: gradientBorder ? 1.5 : 1
                    )
            )
            .shadow(
                color: gradientBorder
                    ? gradientColors[0].opacity(style.shadowOpacity)
                    : .black.opacity(style.shadowOpacity),
                radius: style.shadowRadius,
                x: 0,
                y: 4
            )
    }
}

// MARK: - View Extensions

extension View {
    func trixSurfaceCard(
        cornerRadius: CGFloat = 16,
        borderOpacity: Double = 0.18,
        shadowOpacity: Double = 0.08,
        shadowRadius: CGFloat = 10
    ) -> some View {
        self.modifier(
            TrixSurfaceCardModifier(
                cornerRadius: cornerRadius,
                borderOpacity: borderOpacity,
                shadowOpacity: shadowOpacity,
                shadowRadius: shadowRadius
            )
        )
    }

    func trixPageBackground(
        colors: [Color] = [
            Color.brandPurple.opacity(0.16),
            Color.brandPink.opacity(0.1),
            Color.cyan.opacity(0.06),
            Color.clear
        ]
    ) -> some View {
        self.modifier(TrixGradientBackgroundModifier(colors: colors))
    }

    /// Apply a styled glass panel
    func glassPanel(
        style: GlassPanelStyle = .default,
        gradientBorder: Bool = false,
        gradientColors: [Color] = [.purple, .pink]
    ) -> some View {
        self.modifier(StyledGlassPanel(
            style: style,
            gradientBorder: gradientBorder,
            gradientColors: gradientColors
        ))
    }

    /// Elevated glass panel
    func elevatedGlass() -> some View {
        self.glassPanel(style: .elevated)
    }

    /// Subtle glass panel
    func subtleGlass() -> some View {
        self.glassPanel(style: .subtle)
    }

    /// Card style glass panel
    func glassCard() -> some View {
        self.glassPanel(style: .card)
    }

    /// Glass panel with gradient border
    func gradientGlassBorder(
        colors: [Color] = [.purple, .pink]
    ) -> some View {
        self.glassPanel(style: .default, gradientBorder: true, gradientColors: colors)
    }

    /// Glass input field style
    func glassInput() -> some View {
        self.glassPanel(style: .input)
    }
}

// MARK: - Background View Modifier

struct GlassBackground: ViewModifier {
    let colors: [Color]

    init(colors: [Color] = [.purple.opacity(0.1), .pink.opacity(0.1)]) {
        self.colors = colors
    }

    func body(content: Content) -> some View {
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(
                LinearGradient(
                    colors: colors,
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()
            )
    }
}

extension View {
    /// Apply glass gradient background
    func glassBackground(
        colors: [Color] = [.purple.opacity(0.1), .pink.opacity(0.1)]
    ) -> some View {
        self.modifier(GlassBackground(colors: colors))
    }
}

// MARK: - Section Container

/// A section container with title and glass panel
struct GlassSection<Content: View>: View {
    let title: String
    let icon: String?
    let content: Content

    init(
        title: String,
        icon: String? = nil,
        @ViewBuilder content: () -> Content
    ) {
        self.title = title
        self.icon = icon
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack(spacing: 8) {
                if let icon = icon {
                    Image(systemName: icon)
                        .foregroundStyle(
                            LinearGradient(
                                colors: [.purple, .pink],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                }
                Text(title)
                    .font(.headline)
            }
            .padding(.leading, 4)

            // Content
            content
                .glassCard()
        }
    }
}

// MARK: - Previews

#Preview("Glass Panel Styles") {
    ScrollView {
        VStack(spacing: 24) {
            // Default style
            VStack(spacing: 12) {
                Text("Default Style")
                    .font(.headline)
                Text("Standard glass panel effect")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            .glassPanel()

            // Elevated style
            VStack(spacing: 12) {
                Text("Elevated Style")
                    .font(.headline)
                Text("More prominent shadow")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            .elevatedGlass()

            // Subtle style
            VStack(spacing: 12) {
                Text("Subtle Style")
                    .font(.headline)
                Text("Minimal effect")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            .subtleGlass()

            // Card style
            VStack(spacing: 12) {
                Text("Card Style")
                    .font(.headline)
                Text("Optimized for cards")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            .glassCard()

            // Gradient border
            VStack(spacing: 12) {
                Text("Gradient Border")
                    .font(.headline)
                Text("With purple-pink gradient")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            .gradientGlassBorder()

            // Glass Section
            GlassSection(title: "Settings", icon: "gearshape.fill") {
                VStack(spacing: 12) {
                    HStack {
                        Text("Notifications")
                        Spacer()
                        Toggle("", isOn: .constant(true))
                    }
                    HStack {
                        Text("Sound")
                        Spacer()
                        Toggle("", isOn: .constant(false))
                    }
                }
            }

            // Input style
            TextField("Enter text...", text: .constant(""))
                .textFieldStyle(.plain)
                .glassInput()
        }
        .padding()
    }
    .glassBackground()
}
