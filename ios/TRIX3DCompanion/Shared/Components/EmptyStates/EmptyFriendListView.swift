import SwiftUI

// MARK: - Localization Helper
private func L(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

/// 空好友列表视图
/// 当用户没有好友时显示
struct EmptyFriendListView: View {
    var onAddFriend: (() -> Void)?
    var onScanQR: (() -> Void)?

    var body: some View {
        VStack(spacing: 20) {
            // 图标
            ZStack {
                Circle()
                    .fill(Color.brandPurple.opacity(0.1))
                    .frame(width: 100, height: 100)

                Image(systemName: "person.2")
                    .font(.system(size: 40))
                    .foregroundColor(.brandPurple)
            }

            // 标题
            Text(L("empty.friends"))
                .font(.title3)
                .fontWeight(.semibold)
                .foregroundColor(.textPrimary)

            // 描述
            Text(L("empty.friend.description"))
                .font(.body)
                .foregroundColor(.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            // 操作按钮
            VStack(spacing: 12) {
                if let onAddFriend = onAddFriend {
                    Button(action: onAddFriend) {
                        HStack(spacing: 8) {
                            Image(systemName: "person.badge.plus")
                            Text(L("empty.friend.add"))
                        }
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(.white)
                        .frame(maxWidth: 200)
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
                }

                if let onScanQR = onScanQR {
                    Button(action: onScanQR) {
                        HStack(spacing: 8) {
                            Image(systemName: "qrcode")
                            Text(L("empty.friend.scan"))
                        }
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(.brandPurple)
                        .frame(maxWidth: 200)
                        .padding(.vertical, 12)
                        .background(Color.brandPurple.opacity(0.1))
                        .cornerRadius(24)
                    }
                }
            }
            .padding(.top, 8)
        }
        .padding(24)
    }
}

// MARK: - Preview

#Preview("空好友列表 - 浅色") {
    EmptyFriendListView(
        onAddFriend: {
            SecureLogger.shared.debug("添加好友")
        },
        onScanQR: {
            SecureLogger.shared.debug("扫一扫")
        }
    )
}

#Preview("空好友列表 - 深色") {
    EmptyFriendListView(
        onAddFriend: {
            SecureLogger.shared.debug("添加好友")
        },
        onScanQR: {
            SecureLogger.shared.debug("扫一扫")
        }
    )
    .preferredColorScheme(.dark)
}

#Preview("空好友列表 - 仅添加") {
    EmptyFriendListView(onAddFriend: {
        SecureLogger.shared.debug("添加好友")
    })
}
