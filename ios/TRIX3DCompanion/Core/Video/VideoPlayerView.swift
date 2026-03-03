//
//  VideoPlayerView.swift
//  TRIX3DCompanion
//
//  UIViewRepresentable wrapper for AVPlayerLayer with looping support
//

import SwiftUI
import UIKit
import AVFoundation

struct VideoPlayerView: UIViewRepresentable {
    let videoName: String
    var isPlaying: Bool = true
    var playbackRate: Float = 1.0

    func makeUIView(context: Context) -> UIView {
        let view = UIView()
        view.backgroundColor = .black

        if let url = Bundle.main.url(forResource: videoName, withExtension: "mp4") {
            let player = AVPlayer(url: url)
            player.isMuted = true
            player.volume = 0

            // 设置循环播放
            NotificationCenter.default.addObserver(
                forName: .AVPlayerItemDidPlayToEndTime,
                object: player.currentItem,
                queue: .main
            ) { _ in
                player.seek(to: .zero)
                if self.isPlaying {
                    player.play()
                }
            }

            let playerLayer = AVPlayerLayer(player: player)
            playerLayer.videoGravity = .resizeAspectFill
            playerLayer.frame = view.bounds
            view.layer.addSublayer(playerLayer)
            context.coordinator.playerLayer = playerLayer
            context.coordinator.player = player

            if isPlaying {
                player.play()
            }
        }

        return view
    }

    func updateUIView(_ uiView: UIView, context: Context) {
        if let player = context.coordinator.player {
            player.rate = isPlaying ? playbackRate : 0
        }

        // 更新player layer的frame
        if let playerLayer = context.coordinator.playerLayer {
            DispatchQueue.main.async {
                playerLayer.frame = uiView.bounds
            }
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    class Coordinator {
        var playerLayer: AVPlayerLayer?
        var player: AVPlayer?
    }
}
