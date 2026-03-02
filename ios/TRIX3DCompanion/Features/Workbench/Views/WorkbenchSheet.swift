//
//  WorkbenchSheet.swift
//  TRIX3DCompanion
//
//  Main workbench sheet view with navigation to different features
//

import SwiftUI
import MapKit

// MARK: - Placeholder Location Picker View

/// Placeholder for LocationPickerView when the Map module is not available
struct WorkbenchLocationPicker: View {
    var showAsSheet: Bool = true

    var body: some View {
        NavigationView {
            VStack(spacing: 20) {
                Image(systemName: "location.fill")
                    .font(.system(size: 60))
                    .foregroundColor(.purple)

                Text("Location Picker")
                    .font(.title2)
                    .fontWeight(.semibold)

                Text("Select a location on the map")
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                Spacer()
            }
            .padding(.top, 50)
            .navigationTitle("Pick Location")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
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
        NavigationView {
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
            .navigationTitle("Workbench")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
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
            Text("Quick Actions")
                .font(.title2)
                .fontWeight(.bold)

            Text("Tap a card to access features")
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
                    title: "Snapshot",
                    subtitle: "Quick capture",
                    color: .purple
                ) {
                    showSnapshot = true
                }

                WorkbenchCard(
                    icon: "location.fill",
                    title: "Location",
                    subtitle: "Share place",
                    color: .green
                ) {
                    showLocationPicker = true
                }

                WorkbenchCard(
                    icon: "calendar",
                    title: "Schedule",
                    subtitle: "Manage events",
                    color: .blue
                ) {
                    showScheduleList = true
                }

                WorkbenchCard(
                    icon: "checklist",
                    title: "Todo",
                    subtitle: "Task list",
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
                Color.purple.opacity(0.1),
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
        case .overview: return "Overview"
        case .todo: return "Todo"
        case .schedule: return "Schedule"
        case .location: return "Location"
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
            .background(isSelected ? Color.purple : Color.gray.opacity(0.15))
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
        NavigationView {
            CameraView()
                .ignoresSafeArea()
                .toolbar {
                    ToolbarItem(placement: .navigationBarLeading) {
                        Button("Cancel") {
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
