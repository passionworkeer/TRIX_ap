//
//  ToastManager.swift
//  TRIX3DCompanion
//
//  Global toast notification manager using PopupView
//

import SwiftUI
import PopupView

// MARK: - Toast Type

enum ToastType {
    case success
    case error
    case info
    case warning

    var icon: String {
        switch self {
        case .success: return "checkmark.circle.fill"
        case .error: return "xmark.circle.fill"
        case .info: return "info.circle.fill"
        case .warning: return "exclamationmark.triangle.fill"
        }
    }

    var color: Color {
        switch self {
        case .success: return Color(hex: "22C55E")
        case .error: return Color(hex: "EF4444")
        case .info: return Color(hex: "3B82F6")
        case .warning: return Color(hex: "F59E0B")
        }
    }

    var defaultMessage: String {
        switch self {
        case .success: return "操作成功"
        case .error: return "操作失败"
        case .info: return "提示信息"
        case .warning: return "警告"
        }
    }
}

// MARK: - Toast Item

struct ToastItem: Identifiable {
    let id = UUID()
    let type: ToastType
    let message: String
    let duration: TimeInterval
}

// MARK: - Toast Manager

@MainActor
final class ToastManager: ObservableObject {
    static let shared = ToastManager()

    @Published private(set) var toasts: [ToastItem] = []

    private init() {}

    // MARK: - Public Methods

    /// Show a success toast
    func success(_ message: String = "操作成功", duration: TimeInterval = 2.0) {
        show(type: .success, message: message, duration: duration)
    }

    /// Show an error toast
    func error(_ message: String = "操作失败", duration: TimeInterval = 3.0) {
        show(type: .error, message: message, duration: duration)
    }

    /// Show an info toast
    func info(_ message: String, duration: TimeInterval = 2.0) {
        show(type: .info, message: message, duration: duration)
    }

    /// Show a warning toast
    func warning(_ message: String, duration: TimeInterval = 2.5) {
        show(type: .warning, message: message, duration: duration)
    }

    /// Show a toast with custom type and message
    func show(type: ToastType, message: String? = nil, duration: TimeInterval = 2.0) {
        let toastMessage = message ?? type.defaultMessage
        let toast = ToastItem(type: type, message: toastMessage, duration: duration)
        toasts.append(toast)
    }

    /// Remove a toast by id
    func removeToast(id: UUID) {
        toasts.removeAll { $0.id == id }
    }

    /// Clear all toasts
    func clearAll() {
        toasts.removeAll()
    }
}

// MARK: - Toast View

struct ToastView: View {
    let item: ToastItem
    let onDismiss: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            // Icon
            Image(systemName: item.type.icon)
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(item.type.color)

            // Message
            Text(item.message)
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundStyle(.primary)
                .lineLimit(2)

            Spacer()

            // Close button
            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(.regularMaterial)
                .shadow(color: .black.opacity(0.15), radius: 8, x: 0, y: 4)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(item.type.color.opacity(0.3), lineWidth: 1)
        )
        .padding(.horizontal, 16)
    }
}

// MARK: - Toast Container View

struct ToastContainerView: View {
    @ObservedObject var toastManager = ToastManager.shared

    var body: some View {
        ZStack {
            ForEach(toastManager.toasts) { item in
                PopupView(
                    item: item,
                    type: .toast(
                        verticalPadding: 0,
                        horizontalPadding: 0,
                        useSafeAreaInset: true
                    ),
                    position: .top,
                    appearFrom: .topSlide,
                    disappearTo: .topSlide,
                    animation: .spring(response: 0.4, dampingFraction: 0.7),
                    autohideIn: item.duration,
                    dismissCallback: {
                        toastManager.removeToast(id: item.id)
                    }
                ) {
                    ToastView(item: item) {
                        toastManager.removeToast(id: item.id)
                    }
                }
            }
        }
    }
}

// MARK: - View Extension for Easy Toast

extension View {
    /// Add toast container to view
    func withToast() -> some View {
        self.overlay(ToastContainerView())
    }
}
