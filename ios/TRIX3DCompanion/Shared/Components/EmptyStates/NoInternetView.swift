import SwiftUI

/// 无网络连接视图
/// 当设备没有网络连接时显示
struct NoInternetView: View {
    var onRetry: (() -> Void)?
    var onOfflineMode: (() -> Void)?

    @State private var isRetrying = false

    var body: some View {
        VStack(spacing: 20) {
            // 图标
            ZStack {
                Circle()
                    .fill(Color.error.opacity(0.1))
                    .frame(width: 100, height: 100)

                Image(systemName: "wifi.slash")
                    .font(.system(size: 40))
                    .foregroundColor(.error)
            }

            // 标题
            Text("网络连接失败")
                .font(.title3)
                .fontWeight(.semibold)
                .foregroundColor(.textPrimary)

            // 描述
            Text("请检查您的网络连接，或尝试使用离线模式继续浏览已缓存的内容")
                .font(.body)
                .foregroundColor(.textSecondary)
                .multilineTextAlignment(.center")
                .padding(.horizontal, 32)

            // 操作按钮
            VStack(spacing: 12) {
                if let onRetry = onRetry {
                    Button(action: {
                        performRetry()
                    }) {
                        HStack(spacing: 8) {
                            if isRetrying {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                    .scaleEffect(0.8)
                            } else {
                                Image(systemName: "arrow.clockwise")
                            }
                            Text(isRetrying ? "重试中..." : "重新加载")
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
                    .disabled(isRetrying)
                }

                if let onOfflineMode = onOfflineMode {
                    Button(action: onOfflineMode) {
                        HStack(spacing: 8) {
                            Image(systemName: "arrow.down.circle")
                            Text("离线模式")
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

    // MARK: - Actions

    private func performRetry() {
        isRetrying = true

        // 模拟网络请求延迟
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            isRetrying = false
            onRetry?()
        }
    }
}

// MARK: - Preview

#Preview("无网络 - 浅色") {
    NoInternetView {
        SecureLogger.shared.debug("重新加载")
    } onOfflineMode: {
        SecureLogger.shared.debug("离线模式")
    }
}

#Preview("无网络 - 深色") {
    NoInternetView {
        SecureLogger.shared.debug("重新加载")
    } onOfflineMode: {
        SecureLogger.shared.debug("离线模式")
    }
    .preferredColorScheme(.dark)
}

#Preview("无网络 - 仅重试") {
    NoInternetView {
        SecureLogger.shared.debug("重新加载")
    }
}
