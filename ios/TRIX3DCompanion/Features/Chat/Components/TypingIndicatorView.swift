//
//  TypingIndicatorView.swift
//  TRIX3DCompanion
//
//  Animated typing indicator showing "typing..." state
//  Uses bouncing dots animation
//

import SwiftUI

// MARK: - Typing Indicator View

/// Animated indicator showing someone is typing
struct TypingIndicatorView: View {

    // MARK: - Properties

    /// Whether the indicator is currently animating
    var isAnimating: Bool = true

    /// The size of each dot
    var dotSize: CGFloat = 8

    /// The spacing between dots
    var spacing: CGFloat = 4

    /// The color of the dots
    var dotColor: Color = .gray

    // MARK: - State

    @State private var isAnimatingInternal = false

    // MARK: - Body

    var body: some View {
        HStack(spacing: spacing) {
            ForEach(0..<3) { index in
                Circle()
                    .fill(dotColor)
                    .frame(width: dotSize, height: dotSize)
                    .scaleEffect(isAnimating ? scale(for: index) : 1.0)
                    .animation(
                        Animation.easeInOut(duration: 0.6)
                            .repeatForever(autoreverses: true)
                            .delay(Double(index) * 0.15),
                        value: isAnimatingInternal
                    )
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .onAppear {
            if isAnimating {
                isAnimatingInternal = true
            }
        }
        .onChange(of: isAnimating) { _, newValue in
            isAnimatingInternal = newValue
        }
    }

    // MARK: - Scale Animation

    /// Calculate scale for a dot at a given index
    private func scale(for index: Int) -> CGFloat {
        let phase = CGFloat(index) * 0.15
        let time = Date().timeIntervalSince1970
        let sine = sin((time + Double(phase)) * 5.0)
        return 1.0 + sine * 0.3
    }
}

// MARK: - Typing Bubble View

/// Chat bubble containing typing indicator
struct TypingBubbleView: View {

    // MARK: - Properties

    var isAnimating: Bool = true

    // MARK: - Body

    var body: some View {
        HStack(alignment: .bottom, spacing: 4) {
            TypingIndicatorView(
                isAnimating: isAnimating,
                dotSize: 6,
                spacing: 3,
                dotColor: .gray
            )
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.05), radius: 4, y: 2)
    }
}

// MARK: - Typing Status View

/// Full view showing who is typing
struct TypingStatusView: View {

    // MARK: - Properties

    let names: [String]
    var isAnimating: Bool = true

    // MARK: - Computed Properties

    private var displayText: String {
        if names.isEmpty {
            return ""
        } else if names.count == 1 {
            return String(format: NSLocalizedString("chat.typing.single", comment: "Single typing"), names[0])
        } else if names.count == 2 {
            return String(format: NSLocalizedString("chat.typing.dual", comment: "Dual typing"), names[0], names[1])
        } else {
            return String(format: NSLocalizedString("chat.typing.multiple", comment: "Multiple typing"), names.count)
        }
    }

    // MARK: - Body

    var body: some View {
        HStack(spacing: 8) {
            TypingIndicatorView(
                isAnimating: isAnimating,
                dotSize: 6,
                spacing: 2,
                dotColor: .purple
            )

            Text(displayText)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(.ultraThinMaterial)
        .clipShape(Capsule())
    }
}

// MARK: - Convenience Initializers

extension TypingIndicatorView {

    /// Create a small typing indicator
    static func small(isAnimating: Bool = true) -> TypingIndicatorView {
        TypingIndicatorView(
            isAnimating: isAnimating,
            dotSize: 6,
            spacing: 3
        )
    }

    /// Create a large typing indicator
    static func large(isAnimating: Bool = true) -> TypingIndicatorView {
        TypingIndicatorView(
            isAnimating: isAnimating,
            dotSize: 10,
            spacing: 6
        )
    }

    /// Create a typing indicator with custom color
    static func colored(_ color: Color, isAnimating: Bool = true) -> TypingIndicatorView {
        TypingIndicatorView(
            isAnimating: isAnimating,
            dotColor: color
        )
    }
}

// MARK: - Preview

#Preview("Typing Indicator") {
    VStack(spacing: 30) {
        // Standard size
        TypingIndicatorView(isAnimating: true)

        // Small size
        TypingIndicatorView.small(isAnimating: true)

        // Large size
        TypingIndicatorView.large(isAnimating: true)

        // Custom color
        TypingIndicatorView.colored(.purple, isAnimating: true)
        TypingIndicatorView.colored(.info, isAnimating: true)
        TypingIndicatorView.colored(.green, isAnimating: true)

        // Typing bubble
        TypingBubbleView(isAnimating: true)
            .frame(maxWidth: 200, alignment: .leading)

        // Typing status
        HStack(spacing: 20) {
            TypingStatusView(names: ["Alice"], isAnimating: true)
            TypingStatusView(names: ["Alice", "Bob"], isAnimating: true)
            TypingStatusView(names: ["Alice", "Bob", "Charlie"], isAnimating: true)
        }
    }
    .padding()
    .background(Color.tertiaryBackground.opacity(0.1))
}

#Preview("Typing in Chat Context") {
    VStack(alignment: .leading, spacing: 12) {
        // Received message
        HStack {
            Text("Hey, are you there?")
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(.white)
                .clipShape(RoundedRectangle(cornerRadius: 16))
            Spacer()
        }

        // Typing indicator
        HStack {
            TypingBubbleView(isAnimating: true)
            Spacer()
        }

        Spacer()
    }
    .padding()
    .background(Color.brandPurple.opacity(0.05))
}
