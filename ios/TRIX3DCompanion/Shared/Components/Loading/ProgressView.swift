import SwiftUI

/// 进度条视图
/// 用于显示进度状态，支持线性和圆形两种样式
struct ProgressView: View {
    // MARK: - Configuration

    let value: Double
    let total: Double
    let style: ProgressStyle
    let showPercentage: Bool
    let title: String?

    // MARK: - Computed Properties

    private var progress: Double {
        guard total > 0 else { return 0 }
        return min(max(value / total, 0), 1)
    }

    private var percentageText: String {
        let percentage = Int(progress * 100)
        return "\(percentage)%"
    }

    // MARK: - Initialization

    init(
        value: Double,
        total: Double = 1.0,
        style: ProgressStyle = .linear,
        showPercentage: Bool = true,
        title: String? = nil
    ) {
        self.value = value
        self.total = total
        self.style = style
        self.showPercentage = showPercentage
        self.title = title
    }

    // MARK: - View Body

    var body: some View {
        VStack(spacing: 8) {
            // 标题和百分比
            if title != nil || showPercentage {
                HStack {
                    if let title = title {
                        Text(title)
                            .font(.subheadline)
                            .foregroundColor(.textSecondary)
                    }

                    Spacer()

                    if showPercentage {
                        Text(percentageText)
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .foregroundColor(progressColor)
                    }
                }
            }

            // 进度条
            switch style {
            case .linear:
                linearProgressBar
            case .circular:
                circularProgressBar
            case .gradient:
                gradientProgressBar
            }
        }
    }

    // MARK: - Progress Bar Styles

    private var linearProgressBar: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                // 背景
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color(.systemGray5))

                // 进度
                RoundedRectangle(cornerRadius: 4)
                    .fill(progressColor)
                    .frame(width: geometry.size.width * progress)
                    .animation(.easeInOut(duration: 0.3), value: progress)
            }
        }
        .frame(height: 8)
    }

    private var circularProgressBar: some View {
        ZStack {
            // 背景圆环
            Circle()
                .stroke(Color(.systemGray5), lineWidth: 8)

            // 进度圆环
            Circle()
                .trim(from: 0, to: progress)
                .stroke(
                    progressGradient,
                    style: StrokeStyle(lineWidth: 8, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
                .animation(.easeInOut(duration: 0.3), value: progress)

            // 中心百分比文字
            if showPercentage {
                VStack(spacing: 2) {
                    Text(percentageText)
                        .font(.title2)
                        .fontWeight(.bold)
                        .foregroundColor(.textPrimary)

                    if let title = title {
                        Text(title)
                            .font(.caption)
                            .foregroundColor(.textSecondary)
                    }
                }
            }
        }
        .frame(width: 120, height: 120)
    }

    private var gradientProgressBar: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                // 背景
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color(.systemGray5))

                // 渐变进度
                RoundedRectangle(cornerRadius: 4)
                    .fill(
                        LinearGradient(
                            colors: [.brandPurple, .brandPink],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .frame(width: geometry.size.width * progress)
                    .animation(.easeInOut(duration: 0.3), value: progress)
            }
        }
        .frame(height: 8)
    }

    // MARK: - Computed Colors

    private var progressColor: Color {
        switch progress {
        case 0..<0.3:
            return .error
        case 0.3..<0.7:
            return .warning
        default:
            return .success
        }
    }

    private var progressGradient: AngularGradient {
        AngularGradient(
            gradient: Gradient(colors: [.brandPurple, .brandPink, .brandPurple]),
            center: .center,
            startAngle: .degrees(0),
            endAngle: .degrees(360)
        )
    }
}

// MARK: - Progress Style

enum ProgressStyle {
    case linear
    case circular
    case gradient
}

// MARK: - Previews

#Preview("进度条 - 线性") {
    VStack(spacing: 20) {
        ProgressView(value: 0.25, total: 1.0, style: .linear, title: "下载中...")
        ProgressView(value: 0.5, total: 1.0, style: .linear, title: "上传中...")
        ProgressView(value: 0.75, total: 1.0, style: .linear, title: "处理中...")
        ProgressView(value: 1.0, total: 1.0, style: .linear, title: "完成")
    }
    .padding()
}

#Preview("进度条 - 圆形") {
    HStack(spacing: 40) {
        ProgressView(value: 0.35, total: 1.0, style: .circular, title: "进度")
        ProgressView(value: 0.7, total: 1.0, style: .circular, title: "进度")
        ProgressView(value: 1.0, total: 1.0, style: .circular, title: "完成")
    }
    .padding()
}

#Preview("进度条 - 渐变") {
    VStack(spacing: 20) {
        ProgressView(value: 0.3, total: 1.0, style: .gradient, title: "加载中...")
        ProgressView(value: 0.6, total: 1.0, style: .gradient, title: "加载中...")
        ProgressView(value: 0.9, total: 1.0, style: .gradient, title: "即将完成...")
    }
    .padding()
}

#Preview("进度条 - 深色模式") {
    VStack(spacing: 20) {
        ProgressView(value: 0.45, total: 1.0, style: .linear, title: "处理中...")
        ProgressView(value: 0.8, total: 1.0, style: .circular, title: "进度")
    }
    .padding()
    .preferredColorScheme(.dark)
}
