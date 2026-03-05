//
//  AIActionSelectorView.swift
//  TRIX3DCompanion
//
//  Glass-morphism AI action selector for ChatInputBar
//

import SwiftUI

/// Glass-morphism AI Action selector with popup menu
struct AIActionSelectorView: View {

    // MARK: - Properties

    @Binding var selectedAction: AIActionType
    let onSelect: (AIActionType) -> Void

    @State private var showMenu = false

    // MARK: - Body

    var body: some View {
        Menu {
            ForEach(AIActionType.allCases) { action in
                Button(action: {
                    selectedAction = action
                    onSelect(action)
                    showMenu = false
                }) {
                    Label(action.label, systemImage: action.iconName)
                }
            }
        } label: {
            actionButton
        }
        .menuStyle(.borderlessButton)
        .fixedSize()
    }

    // MARK: - Action Button

    private var actionButton: some View {
        Button(action: { showMenu = true }) {
            ZStack {
                Circle()
                    .fill(selectedAction.iconGradient)
                    .frame(width: 44, height: 44)
                    .shadow(color: selectedAction.iconGradientColor.opacity(0.4), radius: 4, y: 2)

                Image(systemName: selectedAction.iconName)
                    .font(.title3)
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
            }
        }
        .contextMenu {
            ForEach(AIActionType.allCases) { action in
                Button(action: {
                    selectedAction = action
                    onSelect(action)
                }) {
                    Label(action.label, systemImage: action.iconName)
                }
            }
        }
    }
}

// MARK: - Color Extensions

extension AIActionType {
    var iconGradient: LinearGradient {
        LinearGradient(
            colors: iconGradientColors.compactMap { Color(hex: $0) },
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    var iconGradientColor: Color {
        Color(hexOptional: iconGradientColors.first ?? "#3B82F6") ?? .blue
    }
}

// MARK: - Preview

#Preview("AI Action Selector") {
    VStack(spacing: 20) {
        Text("Selected: AI Chat")

        AIActionSelectorView(
            selectedAction: .constant(.chat),
            onSelect: { action in
                print("Selected: \(action.label)")
            }
        )

        Text("Selected: AI Image")

        AIActionSelectorView(
            selectedAction: .constant(.image),
            onSelect: { action in
                print("Selected: \(action.label)")
            }
        )
    }
    .padding()
    .background(.ultraThinMaterial)
}
