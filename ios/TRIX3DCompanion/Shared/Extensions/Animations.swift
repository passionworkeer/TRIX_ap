//
//  Animations.swift
//  TRIX3DCompanion
//
//  Standard animation definitions for consistent UX
//

import SwiftUI

// MARK: - Animation Tokens

/// Standard animation durations
enum AnimationDuration {
    static let instant: Double = 0.1
    static let quick: Double = 0.2
    static let standard: Double = 0.3
    static let slow: Double = 0.5
    static let verySlow: Double = 0.8
}

/// Standard animation curves
enum AnimationCurve {
    static let standard = Animation.easeInOut(duration: AnimationDuration.standard)
    static let quick = Animation.easeInOut(duration: AnimationDuration.quick)
    static let slow = Animation.easeInOut(duration: AnimationDuration.slow)
    static let spring = Animation.spring(response: 0.3, dampingFraction: 0.7)
    static let springBouncy = Animation.spring(response: 0.4, dampingFraction: 0.6)
    static let springGentle = Animation.spring(response: 0.5, dampingFraction: 0.8)
}

// MARK: - View Extensions

extension View {

    /// Fade in animation
    /// - Parameters:
    ///   - delay: Delay before animation starts
    ///   - duration: Animation duration
    /// - Returns: Animated view
    func fadeIn(delay: Double = 0, duration: Double = AnimationDuration.standard) -> some View {
        self
            .opacity(0)
            .animation(.easeIn(duration: duration).delay(delay), value: UUID())
    }

    /// Fade out animation
    /// - Parameters:
    ///   - delay: Delay before animation starts
    ///   - duration: Animation duration
    /// - Returns: Animated view
    func fadeOut(delay: Double = 0, duration: Double = AnimationDuration.standard) -> some View {
        self
            .opacity(1)
            .animation(.easeOut(duration: duration).delay(delay), value: UUID())
    }

    /// Slide in from leading edge
    /// - Parameters:
    ///   - delay: Delay before animation starts
    ///   - distance: Distance to slide
    /// - Returns: Animated view
    func slideInFromLeading(delay: Double = 0, distance: CGFloat = 50) -> some View {
        self
            .opacity(0)
            .offset(x: -distance)
            .animation(AnimationCurve.standard.delay(delay), value: UUID())
    }

    /// Slide in from trailing edge
    /// - Parameters:
    ///   - delay: Delay before animation starts
    ///   - distance: Distance to slide
    /// - Returns: Animated view
    func slideInFromTrailing(delay: Double = 0, distance: CGFloat = 50) -> some View {
        self
            .opacity(0)
            .offset(x: distance)
            .animation(AnimationCurve.standard.delay(delay), value: UUID())
    }

    /// Slide in from top
    /// - Parameters:
    ///   - delay: Delay before animation starts
    ///   - distance: Distance to slide
    /// - Returns: Animated view
    func slideInFromTop(delay: Double = 0, distance: CGFloat = 50) -> some View {
        self
            .opacity(0)
            .offset(y: -distance)
            .animation(AnimationCurve.standard.delay(delay), value: UUID())
    }

    /// Slide in from bottom
    /// - Parameters:
    ///   - delay: Delay before animation starts
    ///   - distance: Distance to slide
    /// - Returns: Animated view
    func slideInFromBottom(delay: Double = 0, distance: CGFloat = 50) -> some View {
        self
            .opacity(0)
            .offset(y: distance)
            .animation(AnimationCurve.standard.delay(delay), value: UUID())
    }

    /// Scale up animation
    /// - Parameters:
    ///   - delay: Delay before animation starts
    ///   - from: Starting scale
    /// - Returns: Animated view
    func scaleIn(delay: Double = 0, from: CGFloat = 0.5) -> some View {
        self
            .opacity(0)
            .scaleEffect(from)
            .animation(AnimationCurve.spring.delay(delay), value: UUID())
    }

    /// Spring animation for button press
    func buttonPress() -> some View {
        self.buttonStyle(PressableButtonStyle())
    }

