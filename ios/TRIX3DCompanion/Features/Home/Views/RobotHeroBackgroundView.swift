//
//  RobotHeroBackgroundView.swift
//  TRIX3DCompanion
//
//  3D Robot Hero Background with video playback
//  Uses state-driven video transitions with battery-aware optimization
//

import SwiftUI
import AVKit
import UIKit
import Combine

// MARK: - Robot Hero Background View

/// 3D 机器人 Hero 背景视图，支持视频播放和状态过渡
struct RobotHeroBackgroundView: View {

    // MARK: - State

    @StateObject private var videoTransitionManager = VideoTransitionManager()
    @StateObject private var batteryManager = BatteryAwareVideoPlayer.shared

    @State private var showParticles = true

    // MARK: - Properties

    let botState: BotState
    let onActiveVideoSourceChange: ((String) -> Void)?

    // MARK: - Body

    var body: some View {
        ZStack {
            // Video layers (managed by VideoTransitionManager)
            VideoLayersView(manager: videoTransitionManager)
                .ignoresSafeArea()

            // Animated particles (optional overlay)
            if showParticles {
                particleOverlay
                    .ignoresSafeArea()
            }

            // Gradient overlay for readability
            gradientOverlay
                .ignoresSafeArea()

            // Battery indicator overlay (in low power mode)
            if batteryManager.isLowPowerMode {
                batteryIndicator
            }
        }
        .onAppear {
            Task {
                await initializeVideoSystem()
            }
        }
        .onChange(of: botState) { _, newState in
            Task {
                await transitionToState(newState)
            }
        }
        .onChange(of: batteryManager.playbackQuality) { _, _ in
            Task {
                await handleQualityChange()
            }
        }
    }

    // MARK: - Particle Overlay

    private var particleOverlay: some View {
        GeometryReader { geometry in
            ForEach(0..<10, id: \.self) { index in
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [
                                Color.white.opacity(batteryManager.isLowPowerMode ? 0.1 : 0.3),
                                Color.clear
                            ],
                            center: .center,
                            startRadius: 0,
                            endRadius: 20
                        )
                    )
                    .frame(width: CGFloat.random(in: 10...30))
                    .position(
                        x: CGFloat.random(in: 0...geometry.size.width),
                        y: CGFloat.random(in: 0...geometry.size.height)
                    )
                    .opacity(Double.random(in: 0.1...0.4))
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
                    Color.black.opacity(0.5),
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

    // MARK: - Battery Indicator

    private var batteryIndicator: some View {
        HStack(spacing: 6) {
            Image(systemName: "battery.low")
                .font(.caption2)
                .foregroundColor(.yellow)

            Text("\(batteryManager.getBatteryPercentage())%")
                .font(.caption2)
                .foregroundColor(.yellow)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(.ultraThinMaterial)
        .clipShape(Capsule())
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
        .padding(.trailing, 16)
        .padding(.top, 60)
    }

    // MARK: - Initialization

    private func initializeVideoSystem() async {
        // Initialize video transition manager
        await videoTransitionManager.initialize()

        // Set initial state
        let adjustedState = batteryManager.adjustedState(for: botState)
        await videoTransitionManager.setInitialState(adjustedState)

        // Notify callback
        onActiveVideoSourceChange?(adjustedState.videoFileName)

        SecureLogger.shared.info("RobotHeroBackground initialized with state: \(botState.rawValue)")
    }

    // MARK: - State Transitions

    private func transitionToState(_ state: BotState) async {
        // Apply battery-aware state adjustment
        let adjustedState = batteryManager.adjustedState(for: state)

        // Perform video transition
        await videoTransitionManager.transitionToState(adjustedState)

        // Notify callback
        onActiveVideoSourceChange?(adjustedState.videoFileName)

        // Trigger haptic feedback
        let generator = UIImpactFeedbackGenerator(style: .light)
        generator.impactOccurred()

        SecureLogger.shared.info("Transitioned to state: \(adjustedState.rawValue)")
    }

    private func handleQualityChange() async {
        // Adjust particle effects based on battery
        withAnimation {
            showParticles = batteryManager.playbackQuality != .low
        }

        // Pause/resume based on battery
        if batteryManager.shouldPausePlayback() {
            videoTransitionManager.pause()
        } else {
            videoTransitionManager.resume()
        }
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

#Preview("Robot Hero Background - Boring") {
    RobotHeroBackgroundView(
        botState: .boring,
        onActiveVideoSourceChange: { source in
            print("Active video source: \(source)")
        }
    )
}
