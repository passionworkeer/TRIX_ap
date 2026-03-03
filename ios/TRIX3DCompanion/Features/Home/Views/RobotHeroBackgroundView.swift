//
//  RobotHeroBackgroundView.swift
//  TRIX3DCompanion
//
//  3D Robot Hero Background
//  使用状态驱动的动态背景，支持机器人动画效果
//

import SwiftUI
import AVKit

// MARK: - Bot State

/// 机器人状态枚举
enum BotState: String, Equatable {
    case idle = "IDLE"
    case thinking = "THINKING"
    case speaking = "SPEAKING"
    case boring = "BORING"
}

// MARK: - Robot Hero Background View

/// 3D 机器人 Hero 背景视图
struct RobotHeroBackgroundView: View {

    // MARK: - State

    @State private var isLowBattery: Bool = false
    @State private var animationOffset: CGFloat = 0

    // MARK: - Properties

    let botState: BotState
    let onActiveVideoSourceChange: ((String) -> Void)?

    // MARK: - Body

    var body: some View {
        ZStack {
            // Background gradient based on bot state
            backgroundGradient
                .ignoresSafeArea()
                .offset(y: animationOffset)

            // Animated particles
            particleOverlay
                .ignoresSafeArea()

            // Gradient overlay for readability
            gradientOverlay
                .ignoresSafeArea()
        }
        .onAppear {
            setupBatteryMonitoring()
            startAnimation()
        }
        .onChange(of: botState) { _, newState in
            updateForState(newState)
        }
    }

    // MARK: - Background Gradient

    private var backgroundGradient: some View {
        let gradientColors = gradientColorsForState(botState)

        return LinearGradient(
            colors: gradientColors,
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    private func gradientColorsForState(_ state: BotState) -> [Color] {
        switch state {
        case .idle:
            return [
                Color(hex: "667eea"),
                Color(hex: "764ba2"),
                Color(hex: "6B8DD6")
            ]
        case .thinking:
            return [
                Color(hex: "4338ca"),
                Color(hex: "6366f1"),
                Color(hex: "8B5CF6")
            ]
        case .speaking:
            return [
                Color(hex: "7C3AED"),
                Color(hex: "A78BFA"),
                Color(hex: "F472B6")
            ]
        case .boring:
            return [
                Color.gray.opacity(0.3),
                Color.gray.opacity(0.2),
                Color.clear
            ]
        }
    }

    // MARK: - Particle Overlay

    private var particleOverlay: some View {
        GeometryReader { geometry in
            ForEach(0..<20, id: \.self) { index in
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [
                                Color.white.opacity(0.3),
                                Color.clear
                            ],
                            center: .center,
                            startRadius: 0,
                            endRadius: 20
                        )
                    )
                    .frame(width: CGFloat.random(in: 10...40))
                    .position(
                        x: CGFloat.random(in: 0...geometry.size.width),
                        y: CGFloat.random(in: 0...geometry.size.height)
                    )
                    .opacity(Double.random(in: 0.2...0.6))
                    .blur(radius: 5)
            }
        }
    }

    // MARK: - Gradient Overlay

    private var gradientOverlay: some View {
        ZStack {
            // Top dark gradient
            LinearGradient(
                colors: [
                    Color.black.opacity(0.4),
                    Color.clear
                ],
                startPoint: .top,
                endPoint: .center
            )

            // Bottom dark gradient
            LinearGradient(
                colors: [
                    Color.clear,
                    Color.black.opacity(0.7)
                ],
                startPoint: .center,
                endPoint: .bottom
            )
        }
        .allowsHitTesting(false)
    }

    // MARK: - Battery Monitoring

    private func setupBatteryMonitoring() {
        // Check for low power mode
        isLowBattery = ProcessInfo.processInfo.isLowPowerModeEnabled

        // Monitor battery state changes
        NotificationCenter.default.publisher(for: Notification.Name("NSProcessInfoPowerStateDidChange"))
            .sink { [weak self] _ in
                self?.isLowBattery = ProcessInfo.processInfo.isLowPowerModeEnabled
                if let state = self?.botState {
                    self?.updateForState(state)
                }
            }
            .store(in: &cancellables)
    }

    @State private var cancellables = Set<AnyCancellable>()

    // MARK: - Animation

    private func startAnimation() {
        withAnimation(
            Animation.easeInOut(duration: 8.0)
                .repeatForever(autoreverses: true)
        ) {
            animationOffset = 50
        }
    }

    // MARK: - State Updates

    private func updateForState(_ state: BotState) {
        let sourceName = videoSourceForState(state)
        onActiveVideoSourceChange?(sourceName)

        // Trigger haptic feedback on state change
        let generator = UIImpactFeedbackGenerator(style: .light)
        generator.impactOccurred()
    }

    private func videoSourceForState(_ state: BotState) -> String {
        if isLowBattery && state == .idle {
            return "videos/role1/boring.mp4"
        }

        switch state {
        case .thinking:
            return "videos/role1/thinking.mp4"
        case .speaking:
            return "videos/role1/speaking.mp4"
        case .idle:
            return "videos/role1/idle.mp4"
        case .boring:
            return "videos/role1/boring.mp4"
        }
    }
}

// MARK: - Color Extension

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (1, 1, 1, 0)
        }

        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue:  Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

import Combine

// MARK: - Preview

#Preview("Robot Hero Background - Idle") {
    RobotHeroBackgroundView(
        botState: .idle,
        onActiveVideoSourceChange: { source in
            print("Active video source: \(source)")
        }
    )
}

#Preview("Robot Hero Background - Thinking") {
    RobotHeroBackgroundView(
        botState: .thinking,
        onActiveVideoSourceChange: { source in
            print("Active video source: \(source)")
        }
    )
}

#Preview("Robot Hero Background - Speaking") {
    RobotHeroBackgroundView(
        botState: .speaking,
        onActiveVideoSourceChange: { source in
            print("Active video source: \(source)")
        }
    )
}