    /// Animated visibility with fade and scale
    func animatedVisibility(_ isVisible: Bool) -> some View {
        self
            .opacity(isVisible ? 1 : 0)
            .scaleEffect(isVisible ? 1 : 0.8)
            .animation(AnimationCurve.spring, value: isVisible)
    }

    /// Shimmer effect for loading states
    func shimmer(isActive: Bool = true) -> some View {
        self.modifier(ShimmerModifier(isActive: isActive))
    }

    /// Pulse animation for notifications
    func pulse(count: Int = 3) -> some View {
        self.modifier(PulseModifier(count: count))
    }
}

// MARK: - Button Style

struct PressableButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.95 : 1)
            .animation(.spring(response: 0.2, dampingFraction: 0.6), value: configuration.isPressed)
    }
}

// MARK: - Shimmer Modifier

struct ShimmerModifier: ViewModifier {
    let isActive: Bool
    @State private var phase: CGFloat = 0

    func body(content: Content) -> some View {
        if isActive {
            content
                .overlay(
                    GeometryReader { geometry in
                        LinearGradient(
                            colors: [
                                .clear,
                                .white.opacity(0.5),
                                .clear
                            ],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                        .frame(width: geometry.size.width * 2)
                        .offset(x: -geometry.size.width + (phase * geometry.size.width * 3))
                    }
                )
                .mask(content)
                .onAppear {
                    withAnimation(.linear(duration: 1.5).repeatForever(autoreverses: false)) {
                        phase = 1
                    }
                }
        } else {
            content
        }
    }
}

// MARK: - Pulse Modifier

struct PulseModifier: ViewModifier {
    let count: Int
    @State private var isPulsing = false

    func body(content: Content) -> some View {
        content
            .scaleEffect(isPulsing ? 1.1 : 1.0)
            .opacity(isPulsing ? 0.8 : 1.0)
            .onAppear {
                withAnimation(.easeInOut(duration: 0.6).repeatCount(count * 2, autoreverses: true)) {
                    isPulsing = true
                }
            }
    }
}

// MARK: - Transition Extensions

extension AnyTransition {
    static var fadeAndSlide: AnyTransition {
        .asymmetric(
            insertion: .opacity.combined(with: .move(edge: .bottom)),
            removal: .opacity
        )
    }

    static var scaleAndFade: AnyTransition {
        .asymmetric(
            insertion: .opacity.combined(with: .scale(scale: 0.9)),
            removal: .opacity
        )
    }

    static var slideFromLeading: AnyTransition {
        .asymmetric(
            insertion: .move(edge: .leading),
            removal: .move(edge: .leading)
        )
    }

    static var slideFromTrailing: AnyTransition {
        .asymmetric(
            insertion: .move(edge: .trailing),
            removal: .move(edge: .trailing)
        )
    }
}

// MARK: - Previews

#Preview("Animations") {
    VStack(spacing: 20) {
        Text("Fade In")
            .padding()
            .frame(maxWidth: .infinity)
            .background(Color.brandPurple)
            .foregroundColor(.white)
            .fadeIn()

        Text("Slide from Bottom")
            .padding()
            .frame(maxWidth: .infinity)
            .background(Color.brandPink)
            .foregroundColor(.white)
            .slideInFromBottom(delay: 0.2)

        Text("Scale In")
            .padding()
            .frame(maxWidth: .infinity)
            .background(Color.success)
            .foregroundColor(.white)
            .scaleIn(delay: 0.4)

        Button("Press Me") {
            // Action
        }
        .buttonPress()
        .padding()
    }
    .padding()
}

#Preview("Transitions") {
    struct TransitionExample: View {
        @State private var isShowing = false

        var body: some View {
            VStack {
                if isShowing {
                    Text("Content")
                        .padding()
                        .background(Color.brandPurple)
                        .foregroundColor(.white)
                        .transition(.fadeAndSlide)
                }

                Button("Toggle") {
                    withAnimation {
                        isShowing.toggle()
                    }
                }
            }
        }
    }

    return TransitionExample()
}
