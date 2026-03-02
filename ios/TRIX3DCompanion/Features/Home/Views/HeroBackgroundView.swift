//
//  HeroBackgroundView.swift
//  TRIX3DCompanion
//
//  Dynamic hero background with gradient overlay and battery awareness
//

import SwiftUI

// MARK: - Battery Manager

@MainActor
class BatteryManager: ObservableObject {
    @Published var batteryLevel: Int = 100
    @Published var isLowPowerMode: Bool = false

    init() {
        isLowPowerMode = ProcessInfo.processInfo.isLowPowerModeEnabled
    }

    var shouldReduceMotion: Bool {
        isLowPowerMode
    }
}

// MARK: - Hero Background View

struct HeroBackgroundView: View {
    @StateObject private var batteryManager = BatteryManager()

    @State private var animateGradient = false
    @State private var particles: [HeroParticle] = []

    private let primaryColors: [Color] = [
        Color(hex: "667eea"),
        Color(hex: "764ba2"),
        Color(hex: "6B8DD6"),
        Color(hex: "8E54E9")
    ]

    private let accentColors: [Color] = [
        Color.purple.opacity(0.6),
        Color.pink.opacity(0.4),
        Color.cyan.opacity(0.3)
    ]

    var body: some View {
        ZStack {
            // Base gradient background
            baseGradient

            // Animated gradient overlay
            gradientOverlay

            // Floating particles
            if !batteryManager.shouldReduceMotion {
                particlesView
            }

            // Vignette effect
            vignetteOverlay
        }
        .ignoresSafeArea()
        .onAppear {
            startAnimations()
            createParticles()
        }
        .onChange(of: batteryManager.shouldReduceMotion) { newValue in
            if !newValue {
                startAnimations()
                createParticles()
            }
        }
    }

    // MARK: - Base Gradient

    private var baseGradient: some View {
        LinearGradient(
            colors: primaryColors,
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    // MARK: - Animated Gradient Overlay

    private var gradientOverlay: some View {
        LinearGradient(
            colors: [
                Color.brandPurple.opacity(animateGradient ? 0.3 : 0.1),
                Color.brandPink.opacity(animateGradient ? 0.2 : 0.4),
                Color.cyan.opacity(animateGradient ? 0.15 : 0.05)
            ],
            startPoint: animateGradient ? .topLeading : .topTrailing,
            endPoint: animateGradient ? .bottomTrailing : .bottomLeading
        )
        .animation(
            batteryManager.shouldReduceMotion
                ? .easeInOut(duration: 5.0).repeatForever(autoreverses: true)
                : .easeInOut(duration: 3.0).repeatForever(autoreverses: true),
            value: animateGradient
        )
    }

    // MARK: - Particles

    private var particlesView: some View {
        ZStack {
            ForEach(particles) { particle in
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [particle.color.opacity(particle.opacity), .clear],
                            center: .center,
                            startRadius: 0,
                            endRadius: particle.size
                        )
                    )
                    .frame(width: particle.size * 2, height: particle.size * 2)
                    .position(particle.position)
                    .blur(radius: particle.blur)
            }
        }
    }

    // MARK: - Vignette

    private var vignetteOverlay: some View {
        RadialGradient(
            colors: [.clear, .black.opacity(0.3)],
            center: .center,
            startRadius: 100,
            endRadius: 500
        )
    }

    // MARK: - Helpers

    private func startAnimations() {
        animateGradient = true
    }

    private func createParticles() {
        guard !batteryManager.shouldReduceMotion else { return }

        let screenWidth: CGFloat = 400 // Fallback width
        let screenHeight: CGFloat = 800 // Fallback height

        particles = (0..<15).map { _ in
            HeroParticle(
                id: UUID(),
                position: CGPoint(
                    x: CGFloat.random(in: 0...screenWidth),
                    y: CGFloat.random(in: 0...screenHeight)
                ),
                size: CGFloat.random(in: 2...8),
                color: accentColors.randomElement() ?? .brandPurple,
                opacity: CGFloat.random(in: 0.1...0.4),
                blur: CGFloat.random(in: 1...4)
            )
        }

        // Animate particles
        withAnimation(.easeInOut(duration: 8).repeatForever(autoreverses: true)) {
            for i in particles.indices {
                particles[i].position.y -= CGFloat.random(in: 20...60)
                particles[i].position.x += CGFloat.random(in: -20...20)
            }
        }
    }
}

// MARK: - Particle Model

struct HeroParticle: Identifiable {
    let id: UUID
    var position: CGPoint
    let size: CGFloat
    let color: Color
    let opacity: CGFloat
    let blur: CGFloat
}

// MARK: - Preview

#Preview("Hero Background") {
    HeroBackgroundView()
}
