//
//  DataPersistenceIntegrationExample.swift
//  TRIX3DCompanion
//
//  Integration examples for Phase 6C data persistence services
//

import SwiftUI
import Combine

// MARK: - Example 1: Network-Aware Data Loading

/// Example view that loads data based on network status
struct NetworkAwareDataView: View {
    @StateObject private var networkMonitor = NetworkMonitor.shared
    @StateObject private var syncService = DataSyncService.shared
    @StateObject private var cacheService = OfflineCacheService.shared

    @State private var messages: [ChatMessage] = []
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            List(messages) { message in
                Text(message.text)
            }
            .navigationTitle("Messages")
            .overlay {
                if isLoading {
                    ProgressView("Loading...")
                } else if let error = errorMessage {
                    Text(error)
                        .foregroundColor(.red)
                }
            }
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    HStack {
                        // Network status indicator
                        Circle()
                            .fill(networkMonitor.isConnected ? Color.green : Color.red)
                            .frame(width: 10, height: 10)

                        Text(networkMonitor.connectionType.displayName)
                            .font(.caption)

                        // Sync button
                        if networkMonitor.isConnected && syncService.pendingItems > 0 {
                            Button("Sync") {
                                Task {
                                    await syncData()
                                }
                            }
                        }
                    }
                }
            }
            .task {
                await loadData()
            }
        }
    }

    private func loadData() async {
        isLoading = true
        errorMessage = nil

        do {
            // Try cache first
            if let cachedMessages = try? await cacheService.getMessages(for: "room_123") {
                messages = cachedMessages
            }

            // If network available, sync and load fresh data
            if networkMonitor.isConnected {
                try await syncService.sync(type: .messages, priority: .normal)

                // Reload from cache (now updated)
                messages = try await cacheService.getMessages(for: "room_123")
            }
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    private func syncData() async {
        do {
            let result = try await syncService.sync(type: .messages, priority: .high)
            SecureLogger.shared.debug("Sync result: \(result.syncedItems) synced, \(result.failedItems) failed")

            // Reload data after sync
            messages = try await cacheService.getMessages(for: "room_123")
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

// MARK: - Example 2: Offline Study Session Tracking

/// Example service that tracks study sessions with offline support
@MainActor
final class OfflineStudyTracker: ObservableObject {
    @Published private(set) var isTracking = false
    @Published private(set) var currentSession: StudySession?
    @Published private(set) var syncStatus: SyncStatus = .idle

    private let databaseManager = DatabaseManager.shared
    private let syncService = DataSyncService.shared
    private let networkMonitor = NetworkMonitor.shared

    // Sync subscriptions
    private var cancellables = Set<AnyCancellable>()

    init() {
        setupSyncMonitoring()
    }

    private func setupSyncMonitoring() {
        // Auto-sync when network becomes available
        networkMonitor.statusPublisher
            .filter { $0.isConnected }
            .sink { [weak self] _ in
                Task { @MainActor in
                    await self?.syncPendingSessions()
                }
            }
            .store(in: &cancellables)

        // Monitor sync status
        syncService.statusPublisher
            .assign(to: &$syncStatus)
    }

    func startSession(subject: String?) async throws {
        let session = StudySession(
            id: UUID().uuidString,
            userId: AuthService.shared.currentUser?.id ?? "",
            subject: subject,
            duration: 0,
            startedAt: Date(),
            endedAt: nil,
            notes: nil,
            earnedPoints: nil,
            isCompleted: false,
            createdAt: Date()
        )

        // Save to database
        try databaseManager.saveStudySession(session)
        currentSession = session
        isTracking = true
    }

    func endSession(notes: String?) async throws {
        guard var session = currentSession else {
            return
        }

        let endTime = Date()
        let duration = Int(endTime.timeIntervalSince(session.startedAt))

        // Update session
        let updatedSession = StudySession(
            id: session.id,
            userId: session.userId,
            subject: session.subject,
            duration: duration,
            startedAt: session.startedAt,
            endedAt: endTime,
            notes: notes,
            earnedPoints: calculatePoints(for: duration),
            isCompleted: true,
            createdAt: session.createdAt
        )

        // Save to database
        try databaseManager.saveStudySession(updatedSession)
        currentSession = updatedSession
        isTracking = false

        // Sync to server if network available
        if networkMonitor.isConnected {
            await syncPendingSessions()
        }
    }

    private func syncPendingSessions() async {
        do {
            let result = try await syncService.sync(type: .studySessions, priority: .high)
            SecureLogger.shared.info("Synced \(result.syncedItems) study sessions")
        } catch {
            SecureLogger.shared.error("Sync failed: \(error)")
        }
    }

    private func calculatePoints(for duration: Int) -> Int {
        // Simple points calculation: 1 point per minute
        return duration / 60
    }
}

// MARK: - Example 3: User Data Export View

/// Example view for exporting user data
struct DataExportView: View {
    @StateObject private var exportService = DataExportService.shared
    @StateObject private var authService = AuthService.shared

    @State private var selectedType: ExportType = .allData
    @State private var selectedFormat: ExportFormat = .json
    @State private var exportedFileURL: URL?
    @State private var showingShareSheet = false
    @State private var showingError = false
    @State private var errorMessage: String?

    var body: some View {
        Form {
            Section("Export Options") {
                Picker("Data Type", selection: $selectedType) {
                    ForEach(ExportType.allCases, id: \.self) { type in
                        Text(type.displayName).tag(type)
                    }
                }

                Picker("Format", selection: $selectedFormat) {
                    Text("JSON").tag(ExportFormat.json)
                    Text("CSV").tag(ExportFormat.csv)
                }
            }

            Section("Export") {
                if exportService.isExporting {
                    VStack(alignment: .leading, spacing: 8) {
                        if let progress = exportService.currentProgress {
                            Text(progress.currentStep)
                                .font(.caption)

                            ProgressView(value: progress.percentage / 100.0)

                            Text("\(Int(progress.percentage))%")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding()
                } else {
                    Button(action: performExport) {
                        HStack {
                            Image(systemName: "square.and.arrow.up")
                            Text("Export \(selectedType.displayName)")
                        }
                    }
                    .disabled(!authService.isLoggedIn)
                }
            }

            if let history = exportService.getExportHistory(), !history.isEmpty {
                Section("Export History") {
                    ForEach(Array(history.enumerated().prefix(5)), id: \.element) { _, result in
                        HStack {
                            VStack(alignment: .leading) {
                                Text(result.type.displayName)
                                    .font(.headline)
                                Text(result.format.displayName.uppercased())
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }

                            Spacer()

                            VStack(alignment: .trailing) {
                                Text(result.formattedFileSize)
                                    .font(.caption)
                                Text(result.timestamp, style: .relative)
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Export Data")
        .sheet(isPresented: $showingShareSheet) {
            if let fileURL = exportedFileURL {
                ShareSheet(activityItems: [fileURL])
            }
        }
        .alert("Export Error", isPresented: $showingError) {
            Button("OK", role: .cancel) { }
        } message: {
            if let error = errorMessage {
                Text(error)
            }
        }
    }

    private func performExport() {
        Task {
            do {
                let result = try await exportService.export(type: selectedType, format: selectedFormat)
                exportedFileURL = result.fileURL
                showingShareSheet = true
            } catch {
                errorMessage = error.localizedDescription
                showingError = true
            }
        }
    }
}

// MARK: - Example 4: Sync Status Dashboard

/// Example view showing sync status and controls
struct SyncDashboardView: View {
    @StateObject private var syncService = DataSyncService.shared
    @StateObject private var networkMonitor = NetworkMonitor.shared
    @StateObject private var cacheService = OfflineCacheService.shared

    @State private var cacheStats: [CacheType: CacheStatistics] = [:]

    var body: some View {
        List {
            // Network Status Section
            Section("Network") {
                HStack {
                    Image(systemName: "wifi")
                        .foregroundColor(networkMonitor.isConnected ? .green : .red)

                    VStack(alignment: .leading) {
                        Text(networkMonitor.isConnected ? "Connected" : "Disconnected")
                            .font(.headline)

                        Text(networkMonitor.connectionType.displayName)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    Spacer()

                    if networkMonitor.isConnected {
                        VStack(alignment: .trailing) {
                            Text("Quality")
                                .font(.caption2)
                            Text(networkMonitor.quality.displayName)
                                .font(.caption)
                                .foregroundColor(colorForQuality(networkMonitor.quality))
                        }
                    }
                }
            }

            // Sync Status Section
            Section("Sync Status") {
                HStack {
                    Image(systemName: iconForSyncStatus(syncService.currentStatus))
                        .foregroundColor(colorForSyncStatus(syncService.currentStatus))

                    VStack(alignment: .leading) {
                        Text(syncService.currentStatus.displayName)
                            .font(.headline)

                        if let lastSync = syncService.lastSyncDate {
                            Text("Last sync: \(lastSync, style: .relative)")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }

                    Spacer()

                    if syncService.pendingItems > 0 {
                        Text("\(syncService.pendingItems) pending")
                            .font(.caption)
                            .padding(4)
                            .background(Color.orange.opacity(0.2))
                            .clipShape(Capsule())
                    }
                }

                if syncService.isSyncing {
                    VStack(alignment: .leading) {
                        Text("Syncing...")
                            .font(.caption)

                        ProgressView(value: syncService.progress)
                    }
                }

                if networkMonitor.isConnected {
                    Button(action: syncAll) {
                        HStack {
                            Image(systemName: "arrow.clockwise")
                            Text("Sync Now")
                        }
                    }
                    .disabled(syncService.isSyncing)
                }
            }

            // Cache Statistics Section
            Section("Cache Statistics") {
                ForEach(CacheType.allCases, id: \.self) { type in
                    if let stats = cacheStats[type] {
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(type.displayName)
                                    .font(.headline)

                                Spacer()

                                Text(stats.formattedSize)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }

                            HStack {
                                ProgressView(value: stats.usagePercentage / 100.0)
                                    .tint(colorForUsage(stats.usagePercentage))

                                Text("\(Int(stats.usagePercentage))%")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }

                            HStack {
                                Text("\(stats.totalEntries) items")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)

                                if stats.expiredEntries > 0 {
                                    Text("• \(stats.expiredEntries) expired")
                                        .font(.caption2)
                                        .foregroundColor(.orange)
                                }
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }

                Button("Clear Expired") {
                    Task {
                        try? await cacheService.cleanExpired()
                        loadCacheStats()
                    }
                }
            }

            // Export Section
            Section("Data Management") {
                NavigationLink(destination: DataExportView()) {
                    HStack {
                        Image(systemName: "square.and.arrow.up")
                        Text("Export Data")
                    }
                }

                Button("Clear All Cache", role: .destructive) {
                    Task {
                        try? await cacheService.clearAll()
                        loadCacheStats()
                    }
                }
            }
        }
        .navigationTitle("Data & Sync")
        .task {
            loadCacheStats()
        }
    }

    private func syncAll() {
        Task {
            do {
                let result = try await syncService.syncAll(priority: .normal)
                SecureLogger.shared.info("Sync complete: \(result.syncedItems) synced")
            } catch {
                SecureLogger.shared.error("Sync failed: \(error)")
            }
        }
    }

    private func loadCacheStats() {
        Task {
            for type in CacheType.allCases {
                if let stats = try? await cacheService.getStatistics(type: type) {
                    cacheStats[type] = stats
                }
            }
        }
    }

    private func iconForSyncStatus(_ status: SyncStatus) -> String {
        switch status {
        case .idle:
            return "checkmark.circle"
        case .syncing:
            return "arrow.circlepath"
        case .success:
            return "checkmark.circle.fill"
        case .failed:
            return "xmark.circle.fill"
        case .partial:
            return "exclamationmark.triangle.fill"
        }
    }

    private func colorForSyncStatus(_ status: SyncStatus) -> Color {
        switch status {
        case .idle:
            return .gray
        case .syncing:
            return .blue
        case .success:
            return .green
        case .failed:
            return .red
        case .partial:
            return .orange
        }
    }

    private func colorForQuality(_ quality: ConnectionQuality) -> Color {
        switch quality {
        case .excellent:
            return .green
        case .good:
            return .blue
        case .fair:
            return .yellow
        case .poor:
            return .red
        case .unknown:
            return .gray
        }
    }

    private func colorForUsage(_ percentage: Double) -> Color {
        switch percentage {
        case 0..<50:
            return .green
        case 50..<80:
            return .yellow
        case 80...:
            return .red
        default:
            return .gray
        }
    }
}

// MARK: - Helper: Share Sheet

struct ShareSheet: UIViewControllerRepresentable {
    let activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {
    }
}

// MARK: - Preview

#Preview("Network-Aware Data View") {
    NetworkAwareDataView()
}

#Preview("Sync Dashboard") {
    NavigationStack {
        SyncDashboardView()
    }
}

#Preview("Export Data") {
    NavigationStack {
        DataExportView()
    }
}
