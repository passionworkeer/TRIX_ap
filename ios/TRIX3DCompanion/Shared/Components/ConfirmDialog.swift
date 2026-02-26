//
//  ConfirmDialog.swift
//  TRIX3DCompanion
//
//  Created by TRIX 3D Companion Team
//

import SwiftUI

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
    var confirmText: String = "Confirm"
    var cancelText: String = "Cancel"
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
                        Text(confirmText)
                            .font(.headline)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(
                                isDestructive ? ButtonStyle.destructive.fillStyle : ButtonStyle.default.fillStyle
                            )
                            .cornerRadius(12)
                    }
                    .buttonStyle(.plain)

                    Button(action: onCancel) {
                        Text(cancelText)
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
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(.ultraThinMaterial)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(
                        LinearGradient(
                            colors: [.white.opacity(0.2), .clear],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 1
                    )
            )
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
            title: "Delete \(item)?",
            message: "This action cannot be undone. Are you sure you want to delete this \(item)?",
            confirmText: "Delete",
            cancelText: "Cancel",
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
            title: "Sign Out",
            message: "Are you sure you want to sign out? Any unsaved changes may be lost.",
            confirmText: "Sign Out",
            cancelText: "Cancel",
            isDestructive: false,
            onConfirm: onConfirm,
            onCancel: onCancel
        )
    }

    /// Creates a generic confirmation dialog
    static func confirm(
        title: String,
        message: String,
        confirmText: String = "Confirm",
        onConfirm: @escaping () -> Void,
        onCancel: @escaping () -> Void = {}
    ) -> ConfirmDialog {
        ConfirmDialog(
            title: title,
            message: message,
            confirmText: confirmText,
            cancelText: "Cancel",
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
                Button("Show Delete Dialog") {
                    showDialog = .delete
                    isShowing = true
                }
                .glassPanel()

                Button("Show Sign Out Dialog") {
                    showDialog = .signOut
                    isShowing = true
                }
                .glassPanel()

                Button("Show Custom Dialog") {
                    showDialog = .custom
                    isShowing = true
                }
                .glassPanel()
            }

            // Dialog overlay
            if isShowing {
                switch showDialog {
                case .delete:
                    ConfirmDialog.delete(item: "Model") {
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
                        title: "Upload Model",
                        message: "Would you like to upload your 3D model to the cloud? This may take a few minutes.",
                        confirmText: "Upload"
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
