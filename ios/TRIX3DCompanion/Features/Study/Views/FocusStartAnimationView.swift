//
//  FocusStartAnimationView.swift
//  TRIX3DCompanion
//
//  专注开始动画视图
//  显示"准备→倒计时→开始"的仪式感动画
//

import SwiftUI

// MARK: - Localization Helper
private func L(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

private func L(_ key: String, _ args: CVarArg...) -> String {
    String(format: NSLocalizedString(key, comment: ""), args)
}

struct FocusStartAnimationView: View {

    // MARK: - State

    @State private var phase: AnimationPhase = .prepare
    @State private var countdownNumber: Int = 3
    @State private var scale: CGFloat = 1.0
    @State private var opacity: Double = 1.0

    // MARK: - Properties

    let duration: Int
    let onComplete: () -> Void

    // MARK: - Body

    var body: some View {
        ZStack {
            // 背景遮罩
            Color.black.opacity(0.8)
                .ignoresSafeArea()

            // 光晕效果
            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            Color.brandPurple.opacity(0.3),
                            Color.clear
                        ],
                        center: .center,
                        startRadius: 100,
                        endRadius: 300
                    )
                )
                .frame(width: 600, height: 600)
                .scaleEffect(scale)
                .opacity(opacity)

            // 内容
            content
                .transition(.opacity)
        }
        .onAppear {
            startAnimation()
        }
    }

    // MARK: - View Components

    @ViewBuilder
    private var content: some View {
        switch phase {
        case .prepare:
            prepareView
        case .countdown:
            countdownView
        case .start:
            startView
        }
    }

    private var prepareView: some View {
        VStack(spacing: 24) {
            Text("📚")
                .font(.system(size: 60))

            Text(L("study.focus.prepare"))
                .font(.title)
                .fontWeight(.bold)
                .foregroundColor(.white)

            Text(L("study.focus.duration.belong", duration))
                .font(.title3)
                .foregroundColor(Color.purple.opacity(0.7))
        }
    }

    private var countdownView: some View {
        VStack(spacing: 24) {
            Text("\(countdownNumber)")
                .font(.system(size: 80, weight: .bold))
                .foregroundColor(.clear)
                .overlay(
                    LinearGradient(
                        colors: [Color.brandPurple, Color.brandPink],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                    .mask(
                        Text("\(countdownNumber)")
                            .font(.system(size: 80, weight: .bold))
                    )
                )

            Text(L("study.focus.breathe"))
                .font(.title2)
                .foregroundColor(.white)
        }
    }

    private var startView: some View {
        VStack(spacing: 24) {
            Text("✨")
                .font(.system(size: 60))

            Text(L("study.focus.start"))
                .font(.system(size: 48, weight: .bold))
                .foregroundColor(.clear)
                .overlay(
                    LinearGradient(
                        colors: [Color.brandPurple.opacity(0.8), Color.brandPink.opacity(0.8)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                    .mask(
                        Text(L("study.focus.start"))
                            .font(.system(size: 48, weight: .bold))
                    )
                )

            Text(L("study.focus.encourage"))
                .font(.title3)
                .foregroundColor(Color.purple.opacity(0.7))
        }
    }

    // MARK: - Private Methods

    private func startAnimation() {
        // 阶段1: 准备
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            withAnimation(.easeInOut(duration: 1.5)) {
                scale = 1.2
                opacity = 0.8
            }
        }

        // 阶段2: 倒计时
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            phase = .countdown
            startCountdown()
        }

        // 阶段3: 完成
        DispatchQueue.main.asyncAfter(deadline: .now() + 5.5) {
            phase = .start
        }

        // 结束动画
        DispatchQueue.main.asyncAfter(deadline: .now() + 7) {
            onComplete()
        }
    }

    private func startCountdown() {
        countdownNumber = 3

        for i in stride(from: 3, through: 1, by: -1) {
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(3 - i)) {
                withAnimation(.spring(response: 0.5, dampingFraction: 0.6)) {
                    countdownNumber = i
                    scale = 1.0
                    opacity = 1.0
                }
            }
        }
    }
}

// MARK: - Animation Phase

enum AnimationPhase {
    case prepare
    case countdown
    case start
}

// MARK: - Preview

#Preview("Focus Start Animation") {
    FocusStartAnimationView(duration: 25) {
        print("Animation complete")
    }
}
