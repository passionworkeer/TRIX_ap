//
//  GlassPanel.swift
//  TRIX3DCompanion
//
//  Created by TRIX 3D Companion Team
//

import SwiftUI

/// A ViewModifier that applies a frosted glass effect to any view
/// Uses ultra-thin material with customizable corner radius and shadow
struct GlassPanel: ViewModifier {
    // MARK: - Properties
    var cornerRadius: CGFloat = 16
    var shadowOpacity: Double = 0.1
    var shadowRadius: CGFloat = 10
    var padding: CGFloat = 16

    // MARK: - Body
    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .fill(Material.ultraThinMaterial)
            )
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .stroke(
                        LinearGradient(
                            colors: [.white.opacity(0.2), .clear],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 1
                    )
            )
            .shadow(
                color: .black.opacity(shadowOpacity),
                radius: shadowRadius,
                x: 0,
                y: 4
            )
    }
}

// MARK: - View Extension
extension View {
    /// Applies a glass panel effect to the view
    /// - Parameters:
    ///   - cornerRadius: The corner radius of the panel (default: 16)
    ///   - shadowOpacity: The opacity of the shadow (default: 0.1)
    ///   - shadowRadius: The radius of the shadow (default: 10)
    ///   - padding: The internal padding of the panel (default: 16)
    /// - Returns: A view with the glass panel effect applied
    func glassPanel(
        cornerRadius: CGFloat = 16,
        shadowOpacity: Double = 0.1,
        shadowRadius: CGFloat = 10,
        padding: CGFloat = 16
    ) -> some View {
        self.modifier(
            GlassPanel(
                cornerRadius: cornerRadius,
                shadowOpacity: shadowOpacity,
                shadowRadius: shadowRadius,
                padding: padding
            )
        )
    }
}

// MARK: - GlassPanel Container
/// A standalone glass panel component that wraps any content
struct GlassPanelContainer<Content: View>: View {
    let content: Content
    var cornerRadius: CGFloat = 16
    var shadowOpacity: Double = 0.1
    var shadowRadius: CGFloat = 10
    var padding: CGFloat = 16
    var backgroundColor: Color? = nil

    init(
        cornerRadius: CGFloat = 16,
        shadowOpacity: Double = 0.1,
        shadowRadius: CGFloat = 10,
        padding: CGFloat = 16,
        backgroundColor: Color? = nil,
        @ViewBuilder content: () -> Content
    ) {
        self.content = content()
        self.cornerRadius = cornerRadius
        self.shadowOpacity = shadowOpacity
        self.shadowRadius = shadowRadius
        self.padding = padding
        self.backgroundColor = backgroundColor
    }

    var body: some View {
        content
            .padding(padding)
            .background(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .fill(Material.ultraThinMaterial)
                    .overlay(
                        RoundedRectangle(cornerRadius: cornerRadius)
                            .fill(backgroundColor?.opacity(0.95) ?? Color.clear)
                    )
            )
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .stroke(
                        LinearGradient(
                            colors: [.white.opacity(0.2), .clear],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 1
                    )
            )
            .shadow(
                color: .black.opacity(shadowOpacity),
                radius: shadowRadius,
                x: 0,
                y: 4
            )
    }
}

// MARK: - Previews
#Preview("GlassPanel modifier") {
    VStack(spacing: 20) {
        Text("Card with Glass Effect")
            .font(.headline)
            .glassPanel()

        VStack(alignment: .leading, spacing: 12) {
            Text("3D Model Details")
                .font(.title3)
                .fontWeight(.semibold)

            Text("This panel demonstrates the glass effect with multiple elements.")
                .font(.body)
                .foregroundColor(.secondary)

            HStack {
                Image(systemName: "cube")
                Text("Polygons: 12,345")
                Spacer()
            }
            .font(.caption)
            .foregroundColor(.secondary)
        }
        .glassPanel(cornerRadius: 20)

        Text("Custom style")
            .font(.subheadline)
            .glassPanel(cornerRadius: 8, shadowOpacity: 0.2, shadowRadius: 15, padding: 12)
    }
    .padding()
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(
        LinearGradient(
            colors: [.purple.opacity(0.3), .pink.opacity(0.3)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    )
}

#Preview("GlassPanel container") {
    GlassPanelContainer(cornerRadius: 24) {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Image(systemName: "sparkles")
                    .foregroundStyle(
                        LinearGradient(
                            colors: [.purple, .pink],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                Text("Premium Feature")
                    .font(.headline)
            }

            Text("This container approach wraps any content in a beautiful glass panel with customizable styling.")
                .font(.body)
                .foregroundColor(.secondary)

            Button("Learn More") {
                SecureLogger.shared.debug("Learn more tapped")
            }
            .buttonStyle(.borderedProminent)
        }
    }
    .padding()
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(
        LinearGradient(
            colors: [.purple.opacity(0.3), .pink.opacity(0.3)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    )
}

#Preview("Dark mode") {
    VStack(spacing: 20) {
        Text("Dark Mode Glass")
            .font(.headline)
            .glassPanel()

        GlassPanelContainer {
            VStack(alignment: .leading, spacing: 12) {
                Text("Content Example")
                    .font(.title3)
                Text("Glass effects work beautifully in dark mode too.")
                    .font(.body)
                    .foregroundColor(.secondary)
            }
        }
    }
    .padding()
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.black)
    .preferredColorScheme(.dark)
}

#Preview("Interactive elements") {
    VStack(spacing: 20) {
        Button(action: {}) {
            Text("Button in Glass")
                .font(.headline)
        }
        .glassPanel()

        Toggle("Setting in Glass", isOn: .constant(true))
            .glassPanel()
    }
    .padding()
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(
        LinearGradient(
            colors: [.purple.opacity(0.3), .pink.opacity(0.3)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    )
}
