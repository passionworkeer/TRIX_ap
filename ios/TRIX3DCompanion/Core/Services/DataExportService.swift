//
//  DataExportService.swift
//  TRIX3DCompanion
//
//  Data export service for exporting user data in various formats
//

import Foundation
import Combine

// MARK: - Export Format

/// Supported export formats
enum ExportFormat: String, CaseIterable {
    case json = "json"
    case csv = "csv"
    case pdf = "pdf"

    var fileExtension: String {
        return rawValue
    }

    var displayName: String {
        switch self {
        case .json:
            return "JSON"
        case .csv:
            return "CSV"
        case .pdf:
            return "PDF"
        }
    }

    var mimeType: String {
        switch self {
        case .json:
            return "application/json"
        case .csv:
            return "text/csv"
        case .pdf:
            return "application/pdf"
        }
    }
}

// MARK: - Export Type

/// Types of data that can be exported
enum ExportType: String, CaseIterable {
    case allData = "all_data"
    case messages = "messages"
    case studyRecords = "study_records"
    case chatHistory = "chat_history"
    case learningProgress = "learning_progress"
    case userProfile = "user_profile"

    var displayName: String {
        switch self {
        case .allData:
            return "All Data"
        case .messages:
            return "Messages"
        case .studyRecords:
            return "Study Records"
        case .chatHistory:
            return "Chat History"
        case .learningProgress:
            return "Learning Progress"
        case .userProfile:
            return "User Profile"
        }
    }
}

// MARK: - Export Progress

/// Progress tracking for export operations
struct ExportProgress {
    let currentStep: String
    let stepsCompleted: Int
    let totalSteps: Int
    let itemsProcessed: Int
    let totalItems: Int

    var percentage: Double {
        guard totalSteps > 0 else { return 0 }
        return Double(stepsCompleted) / Double(totalSteps) * 100.0
    }

    var isComplete: Bool {
        stepsCompleted >= totalSteps && itemsProcessed >= totalItems
    }
}

// MARK: - Export Result

/// Result of an export operation
struct ExportResult {
    let type: ExportType
    let format: ExportFormat
    let fileURL: URL
    let itemCount: Int
    let fileSizeBytes: Int64
    let timestamp: Date
    let duration: TimeInterval

    var formattedFileSize: String {
        ByteCountFormatter.string(fromByteCount: fileSizeBytes, countStyle: .file)
    }

    var formattedDuration: String {
        let formatter = DateComponentsFormatter()
        formatter.unitsStyle = .abbreviated
        formatter.allowedUnits = [.minute, .second]
        return formatter.string(from: duration) ?? "0s"
    }
}

// MARK: - Export Error

/// Export operation errors
enum ExportError: Error, LocalizedError {
    case notAuthenticated
    case permissionDenied
    case storageUnavailable
    case invalidFormat
    case dataUnavailable
    case encodingFailed
    case fileWriteFailed(underlying: Error)
    case cancelled
    case messageFetchFailed(underlying: Error?)
    case unknown(underlying: Error?)

    var errorDescription: String? {
        switch self {
        case .notAuthenticated:
            return "Authentication required for export"
        case .permissionDenied:
            return "Permission denied for file access"
        case .storageUnavailable:
            return "Storage is currently unavailable"
        case .invalidFormat:
            return "Invalid export format specified"
        case .dataUnavailable:
            return "Requested data is unavailable"
        case .encodingFailed:
            return "Failed to encode data for export"
        case .fileWriteFailed(let error):
            return "Failed to write file: \(error.localizedDescription)"
        case .cancelled:
            return "Export cancelled by user"
        case .messageFetchFailed(let error):
            return "Failed to fetch messages: \(error?.localizedDescription ?? "Unknown error")"
        case .unknown(let error):
            return error?.localizedDescription ?? "Unknown export error"
        }
    }
}

// MARK: - Exportable Data Container

/// Container for all exportable user data
struct ExportableData: Codable {
    let userProfile: User?
    let messages: [ChatMessage]
    let studySessions: [StudySession]
    let pointsHistory: [PointsTransaction]
    let exportDate: Date
    let version: String

    var totalItems: Int {
        (userProfile != nil ? 1 : 0) + messages.count + studySessions.count + pointsHistory.count
    }
}

// MARK: - Data Export Service Protocol

protocol DataExportServiceProtocol {
    var isExporting: Bool { get }
    var currentProgress: ExportProgress? { get }
    var progressPublisher: AnyPublisher<ExportProgress?, Never> { get }

    func export(type: ExportType, format: ExportFormat) async throws -> ExportResult
    func exportAll(format: ExportFormat) async throws -> ExportResult
    func cancelExport()
    func getExportHistory() -> [ExportResult]
}

