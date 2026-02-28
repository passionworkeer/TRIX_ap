//
//  WorkbenchCard.swift
//  TRIX3DCompanion
//
//  Individual workbench card component for displaying workbench features
//

import SwiftUI

// MARK: - Workbench Card

/// Workbench feature card component
struct WorkbenchCard: View {

    // MARK: - Properties

    let icon: String
    let title: String
    let subtitle: String?
    let color: Color
    let action: () -> Void

    // MARK: - State

    @State private var isPressed = false

    // MARK: - Initialization

    init(
        icon: String,
        title: String,
        subtitle: String? = nil,
        color: Color = .blue,
        action: @escaping () -> Void
    ) {
        self.icon = icon
        self.title = title
        self.subtitle = subtitle
        self.color = color
        self.action = action
    }

    // MARK: - Body

    var body: some View {
        Button(action: {
            triggerHapticFeedback()
            action()
        }) {
            VStack(spacing: 12) {
                // Icon
                ZStack {
                    Circle()
                        .fill(
                            LinearGradient(
                                colors: [color, color.opacity(0.8)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 56, height: 56)

                    Image(systemName: icon)
                        .font(.system(size: 24, weight: .medium))
                        .foregroundColor(.white)
                }
                .scaleEffect(isPressed ? 0.9 : 1.0)
                .animation(.spring(response: 0.3), value: isPressed)

                // Title
                Text(title)
                    .font(.headline)
                    .foregroundColor(.primary)
                    .lineLimit(1)

                // Subtitle (optional)
                if let subtitle = subtitle {
                    Text(subtitle)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .padding(.horizontal, 12)
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .shadow(color: color.opacity(0.2), radius: 8, x: 0, y: 4)
        }
        .buttonStyle(.plain)
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in
                    isPressed = true
                }
                .onEnded { _ in
                    isPressed = false
                }
        )
    }

    // MARK: - Private Methods

    private func triggerHapticFeedback() {
        let generator = UIImpactFeedbackGenerator(style: .medium)
        generator.impactOccurred()
    }
}

// MARK: - Workbench Card Item

/// Data model for workbench card items
struct WorkbenchCardItem: Identifiable {
    let id = UUID()
    let icon: String
    let title: String
    let subtitle: String?
    let color: Color
    let action: () -> Void
}

// MARK: - Preview

#Preview("Workbench Cards") {
    HStack(spacing: 16) {
        WorkbenchCard(
            icon: "camera.fill",
            title: "Snapshot",
            subtitle: "Quick capture",
            color: .purple
        ) {
            print("Snapshot tapped")
        }

        WorkbenchCard(
            icon: "location.fill",
            title: "Location",
            subtitle: "Share place",
            color: .green
        ) {
            print("Location tapped")
        }
    }
    .padding()
}
