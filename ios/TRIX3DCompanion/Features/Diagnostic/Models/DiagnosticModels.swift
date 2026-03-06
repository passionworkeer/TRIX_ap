//
//  DiagnosticModels.swift
//  TRIX3DCompanion
//
//  Diagnostic data models for network, storage, and performance status
//

import Foundation

// MARK: - Network Diagnostic Models

/// Network diagnostic result
struct NetworkDiagnosticResult: Identifiable, Equatable {
    let id: UUID
    let endpoint: String
    let status: DiagnosticStatus
    let latencyMs: Double?
    let errorMessage: String?
    let timestamp: Date

    init(
        id: UUID = UUID(),
        endpoint: String,
        status: DiagnosticStatus,
        latencyMs: Double? = nil,
        errorMessage: String? = nil,
        timestamp: Date = Date()
    ) {
        self.id = id
        self.endpoint = endpoint
        self.status = status
        self.latencyMs = latencyMs
        self.errorMessage = errorMessage
        self.timestamp = timestamp
    }

    var formattedLatency: String {
        guard let latency = latencyMs else { return "N/A" }
        return String(format: "%.0f ms", latency)
    }
}

/// API endpoint for testing
struct APIEndpoint: Identifiable {
    let id: String
    let name: String
    let url: String
    let method: String

    static let defaultEndpoints: [APIEndpoint] = [
        APIEndpoint(id: "health", name: "Health Check", url: "/health", method: "GET"),
        APIEndpoint(id: "auth", name: "Auth", url: "/api/v1/auth/me", method: "GET"),
        APIEndpoint(id: "user", name: "User Profile", url: "/api/v1/users/me", method: "GET"),
        APIEndpoint(id: "study", name: "Study Sessions", url: "/api/v1/study/sessions", method: "GET"),
        APIEndpoint(id: "chat", name: "Chat Messages", url: "/api/v1/chat/messages", method: "GET")
    ]
}

// MARK: - Storage Diagnostic Models

/// Storage diagnostic result
struct StorageDiagnosticResult: Identifiable {
    let id: UUID
    let type: StorageType
    let status: DiagnosticStatus
    let sizeBytes: Int64
    let details: String?
    let errorMessage: String?

    var formattedSize: String {
        ByteCountFormatter.string(fromByteCount: sizeBytes, countStyle: .file)
    }
}

/// Storage type enum
enum StorageType: String, CaseIterable, Identifiable {
    case userDefaults = "UserDefaults"
    case fileStorage = "File Storage"
    case cache = "Cache"
    case database = "Database"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .userDefaults: return "gearshape.fill"
        case .fileStorage: return "folder.fill"
        case .cache: return "internaldrive.fill"
        case .database: return "cylinder.fill"
        }
    }

    var description: String {
        switch self {
        case .userDefaults: return "User preferences and settings"
        case .fileStorage: return "Local file storage"
        case .cache: return "Temporary cached data"
        case .database: return "Local database"
        }
    }
}

// MARK: - Diagnostic Status

/// Status of diagnostic checks
enum DiagnosticStatus: String, CaseIterable {
    case success = "success"
    case warning = "warning"
    case error = "error"
    case testing = "testing"
    case unknown = "unknown"

    var displayName: String {
        switch self {
        case .success: return "OK"
        case .warning: return "Warning"
        case .error: return "Error"
        case .testing: return "Testing..."
        case .unknown: return "Unknown"
        }
    }

    var iconName: String {
        switch self {
        case .success: return "checkmark.circle.fill"
        case .warning: return "exclamationmark.triangle.fill"
        case .error: return "xmark.circle.fill"
        case .testing: return "arrow.triangle.2.circlepath"
        case .unknown: return "questionmark.circle.fill"
        }
    }

    var color: String {
        switch self {
        case .success: return "green"
        case .warning: return "yellow"
        case .error: return "red"
        case .testing: return "blue"
        case .unknown: return "gray"
        }
    }
}

