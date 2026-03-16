import SwiftUI

// MARK: - Localization Helper
private func L(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

/// 空积分历史视图
/// 当用户没有积分交易记录时显示
struct EmptyPointsHistoryView: View {
    var onExplore: (() -> Void)?

    var body: some View {
        VStack(spacing: 20) {
            // 图标
            ZStack {
                Circle()
                    .fill(Color.brandPurple.opacity(0.1))
                    .frame(width: 100, height: 100)

                Image(systemName: "coins")
                    .font(.system(size: 40))
                    .foregroundColor(.brandPurple)
            }

            // 标题
            Text(L("empty.points.title"))
                .font(.title3)
                .fontWeight(.semibold)
                .foregroundColor(.textPrimary)

            // 描述
            Text(L("empty.points.description"))
                .font(.body)
                .foregroundColor(.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            // 操作按钮
            if let onExplore = onExplore {
                Button(action: onExplore) {
                    HStack(spacing: 8) {
                        Image(systemName: "sparkles")
                        Text(L("empty.points.action"))
                    }
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 12)
                    .background(
                        LinearGradient(
                            colors: [.brandPurple, .brandPink],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .cornerRadius(24)
                }
                .padding(.top, 8)
            }
        }
        .padding(24)
    }
}

// MARK: - Preview

#Preview("空积分历史 - 浅色") {
    EmptyPointsHistoryView {
        SecureLogger.shared.debug("去探索")
    }
}

#Preview("空积分历史 - 深色") {
    EmptyPointsHistoryView {
        SecureLogger.shared.debug("去探索")
    }
    .preferredColorScheme(.dark)
}
