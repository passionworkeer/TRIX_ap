import SwiftUI

/// 骨架屏视图
/// 用于在内容加载时显示占位效果
struct SkeletonView: View {
    @State private var isAnimating = false

    // MARK: - Configuration

    let shape: SkeletonShape
    let lines: Int
    let lineSpacing: CGFloat
    let cornerRadius: CGFloat

    // MARK: - Initialization

    init(
        shape: SkeletonShape = .rectangle,
        lines: Int = 1,
        lineSpacing: CGFloat = 8,
        cornerRadius: CGFloat = 4
    ) {
        self.shape = shape
        self.lines = lines
        self.lineSpacing = lineSpacing
        self.cornerRadius = cornerRadius
    }

    // MARK: - View Body

    var body: some View {
        VStack(spacing: lineSpacing) {
            ForEach(0..<lines, id: \.self) { index in
                skeletonLine(at: index)
            }
        }
        .onAppear {
            withAnimation(
                .linear(duration: 1.5)
                .repeatForever(autoreverses: true)
            ) {
                isAnimating = true
            }
        }
    }

    // MARK: - Private Methods

    @ViewBuilder
    private func skeletonLine(at index: Int) -> some View {
        let widthMultiplier: CGFloat = {
            if lines == 1 { return 1.0 }
            // 最后一行短一些，更自然
            if index == lines - 1 { return 0.7 }
            return 1.0
        }()

        GeometryReader { geometry in
            RoundedRectangle(cornerRadius: cornerRadius)
                .fill(
                    LinearGradient(
                        gradient: Gradient(colors: [
                            Color(.systemGray5),
                            Color(.systemGray6),
                            Color(.systemGray5)
                        ]),
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .frame(width: geometry.size.width * widthMultiplier)
                .offset(x: isAnimating ? geometry.size.width * 0.3 : -geometry.size.width * 0.3)
                .mask(
                    RoundedRectangle(cornerRadius: cornerRadius)
                        .frame(width: geometry.size.width * widthMultiplier)
                )
        }
        .frame(height: shape == .circle ? 60 : (shape == .avatar ? 40 : 16))
    }
}

// MARK: - Skeleton Shape

enum SkeletonShape {
    case rectangle
    case circle
    case avatar
    case roundedRectangle(cornerRadius: CGFloat)
}

// MARK: - Convenience Extensions

extension SkeletonView {
    /// 圆形骨架（用于头像）
    static func circle(size: CGFloat = 60) -> some View {
        SkeletonView(shape: .circle)
            .frame(width: size, height: size)
    }

    /// 头像骨架
    static func avatar(size: CGFloat = 40) -> some View {
        SkeletonView(shape: .avatar)
            .frame(width: size, height: size)
    }

    /// 文本行骨架
    static func text(lines: Int = 1) -> some View {
        SkeletonView(lines: lines)
    }
}

// MARK: - Previews

#Preview("骨架屏 - 各种形状") {
    VStack(spacing: 20) {
        HStack(spacing: 16) {
            SkeletonView.circle(size: 60)
            VStack(alignment: .leading, spacing: 8) {
                SkeletonView.text(lines: 1)
                    .frame(width: 120)
                SkeletonView.text(lines: 1)
                    .frame(width: 80)
            }
            Spacer()
        }

        SkeletonView.text(lines: 3)

        SkeletonView(shape: .rectangle, lines: 2)
    }
    .padding()
}

#Preview("骨架屏 - 列表") {
    List {
        ForEach(0..<5) { _ in
            HStack(spacing: 12) {
                SkeletonView.avatar(size: 48)
                    .frame(width: 48, height: 48)

                VStack(alignment: .leading, spacing: 6) {
                    SkeletonView.text(lines: 1)
                        .frame(width: 120)
                    SkeletonView.text(lines: 1)
                        .frame(width: 80)
                }

                Spacer()

                SkeletonView.text(lines: 1)
                    .frame(width: 40)
            }
            .padding(.vertical, 8)
        }
    }
}