// MARK: - Performance Models

/// Performance metrics
struct PerformanceMetrics: Identifiable {
    let id: UUID
    let type: PerformanceMetricType
    let value: Double
    let unit: String
    let timestamp: Date
    let isHealthy: Bool

    var formattedValue: String {
        switch type {
        case .memoryUsage:
            return String(format: "%.1f MB", value / (1024 * 1024))
        case .cpuUsage:
            return String(format: "%.1f%%", value)
        case .diskUsage:
            return String(format: "%.1f GB", value / (1024 * 1024 * 1024))
        case .fps:
            return String(format: "%.0f", value)
        case .networkLatency:
            return String(format: "%.0f ms", value)
        }
    }
}

/// Performance metric type
enum PerformanceMetricType: String, CaseIterable, Identifiable {
    case memoryUsage = "Memory Usage"
    case cpuUsage = "CPU Usage"
    case diskUsage = "Disk Usage"
    case fps = "FPS"
    case networkLatency = "Network Latency"

    var id: String { rawValue }

    var unit: String {
        switch self {
        case .memoryUsage: return "MB"
        case .cpuUsage: return "%"
        case .diskUsage: return "GB"
        case .fps: return "fps"
        case .networkLatency: return "ms"
        }
    }

    var icon: String {
        switch self {
        case .memoryUsage: return "memorychip.fill"
        case .cpuUsage: return "cpu.fill"
        case .diskUsage: return "internaldrive.fill"
        case .fps: return "speedometer"
        case .networkLatency: return "network"
        }
    }

    var healthyThreshold: Double {
        switch self {
        case .memoryUsage: return 200 * 1024 * 1024 // 200 MB
        case .cpuUsage: return 70 // 70%
        case .diskUsage: return 10 * 1024 * 1024 * 1024 // 10 GB
        case .fps: return 30 // 30 fps
        case .networkLatency: return 200 // 200 ms
        }
    }
}

// MARK: - Log Entry

/// Log entry for log viewer
struct LogEntry: Identifiable {
    let id: UUID
    let level: LogLevel
    let message: String
    let source: String
    let timestamp: Date

    init(
        id: UUID = UUID(),
        level: LogLevel,
        message: String,
        source: String,
        timestamp: Date = Date()
    ) {
        self.id = id
        self.level = level
        self.message = message
        self.source = source
        self.timestamp = timestamp
    }

    var formattedTime: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss.SSS"
        return formatter.string(from: timestamp)
    }
}

/// Log level
enum LogLevel: String, CaseIterable {
    case debug = "DEBUG"
    case info = "INFO"
    case warning = "WARNING"
    case error = "ERROR"

    var iconName: String {
        switch self {
        case .debug: return "ant.fill"
        case .info: return "info.circle.fill"
        case .warning: return "exclamationmark.triangle.fill"
        case .error: return "xmark.circle.fill"
        }
    }

    var color: String {
        switch self {
        case .debug: return "gray"
        case .info: return "blue"
        case .warning: return "yellow"
        case .error: return "red"
        }
    }
}

// MARK: - Cache Info

/// Cache information
struct CacheInfo: Identifiable {
    let id: UUID
    let type: DiagnosticCacheType
    let sizeBytes: Int64
    let entryCount: Int
    let lastCleared: Date?

    var formattedSize: String {
        ByteCountFormatter.string(fromByteCount: sizeBytes, countStyle: .file)
    }

    var formattedLastCleared: String {
        guard let date = lastCleared else { return "Never" }
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

/// Cache type for diagnostic
enum DiagnosticCacheType: String, CaseIterable, Identifiable {
    case images = "Images"
    case data = "Data"
    case sessions = "Sessions"
    case temporary = "Temporary"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .images: return "photo.fill"
        case .data: return "doc.fill"
        case .sessions: return "clock.fill"
        case .temporary: return "trash.fill"
        }
    }
}
