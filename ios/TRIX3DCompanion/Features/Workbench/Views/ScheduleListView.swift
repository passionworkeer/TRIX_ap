//
//  ScheduleListView.swift
//  TRIX3DCompanion
//
//  Schedule list view displaying all schedule items with filtering
//

import SwiftUI

// MARK: - Schedule List View

/// Schedule list view displaying schedule items
struct ScheduleListView: View {

    // MARK: - Environment

    @Environment(\.dismiss) private var dismiss

    // MARK: - State

    @StateObject private var viewModel = ScheduleViewModel()

    /// Whether this view is presented as a sheet
    var showAsSheet: Bool = true

    // MARK: - Body

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Filter Bar
                filterBar

                // Stats Section
                statsSection
                    .padding(.horizontal)
                    .padding(.top, 8)

                // Schedule List
                scheduleList
            }
            .background(backgroundGradient)
            .navigationTitle("Schedule")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: navigationBarLeading(showAsSheet: showAsSheet)) {
                    if showAsSheet {
                        Button("Done") {
                            dismiss()
                        }
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        viewModel.showAddForm()
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(.title3)
                            .foregroundColor(.blue)
                    }
                }
            }
            .sheet(isPresented: $viewModel.showForm) {
                ScheduleFormView(
                    viewModel: viewModel,
                    editingSchedule: viewModel.editingSchedule
                )
            }
            .alert("Error", isPresented: .init(
                get: { viewModel.errorMessage != nil },
                set: { if !$0 { viewModel.clearMessages() } }
            )) {
                Button("OK") {
                    viewModel.clearMessages()
                }
            } message: {
                Text(viewModel.errorMessage ?? "")
            }
        }
    }

    // MARK: - View Components

    /// Filter bar
    private var filterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(ScheduleFilter.allCases, id: \.self) { filter in
                    FilterChip(
                        title: filter.displayName,
                        isSelected: viewModel.filter == filter
                    ) {
                        viewModel.setFilter(filter)
                    }
                }
            }
            .padding(.horizontal)
        }
        .padding(.vertical, 8)
    }

    /// Statistics section
    private var statsSection: some View {
        HStack(spacing: 16) {
            StatBadge(
                title: "Today",
                value: viewModel.todayCount,
                color: .blue
            )

            StatBadge(
                title: "Upcoming",
                value: viewModel.upcomingCount,
                color: .green
            )
        }
        .padding(.vertical, 8)
    }

    /// Schedule list content
    private var scheduleList: some View {
        Group {
            if viewModel.filteredSchedules.isEmpty {
                emptyState
            } else {
                List {
                    ForEach(viewModel.filteredSchedules) { schedule in
                        ScheduleRow(
                            schedule: schedule,
                            onTap: {
                                viewModel.showEditForm(for: schedule)
                            }
                        )
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                        .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                    }
                    .onDelete { indexSet in
                        indexSet.forEach { index in
                            let schedule = viewModel.filteredSchedules[index]
                            Task {
                                await viewModel.deleteSchedule(schedule.id)
                            }
                        }
                    }
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
            }
        }
    }

    /// Empty state view
    private var emptyState: some View {
        VStack(spacing: 16) {
            Spacer()

            Image(systemName: "calendar.badge.plus")
                .font(.system(size: 60))
                .foregroundColor(.gray.opacity(0.5))

            Text("No schedules yet")
                .font(.headline)
                .foregroundColor(.secondary)

            Text("Tap + to add a new schedule")
                .font(.subheadline)
                .foregroundColor(.secondary)

            Button {
                viewModel.showAddForm()
            } label: {
                Text("Add Schedule")
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 12)
                    .background(Color.blue)
                    .clipShape(Capsule())
            }
            .padding(.top, 8)

            Spacer()
        }
    }

    /// Background gradient
    private var backgroundGradient: some View {
        LinearGradient(
            colors: [
                Color.blue.opacity(0.05),
                Color.clear
            ],
            startPoint: .top,
            endPoint: .bottom
        )
        .ignoresSafeArea()
    }

    // MARK: - Helper Methods

    private func navigationBarLeading(showAsSheet: Bool) -> ToolbarItemPlacement {
        return showAsSheet ? .navigationBarLeading : .principal
    }
}

// MARK: - Schedule Row

/// Single schedule row component
struct ScheduleRow: View {
    let schedule: Schedule
    let onTap: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            // Time indicator
            VStack(spacing: 4) {
                Text(schedule.isToday ? "Today" : (schedule.isTomorrow ? "Tmrw" : ""))
                    .font(.caption2)
                    .fontWeight(.medium)
                    .foregroundColor(.white)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(schedule.statusColor)
                    .clipShape(Capsule())

                Text(formattedTime)
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(schedule.statusColor)
            }
            .frame(width: 50)

            // Content
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
                    // Status indicator
                    if schedule.isNow {
                        Circle()
                            .fill(Color.green)
                            .frame(width: 8, height: 8)
                            .overlay(
                                Circle()
                                    .stroke(Color.green.opacity(0.5), lineWidth: 2)
                                    .scaleEffect(1.5)
                            )
                    }

                    Text(schedule.title)
                        .font(.body)
                        .fontWeight(.medium)
                        .foregroundColor(schedule.isPast ? .secondary : .primary)
                        .lineLimit(2)
                }

                if let description = schedule.description, !description.isEmpty {
                    Text(description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }

                HStack(spacing: 12) {
                    // Time range
                    HStack(spacing: 4) {
                        Image(systemName: "clock")
                            .font(.caption2)
                        Text(schedule.timeRangeString)
                            .font(.caption)
                    }
                    .foregroundColor(.secondary)

                    // Location
                    if let location = schedule.location, !location.isEmpty {
                        HStack(spacing: 4) {
                            Image(systemName: "location")
                                .font(.caption2)
                            Text(location)
                                .font(.caption)
                        }
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                    }

                    // Reminder indicator
                    if schedule.reminderMinutesBefore != nil {
                        Image(systemName: "bell.fill")
                            .font(.caption2)
                            .foregroundColor(.orange)
                    }
                }
            }

            Spacer()

            // Edit indicator
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .contentShape(Rectangle())
        .onTapGesture {
            onTap()
        }
    }

    private var formattedTime: String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter.string(from: schedule.startTime)
    }
}

// MARK: - Preview

#Preview("Schedule List") {
    ScheduleListView(showAsSheet: false)
}
