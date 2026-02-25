//
//  LoadingView.swift
//  TRIX3DCompanion
//
//  Created by TRIX 3D Companion Team
//

import SwiftUI

/// A reusable loading indicator component with optional message text
/// Displays a centered progress view with semi-transparent background
struct LoadingView: View {
    // MARK: - Properties
    var message: String?
    var backgroundColor: Color = .ultraThinMaterial

    // MARK: - Body
    var body: some View {
        ZStack {
            // Background overlay
            backgroundColor
                .ignoresSafeArea()

            // Loading content
            VStack(spacing: 16) {
                // Progress indicator
                ProgressView()
                    .scaleEffect(1.5)
                    .tint(.purple)

                // Optional message
                if let message = message {
                    Text(message)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                }
            }
            .padding(24)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(.ultraThinMaterial)
                    .shadow(color: .black.opacity(0.1), radius: 10, x: 0, y: 4)
            )
        }
    }
}

// MARK: - Previews
#Preview("Loading with message") {
    LoadingView(message: "Loading 3D model...")
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(
            LinearGradient(
                colors: [.purple.opacity(0.3), .pink.opacity(0.3)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
}

#Preview("Loading without message") {
    LoadingView()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(
            LinearGradient(
                colors: [.purple.opacity(0.3), .pink.opacity(0.3)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
}

#Preview("Dark mode") {
    LoadingView(message: "Processing...")
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(
            LinearGradient(
                colors: [.purple.opacity(0.3), .pink.opacity(0.3)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .preferredColorScheme(.dark)
}
