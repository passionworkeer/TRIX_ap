//
//  VideoBackgroundView.swift
//  TRIX3DCompanion
//
//  视频背景视图 - 使用 UIViewRepresentable 封装 AVPlayerLayer
//

import SwiftUI
import AVKit
import AVFoundation

/// 视频背景视图，支持根据机器人状态切换不同视频
struct VideoBackgroundView: View {
    let botState: BotState
    @StateObject private var videoManager = VideoBackgroundManager()

    private let videoNames: [BotState: String] = [
        .idle: "idle",
        .thinking: "thinking",
        .speaking: "speaking",
        .boring: "boring"
    ]

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // 视频播放器层 - 适配屏幕大小
                VideoBackgroundPlayerView(
                    videoName: videoNames[botState] ?? "idle",
                    manager: videoManager
                )
                .frame(width: geometry.size.width, height: geometry.size.height)
                .clipped()

                // 降级：渐变背景（当视频未加载时显示）
                if !videoManager.isVideoLoaded {
                    FallbackGradientView()
                }
            }
            .frame(width: geometry.size.width, height: geometry.size.height)
        }
        .onAppear {
            videoManager.loadVideo(named: videoNames[botState] ?? "idle")
        }
        .onChange(of: botState) { _, newValue in
            videoManager.loadVideo(named: videoNames[newValue] ?? "idle")
        }
    }
}

// MARK: - Video Background Manager

/// 管理视频加载和播放状态
@MainActor
class VideoBackgroundManager: ObservableObject {
    @Published var isVideoLoaded = false

    func loadVideo(named name: String) {
        isVideoLoaded = false
        // 延迟设置loaded状态，让视频有时间加载
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            self.isVideoLoaded = true
        }
    }
}

// MARK: - Video Background Player View

/// 视频播放器视图
struct VideoBackgroundPlayerView: UIViewRepresentable {
    let videoName: String
    let manager: VideoBackgroundManager

    func makeUIView(context: Context) -> VideoBackgroundUIView {
        let view = VideoBackgroundUIView()
        return view
    }

    func updateUIView(_ uiView: VideoBackgroundUIView, context: Context) {
        uiView.loadVideo(named: videoName)
    }
}

// MARK: - Video Background UI View

/// 自定义 UIView 包含 AVPlayerLayer 用于背景视频
class VideoBackgroundUIView: UIView {
    private var player: AVPlayer?
    private var playerLayer: AVPlayerLayer?
    private var playerLooper: AVPlayerLooper?
    private var queuePlayer: AVQueuePlayer?
    private var currentVideoName: String?

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        playerLayer?.frame = bounds
    }

    func loadVideo(named name: String) {
        // 如果是同一个视频，不重新加载
        if currentVideoName == name && player != nil {
            return
        }

        currentVideoName = name

        // 清理旧资源
        cleanup()

        // 加载视频
        guard let url = Bundle.main.url(forResource: name, withExtension: "mp4") else {
            SecureLogger.shared.warning("Video not found: \(name).mp4")
            return
        }

        // 创建 Player 和 PlayerItem
        let playerItem = AVPlayerItem(url: url)
        queuePlayer = AVQueuePlayer(playerItem: playerItem)
        player = queuePlayer

        // 创建 Looper 实现循环播放
        if let queuePlayer = queuePlayer {
            playerLooper = AVPlayerLooper(player: queuePlayer, templateItem: playerItem)
        }

        // 配置播放器
        player?.isMuted = true
        player?.volume = 0
        player?.actionAtItemEnd = .none

        // 创建 PlayerLayer
        let newPlayerLayer = AVPlayerLayer(player: player)
        newPlayerLayer.videoGravity = .resizeAspect
        newPlayerLayer.frame = bounds
        newPlayerLayer.backgroundColor = UIColor.clear.cgColor

        // 添加到视图层
        layer.insertSublayer(newPlayerLayer, at: 0)
        playerLayer = newPlayerLayer

        // 开始播放
        player?.play()

        SecureLogger.shared.debug("Video started playing: \(name).mp4")
    }

    private func cleanup() {
        player?.pause()
        playerLayer?.removeFromSuperlayer()
        playerLayer = nil
        playerLooper = nil
        player = nil
        queuePlayer = nil
    }

    deinit {
        cleanup()
    }
}

/// 降级渐变背景
struct FallbackGradientView: View {
    var body: some View {
        ZStack {
            // 基础渐变
            LinearGradient(
                colors: [
                    Color(hex: "667eea").opacity(0.6),
                    Color(hex: "764ba2").opacity(0.4),
                    Color(hex: "6B8DD6").opacity(0.3)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            // 粒子效果
            Circle()
                .fill(
                    RadialGradient(
                        colors: [Color.white.opacity(0.3), .clear],
                        center: .center,
                        startRadius: 0,
                        endRadius: 50
                    )
                )
                .frame(width: 100, height: 100)
                .position(x: 100, y: 200)
                .blur(radius: 20)
        }
    }
}
