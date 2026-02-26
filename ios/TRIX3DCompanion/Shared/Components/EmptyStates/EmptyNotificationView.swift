import SwiftUI

/// 空通知视图
/// 当用户没有通知时显示
struct EmptyNotificationView: View {
    var onGoHome: (() -> Void)?

    var body: some View {
        VStack(spacing: 20) {
            // 图标
            ZStack {
                Circle()
                    .fill(Color.brandPurple.opacity(0.1))
                    .frame(width: 100, height: 100)

                Image(systemName: "bell.slash.fill")
                    .font(.system(size: 40))
                    .foregroundColor(.brandPurple)
            }

            // 标题
            Text("没有新通知")
                .font(.title3)
                .fontWeight(.semibold)
                .foregroundColor(.textPrimary)

            // 描述
            Text("当有新的活动、消息或提醒时，你会在这里看到通知")
                .font(.body)
                .foregroundColor(.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            // 操作按钮
            if let onGoHome = onGoHome {
                Button(action: onGoHome) {
                    HStack(spacing: 8) {
                        Image(systemName: "house.fill")
                        Text("返回首页")
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

#Preview("空通知 - 浅色") {
    EmptyNotificationView {
        SecureLogger.shared.debug("返回首页")
    }
}

#Preview("空通知 - 深色") {
    EmptyNotificationView {
        SecureLogger.shared.debug("返回首页")
    }
    .preferredColorScheme(.dark)
}

#Preview("空通知 - 无按钮") {
    EmptyNotificationView()
}
