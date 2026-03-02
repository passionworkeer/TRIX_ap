//
//  CelebrationAnimationView.swift
//  TRIX3DCompanion
//
//  庆祝动画视图
//  专注完成时的撒花庆祝效果
//

import SwiftUI

struct CelebrationAnimationView: View {

    // MARK: - State

    @State private var confettiPieces: [ConfettiPiece] = []
    @State private var showTrophy = false
    @State private var showContent = false

    // MARK: - Properties

    let studyDuration: Int
    let earnedPoints: Int
    let hasCompanion: Bool
    let companionName: String?
    let onDismiss: () -> Void

    // MARK: - Body

    var body: some View {
        ZStack {
            // 背景遮罩
            Color.black.opacity(0.7)
                .ignoresSafeArea()
                .onTapGesture {
                    onDismiss()
                }

            // 撒花动画
            ForEach(confettiPieces) { piece in
                ConfettiPieceView(piece: piece)
            }

            // 内容
            if showContent {
                VStack(spacing: 24) {
                    // 奖杯图标
                    if showTrophy {
                        trophyView
                    }

                    // 标题
                    VStack(spacing: 8) {
                        Text(studyDuration >= 25 ? "专注完成!" : "结束专注")
                            .font(.title)
                            .fontWeight(.bold)
                            .foregroundColor(.white)

                        Text(studyDuration >= 25 ? "太棒了! 你完成了全部专注时间 🎉" : "每一次专注都是进步 💪")
                            .font(.subheadline)
                            .foregroundColor(.pink)
                    }

                    // 数据卡片
                    dataCard

                    // 好友信息
                    if hasCompanion, let name = companionName {
                        companionView(name: name)
                    }

                    // 积分
                    if earnedPoints > 0 {
                        pointsView
                    }

                    // 关闭按钮
                    Button(action: onDismiss) {
                        Text("返回自习室")
                            .font(.headline)
                            .foregroundColor(.brandPurple)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.white)
                            .cornerRadius(30)
                    }
                    .padding(.horizontal, 40)
                    .padding(.top, 16)
                }
                .transition(.scale.combined(with: .opacity))
            }
        }
        .onAppear {
            startAnimation()
        }
    }

    // MARK: - View Components

    private var trophyView: some View {
        ZStack {
            Circle()
                .fill(
                    LinearGradient(
                        colors: [Color.yellow, Color.orange],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 80, height: 80)
                .shadow(color: .yellow.opacity(0.5), radius: 20)

            Image(systemName: "trophy.fill")
                .font(.system(size: 40))
                .foregroundColor(.white)
        }
        .scaleEffect(showTrophy ? 1 : 0.5)
        .animation(.spring(response: 0.6, dampingFraction: 0.6), value: showTrophy)
    }

    private var dataCard: some View {
        VStack(spacing: 16) {
            // 专注时长
            VStack(spacing: 4) {
                Text("本次专注时长")
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.6))

                HStack(alignment: .lastTextBaseline, spacing: 4) {
                    Text("\(studyDuration)")
                        .font(.system(size: 48, weight: .bold))
                        .foregroundColor(.white)

                    Text("分钟")
                        .font(.title3)
                        .foregroundColor(.white.opacity(0.8))
                }
            }

            if studyDuration < 25 {
                Text("目标: 25 分钟 (\(Int(Double(studyDuration) / 25.0 * 100))%)")
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.5))
            }
        }
        .padding(24)
        .background(Color.white.opacity(0.1))
        .cornerRadius(20)
    }

    private func companionView(name: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "person.fill")
                .foregroundColor(.pink)

            Text("和 ")
                .foregroundColor(.white.opacity(0.8))
            Text(name)
                .fontWeight(.semibold)
                .foregroundColor(.pink)
            Text(" 共度了一段高效时光")
                .foregroundColor(.white.opacity(0.8))
        }
        .font(.subheadline)
    }

    private var pointsView: some View {
        HStack(spacing: 8) {
            Image(systemName: "bolt.fill")
                .foregroundColor(.yellow)

            Text("+\(earnedPoints) 积分")
                .font(.headline)
                .foregroundColor(.yellow)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 8)
        .background(Color.yellow.opacity(0.2))
        .cornerRadius(20)
    }

    // MARK: - Private Methods

    private func startAnimation() {
        // 生成撒花
        confettiPieces = (0..<50).map { _ in
            ConfettiPiece(
                id: UUID(),
                x: CGFloat.random(in: 0...UIScreen.main.bounds.width),
                y: -50,
                rotation: Double.random(in: 0...360),
                color: [Color.pink, Color.yellow, Color.blue, Color.purple, Color.orange].randomElement()!,
                delay: Double.random(in: 0...2)
            )
        }

        // 显示内容
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            showContent = true
        }

        // 显示奖杯
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
            showTrophy = true
        }
    }
}

// MARK: - Confetti Piece

struct ConfettiPiece: Identifiable {
    let id: UUID
    var x: CGFloat
    var y: CGFloat
    var rotation: Double
    let color: Color
    let delay: Double
}

// MARK: - Confetti Piece View

struct ConfettiPieceView: View {
    let piece: ConfettiPiece

    @State private var yOffset: CGFloat = -50

    var body: some View {
        Circle()
            .fill(piece.color)
            .frame(width: 8, height: 8)
            .position(x: piece.x + sin(piece.y / 50) * 30, y: yOffset)
            .rotationEffect(.degrees(piece.rotation))
            .onAppear {
                withAnimation(
                    .easeIn(duration: 4)
                    .delay(piece.delay)
                ) {
                    yOffset = UIScreen.main.bounds.height + 50
                }
            }
    }
}

// MARK: - Preview

#Preview {
    CelebrationAnimationView(
        studyDuration: 25,
        earnedPoints: 50,
        hasCompanion: true,
        companionName: "小明",
        onDismiss: {}
    )
}
