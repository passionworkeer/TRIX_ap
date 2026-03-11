//
//  HomeBotBubbleView.swift
//  TRIX3DCompanion
//
//  Floating robot avatar bubble for home screen chat entry
//  仿照 Web 端的 HomeBotBubble.tsx 设计
//

import SwiftUI

struct HomeBotBubbleView: View {
    let botName: String
    let botAvatar: String
    let onTap: () -> Void

    @State private var isAnimating = false
    @State private var bubbleText: String = ""

    var body: some View {
        VStack(alignment: .trailing, spacing: 0) {
            Button(action: onTap) {
                HStack(spacing: 6) {
                    ZStack {
                        Circle()
                            .fill(Color.green.opacity(0.22))
                            .frame(width: 22, height: 22)
                            .scaleEffect(isAnimating ? 1.18 : 0.94)

                        Circle()
                            .fill(Color.green)
                            .frame(width: 8, height: 8)
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        Text(botName)
                            .font(.system(size: 10, weight: .bold, design: .rounded))
                            .foregroundColor(.white.opacity(0.9))

                        Text(bubbleText)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(.white)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                    }
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(
                    RoundedRectangle(cornerRadius: 16)
                        .fill(.ultraThinMaterial)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color.white.opacity(0.25), lineWidth: 0.8)
                )
                .shadow(color: .black.opacity(0.15), radius: 8, x: 0, y: 4)
            }
            .buttonStyle(.plain)

            // 小箭头 (气泡右下角的三角形)
            Image(systemName: "chevron.right")
                .font(.system(size: 8, weight: .bold))
                .foregroundColor(.white.opacity(0.8))
                .padding(.trailing, 8)
        }
        .onAppear {
            bubbleText = NSLocalizedString("home.bot.greeting", comment: "")
            withAnimation(.easeInOut(duration: 2.0).repeatForever(autoreverses: true)) {
                isAnimating = true
            }
        }
    }
}

// MARK: - Preview

#Preview("Home Bot Bubble") {
    ZStack {
        Color.black.ignoresSafeArea()

        VStack {
            Spacer()

            HomeBotBubbleView(
                botName: "TRIX AI",
                botAvatar: "sparkles",
                onTap: {}
            )
            .padding(.trailing, 20)
            .padding(.top, 100)
        }
    }
}