// MARK: - Data Export Service

/// Main data export service for exporting user data
@MainActor
final class DataExportService: ObservableObject, DataExportServiceProtocol {

    // MARK: - Singleton

    static let shared = DataExportService()

    // MARK: - Published Properties

    @Published private(set) var isExporting: Bool = false

    @Published private(set) var currentProgress: ExportProgress?

    @Published private(set) var lastError: ExportError?

    // MARK: - Dependencies

    private let offlineCache: OfflineCacheService
    private let databaseManager: DatabaseManager
    private let authService: AuthService
    private let fileManager: FileManager
    private let chatService: ChatService

    // MARK: - Private Properties

    private var exportTask: Task<Void, Never>?

    private var exportHistory: [ExportResult] = []

    private var cancellables = Set<AnyCancellable>()

    private let maxHistoryItems = 20

    // MARK: - Publishers

    var progressPublisher: AnyPublisher<ExportProgress?, Never> {
        $currentProgress.eraseToAnyPublisher()
    }

    // MARK: - Initialization

    init(
        offlineCache: OfflineCacheService = .shared,
        databaseManager: DatabaseManager = .shared,
        authService: AuthService = .shared,
        chatService: ChatService = .shared
    ) {
        self.offlineCache = offlineCache
        self.databaseManager = databaseManager
        self.authService = authService
        self.fileManager = FileManager.default
        self.chatService = chatService
    }

    // MARK: - Public Methods - Export Operations

    /// Export specific data type
    /// - Parameters:
    ///   - type: Type of data to export
    ///   - format: Export format
    /// - Returns: Export result
    func export(type: ExportType, format: ExportFormat = .json) async throws -> ExportResult {
        // Check authentication
        guard authService.isLoggedIn else {
            throw ExportError.notAuthenticated
        }

        // Check if already exporting
        guard !isExporting else {
            throw ExportError.unknown(underlying: nil)
        }

        isExporting = true
        lastError = nil

        let startTime = Date()

        do {
            let result = try await performExport(type: type, format: format, startTime: startTime)

            // Save to history
            addToHistory(result)

            isExporting = false
            currentProgress = nil

            return result

        } catch let error as ExportError {
            isExporting = false
            lastError = error
            currentProgress = nil
            throw error

        } catch {
            isExporting = false
            let exportError = ExportError.unknown(underlying: error)
            lastError = exportError
            currentProgress = nil
            throw exportError
        }
    }

    /// Export all data
    /// - Parameter format: Export format
    /// - Returns: Export result
    func exportAll(format: ExportFormat = .json) async throws -> ExportResult {
        return try await export(type: .allData, format: format)
    }

    /// Cancel current export
    func cancelExport() {
        exportTask?.cancel()
        exportTask = nil
        isExporting = false
        currentProgress = nil
        lastError = .cancelled
    }

    /// Get export history
    func getExportHistory() -> [ExportResult] {
        return exportHistory
    }

    // MARK: - Private Methods - Export Implementation

    private func performExport(type: ExportType, format: ExportFormat, startTime: Date) async throws -> ExportResult {
        // Gather data based on type
        let data = try await gatherData(for: type)

        // Update progress
        updateProgress(
            currentStep: "Encoding data",
            stepsCompleted: 1,
            totalSteps: 3,
            itemsProcessed: 0,
            totalItems: data.totalItems
        )

        // Encode data
        let encodedData = try encodeData(data, format: format)

        // Update progress
        updateProgress(
            currentStep: "Writing file",
            stepsCompleted: 2,
            totalSteps: 3,
            itemsProcessed: data.totalItems,
            totalItems: data.totalItems
        )

        // Write to file
        let fileURL = try writeFile(encodedData, type: type, format: format)

        // Update progress
        updateProgress(
            currentStep: "Complete",
            stepsCompleted: 3,
            totalSteps: 3,
            itemsProcessed: data.totalItems,
            totalItems: data.totalItems
        )

        let duration = Date().timeIntervalSince(startTime)

        return ExportResult(
            type: type,
            format: format,
            fileURL: fileURL,
            itemCount: data.totalItems,
            fileSizeBytes: Int64(encodedData.count),
            timestamp: Date(),
            duration: duration
        )
    }

