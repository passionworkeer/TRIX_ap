//
//  HomeBotBubbleView.swift
//  TRIX3DCompanion
//
//  Floating robot avatar bubble for home screen chat entry
//

import SwiftUI

struct HomeBotBubbleView: View {
    let botName: String
    let botAvatar: String
    let onTap: () -> Void

    @State private var isAnimating = false
    @State private var isPressed = false

    var body: some View {
        Button(action: {
            withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                isPressed = true
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                isPressed = false
                onTap()
            }
        }) {
            HStack(spacing: 12) {
                // Bot Avatar
                ZStack {
                    // Glow effect
                    Circle()
                        .fill(
                            RadialGradient(
                                colors: [Color.brandPurple.opacity(0.5), .clear],
                                center: .center,
                                startRadius: 0,
                                endRadius: 25
                            )
                        )
                        .frame(width: 50, height: 50)
                        .blur(radius: isAnimating ? 8 : 4)
                        .scaleEffect(isAnimating ? 1.1 : 1.0)

                    // Avatar circle
                    Circle()
                        .fill(
                            LinearGradient(
                                colors: [Color.brandPurple, Color.brandPink],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 44, height: 44)

                    // Avatar icon
                    Image(systemName: botAvatar)
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundColor(.white)
                }

                // Bot info
                VStack(alignment: .leading, spacing: 2) {
                    Text(botName)
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(.white)

                    Text(NSLocalizedString("home.bot.greeting", comment: ""))
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.8))
                }

                Spacer()

                // Chat icon
                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.white.opacity(0.8))
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(
                RoundedRectangle(cornerRadius: 24)
                    .fill(
                        LinearGradient(
                            colors: [
                                Color.brandPurple.opacity(0.8),
                                Color.brandPink.opacity(0.6)
                            ],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
            )
            .overlay(
                RoundedRectangle(cornerRadius: 24)
                    .stroke(
                        LinearGradient(
                            colors: [.white.opacity(0.3), .white.opacity(0.1)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 1
                    )
            )
            .shadow(color: Color.brandPurple.opacity(0.3), radius: 10, x: 0, y: 5)
            .scaleEffect(isPressed ? 0.95 : 1.0)
        }
        .buttonStyle(.plain)
        .onAppear {
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
            .padding(.horizontal, 20)
            .padding(.bottom, 100)
        }
    }
}
