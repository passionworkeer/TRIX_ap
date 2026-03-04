//
//  VideoPlayerView.swift
//  TRIX3DCompanion
//
//  UIViewRepresentable wrapper for AVPlayerLayer with looping support
//

import SwiftUI
import UIKit
import AVFoundation
import AVKit

struct VideoPlayerView: UIViewRepresentable {
    let videoName: String
    var isPlaying: Bool = true
    var playbackRate: Float = 1.0

    func makeUIView(context: Context) -> VideoPlayerContainerView {
        let containerView = VideoPlayerContainerView()

        // 视频文件在 app bundle 的根目录
        if let url = Bundle.main.url(forResource: videoName, withExtension: "mp4") {
            SecureLogger.shared.debug("Video found: \(url)")
            containerView.setupPlayer(url: url, isPlaying: isPlaying, playbackRate: playbackRate)
        } else {
            SecureLogger.shared.warning("Video not found: \(videoName).mp4 in bundle")
        }

        return containerView
    }

    func updateUIView(_ uiView: VideoPlayerContainerView, context: Context) {
        uiView.updatePlayback(isPlaying: isPlaying, rate: playbackRate)
    }
}

// MARK: - Video Player Container View

class VideoPlayerContainerView: UIView {
    private var player: AVPlayer?
    private var playerLayer: AVPlayerLayer?
    private var playerLooper: AVPlayerLooper?
    private var queuePlayer: AVQueuePlayer?

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

    func setupPlayer(url: URL, isPlaying: Bool, playbackRate: Float) {
        // 清理旧的 player
        cleanup()

        // 创建新的 player
        let playerItem = AVPlayerItem(url: url)
        queuePlayer = AVQueuePlayer(playerItem: playerItem)
        player = queuePlayer

        // 设置循环
        if let queuePlayer = queuePlayer {
            playerLooper = AVPlayerLooper(player: queuePlayer, templateItem: playerItem)
        }

        player?.isMuted = true
        player?.volume = 0
        player?.actionAtItemEnd = .none
        player?.rate = isPlaying ? playbackRate : 0

        // 创建 player layer
        let newPlayerLayer = AVPlayerLayer(player: player)
        newPlayerLayer.videoGravity = .resizeAspectFill
        newPlayerLayer.frame = bounds
        newPlayerLayer.backgroundColor = UIColor.clear.cgColor
        playerLayer = newPlayerLayer

        if let playerLayer = playerLayer {
            layer.addSublayer(playerLayer)
            SecureLogger.shared.debug("PlayerLayer added, bounds: \(bounds)")
        }
    }

    func updatePlayback(isPlaying: Bool, rate: Float) {
        if isPlaying {
            player?.rate = rate
        } else {
            player?.pause()
        }
    }

    private func cleanup() {
        player?.pause()
        playerLayer?.removeFromSuperlayer()
        playerLayer = nil
        player = nil
        queuePlayer = nil
        playerLooper = nil
    }

    deinit {
        cleanup()
    }
}
