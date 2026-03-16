//
//  ConfirmDialog.swift
//  TRIX3DCompanion
//
//  Created by TRIX 3D Companion Team
//

import SwiftUI

// MARK: - Localization Helper
private func L(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

/// A reusable confirmation dialog component with customizable buttons
/// Supports both standard and destructive (danger) actions
struct ConfirmDialog: View {
    // MARK: - Button Style
    enum ButtonStyle {
        case `default`
        case destructive
        case cancel

        var color: Color {
            switch self {
            case .default: return .purple
            case .destructive: return .red
            case .cancel: return .secondary
            }
        }

        var fillStyle: any ShapeStyle {
            switch self {
            case .default:
                return LinearGradient(
                    colors: [.purple, .pink],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            case .destructive:
                return LinearGradient(
                    colors: [.red, .red.opacity(0.8)],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            case .cancel:
                return Color.secondary.opacity(0.2)
            }
        }
    }

    // MARK: - Properties
    let title: String
    let message: String
    var confirmText: String = ""
    var cancelText: String = ""
    var isDestructive: Bool = false
    let onConfirm: () -> Void
    let onCancel: () -> Void

    // MARK: - Body
    var body: some View {
        ZStack {
            // Dimmed background
            Color.black.opacity(0.4)
                .ignoresSafeArea()
                .onTapGesture {
                    onCancel()
                }

            // Dialog content
            VStack(spacing: 24) {
                // Title and message
                VStack(spacing: 12) {
                    Image(systemName: isDestructive ? "exclamationmark.triangle.fill" : "checkmark.circle.fill")
                        .font(.system(size: 48))
                        .foregroundStyle(
                            LinearGradient(
                                colors: isDestructive ? [.red, .orange] : [.purple, .pink],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )

                    Text(title)
                        .font(.title2)
                        .fontWeight(.semibold)
                        .foregroundColor(.primary)

                    Text(message)
                        .font(.body)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                }

                // Buttons
                VStack(spacing: 12) {
                    Button(action: onConfirm) {
                        Text(confirmText.isEmpty ? L("action.confirm") : confirmText)
                            .font(.headline)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(isDestructive ? Color.red : Color.purple)
                            .cornerRadius(12)
                    }
                    .buttonStyle(.plain)

                    Button(action: onCancel) {
                        Text(cancelText.isEmpty ? L("action.cancel") : cancelText)
                            .font(.headline)
                            .foregroundColor(.primary)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(Color.secondary.opacity(0.2))
                            .cornerRadius(12)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(24)
            .background {
                RoundedRectangle(cornerRadius: 16)
                    .fill(Material.ultraThinMaterial)
            }
            .overlay {
                RoundedRectangle(cornerRadius: 16)
                    .stroke(
                        LinearGradient(
                            colors: [.white.opacity(0.2), .clear],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 1
                    )
            }
            .shadow(color: .black.opacity(0.2), radius: 20, x: 0, y: 10)
            .padding(.horizontal, 40)
            .transition(.scale.combined(with: .opacity))
        }
    }
}

// MARK: - Convenience Initializers
extension ConfirmDialog {
    /// Creates a delete confirmation dialog
    static func delete(
        item: String,
        onConfirm: @escaping () -> Void,
        onCancel: @escaping () -> Void = {}
    ) -> ConfirmDialog {
        ConfirmDialog(
            title: String(format: L("action.delete.item"), item),
            message: String(format: L("action.delete.item.description"), item),
            confirmText: L("action.delete"),
            cancelText: L("action.cancel"),
            isDestructive: true,
            onConfirm: onConfirm,
            onCancel: onCancel
        )
    }

    /// Creates a sign out confirmation dialog
    static func signOut(
        onConfirm: @escaping () -> Void,
        onCancel: @escaping () -> Void = {}
    ) -> ConfirmDialog {
        ConfirmDialog(
            title: L("action.signout"),
            message: L("action.signout.confirm"),
            confirmText: L("action.signout"),
            cancelText: L("action.cancel"),
            isDestructive: false,
            onConfirm: onConfirm,
            onCancel: onCancel
        )
    }

    /// Creates a generic confirmation dialog
    static func confirm(
        title: String,
        message: String,
        confirmText: String = "",
        onConfirm: @escaping () -> Void,
        onCancel: @escaping () -> Void = {}
    ) -> ConfirmDialog {
        ConfirmDialog(
            title: title,
            message: message,
            confirmText: confirmText.isEmpty ? L("action.confirm") : confirmText,
            cancelText: L("action.cancel"),
            isDestructive: false,
            onConfirm: onConfirm,
            onCancel: onCancel
        )
    }
}

// MARK: - Preview Wrapper
struct ConfirmDialogPreviewWrapper: View {
    @State private var showDialog: DialogType?
    @State private var isShowing = false

    enum DialogType {
        case delete
        case signOut
        case custom
    }

    var body: some View {
        ZStack {
            // Background
            LinearGradient(
                colors: [.purple.opacity(0.3), .pink.opacity(0.3)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            // Buttons to trigger dialogs
            VStack(spacing: 20) {
                Button(L("preview.dialog.delete")) {
                    showDialog = .delete
                    isShowing = true
                }
                .glassPanel()

                Button(L("preview.dialog.signout")) {
                    showDialog = .signOut
                    isShowing = true
                }
                .glassPanel()

                Button(L("preview.dialog.custom")) {
                    showDialog = .custom
                    isShowing = true
                }
                .glassPanel()
            }

            // Dialog overlay
            if isShowing {
                switch showDialog {
                case .delete:
                    ConfirmDialog.delete(item: L("preview.dialog.model")) {
                        SecureLogger.shared.debug("Delete confirmed")
                        isShowing = false
                    } onCancel: {
                        SecureLogger.shared.debug("Delete cancelled")
                        isShowing = false
                    }
                case .signOut:
                    ConfirmDialog.signOut {
                        SecureLogger.shared.debug("Sign out confirmed")
                        isShowing = false
                    } onCancel: {
                        SecureLogger.shared.debug("Sign out cancelled")
                        isShowing = false
                    }
                case .custom:
                    ConfirmDialog.confirm(
                        title: L("action.upload.model"),
                        message: L("action.upload.model.description"),
                        confirmText: L("action.upload")
                    ) {
                        SecureLogger.shared.debug("Upload confirmed")
                        isShowing = false
                    } onCancel: {
                        SecureLogger.shared.debug("Upload cancelled")
                        isShowing = false
                    }
                case .none:
                    EmptyView()
                }
            }
        }
    }
}

// MARK: - Previews
#Preview("Delete dialog") {
    ConfirmDialogPreviewWrapper()
}

#Preview("Dark mode") {
    ConfirmDialogPreviewWrapper()
        .preferredColorScheme(.dark)
}

#Preview("Standalone delete dialog") {
    ZStack {
        Color.black.ignoresSafeArea()

        ConfirmDialog.delete(item: "Project") {
            SecureLogger.shared.debug("Deleted")
        } onCancel: {
            SecureLogger.shared.debug("Cancelled")
        }
    }
}
