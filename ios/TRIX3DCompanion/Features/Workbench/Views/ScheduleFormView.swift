//
//  ScheduleFormView.swift
//  TRIX3DCompanion
//
//  Form view for adding and editing schedule items
//

import SwiftUI

// MARK: - Localization Helper

/// Helper for localizing strings in SwiftUI views
private func L(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

// MARK: - Schedule Form View

/// Form view for adding/editing schedule items
struct ScheduleFormView: View {

    // MARK: - Environment

    @Environment(\.dismiss) private var dismiss

    // MARK: - Properties

    @ObservedObject var viewModel: ScheduleViewModel
    let editingSchedule: Schedule?

    // MARK: - State

    @State private var title: String = ""
    @State private var description: String = ""
    @State private var startDate: Date = Date()
    @State private var hasEndTime: Bool = false
    @State private var endDate: Date = Date().addingTimeInterval(3600)
    @State private var hasReminder: Bool = false
    @State private var reminderMinutes: Int = 15
    @State private var location: String = ""

    // MARK: - Computed Properties

    var isEditing: Bool {
        editingSchedule != nil
    }

    var isValid: Bool {
        !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    // MARK: - Reminder Options

    let reminderOptions: [(String, Int)] = [
        (L("schedule.reminder.5min"), 5),
        (L("schedule.reminder.15min"), 15),
        (L("schedule.reminder.30min"), 30),
        (L("schedule.reminder.1hour"), 60),
        (L("schedule.reminder.2hours"), 120),
        (L("schedule.reminder.1day"), 1440)
    ]

    // MARK: - Initialization

    init(viewModel: ScheduleViewModel, editingSchedule: Schedule?) {
        self.viewModel = viewModel
        self.editingSchedule = editingSchedule

        // Initialize form fields if editing
        if let schedule = editingSchedule {
            _title = State(initialValue: schedule.title)
            _description = State(initialValue: schedule.description ?? "")
            _startDate = State(initialValue: schedule.startTime)
            _hasEndTime = State(initialValue: schedule.endTime != nil)
            _endDate = State(initialValue: schedule.endTime ?? Date().addingTimeInterval(3600))
            _hasReminder = State(initialValue: schedule.reminderMinutesBefore != nil)
            _reminderMinutes = State(initialValue: schedule.reminderMinutesBefore ?? 15)
            _location = State(initialValue: schedule.location ?? "")
        }
    }

    // MARK: - Body

    var body: some View {
        NavigationView {
            Form {
                // Title Section
                Section {
                    TextField(L("schedule.title"), text: $title)
                        .font(.body)
                } header: {
                    Text(L("schedule.title.label"))
                } footer: {
                    Text(L("schedule.title.hint"))
                }

                // Description Section
                Section {
                    TextEditor(text: $description)
                        .frame(minHeight: 60)
                } header: {
                    Text(L("schedule.description.label"))
                } footer: {
                    Text(L("schedule.description.hint"))
                }

                // Date & Time Section
                Section {
                    DatePicker(
                        L("schedule.start"),
                        selection: $startDate,
                        displayedComponents: [.date, .hourAndMinute]
                    )

                    Toggle(L("schedule.set.end.time"), isOn: $hasEndTime)

                    if hasEndTime {
                        DatePicker(
                            L("schedule.end"),
                            selection: $endDate,
                            in: startDate...,
                            displayedComponents: [.date, .hourAndMinute]
                        )
                    }
                } header: {
                    Text(L("schedule.date.time"))
                }

                // Location Section
                Section {
                    TextField(L("schedule.location.optional"), text: $location)
                        .font(.body)
                } header: {
                    Text(L("schedule.location.label"))
                }

                // Reminder Section
                Section {
                    Toggle(L("schedule.set.reminder"), isOn: $hasReminder)

                    if hasReminder {
                        Picker(L("schedule.remind.me"), selection: $reminderMinutes) {
                            ForEach(reminderOptions, id: \.1) { option in
                                Text(option.0).tag(option.1)
                            }
                        }
                    }
                } header: {
                    Text(L("schedule.reminder"))
                } footer: {
                    if hasReminder {
                        Text(L("schedule.reminder.hint"))
                    }
                }
            }
            .navigationTitle(isEditing ? L("schedule.edit") : L("schedule.new"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(L("action.cancel")) {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(L("action.save")) {
                        saveSchedule()
                    }
                    .fontWeight(.semibold)
                    .disabled(!isValid)
                }
            }
        }
    }

    // MARK: - Private Methods

    private func saveSchedule() {
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedDescription = description.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedLocation = location.trimmingCharacters(in: .whitespacesAndNewlines)

        Task {
            if let existingSchedule = editingSchedule {
                // Update existing schedule
                var updatedSchedule = existingSchedule
                updatedSchedule.title = trimmedTitle
                updatedSchedule.description = trimmedDescription.isEmpty ? nil : trimmedDescription
                updatedSchedule.startTime = startDate
                updatedSchedule.endTime = hasEndTime ? endDate : nil
                updatedSchedule.reminderMinutesBefore = hasReminder ? reminderMinutes : nil
                updatedSchedule.location = trimmedLocation.isEmpty ? nil : trimmedLocation

                viewModel.updateSchedule(updatedSchedule)
            } else {
                // Create new schedule
                let newSchedule = Schedule(
                    title: trimmedTitle,
                    description: trimmedDescription.isEmpty ? nil : trimmedDescription,
                    startTime: startDate,
                    endTime: hasEndTime ? endDate : nil,
                    reminderMinutesBefore: hasReminder ? reminderMinutes : nil,
                    location: trimmedLocation.isEmpty ? nil : trimmedLocation
                )

                viewModel.addSchedule(newSchedule)
            }

            dismiss()
        }
    }
}

// MARK: - Preview

#Preview("Add Schedule") {
    ScheduleFormView(viewModel: ScheduleViewModel(), editingSchedule: nil)
}

#Preview("Edit Schedule") {
    ScheduleFormView(viewModel: ScheduleViewModel(), editingSchedule: Schedule.sampleSchedules.first)
}
