//
//  Todo.swift
//  TRIX3DCompanion
//
//  Todo data model for workbench feature
//

import Foundation
import SwiftUI

// MARK: - Todo Model

/// Todo item model
struct Todo: Identifiable, Codable, Equatable {
    let id: UUID
    var title: String
    var description: String?
    var completed: Bool
    var priority: Priority
    var dueDate: Date?
    let createdAt: Date
    var updatedAt: Date
    var syncStatus: SyncStatus

    // MARK: - Nested Types

    /// Todo priority level
    enum Priority: String, Codable, CaseIterable {
        case low
        case medium
        case high

        var displayName: String {
            switch self {
            case .low: return "Low"
            case .medium: return "Medium"
            case .high: return "High"
            }
        }

        /// Returns icon name for priority - using different icons for visual distinction
        var icon: String {
            switch self {
            case .low: return "arrow.down.circle"
            case .medium: return "minus.circle"
            case .high: return "exclamationmark.circle"
            }
        }

        /// Returns color hex string for priority - Model should not depend on SwiftUI
        var colorHex: String {
            switch self {
            case .low: return "#10B981"     // green-500
            case .medium: return "#F97316"   // orange-500
            case .high: return "#EF4444"     // red-500
            }
        }

        /// Returns SwiftUI Color for priority
        var color: Color {
            switch self {
            case .low: return Color(hex: "#10B981") ?? .green
            case .medium: return Color(hex: "#F97316") ?? .orange
            case .high: return Color(hex: "#EF4444") ?? .red
            }
        }
    }

    /// Sync status with backend
    enum SyncStatus: String, Codable {
        case synced
        case pending
        case conflict
    }

    // MARK: - Static DateFormatters (cached for performance)

    /// Cached date formatter for due date strings
    private static let _dueDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        return formatter
    }()

    /// Cached date formatter for time only
    private static let _timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter
    }()

    // MARK: - Coding Keys

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case description
        case completed
        case priority
        case dueDate = "due_date"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case syncStatus = "sync_status"
    }

    // MARK: - Initialization

    init(
        id: UUID = UUID(),
        title: String,
        description: String? = nil,
        completed: Bool = false,
        priority: Priority = .medium,
        dueDate: Date? = nil,
        createdAt: Date = Date(),
        updatedAt: Date = Date(),
        syncStatus: SyncStatus = .pending
    ) {
        self.id = id
        self.title = title
        self.description = description
        self.completed = completed
        self.priority = priority
        self.dueDate = dueDate
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.syncStatus = syncStatus
    }

    // MARK: - Computed Properties

    /// Whether todo is overdue
    var isOverdue: Bool {
        guard let due = dueDate, !completed else { return false }
        return due < Date()
    }

    /// Whether todo is due today
    var isDueToday: Bool {
        guard let due = dueDate else { return false }
        return Calendar.current.isDateInToday(due)
    }

    /// Formatted due date string - uses cached formatters
    var dueDateString: String? {
        guard let due = dueDate else { return nil }

        if Calendar.current.isDateInToday(due) {
            let time = Self._timeFormatter.string(from: due)
            return "Today \(time)"
        } else if Calendar.current.isDateInTomorrow(due) {
            let time = Self._timeFormatter.string(from: due)
            return "Tomorrow \(time)"
        } else {
            return Self._dueDateFormatter.string(from: due)
        }
    }
}

// MARK: - Todo Filter

/// Filter options for todo list
enum TodoFilter: String, CaseIterable {
    case all
    case active
    case completed

    var displayName: String {
        switch self {
        case .all: return "All"
        case .active: return "Active"
        case .completed: return "Completed"
        }
    }

    var icon: String {
        switch self {
        case .all: return "list.bullet"
        case .active: return "circle"
        case .completed: return "checkmark.circle.fill"
        }
    }
}

// MARK: - Create Todo Request

/// Request model for creating a new todo
struct CreateTodoRequest: Codable {
    let title: String
    let description: String?
    let priority: Todo.Priority
    let dueDate: Date?

    enum CodingKeys: String, CodingKey {
        case title
        case description
        case priority
        case dueDate = "due_date"
    }
}

// MARK: - Update Todo Request

/// Request model for updating an existing todo
struct UpdateTodoRequest: Codable {
    let title: String?
    let description: String?
    let completed: Bool?
    let priority: Todo.Priority?
    let dueDate: Date?

    enum CodingKeys: String, CodingKey {
        case title
        case description
        case completed
        case priority
        case dueDate = "due_date"
    }
}

// MARK: - Todo Sort Option

/// Sort options for todo list
enum TodoSortOption: String, CaseIterable {
    case createdAt
    case dueDate
    case priority
    case title

    var displayName: String {
        switch self {
        case .createdAt: return "Created Date"
        case .dueDate: return "Due Date"
        case .priority: return "Priority"
        case .title: return "Title"
        }
    }

    var icon: String {
        switch self {
        case .createdAt: return "calendar.badge.plus"
        case .dueDate: return "calendar"
        case .priority: return "flag"
        case .title: return "textformat"
        }
    }
}

// MARK: - Preview Helpers

#if DEBUG
extension Todo {
    /// Sample todos for preview
    static var sampleTodos: [Todo] {
        [
            Todo(
                title: "Complete iOS project",
                description: "Finish the workbench feature implementation",
                completed: false,
                priority: .high,
                dueDate: Date().addingTimeInterval(3600 * 2)
            ),
            Todo(
                title: "Review pull request",
                description: nil,
                completed: false,
                priority: .medium,
                dueDate: Date().addingTimeInterval(3600 * 24)
            ),
            Todo(
                title: "Update documentation",
                description: "Add API documentation for new endpoints",
                completed: true,
                priority: .low,
                dueDate: nil
            ),
            Todo(
                title: "Fix login bug",
                description: "Users cannot login with Apple ID",
                completed: false,
                priority: .high,
                dueDate: Date().addingTimeInterval(-3600) // Overdue
            )
        ]
    }
}
#endif
