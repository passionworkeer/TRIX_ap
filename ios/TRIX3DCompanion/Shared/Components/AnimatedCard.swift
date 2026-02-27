//
//  AnimatedCard.swift
//  TRIX3DCompanion
//
//  Beautiful animated card component with 3D hover effect
//

import SwiftUI

// MARK: - Animated Card

/// A beautiful card with 3D hover effect and smooth animations
struct AnimatedCard<Content: View>: View {
    // MARK: - Properties

    let content: Content
    var cornerRadius: CGFloat = 20
    var shadowColor: Color = .purple
    var shadowOpacity: Double = 0.3
    var glowColor: Color = .purple
    var showGlow: Bool = true

    // Animation states
    @State private var isHovered = false
    @State private var scale: CGFloat = 1.0
    @State private var rotationX: Double = 0
    @State private var rotationY: Double = 0

    // MARK: - Initialization

    init(
        cornerRadius: CGFloat = 20,
        shadowColor: Color = .purple,
        shadowOpacity: Double = 0.3,
        glowColor: Color = .purple,
        showGlow: Bool = true,
        @ViewBuilder content: () -> Content
    ) {
        self.content = content()
        self.cornerRadius = cornerRadius
        self.shadowColor = shadowColor
        self.shadowOpacity = shadowOpacity
        self.glowColor = glowColor
        self.showGlow = showGlow
    }

    // MARK: - Body

    var body: some View {
        content
            .padding(20)
            .background(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .fill(.ultraThinMaterial)
                    .shadow(
                        color: shadowColor.opacity(shadowOpacity),
                        radius: isHovered ? 25 : 15,
                        x: 0,
                        y: isHovered ? 12 : 6
                    )
            )
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .stroke(
                        LinearGradient(
                            colors: [
                                .white.opacity(isHovered ? 0.4 : 0.2),
                                .white.opacity(0.05),
                                .clear
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 1.5
                    )
            )
            .overlay(
                Group {
                    if showGlow && isHovered {
                        RoundedRectangle(cornerRadius: cornerRadius)
                            .stroke(
                                glowColor.opacity(0.5),
                                lineWidth: 2
                            )
                            .blur(radius: 4)
                            .opacity(0.6)
                    }
                }
            )
            .scaleEffect(scale)
            .rotation3DEffect(
                .degrees(rotationX),
                axis: (x: 1, y: 0, z: 0)
            )
            .rotation3DEffect(
                .degrees(rotationY),
                axis: (x: 0, y: 1, z: 0)
            )
            .animation(.spring(response: 0.3, dampingFraction: 0.6), value: isHovered)
            .animation(.spring(response: 0.3, dampingFraction: 0.6), value: scale)
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        handleHover(at: value.location)
                    }
                    .onEnded { _ in
                        resetHover()
                    }
            )
            .onTapGesture {
                // Haptic feedback
                let generator = UIImpactFeedbackGenerator(style: .medium)
                generator.impactOccurred()

                withAnimation(.spring(response: 0.3, dampingFraction: 0.5)) {
                    scale = 0.97
                }

                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.5)) {
                        scale = 1.0
                    }
                }
            }
    }

    // MARK: - Private Methods

    private func handleHover(at location: CGPoint) {
        isHovered = true

        // Calculate rotation based on touch position
        let cardWidth: CGFloat = 300 // Approximate
        let cardHeight: CGFloat = 200 // Approximate

        let normalizedX = (location.x - cardWidth / 2) / (cardWidth / 2)
        let normalizedY = (location.y - cardHeight / 2) / (cardHeight / 2)

        withAnimation(.spring(response: 0.2, dampingFraction: 0.7)) {
            rotationY = Double(normalizedX) * 5
            rotationX = Double(-normalizedY) * 5
            scale = 1.02
        }
    }

    private func resetHover() {
        withAnimation(.spring(response: 0.4, dampingFraction: 0.6)) {
            isHovered = false
            rotationX = 0
            rotationY = 0
            scale = 1.0
        }
    }
}

// MARK: - Gradient Card

/// A card with gradient background
struct GradientCard<Content: View>: View {
    let content: Content
    var gradientColors: [Color] = [.purple, .pink]
    var cornerRadius: CGFloat = 20

    init(
        gradientColors: [Color] = [.purple, .pink],
        cornerRadius: CGFloat = 20,
        @ViewBuilder content: () -> Content
    ) {
        self.content = content()
        self.gradientColors = gradientColors
        self.cornerRadius = cornerRadius
    }

    var body: some View {
        content
            .padding(20)
            .background(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .fill(
                        LinearGradient(
                            colors: gradientColors,
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .opacity(0.15)
            )
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .stroke(
                        LinearGradient(
                            colors: gradientColors.map { $0.opacity(0.5) },
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 1.5
                    )
            )
            .shadow(color: gradientColors[0].opacity(0.2), radius: 15, y: 8)
    }
}

// MARK: - Previews

#Preview("Animated Card") {
    VStack(spacing: 30) {
        AnimatedCard {
            VStack(alignment: .leading, spacing: 12) {
                Image(systemName: "sparkles")
                    .font(.system(size: 40))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [.purple, .pink],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )

                Text("Interactive Card")
                    .font(.title2)
                    .fontWeight(.bold)

                Text("Touch and drag to see the 3D hover effect")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
        }

        GradientCard(gradientColors: [.blue, .purple]) {
            VStack(alignment: .leading, spacing: 12) {
                Image(systemName: "star.fill")
                    .font(.system(size: 32))
                    .foregroundColor(.blue)

                Text("Gradient Card")
                    .font(.title3)
                    .fontWeight(.semibold)

                Text("Beautiful gradient border effect")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .frame(maxWidth: .infinity)
        }
    }
    .padding()
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color(.systemGroupedBackground))
}
