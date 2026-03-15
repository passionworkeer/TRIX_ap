//
//  ScheduleListView.swift
//  TRIX3DCompanion
//
//  Schedule list view displaying all schedule items with filtering
//

import SwiftUI

// MARK: - Schedule List View

/// Schedule list view displaying schedule items with native iOS design
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
            .background(Color(.systemGroupedBackground))
            .navigationTitle("日程")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: navigationBarLeading(showAsSheet: showAsSheet)) {
                    if showAsSheet {
                        Button("完成") {
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
            .alert("错误", isPresented: .init(
                get: { viewModel.errorMessage != nil },
                set: { if !$0 { viewModel.clearMessages() } }
            )) {
                Button("确定") {
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
        HStack(spacing: 12) {
            StatBadge(
                title: "今天",
                value: viewModel.todayCount,
                color: .blue
            )

            StatBadge(
                title: "即将到来",
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
                    }
                    .onDelete { indexSet in
                        indexSet.forEach { index in
                            let schedule = viewModel.filteredSchedules[index]
                            Task {
                                viewModel.deleteSchedule(schedule.id)
                            }
                        }
                    }
                }
                .listStyle(.insetGrouped)
            }
        }
    }

    /// Empty state view
    private var emptyState: some View {
        ContentUnavailableView {
            Label("暂无日程", systemImage: "calendar.badge.plus")
        } description: {
            Text("点击右上角按钮添加新日程")
        } actions: {
            Button("添加日程") {
                viewModel.showAddForm()
            }
            .buttonStyle(.borderedProminent)
        }
    }

    // MARK: - Helper Methods

    private func navigationBarLeading(showAsSheet: Bool) -> ToolbarItemPlacement {
        return showAsSheet ? .navigationBarLeading : .principal
    }
}

// MARK: - Schedule Row

/// Single schedule row component with native iOS style
struct ScheduleRow: View {
    let schedule: Schedule
    let onTap: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            // Time indicator
            VStack(spacing: 4) {
                Text(schedule.isToday ? "今天" : (schedule.isTomorrow ? "明天" : ""))
                    .font(.caption2)
                    .fontWeight(.medium)
                    .foregroundColor(.white)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color(hex: schedule.statusColorHex))
                    .clipShape(Capsule())

                Text(formattedTime)
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(Color(hex: schedule.statusColorHex))
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
        .padding(.vertical, 4)
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