    private func gatherData(for type: ExportType) async throws -> ExportableData {
        let userProfile = authService.currentUser

        var messages: [ChatMessage] = []
        var studySessions: [StudySession] = []
        var pointsHistory: [PointsTransaction] = []

        switch type {
        case .allData:
            // Gather all data including messages via ChatService
            messages = try await fetchAllMessages()
            studySessions = try databaseManager.getUnsyncedStudySessions()
            pointsHistory = try databaseManager.getPointsHistory(limit: 1000)

        case .messages, .chatHistory:
            // Gather messages using ChatService with pagination support
            messages = try await fetchAllMessages()

        case .studyRecords, .learningProgress:
            // Gather study sessions
            studySessions = try databaseManager.getUnsyncedStudySessions()

        case .userProfile:
            // Just user profile, no additional data
            break
        }

        return ExportableData(
            userProfile: userProfile,
            messages: messages,
            studySessions: studySessions,
            pointsHistory: pointsHistory,
            exportDate: Date(),
            version: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        )
    }

    // MARK: - Private Methods - Message Retrieval

    /// Fetch all messages from all chat rooms with pagination support
    /// - Returns: Array of all chat messages
    /// - Throws: ExportError if message retrieval fails
    private func fetchAllMessages() async throws -> [ChatMessage] {
        // First, fetch all chat rooms
        let roomsResult = await chatService.fetchChatRooms()

        switch roomsResult {
        case .success(let chatRooms):
            // If no rooms, return empty array
            guard !chatRooms.isEmpty else {
                return []
            }

            // Fetch messages from each room with pagination
            var allMessages: [ChatMessage] = []
            let maxMessagesPerRoom = 1000 // Limit per room to prevent excessive export

            for room in chatRooms {
                let roomMessages = try await fetchMessagesForRoom(
                    roomId: room.id,
                    maxMessages: maxMessagesPerRoom
                )
                allMessages.append(contentsOf: roomMessages)
            }

            // Sort all messages by timestamp (newest first)
            return allMessages.sorted { $0.createdAt > $1.createdAt }

        case .failure(let error):
            // If chat service fails, fall back to local database
            // This provides offline capability
            do {
                return try databaseManager.getMessages(roomId: "", limit: 1000)
            } catch {
                throw ExportError.messageFetchFailed(underlying: error)
            }
        }
    }

    /// Fetch all messages for a specific room using pagination
    /// - Parameters:
    ///   - roomId: The room ID to fetch messages from
    ///   - maxMessages: Maximum number of messages to fetch per room
    /// - Returns: Array of chat messages
    private func fetchMessagesForRoom(roomId: String, maxMessages: Int) async throws -> [ChatMessage] {
        var allRoomMessages: [ChatMessage] = []
        var lastMessageDate: Date? = nil
        let pageSize = 50

        // Keep fetching until we have all messages or reach the limit
        while allRoomMessages.count < maxMessages {
            let result = await chatService.fetchMessages(roomId: roomId, before: lastMessageDate)

            switch result {
            case .success(let messages):
                guard !messages.isEmpty else {
                    // No more messages in this room
                    return allRoomMessages
                }

                // Add new messages
                allRoomMessages.append(contentsOf: messages)

                // Update the last message date for next pagination
                if let oldestMessage = messages.last {
                    lastMessageDate = oldestMessage.createdAt
                }

                // If we received fewer messages than page size, we're done
                if messages.count < pageSize {
                    return allRoomMessages
                }

            case .failure:
                // If fetch fails, return what we have so far
                // This allows partial export to succeed
                if allRoomMessages.isEmpty {
                    // Try local cache as fallback
                    do {
                        return try databaseManager.getMessages(roomId: roomId, limit: maxMessages)
                    } catch {
                        throw ExportError.messageFetchFailed(underlying: error)
                    }
                }
                // Return partial results if we have some messages
                return allRoomMessages
            }
        }

        return allRoomMessages
    }

    private func encodeData(_ data: ExportableData, format: ExportFormat) throws -> Data {
        switch format {
        case .json:
            return try encodeJSON(data)
        case .csv:
            return try encodeCSV(data)
        case .pdf:
            throw ExportError.invalidFormat // PDF not yet implemented
        }
    }

    private func encodeJSON(_ data: ExportableData) throws -> Data {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return try encoder.encode(data)
    }

