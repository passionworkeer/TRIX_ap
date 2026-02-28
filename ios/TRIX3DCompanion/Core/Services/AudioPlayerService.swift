//
//  AudioPlayerService.swift
//  TRIX3DCompanion
//
//  背景音乐播放器服务
//  支持白噪音、环境音、轻音乐播放
//

import Foundation
import AVFoundation
import Combine

// MARK: - Audio Track Model

struct AudioTrack: Identifiable, Equatable {
    let id: String
    let name: String
    let nameEn: String
    let icon: String
    let url: String
    let category: AudioCategory

    enum AudioCategory: String, CaseIterable {
        case nature = "自然"
        case ambient = "环境"
        case music = "音乐"
    }
}

// MARK: - Player State

enum PlayerState: Equatable {
    case idle
    case loading
    case playing
    case paused
    case error(String)
}

// MARK: - Audio Player Service

final class AudioPlayerService: ObservableObject {

    // MARK: - Singleton

    static let shared = AudioPlayerService()

    // MARK: - Published Properties

    @Published private(set) var state: PlayerState = .idle
    @Published private(set) var currentTrack: AudioTrack?
    @Published var volume: Float = 0.5 {
        didSet {
            audioPlayer?.volume = volume
            UserDefaults.standard.set(volume, forKey: "study-music-volume")
        }
    }

    // MARK: - Private Properties

    private var audioPlayer: AVAudioPlayer?
    private var audioSession: AVAudioSession?

    // MARK: - Track List

    static let tracks: [AudioTrack] = [
        AudioTrack(id: "rain", name: "雨声", nameEn: "Rain", icon: "🌧️",
                   url: "https://cdn.pixabay.com/audio/2022/05/16/audio_58b684a7ed.mp3", category: .nature),
        AudioTrack(id: "thunder", name: "雷雨", nameEn: "Thunder", icon: "⛈️",
                   url: "https://cdn.pixabay.com/audio/2022/10/30/audio_1ae47f8e6e.mp3", category: .nature),
        AudioTrack(id: "forest", name: "森林", nameEn: "Forest", icon: "🌲",
                   url: "https://cdn.pixabay.com/audio/2022/08/04/audio_2dde668d05.mp3", category: .nature),
        AudioTrack(id: "ocean", name: "海浪", nameEn: "Ocean Waves", icon: "🌊",
                   url: "https://cdn.pixabay.com/audio/2022/06/25/audio_d28f6cd1ef.mp3", category: .nature),
        AudioTrack(id: "fireplace", name: "壁炉", nameEn: "Fireplace", icon: "🔥",
                   url: "https://cdn.pixabay.com/audio/2021/12/06/audio_1daf0a0c8c.mp3", category: .ambient),
        AudioTrack(id: "cafe", name: "咖啡馆", nameEn: "Coffee Shop", icon: "☕",
                   url: "https://cdn.pixabay.com/audio/2024/01/18/audio_79b14f39e1.mp3", category: .ambient),
        AudioTrack(id: "wind", name: "风声", nameEn: "Wind", icon: "🍃",
                   url: "https://cdn.pixabay.com/audio/2022/03/10/audio_4df097b33d.mp3", category: .nature),
        AudioTrack(id: "birds", name: "鸟鸣", nameEn: "Birds", icon: "🐦",
                   url: "https://cdn.pixabay.com/audio/2022/06/07/audio_69a61cd6d6.mp3", category: .nature),
        AudioTrack(id: "piano", name: "轻音乐", nameEn: "Piano", icon: "🎹",
                   url: "https://cdn.pixabay.com/audio/2022/05/27/audio_1808f8a1e2.mp3", category: .music),
        AudioTrack(id: "lofi", name: "Lo-Fi", nameEn: "Lo-Fi", icon: "🎧",
                   url: "https://cdn.pixabay.com/audio/2024/11/29/audio_6546a57f96.mp3", category: .music)
    ]

    // MARK: - Initialization

    private init() {
        // 从 UserDefaults 恢复音量
        if UserDefaults.standard.object(forKey: "study-music-volume") != nil {
            volume = UserDefaults.standard.float(forKey: "study-music-volume")
        }

        setupAudioSession()
    }

    // MARK: - Public Methods

    func play(track: AudioTrack) {
        // 如果是同一首曲子，切换播放状态
        if currentTrack?.id == track.id {
            if state == .playing {
                pause()
            } else {
                resume()
            }
            return
        }

        // 切换曲目
        stop()
        state = .loading
        currentTrack = track

        guard let url = URL(string: track.url) else {
            state = .error("无效的音频 URL")
            return
        }

        // 使用 URLSession 下载音频数据
        URLSession.shared.dataTask(with: url) { [weak self] data, response, error in
            DispatchQueue.main.async {
                guard let self = self else { return }

                if let error = error {
                    self.state = .error(error.localizedDescription)
                    return
                }

                guard let data = data else {
                    self.state = .error("无法下载音频")
                    return
                }

                do {
                    self.audioPlayer = try AVAudioPlayer(data: data)
                    self.audioPlayer?.numberOfLoops = -1 // 循环播放
                    self.audioPlayer?.volume = self.volume
                    self.audioPlayer?.prepareToPlay()

                    if self.audioPlayer?.play() == true {
                        self.state = .playing
                    } else {
                        self.state = .error("播放失败")
                    }
                } catch {
                    self.state = .error(error.localizedDescription)
                }
            }
        }.resume()
    }

    func pause() {
        audioPlayer?.pause()
        state = .paused
    }

    func resume() {
        if audioPlayer?.play() == true {
            state = .playing
        }
    }

    func toggle() {
        switch state {
        case .playing:
            pause()
        case .paused:
            resume()
        default:
            break
        }
    }

    func stop() {
        audioPlayer?.stop()
        audioPlayer = nil
        state = .idle
        currentTrack = nil
    }

    // MARK: - Private Methods

    private func setupAudioSession() {
        do {
            audioSession = AVAudioSession.sharedInstance()
            try audioSession?.setCategory(.playback, mode: .default, options: [.mixWithOthers])
            try audioSession?.setActive(true)
        } catch {
            print("Failed to setup audio session: \(error)")
        }
    }
}
