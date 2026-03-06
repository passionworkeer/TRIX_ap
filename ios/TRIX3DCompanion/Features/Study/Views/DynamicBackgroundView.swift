//
//  DynamicBackgroundView.swift
//  TRIX3DCompanion
//
//  动态背景视图
//  支持粒子动画和渐变呼吸效果
//

import SwiftUI

// MARK: - Particle View

struct ParticleView: View {

    // MARK: - State

    @State private var particles: [Particle] = []
    @State private var animationTimer: Timer?

    // MARK: - Properties

    private var timer: Timer?

    let particleCount: Int
    let primaryColor: Color
    let secondaryColor: Color

    // MARK: - Body

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                ForEach(particles) { particle in
                    Circle()
                        .fill(particle.color)
                        .frame(width: particle.size, height: particle.size)
                        .opacity(particle.opacity)
                        .position(x: particle.x, y: particle.y)
                }
            }
            .onAppear {
                setupParticles(in: geometry.size)
                startAnimation(in: geometry.size)
            }
            .onDisappear {
                stopAnimation()
            }
        }
    }

    // MARK: - Private Methods

    private func setupParticles(in size: CGSize) {
        particles = (0..<particleCount).map { _ in
            Particle(
                x: CGFloat.random(in: 0...size.width),
                y: CGFloat.random(in: 0...size.height),
                size: CGFloat.random(in: 3...8),
                speedX: CGFloat.random(in: -0.5...0.5),
                speedY: CGFloat.random(in: -0.5...0.5),
                opacity: Double.random(in: 0.2...0.6),
                color: Bool.random() ? primaryColor : secondaryColor
            )
        }
    }

    private func startAnimation(in size: CGSize) {
        animationTimer = Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { _ in
            withAnimation(.linear(duration: 0.05)) {
                updateParticles(in: size)
            }
        }
    }

    private func stopAnimation() {
        animationTimer?.invalidate()
        animationTimer = nil
    }

    // MARK: - Timer Management

    private func startTimer() {
        timer = Timer.scheduledTimer(withTimeInterval: 5.0, repeats: true) { _ in
            self.updateBackground()
        }
    }

    private func stopTimer() {
        timer?.invalidate()
        timer = nil
    }

    private func updateBackground() {
        // Background update logic
    }

    // MARK: - Lifecycle

    private func updateParticles(in size: CGSize) {
        for index in particles.indices {
            particles[index].x += particles[index].speedX
            particles[index].y += particles[index].speedY

            // 边界检测
            if particles[index].x < 0 || particles[index].x > size.width {
                particles[index].speedX *= -1
            }
            if particles[index].y < 0 || particles[index].y > size.height {
                particles[index].speedY *= -1
            }
        }
    }
}

// MARK: - Particle Model

struct Particle: Identifiable {
    let id = UUID()
    var x: CGFloat
    var y: CGFloat
    var size: CGFloat
    var speedX: CGFloat
    var speedY: CGFloat
    var opacity: Double
    var color: Color
}

// MARK: - Gradient Background View

struct GradientBackgroundView: View {

    // MARK: - State

    @State private var animateGradient = false

    // MARK: - Properties

    let primaryColor: Color
    let secondaryColor: Color

    // MARK: - Body

    var body: some View {
        LinearGradient(
            colors: [
                primaryColor,
                secondaryColor,
                primaryColor
            ],
            startPoint: animateGradient ? .topLeading : .bottomLeading,
            endPoint: animateGradient ? .bottomTrailing : .topTrailing
        )
        .hueRotation(.degrees(animateGradient ? 30 : 0))
        .animation(
            Animation.easeInOut(duration: 10)
                .repeatForever(autoreverses: true),
            value: animateGradient
        )
        .onAppear {
            animateGradient = true
        }
    }
}

// MARK: - Combined Dynamic Background

struct DynamicBackgroundView: View {

    // MARK: - Properties

    let showParticles: Bool
    let showGradient: Bool
    let primaryColor: Color
    let secondaryColor: Color
    let particleCount: Int

    // MARK: - Body

    var body: some View {
        ZStack {
            if showGradient {
                GradientBackgroundView(
                    primaryColor: primaryColor,
                    secondaryColor: secondaryColor
                )
            }

            if showParticles {
                ParticleView(
                    particleCount: particleCount,
                    primaryColor: primaryColor,
                    secondaryColor: secondaryColor
                )
            }
        }
    }
}

// MARK: - Preview

#Preview {
    DynamicBackgroundView(
        showParticles: true,
        showGradient: true,
        primaryColor: Color.purple.opacity(0.3),
        secondaryColor: Color.pink.opacity(0.3),
        particleCount: 30
    )
}
