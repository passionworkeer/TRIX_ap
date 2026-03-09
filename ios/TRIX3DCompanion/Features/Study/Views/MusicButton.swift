//
//  MusicButton.swift
//  TRIX3DCompanion
//
//  音乐控制按钮组件
//  显示当前播放状态，点击打开音乐选择器
//

import SwiftUI

struct MusicButton: View {

    // MARK: - State

    @StateObject private var audioPlayer = AudioPlayerService.shared
    @Binding var showMusicSelector: Bool

    // MARK: - Body

    var body: some View {
        Button(action: {
            showMusicSelector = true
        }) {
            ZStack {
                Circle()
                    .fill(Color.white.opacity(0.1))
                    .frame(width: 44, height: 44)

                if let track = audioPlayer.currentTrack, audioPlayer.state == .playing {
                    // 播放中显示音频可视化
                    HStack(spacing: 2) {
                        ForEach(0..<3) { index in
                            RoundedRectangle(cornerRadius: 2)
                                .fill(Color.brandPurple)
                                .frame(width: 2, height: CGFloat(6 + index * 3))
                        }
                    }
                    .animation(.easeInOut(duration: 0.5).repeatForever(autoreverses: true), value: audioPlayer.state)
                } else if audioPlayer.currentTrack != nil {
                    // 已选择但暂停
                    Image(systemName: "music.note")
                        .font(.system(size: 16))
                        .foregroundColor(.purple)
                } else {
                    // 未选择
                    Image(systemName: "music.note")
                        .font(.system(size: 16))
                        .foregroundColor(.textSecondary)
                }
            }
        }
    }
}

// MARK: - Preview

#Preview {
    ZStack {
        Color.gray
        MusicButton(showMusicSelector: .constant(false))
    }
}
