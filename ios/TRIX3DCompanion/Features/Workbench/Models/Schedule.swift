//
//  Schedule.swift
//  TRIX3DCompanion
//
//  Schedule data model for workbench feature
//

import Foundation

// MARK: - Constants

/// Magic number: 15 minutes in seconds
private let FIFTEEN_MINUTES_SECONDS: TimeInterval = 900

// MARK: - Localization Helper

/// Helper for localizing strings
private func L(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

// MARK: - Schedule Model

/// Schedule item model
struct Schedule: Identifiable, Codable, Equatable {
    let id: UUID
    var title: String
    var description: String?
    var startTime: Date
    var endTime: Date?
    var reminderMinutesBefore: Int?
    var location: String?
    let createdAt: Date
    var updatedAt: Date
    var syncStatus: SyncStatus

    // MARK: - Nested Types

    /// Sync status with backend
    enum SyncStatus: String, Codable {
        case synced
        case pending
        case conflict
    }

    // MARK: - Static DateFormatters (cached for performance)

    /// Cached date formatter for time only
    private static let _timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter
    }()

    /// Cached date formatter for date only
    private static let _dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter
    }()

    // MARK: - Coding Keys

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case description
        case startTime = "start_time"
        case endTime = "end_time"
        case reminderMinutesBefore = "reminder_minutes_before"
        case location
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case syncStatus = "sync_status"
    }

    // MARK: - Initialization

    init(
        id: UUID = UUID(),
        title: String,
        description: String? = nil,
        startTime: Date,
        endTime: Date? = nil,
        reminderMinutesBefore: Int? = nil,
        location: String? = nil,
        createdAt: Date = Date(),
        updatedAt: Date = Date(),
        syncStatus: SyncStatus = .pending
    ) {
        self.id = id
        self.title = title
        self.description = description
        self.startTime = startTime
        self.endTime = endTime
        self.reminderMinutesBefore = reminderMinutesBefore
        self.location = location
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.syncStatus = syncStatus
    }

    // MARK: - Computed Properties

    /// Whether schedule is today
    var isToday: Bool {
        Calendar.current.isDateInToday(startTime)
    }

    /// Whether schedule is tomorrow
    var isTomorrow: Bool {
        Calendar.current.isDateInTomorrow(startTime)
    }

    /// Whether schedule is in the past
    var isPast: Bool {
        if let end = endTime {
            return end < Date()
        }
        return startTime < Date()
    }

    /// Whether schedule is currently happening
    var isNow: Bool {
        let now = Date()
        if let end = endTime {
            return startTime <= now && now <= end
        }
        // Consider it "now" if within 15 minutes of start
        return abs(startTime.timeIntervalSinceNow) < FIFTEEN_MINUTES_SECONDS
    }

    /// Duration in minutes
    var durationMinutes: Int? {
        guard let end = endTime else { return nil }
        return Int(end.timeIntervalSince(startTime) / 60)
    }

    /// Formatted time range string - uses cached formatters
    var timeRangeString: String {
        let startString = Self._timeFormatter.string(from: startTime)

        if let end = endTime {
            let endString = Self._timeFormatter.string(from: end)
            return "\(startString) - \(endString)"
        }

        return startString
    }

    /// Formatted date string - uses cached formatters
    var dateString: String {
        if isToday {
            return L("schedule.today")
        } else if isTomorrow {
            return L("schedule.tomorrow")
        }

        return Self._dateFormatter.string(from: startTime)
    }

    /// Color hex based on status - Model should not depend on SwiftUI
    var statusColorHex: String {
        if isPast {
            return "#6B7280"     // gray-500
        } else if isNow {
            return "#10B981"     // green-500
        } else if isToday {
            return "#3B82F6"     // blue-500
        }
        return "#8B5CF6"         // violet-500 (default)
    }
}

// MARK: - Schedule Filter

/// Filter options for schedule list
enum ScheduleFilter: String, CaseIterable {
    case all
    case upcoming
    case today
    case past

    var displayName: String {
        switch self {
        case .all: return L("schedule.filter.all")
        case .upcoming: return L("schedule.filter.upcoming")
        case .today: return L("schedule.filter.today")
        case .past: return L("schedule.filter.past")
        }
    }

    var icon: String {
        switch self {
        case .all: return "calendar.badge.clock"
        case .upcoming: return "calendar.badge.plus"
        case .today: return "sun.max.fill"
        case .past: return "calendar.badge.minus"
        }
    }
}

// MARK: - Create Schedule Request

/// Request model for creating a new schedule
struct CreateScheduleRequest: Codable {
    let title: String
    let description: String?
    let startTime: Date
    let endTime: Date?
    let reminderMinutesBefore: Int?
    let location: String?

    enum CodingKeys: String, CodingKey {
        case title
        case description
        case startTime = "start_time"
        case endTime = "end_time"
        case reminderMinutesBefore = "reminder_minutes_before"
        case location
    }
}

// MARK: - Preview Helpers

#if DEBUG
extension Schedule {
    /// Sample schedules for preview
    static var sampleSchedules: [Schedule] {
        let now = Date()
        let calendar = Calendar.current

        return [
            Schedule(
                title: "Team Meeting",
                description: "Weekly sync with the development team",
                startTime: calendar.date(byAdding: .hour, value: 2, to: now)!,
                endTime: calendar.date(byAdding: .hour, value: 3, to: now)!,
                reminderMinutesBefore: 15,
                location: "Conference Room A"
            ),
            Schedule(
                title: "Project Review",
                description: nil,
                startTime: calendar.date(byAdding: .day, value: 1, to: now)!,
                endTime: calendar.date(byAdding: .day, value: 1, to: now)!.addingTimeInterval(3600),
                reminderMinutesBefore: 30,
                location: "Online - Zoom"
            ),
            Schedule(
                title: "Lunch with Client",
                description: "Discuss new project requirements",
                startTime: calendar.date(byAdding: .day, value: 2, to: now)!,
                endTime: nil,
                reminderMinutesBefore: 60,
                location: "Downtown Restaurant"
            ),
            Schedule(
                title: "Completed Task Review",
                description: "Review last week's work",
                startTime: calendar.date(byAdding: .day, value: -1, to: now)!,
                endTime: calendar.date(byAdding: .day, value: -1, to: now)!.addingTimeInterval(1800),
                reminderMinutesBefore: nil
            )
        ]
    }
}
#endif