    private func encodeCSV(_ data: ExportableData) throws -> Data {
        var csvLines: [String] = []

        // Add metadata
        csvLines.append("# Export Date: \(ISO8601DateFormatter().string(from: data.exportDate))")
        csvLines.append("# Version: \(data.version)")
        csvLines.append("")

        // Export study sessions
        if !data.studySessions.isEmpty {
            csvLines.append("# Study Sessions")
            csvLines.append("ID,User ID,Duration,Started,Completed,Earned Points,Is Completed")
            for session in data.studySessions {
                let values = [
                    session.id,
                    session.userId,
                    "\(session.duration)",
                    ISO8601DateFormatter().string(from: session.startedAt),
                    session.endedAt.map { ISO8601DateFormatter().string(from: $0) } ?? "",
                    "\(session.earnedPoints ?? 0)",
                    "\(session.isCompleted)"
                ]
                let escapedValues = values.map { escapeCSV($0) }
                let line = escapedValues.joined(separator: ",")
                csvLines.append(line)
            }
            csvLines.append("")
        }

        // Export points history
        if !data.pointsHistory.isEmpty {
            csvLines.append("# Points History")
            csvLines.append("ID,Points Change,Type,Description,Balance After,Created At")
            for transaction in data.pointsHistory {
                let line = [
                    transaction.id,
                    "\(transaction.pointsChange)",
                    transaction.type.rawValue,
                    escapeCSV(transaction.description),
                    "\(transaction.balanceAfter)",
                    ISO8601DateFormatter().string(from: transaction.createdAt)
                ].joined(separator: ",")
                csvLines.append(line)
            }
        }

        return csvLines.joined(separator: "\n").data(using: .utf8) ?? Data()
    }

    private func escapeCSV(_ field: String) -> String {
        if field.contains(",") || field.contains("\"") || field.contains("\n") {
            return "\"\(field.replacingOccurrences(of: "\"", with: "\"\""))\""
        }
        return field
    }

    private func writeFile(_ data: Data, type: ExportType, format: ExportFormat) throws -> URL {
        // Create export directory
        let exportsURL = fileManager.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Exports", isDirectory: true)

        if !fileManager.fileExists(atPath: exportsURL.path) {
            try fileManager.createDirectory(at: exportsURL, withIntermediateDirectories: true)
        }

        // Create filename with timestamp
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd_HH-mm-ss"
        let timestamp = dateFormatter.string(from: Date())

        let filename = "\(type.rawValue)_\(timestamp).\(format.fileExtension)"
        let fileURL = exportsURL.appendingPathComponent(filename)

        // Write data
        try data.write(to: fileURL)

        return fileURL
    }

    private func updateProgress(currentStep: String, stepsCompleted: Int, totalSteps: Int, itemsProcessed: Int, totalItems: Int) {
        currentProgress = ExportProgress(
            currentStep: currentStep,
            stepsCompleted: stepsCompleted,
            totalSteps: totalSteps,
            itemsProcessed: itemsProcessed,
            totalItems: totalItems
        )
    }

    private func addToHistory(_ result: ExportResult) {
        exportHistory.insert(result, at: 0)

        // Limit history size
        if exportHistory.count > maxHistoryItems {
            exportHistory = Array(exportHistory.prefix(maxHistoryItems))
        }
    }
}

// MARK: - Export Progress Publisher

extension DataExportService {

    /// Observe export progress as AsyncStream
    var progressStream: AsyncStream<ExportProgress?> {
        AsyncStream { continuation in
            // Emit initial state
            continuation.yield(currentProgress)

            // Observe changes
            $currentProgress
                .dropFirst()
                .sink { progress in
                    continuation.yield(progress)
                }
                .store(in: &cancellables)

            continuation.onTermination = { _ in
                // Cleanup handled by cancellables
            }
        }
    }
}

// MARK: - Convenience Extensions

extension DataExportService {

    /// Share exported file
    func shareExportedFile(_ result: ExportResult) -> URL {
        return result.fileURL
    }

    /// Delete exported file
    func deleteExportedFile(_ result: ExportResult) throws {
        try fileManager.removeItem(at: result.fileURL)
    }

    /// Clear export history
    func clearExportHistory() {
        exportHistory.removeAll()
    }

    /// Get total size of all exports
    func getTotalExportSize() -> Int64 {
        exportHistory.reduce(0) { $0 + $1.fileSizeBytes }
    }

    /// Clear error state
    func clearError() {
        lastError = nil
    }
}

// MARK: - Exportable Data Extensions

extension ExportableData {

    /// Get study statistics summary
    var studyStats: String {
        let totalDuration = studySessions.reduce(into: 0) { $0 += $1.duration }
        let completedCount = studySessions.filter { $0.isCompleted }.count
        let totalPoints = studySessions.compactMap { $0.earnedPoints }.reduce(0, +)

        return """
        Total Sessions: \(studySessions.count)
        Completed: \(completedCount)
        Total Duration: \(totalDuration / 60) minutes
        Points Earned: \(totalPoints)
        """
    }

    /// Get chat statistics summary
    var chatStats: String {
        let userMessages = messages.filter { $0.sender == .user }.count
        let botMessages = messages.filter { $0.sender == .bot }.count

        return """
        Total Messages: \(messages.count)
        User Messages: \(userMessages)
        Bot Messages: \(botMessages)
        """
    }
}
