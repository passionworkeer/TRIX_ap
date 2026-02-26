//
//  ErrorView.swift
//  TRIX3DCompanion
//
//  Created by TRIX 3D Companion Team
//

import SwiftUI

/// A reusable error display component with retry functionality
/// Shows error icon, title, description, and retry button
struct ErrorView: View {
    // MARK: - Properties
    let title: String
    let message: String
    let retryAction: (() -> Void)?

    init(title: String, message: String, retryAction: (() -> Void)? = nil) {
        self.title = title
        self.message = message
        self.retryAction = retryAction
    }

    // MARK: - Body
    var body: some View {
        VStack(spacing: 24) {
            // Error icon with animation
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 60))
                .foregroundStyle(
                    LinearGradient(
                        colors: [.purple, .pink],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .symbolEffect(.bounce, value: true)

            // Error title
            Text(title)
                .font(.title2)
                .fontWeight(.semibold)
                .foregroundColor(.primary)

            // Error description
            Text(message)
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            // Retry button (if action provided)
            if let retryAction = retryAction {
                Button(action: retryAction) {
                    HStack(spacing: 8) {
                        Image(systemName: "arrow.clockwise")
                        Text("Retry")
                    }
                    .font(.headline)
                    .foregroundColor(.white)
                    .padding(.horizontal, 32)
                    .padding(.vertical, 12)
                    .background(
                        LinearGradient(
                            colors: [.purple, .pink],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .cornerRadius(25)
                }
                .buttonStyle(.plain)
                .transition(.scale.combined(with: .opacity))
            }
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(.ultraThinMaterial)
                .shadow(color: .black.opacity(0.1), radius: 10, x: 0, y: 4)
        )
    }
}

// MARK: - Convenience Initializers
extension ErrorView {
    /// Creates a network error view with retry action
    static func networkError(retryAction: @escaping () -> Void) -> ErrorView {
        ErrorView(
            title: "Connection Error",
            message: "Unable to connect to the server. Please check your internet connection and try again.",
            retryAction: retryAction
        )
    }

    /// Creates a generic error view without retry
    static func generic(title: String = "Something Went Wrong", message: String) -> ErrorView {
        ErrorView(title: title, message: message, retryAction: nil)
    }
}

// MARK: - Previews
#Preview("Network error with retry") {
    ErrorView.networkError {
        SecureLogger.shared.debug("Retry tapped")
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(
        LinearGradient(
            colors: [.purple.opacity(0.2), .pink.opacity(0.2)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    )
}

#Preview("Generic error without retry") {
    ErrorView.generic(
        title: "File Not Found",
        message: "The requested 3D model could not be found. It may have been moved or deleted."
    )
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(
        LinearGradient(
            colors: [.purple.opacity(0.2), .pink.opacity(0.2)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    )
}

#Preview("Dark mode") {
    ErrorView.networkError {
        SecureLogger.shared.debug("Retry tapped")
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(
        LinearGradient(
            colors: [.purple.opacity(0.2), .pink.opacity(0.2)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    )
    .preferredColorScheme(.dark)
}
