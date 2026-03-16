//
//  WorkbenchView.swift
//  TRIX3DCompanion
//
//  Workbench modal with horizontal scroll cards for quick access features
//

import SwiftUI

// MARK: - Localization Helper

/// Helper for localizing strings in SwiftUI views
private func L(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

// MARK: - Workbench Card Model

struct WorkbenchCardModel: Identifiable, Hashable {
    let id = UUID()
    let title: String
    let icon: String
    let iconColor: Color
    let gradientColors: [Color]
    let action: WorkbenchAction

    enum WorkbenchAction {
        case snapshot
        case location
        case schedule
        case todo
    }

    static let cards: [WorkbenchCardModel] = [
        WorkbenchCardModel(
            title: L("workbench.snapshot"),
            icon: "camera.fill",
            iconColor: .orange,
            gradientColors: [Color.orange.opacity(0.8), Color.red.opacity(0.6)],
            action: .snapshot
        ),
        WorkbenchCardModel(
            title: L("workbench.location"),
            icon: "location.fill",
            iconColor: .green,
            gradientColors: [Color.green.opacity(0.8), Color.teal.opacity(0.6)],
            action: .location
        ),
        WorkbenchCardModel(
            title: L("workbench.schedule"),
            icon: "calendar",
            iconColor: .blue,
            gradientColors: [Color.blue.opacity(0.8), Color.indigo.opacity(0.6)],
            action: .schedule
        ),
        WorkbenchCardModel(
            title: L("workbench.todo"),
            icon: "checklist",
            iconColor: .purple,
            gradientColors: [Color.purple.opacity(0.8), Color.pink.opacity(0.6)],
            action: .todo
        )
    ]
}

// MARK: - Workbench View

struct WorkbenchView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var selectedCard: WorkbenchCardModel?
    @State private var cardOffset: CGFloat = 0
    @State private var showCardDetail = false

    var body: some View {
        ZStack {
            // Background blur
            Color.black.opacity(0.5)
                .ignoresSafeArea()
                .onTapGesture {
                    dismiss()
                }

            // Main content
            VStack(spacing: 0) {
                // Handle bar
                handleBar

                // Title
                titleSection

                // Cards
                cardsSection
            }
            .padding(.top, 12)
            .padding(.bottom, 30)
            .background(
                RoundedRectangle(cornerRadius: 30)
                    .fill(Color.gray.opacity(0.3))
            )
            .shadow(color: .black.opacity(0.2), radius: 20, x: 0, y: -10)
            .offset(y: showCardDetail ? 300 : 0)
            .opacity(showCardDetail ? 0 : 1)
            .animation(.spring(response: 0.4, dampingFraction: 0.8), value: showCardDetail)
        }
        .sheet(item: $selectedCard) { card in
            cardDetailView(for: card)
        }
    }

    // MARK: - Handle Bar

    private var handleBar: some View {
        RoundedRectangle(cornerRadius: 2.5)
            .fill(Color.secondary.opacity(0.4))
            .frame(width: 40, height: 5)
            .padding(.bottom, 16)
    }

    // MARK: - Title Section

    private var titleSection: some View {
        VStack(spacing: 4) {
            Text(L("workbench.title"))
                .font(.title2)
                .fontWeight(.bold)

            Text(L("workbench.subtitle"))
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .padding(.bottom, 24)
    }

    // MARK: - Cards Section

    private var cardsSection: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 16) {
                ForEach(WorkbenchCardModel.cards) { card in
                    WorkbenchCard(
                        icon: card.icon,
                        title: card.title,
                        color: card.iconColor
                    ) {
                        handleCardTap(card)
                    }
                }
            }
            .padding(.horizontal, 20)
        }
    }

    // MARK: - Card Detail View

    @ViewBuilder
    private func cardDetailView(for card: WorkbenchCardModel) -> some View {
        Group {
            switch card.action {
            case .snapshot:
                SnapshotListView()
            case .location:
                LocationPickerView(showAsSheet: true)
            case .schedule:
                ScheduleListView(showAsSheet: true)
            case .todo:
                TodoListView(showAsSheet: true)
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    // MARK: - Actions

    private func handleCardTap(_ card: WorkbenchCardModel) {
        withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
            cardOffset = 10
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                cardOffset = 0
            }
            selectedCard = card
        }
    }
}

// MARK: - Preview

#Preview("Workbench") {
    WorkbenchView()
}
