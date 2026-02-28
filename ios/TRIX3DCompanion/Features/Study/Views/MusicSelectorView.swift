//
//  MusicSelectorView.swift
//  TRIX3DCompanion
//
//  背景音乐选择器视图
//  用户可以选择自然声音、环境音或轻音乐作为自习背景音
//

import SwiftUI

struct MusicSelectorView: View {

    // MARK: - Environment

    @Environment(\.dismiss) private var dismiss

    // MARK: - State

    @StateObject private var audioPlayer = AudioPlayerService.shared
    @State private var selectedCategory: AudioTrack.AudioCategory? = nil

    // MARK: - Body

    var body: some View {
        NavigationView {
            ZStack {
                // Background
                Color.gray900
                    .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 20) {
                        // 当前播放状态
                        if let track = audioPlayer.currentTrack {
                            nowPlayingCard(track: track)
                        }

                        // 分类筛选
                        categoryFilter

                        // 音乐列表
                        trackList
                    }
                    .padding()
                }
            }
            .navigationTitle("背景音乐")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("完成") {
                        dismiss()
                    }
                    .foregroundColor(.brandPurple)
                }
            }
        }
    }

    // MARK: - View Components

    private func nowPlayingCard(track: AudioTrack) -> some View {
        VStack(spacing: 16) {
            HStack {
                // 曲目信息
                HStack(spacing: 12) {
                    Text(track.icon)
                        .font(.system(size: 32))

                    VStack(alignment: .leading, spacing: 2) {
                        Text(track.name)
                            .font(.headline)
                            .foregroundColor(.white)

                        Text(audioPlayer.state == .playing ? "正在播放" : "已暂停")
                            .font(.caption)
                            .foregroundColor(.brandPurple)
                    }
                }

                Spacer()

                // 播放控制
                Button(action: { audioPlayer.toggle() }) {
                    ZStack {
                        Circle()
                            .fill(Color.brandPurple)
                            .frame(width: 44, height: 44)

                        if audioPlayer.state == .loading {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        } else {
                            Image(systemName: audioPlayer.state == .playing ? "pause.fill" : "play.fill")
                                .foregroundColor(.white)
                        }
                    }
                }
                .disabled(audioPlayer.state == .loading)
            }

            // 音量控制
            HStack(spacing: 12) {
                Image(systemName: "speaker.fill")
                    .font(.caption)
                    .foregroundColor(.gray400)

                Slider(value: $audioPlayer.volume, in: 0...1)
                    .tint(.brandPurple)

                Image(systemName: "speaker.wave.3.fill")
                    .font(.caption)
                    .foregroundColor(.gray400)
            }
        }
        .padding()
        .background(Color.brandPurple.opacity(0.15))
        .cornerRadius(16)
    }

    private var categoryFilter: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                // 全部按钮
                CategoryButton(
                    title: "全部",
                    isSelected: selectedCategory == nil,
                    action: { selectedCategory = nil }
                )

                // 分类按钮
                ForEach(AudioTrack.AudioCategory.allCases, id: \.self) { category in
                    CategoryButton(
                        title: category.rawValue,
                        isSelected: selectedCategory == category,
                        action: { selectedCategory = category }
                    )
                }
            }
        }
    }

    private var trackList: some View {
        let filteredTracks = selectedCategory == nil
            ? AudioPlayerService.tracks
            : AudioPlayerService.tracks.filter { $0.category == selectedCategory }

        return LazyVGrid(columns: [
            GridItem(.flexible()),
            GridItem(.flexible())
        ], spacing: 12) {
            ForEach(filteredTracks) { track in
                TrackButton(
                    track: track,
                    isPlaying: audioPlayer.currentTrack?.id == track.id && audioPlayer.state == .playing,
                    isSelected: audioPlayer.currentTrack?.id == track.id,
                    action: { audioPlayer.play(track: track) }
                )
            }
        }
    }
}

// MARK: - Category Button

private struct CategoryButton: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline)
                .fontWeight(.medium)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(isSelected ? Color.brandPurple : Color.white.opacity(0.1))
                .foregroundColor(isSelected ? .white : .gray300)
                .cornerRadius(20)
        }
    }
}

// MARK: - Track Button

private struct TrackButton: View {
    let track: AudioTrack
    let isPlaying: Bool
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(isSelected ? Color.brandPurple.opacity(0.2) : Color.white.opacity(0.05))
                        .frame(height: 70)

                    Text(track.icon)
                        .font(.system(size: 28))

                    // 播放指示器
                    if isPlaying {
                        HStack(spacing: 2) {
                            ForEach(0..<3) { index in
                                RoundedRectangle(cornerRadius: 2)
                                    .fill(Color.brandPurple)
                                    .frame(width: 3, height: CGFloat(8 + index * 4))
                            }
                        }
                        .offset(y: 25)
                    }
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(track.name)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(isSelected ? .brandPurple : .white)
                        .lineLimit(1)

                    Text(track.nameEn)
                        .font(.caption2)
                        .foregroundColor(.gray500)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(isSelected ? Color.brandPurple : Color.clear, lineWidth: 2)
            )
        }
    }
}

// MARK: - Preview

#Preview {
    MusicSelectorView()
}
