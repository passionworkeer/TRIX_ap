import SwiftUI

// MARK: - Localization Helper
private func L(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

/// 空消息列表视图
/// 当用户没有消息时显示
struct EmptyMessageListView: View {
    var onStartChat: (() -> Void)?

    var body: some View {
        VStack(spacing: 20) {
            // 图标
            ZStack {
                Circle()
                    .fill(Color.brandPurple.opacity(0.1))
                    .frame(width: 100, height: 100)

                Image(systemName: "message.fill")
                    .font(.system(size: 40))
                    .foregroundColor(.brandPurple)
            }

            // 标题
            Text(L("empty.messages"))
                .font(.title3)
                .fontWeight(.semibold)
                .foregroundColor(.textPrimary)

            // 描述
            Text(L("empty.message.description"))
                .font(.body)
                .foregroundColor(.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            // 操作按钮
            if let onStartChat = onStartChat {
                Button(action: onStartChat) {
                    HStack(spacing: 8) {
                        Image(systemName: "message.badge.fill")
                        Text(L("empty.message.action"))
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

#Preview("空消息列表 - 浅色") {
    EmptyMessageListView {
        SecureLogger.shared.debug("开始聊天")
    }
}

#Preview("空消息列表 - 深色") {
    EmptyMessageListView {
        SecureLogger.shared.debug("开始聊天")
    }
    .preferredColorScheme(.dark)
}

#Preview("空消息列表 - 无按钮") {
    EmptyMessageListView()
}
