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
    @State private var isPressed = false
    @State private var bubbleText: String = ""

    var body: some View {
        // 右上角小气泡
        VStack(alignment: .trailing, spacing: 0) {
            // 气泡主体
            Button(action: {
                withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                    isPressed = true
                }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                    isPressed = false
                    onTap()
                }
            }) {
                HStack(spacing: 6) {
                    // 星星图标
                    Image(systemName: "sparkles")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(.yellow)

                    // 文字 (最多两行)
                    Text(bubbleText)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(.white)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(
                    RoundedRectangle(cornerRadius: 16)
                        .fill(.ultraThinMaterial)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color.white.opacity(0.25), lineWidth: 0.5)
                )
                .shadow(color: .black.opacity(0.15), radius: 8, x: 0, y: 4)
                .scaleEffect(isPressed ? 0.95 : 1.0)
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
