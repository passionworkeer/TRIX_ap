//
//  WorkbenchSheet.swift
//  TRIX3DCompanion
//
//  Main workbench sheet view with navigation to different features
//

import SwiftUI
import MapKit

// MARK: - Localization Helper

/// Helper for localizing strings in SwiftUI views
private func L(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

// MARK: - Placeholder Location Picker View

/// Placeholder for LocationPickerView when the Map module is not available
struct WorkbenchLocationPicker: View {
    var showAsSheet: Bool = true

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                Image(systemName: "location.fill")
                    .font(.system(size: 60))
                    .foregroundColor(.purple)

                Text(L("workbench.location.picker"))
                    .font(.title2)
                    .fontWeight(.semibold)

                Text(L("workbench.select.location"))
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                Spacer()
            }
            .padding(.top, 50)
            .navigationTitle(L("workbench.pick.location"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(L("action.done")) {
                        // Dismiss handled by parent
                    }
                }
            }
        }
    }
}

// MARK: - Workbench Sheet

/// Main workbench sheet presenting quick access features
struct WorkbenchSheet: View {

    // MARK: - Environment

    @Environment(\.dismiss) private var dismiss

    // MARK: - State

    @State private var selectedTab: WorkbenchTab = .overview
    @State private var showTodoList = false
    @State private var showScheduleList = false
    @State private var showLocationPicker = false
    @State private var showSnapshot = false

    // MARK: - Body

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Header
                headerSection
                    .padding(.horizontal)
                    .padding(.top, 16)

                // Tab Selector
                tabSelector
                    .padding(.top, 16)

                // Content
                tabContent
                    .padding(.top, 16)

                Spacer()
            }
            .background(backgroundGradient)
            .navigationTitle(L("workbench.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(L("action.done")) {
                        dismiss()
                    }
                    .fontWeight(.semibold)
                }
            }
            .sheet(isPresented: $showTodoList) {
                TodoListView()
            }
            .sheet(isPresented: $showScheduleList) {
                ScheduleListView()
            }
            .sheet(isPresented: $showLocationPicker) {
                WorkbenchLocationPicker()
            }
            .fullScreenCover(isPresented: $showSnapshot) {
                SnapshotViewWrapper()
            }
        }
    }

    // MARK: - View Components

    /// Header section with greeting
    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(L("workbench.quick.actions"))
                .font(.title2)
                .fontWeight(.bold)

            Text(L("workbench.tap.card"))
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// Tab selector
    private var tabSelector: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                ForEach(WorkbenchTab.allCases) { tab in
                    TabButton(
                        title: tab.title,
                        icon: tab.icon,
                        isSelected: selectedTab == tab
                    ) {
                        selectedTab = tab
                    }
                }
            }
            .padding(.horizontal)
        }
    }

    /// Tab content based on selection
    @ViewBuilder
    private var tabContent: some View {
        switch selectedTab {
        case .overview:
            overviewContent
        case .todo:
            todoContent
        case .schedule:
            scheduleContent
        case .location:
            locationContent
        }
    }

    /// Overview tab content with cards
    private var overviewContent: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 16) {
                WorkbenchCard(
                    icon: "camera.fill",
                    title: L("workbench.snapshot"),
                    subtitle: L("workbench.snapshot.subtitle"),
                    color: .purple
                ) {
                    showSnapshot = true
                }

                WorkbenchCard(
                    icon: "location.fill",
                    title: L("workbench.location"),
                    subtitle: L("workbench.location.subtitle"),
                    color: .green
                ) {
                    showLocationPicker = true
                }

                WorkbenchCard(
                    icon: "calendar",
                    title: L("workbench.schedule"),
                    subtitle: L("workbench.schedule.subtitle"),
                    color: .info
                ) {
                    showScheduleList = true
                }

                WorkbenchCard(
                    icon: "checklist",
                    title: L("workbench.todo"),
                    subtitle: L("workbench.todo.subtitle"),
                    color: .orange
                ) {
                    showTodoList = true
                }
            }
            .padding(.horizontal)
        }
    }

    /// Todo tab content
    private var todoContent: some View {
        TodoListView(showAsSheet: false)
    }

    /// Schedule tab content
    private var scheduleContent: some View {
        ScheduleListView(showAsSheet: false)
    }

    /// Location tab content
    private var locationContent: some View {
        LocationPickerView(showAsSheet: false)
    }

    /// Background gradient
    private var backgroundGradient: some View {
        LinearGradient(
            colors: [
                Color.brandPurple.opacity(0.1),
                Color.pink.opacity(0.05),
                Color.clear
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .ignoresSafeArea()
    }
}

// MARK: - Workbench Tab

/// Workbench tab enum
enum WorkbenchTab: String, CaseIterable, Identifiable {
    case overview
    case todo
    case schedule
    case location

    var id: String { rawValue }

    var title: String {
        switch self {
        case .overview: return L("workbench.overview")
        case .todo: return L("workbench.todo")
        case .schedule: return L("workbench.schedule")
        case .location: return L("workbench.location")
        }
    }

    var icon: String {
        switch self {
        case .overview: return "square.grid.2x2"
        case .todo: return "checklist"
        case .schedule: return "calendar"
        case .location: return "location"
        }
    }
}

// MARK: - Tab Button

/// Tab button component
struct TabButton: View {
    let title: String
    let icon: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: {
            triggerHapticFeedback()
            action()
        }) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 14, weight: .medium))

                Text(title)
                    .font(.subheadline)
                    .fontWeight(.medium)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(isSelected ? Color.brandPurple : Color.tertiaryBackground.opacity(0.15))
            .foregroundColor(isSelected ? .white : .primary)
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    private func triggerHapticFeedback() {
        let generator = UIImpactFeedbackGenerator(style: .light)
        generator.impactOccurred()
    }
}

// MARK: - Snapshot View Wrapper

/// Wrapper for snapshot view to handle full screen presentation
struct SnapshotViewWrapper: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            CameraView()
                .ignoresSafeArea()
                .toolbar {
                    ToolbarItem(placement: .navigationBarLeading) {
                        Button(L("action.cancel")) {
                            dismiss()
                        }
                    }
                }
        }
    }
}

// MARK: - Preview

#Preview("Workbench Sheet") {
    WorkbenchSheet()
}
