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
        .onChange(of: botState) { newState in
            Task {
                await transitionToState(newState)
            }
        }
        .onChange(of: batteryManager.playbackQuality) { _ in
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
        onActiveVideoSourceChange: { _ in
            // Preview callback
        }
    )
}

#Preview("Robot Hero Background - Thinking") {
    RobotHeroBackgroundView(
        botState: .thinking,
        onActiveVideoSourceChange: { _ in
            // Preview callback
        }
    )
}

#Preview("Robot Hero Background - Speaking") {
    RobotHeroBackgroundView(
        botState: .speaking,
        onActiveVideoSourceChange: { _ in
            // Preview callback
        }
    )
}

#Preview("Robot Hero Background - Boring") {
    RobotHeroBackgroundView(
        botState: .boring,
        onActiveVideoSourceChange: { _ in
            // Preview callback
        }
    )
}

// MARK: - Localization Helper
private func L(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

// MARK: - Video Transition Manager

/// Manages video transitions for the 3D robot hero background
@MainActor
final class VideoTransitionManager: ObservableObject {

    // MARK: - Published Properties

    @Published private(set) var currentVideoLayer: VideoLayer = .primary
    @Published private(set) var isTransitioning: Bool = false

    // MARK: - Video Layers

    enum VideoLayer {
        case primary
        case secondary

        var player: AVPlayer? {
            nil
        }
    }

    // MARK: - Initialization

    init() {}

    // MARK: - Public Methods

    /// Transition to a new video layer
    func transitionTo(_ layer: VideoLayer) {
        guard !isTransitioning else { return }
        isTransitioning = true

        withAnimation(.easeInOut(duration: 0.5)) {
            self.currentVideoLayer = layer
        }

        isTransitioning = false
    }

    /// Play the current video
    func play() {
        // Stub implementation
    }

    /// Pause the current video
    func pause() {
        // Stub implementation
    }

    /// Resume the current video
    func resume() {
        // Stub implementation
    }

    /// Stop and reset videos
    func stop() {
        // Stub implementation
    }

    /// Initialize the video system
    func initialize() async {
        // Stub implementation
    }

    /// Set initial state
    func setInitialState(_ state: BotState) async {
        // Stub implementation
    }

    /// Transition to a specific state
    func transitionToState(_ state: BotState) async {
        // Stub implementation
    }
}

// MARK: - Video Layers View

/// View that displays video layers managed by VideoTransitionManager
struct VideoLayersView: View {
    let manager: VideoTransitionManager

    var body: some View {
        Rectangle()
            .fill(Color.black.opacity(0.3))
            .overlay(
                Text(L("robot.video.layer"))
                    .foregroundColor(.white)
            )
    }
}

// MARK: - Battery Aware Video Player

/// Singleton class that manages battery-aware video playback
@MainActor
final class BatteryAwareVideoPlayer: ObservableObject {

    // MARK: - Singleton

    static let shared = BatteryAwareVideoPlayer()

    // MARK: - Published Properties

    @Published private(set) var batteryLevel: Float = 1.0
    @Published private(set) var isCharging: Bool = false
    @Published private(set) var shouldReduceQuality: Bool = false

    // MARK: - Initialization

    private init() {
        setupBatteryMonitoring()
    }

    // MARK: - Private Methods

    private func setupBatteryMonitoring() {
        UIDevice.current.isBatteryMonitoringEnabled = true

        // Initial battery state
        batteryLevel = UIDevice.current.batteryLevel
        isCharging = UIDevice.current.batteryState == .charging || UIDevice.current.batteryState == .full

        // Update on battery change
        NotificationCenter.default.addObserver(
            forName: UIDevice.batteryLevelDidChangeNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.batteryLevel = UIDevice.current.batteryLevel
                self?.updateQuality()
            }
        }

        NotificationCenter.default.addObserver(
            forName: UIDevice.batteryStateDidChangeNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.isCharging = UIDevice.current.batteryState == .charging || UIDevice.current.batteryState == .full
                self?.updateQuality()
            }
        }
    }

    private func updateQuality() {
        // Reduce quality when battery is low and not charging
        shouldReduceQuality = batteryLevel < 0.2 && !isCharging
    }

    // MARK: - Public Methods

    /// Get recommended video quality based on battery state
    func recommendedQuality() -> VideoQuality {
        if shouldReduceQuality || !isCharging && batteryLevel < 0.3 {
            return .low
        } else if isCharging || batteryLevel > 0.7 {
            return .high
        }
        return .medium
    }

    /// Whether the device is in low power mode
    var isLowPowerMode: Bool {
        ProcessInfo.processInfo.isLowPowerModeEnabled || batteryLevel < 0.2
    }

    /// Current playback quality based on battery state
    var playbackQuality: VideoQuality {
        recommendedQuality()
    }

    /// Get battery percentage as integer
    func getBatteryPercentage() -> Int {
        Int(batteryLevel * 100)
    }

    /// Get adjusted state based on battery level
    func adjustedState(for state: BotState) -> BotState {
        if isLowPowerMode {
            // Reduce particle effects in low power mode
            return state
        }
        return state
    }

    /// Whether playback should be paused
    func shouldPausePlayback() -> Bool {
        isLowPowerMode && !isCharging && batteryLevel < 0.1
    }
}

// MARK: - Video Quality

enum VideoQuality {
    case low
    case medium
    case high
}
