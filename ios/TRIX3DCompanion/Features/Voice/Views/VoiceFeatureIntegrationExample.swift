//
//  VoiceFeatureIntegrationExample.swift
//  TRIX3DCompanion
//
//  Integration example showing how to use Voice features together
//

import SwiftUI

// MARK: - Voice Feature Integration Example

/// Example view demonstrating Voice feature integration
struct VoiceFeatureIntegrationExample: View {

    // MARK: - State

    @State private var selectedTab: VoiceTab = .player
    @State private var showTTSPanel = false

    // MARK: - Body

    var body: some View {
        VStack(spacing: 0) {
            // Tab selector
            tabSelector

            // Content
            ScrollView {
                VStack(spacing: 20) {
                    switch selectedTab {
                    case .player:
                        voicePlayerSection

                    case .tts:
                        ttsSection

                    case .combined:
                        combinedSection
                    }
                }
                .padding()
            }
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("语音功能")
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Tab Selector

    private var tabSelector: some View {
        HStack(spacing: 0) {
            ForEach(VoiceTab.allCases) { tab in
                Button(action: {
                    withAnimation(.spring(response: 0.3)) {
                        selectedTab = tab
                    }
                }) {
                    VStack(spacing: 4) {
                        Image(systemName: tab.icon)
                            .font(.title3)

                        Text(tab.title)
                            .font(.caption)
                    }
                    .foregroundColor(selectedTab == tab ? .purple : .secondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(.ultraThinMaterial)
                }
                .buttonStyle(.plain)
            }
        }
        .overlay(
            Rectangle()
                .fill(Color.purple)
                .frame(height: 2)
                .offset(x: tabOffset(from: selectedTab))
                .animation(.spring(response: 0.3), value: selectedTab),
            alignment: .bottom
        )
    }

    private func tabOffset(from tab: VoiceTab) -> CGFloat {
        let index = CGFloat(VoiceTab.allCases.firstIndex(of: tab) ?? 0)
        let width = UIScreen.main.bounds.width / CGFloat(VoiceTab.allCases.count)
        return (index * width) - (UIScreen.main.bounds.width / 2) + (width / 2)
    }

    // MARK: - Voice Player Section

    private var voicePlayerSection: some View {
        VStack(spacing: 20) {
            // Full player
            VoiceMessagePlayerView(
                audioURL: URL(fileURLWithPath: "/tmp/sample.m4a")
            )

            // Compact players
            VStack(alignment: .leading, spacing: 12) {
                Text("紧凑模式")
                    .font(.headline)
                    .foregroundColor(.secondary)

                VStack(spacing: 12) {
                    CompactVoicePlayerView(
                        audioURL: URL(fileURLWithPath: "/tmp/audio1.m4a")
                    )

                    CompactVoicePlayerView(
                        audioURL: URL(fileURLWithPath: "/tmp/audio2.m4a")
                    )

                    CompactVoicePlayerView(
                        audioURL: URL(fileURLWithPath: "/tmp/audio3.m4a")
                    )
                }
            }
        }
    }

    // MARK: - TTS Section

    private var ttsSection: some View {
        VStack(spacing: 20) {
            // Full TTS control
            TTSControlView()

            // Compact TTS controls
            VStack(alignment: .leading, spacing: 12) {
                Text("紧凑模式")
                    .font(.headline)
                    .foregroundColor(.secondary)

                VStack(spacing: 12) {
                    CompactTTSControlView()

                    HStack {
                        CompactTTSControlView()

                        Spacer()

                        MiniTTSButton()
                    }
                }
            }
        }
    }

    // MARK: - Combined Section

    private var combinedSection: some View {
        VStack(spacing: 20) {
            // Voice player with TTS
            VStack(alignment: .leading, spacing: 16) {
                Text("语音播放器 + TTS")
                    .font(.headline)
                    .foregroundColor(.secondary)

                VoiceMessagePlayerView(
                    audioURL: URL(fileURLWithPath: "/tmp/lecture.m4a")
                )

                CompactTTSControlView()
            }

            // Use case example
            VStack(alignment: .leading, spacing: 16) {
                Text("使用场景示例")
                    .font(.headline)
                    .foregroundColor(.secondary)

                useCaseCard(
                    icon: "speaker.wave.3.fill",
                    title: "课堂录音回放",
                    description: "播放课堂录音的同时，使用 TTS 朗读重要笔记"
                )

                useCaseCard(
                    icon: "mic.fill",
                    title: "语音消息转文字",
                    description: "收听语音消息，TTS 自动朗读内容"
                )

                useCaseCard(
                    icon: "books.vertical.fill",
                    title: "学习辅助",
                    description: "播放音频教材，TTS 朗读配套文本"
                )
            }
        }
    }

    // MARK: - Use Case Card

    private func useCaseCard(
        icon: String,
        title: String,
        description: String
    ) -> some View {
        HStack(spacing: 16) {
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [Color.purple.opacity(0.2), Color.pink.opacity(0.2)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 56, height: 56)

                Image(systemName: icon)
                    .font(.title2)
                    .foregroundStyle(
                        LinearGradient(
                            colors: [.purple, .pink],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.semibold)

                Text(description)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(16)
        .glassPanel(cornerRadius: 16)
    }
}

// MARK: - Voice Tab

enum VoiceTab: String, CaseIterable, Identifiable {
    case player
    case tts
    case combined

    var id: String { rawValue }

    var title: String {
        switch self {
        case .player: return "播放器"
        case .tts: return "TTS"
        case .combined: return "组合"
        }
    }

    var icon: String {
        switch self {
        case .player: return "play.circle.fill"
        case .tts: return "speaker.wave.3.fill"
        case .combined: return "rectangle.stack.fill"
        }
    }
}

// MARK: - Preview

#Preview("Voice Feature Integration") {
    NavigationView {
        VoiceFeatureIntegrationExample()
    }
}

#Preview("Dark Mode") {
    NavigationView {
        VoiceFeatureIntegrationExample()
    }
    .preferredColorScheme(.dark)
}
