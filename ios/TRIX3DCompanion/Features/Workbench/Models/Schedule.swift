//
//  Schedule.swift
//  TRIX3DCompanion
//
//  Schedule data model for workbench feature
//

import Foundation
import SwiftUI

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
        return abs(startTime.timeIntervalSinceNow) < 900
    }

    /// Duration in minutes
    var durationMinutes: Int? {
        guard let end = endTime else { return nil }
        return Int(end.timeIntervalSince(startTime) / 60)
    }

    /// Formatted time range string
    var timeRangeString: String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short

        let startString = formatter.string(from: startTime)

        if let end = endTime {
            let endString = formatter.string(from: end)
            return "\(startString) - \(endString)"
        }

        return startString
    }

    /// Formatted date string
    var dateString: String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium

        if isToday {
            return "Today"
        } else if isTomorrow {
            return "Tomorrow"
        }

        return formatter.string(from: startTime)
    }

    /// Color based on status
    var statusColor: Color {
        if isPast {
            return .gray
        } else if isNow {
            return .green
        } else if isToday {
            return .blue
        }
        return .primary
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
        case .all: return "All"
        case .upcoming: return "Upcoming"
        case .today: return "Today"
        case .past: return "Past"
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
