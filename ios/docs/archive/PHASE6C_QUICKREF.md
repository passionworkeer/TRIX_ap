# Phase 6C Quick Reference

A quick reference guide for Phase 6C data persistence services.

## Service Access

```swift
let networkMonitor = NetworkMonitor.shared
let cacheService = OfflineCacheService.shared
let syncService = DataSyncService.shared
let exportService = DataExportService.shared
```

## Network Monitor

### Check Status

```swift
networkMonitor.isConnected        // Bool
networkMonitor.connectionType     // ConnectionType enum
networkMonitor.quality            // ConnectionQuality enum
networkMonitor.isExpensive        // Bool (cellular)
```

### Subscribe to Changes

```swift
networkMonitor.statusPublisher
    .sink { status in
        print("Connected: \(status.isConnected)")
    }
    .store(in: &cancellables)

// Or AsyncStream
for await status in networkMonitor.statusStream {
    // Handle status change
}
```

### Measure Latency

```swift
let latency = try await networkMonitor.measureLatency()
// latency in seconds
```

## Offline Cache

### Cache Data

```swift
// Generic
try await cacheService.cache(data, forKey: "key", type: .messages)

// Convenience methods
try await cacheService.cacheMessages(messages, for: roomId)
try await cacheService.cacheStudySessions(sessions, for: userId)
try await cacheService.cacheUserProfile(user)
try await cacheService.cacheImage(imageData, forKey: "avatar_123")
```

### Retrieve Data

```swift
// Generic
let data: ChatMessage = try await cacheService.retrieve(key: "key", type: .messages)

// Convenience methods
let messages = try await cacheService.getMessages(for: roomId)
let sessions = try await cacheService.getStudySessions(for: userId)
let user = try await cacheService.getUserProfile()
let imageData = try await cacheService.getImage(forKey: "avatar_123")
```

### Cache Statistics

```swift
let stats = try await cacheService.getStatistics(type: .messages)
print("Size: \(stats.formattedSize)")
print("Entries: \(stats.totalEntries)")
print("Usage: \(stats.usagePercentage)%")
```

### Cache Cleanup

```swift
// Clean expired for specific type
try await cacheService.cleanExpired(type: .messages)

// Clean all expired
try await cacheService.cleanExpired()

// Clear specific type
try await cacheService.clear(type: .messages)

// Clear all
try await cacheService.clearAll()
```

## Data Sync

### Sync Data

```swift
// Sync specific type
let result = try await syncService.sync(type: .messages, priority: .normal)
print("Synced: \(result.syncedItems)")
print("Failed: \(result.failedItems)")
print("Conflicts: \(result.conflicts)")

// Sync all
let allResult = try await syncService.syncAll(priority: .high)
```

### Sync Priority

```swift
enum SyncPriority {
    case low
    case normal
    case high
    case urgent
}
```

### Sync Strategy

```swift
syncService.setStrategy(.immediate)    // Sync immediately
syncService.setStrategy(.deferred)     // Wait for optimal conditions
syncService.setStrategy(.manual)       // Only on request
syncService.setStrategy(.adaptive)     // Auto-choose (recommended)
```

### Conflict Resolution

```swift
syncService.setConflictResolution(.clientWins)    // Local wins
syncService.setConflictResolution(.serverWins)    // Remote wins
syncService.setConflictResolution(.mostRecent)    // Newest timestamp
syncService.setConflictResolution(.manual)        // User resolves
```

### Sync Status

```swift
syncService.currentStatus      // SyncStatus enum
syncService.isSyncing          // Bool
syncService.progress           // Double (0.0-1.0)
syncService.lastSyncDate       // Date?
syncService.pendingItems       // Int
```

### Subscribe to Status

```swift
syncService.statusPublisher
    .sink { status in
        print("Status: \(status.displayName)")
    }
    .store(in: &cancellables)

// Or AsyncStream
for await status in syncService.statusStream {
    // Handle status change
}

// Progress stream
for await progress in syncService.progressStream {
    print("Progress: \(progress * 100)%")
}
```

## Data Export

### Export Data

```swift
// Export specific type
let result = try await exportService.export(type: .studyRecords, format: .json)
print("File: \(result.fileURL)")
print("Size: \(result.formattedSize)")
print("Items: \(result.itemCount)")

// Export all
let allResult = try await exportService.exportAll(format: .csv)
```

### Export Types

```swift
enum ExportType {
    case allData
    case messages
    case studyRecords
    case chatHistory
    case learningProgress
    case userProfile
}
```

### Export Formats

```swift
enum ExportFormat {
    case json    // Structured JSON
    case csv     // Comma-separated values
    case pdf     // Future support
}
```

### Export Progress

```swift
exportService.isExporting          // Bool
exportService.currentProgress      // ExportProgress?

// Subscribe to progress
exportService.progressPublisher
    .sink { progress in
        if let progress = progress {
            print("Step: \(progress.currentStep)")
            print("Progress: \(progress.percentage)%")
        }
    }
    .store(in: &cancellables)
```

### Export History

```swift
let history = exportService.getExportHistory()
// Returns array of ExportResult

// Clear history
exportService.clearExportHistory()

// Get total size
let totalSize = exportService.getTotalExportSize()
```

### Share Exported File

```swift
let fileURL = exportService.shareExportedFile(result)
// Use for sharing with UIActivityViewController
```

## SwiftUI Integration

### State Object

```swift
@StateObject private var networkMonitor = NetworkMonitor.shared
@StateObject private var syncService = DataSyncService.shared
@StateObject private var cacheService = OfflineCacheService.shared
@StateObject private var exportService = DataExportService.shared
```

### Reactive UI

```swift
// Network status indicator
Circle()
    .fill(networkMonitor.isConnected ? Color.green : Color.red)
    .frame(width: 10, height: 10)

Text(networkMonitor.connectionType.displayName)

// Sync button
Button("Sync") {
    Task {
        try? await syncService.syncAll(priority: .normal)
    }
}
.disabled(!networkMonitor.isConnected || syncService.isSyncing)

// Sync progress
if syncService.isSyncing {
    ProgressView(value: syncService.progress)
    Text("Syncing...")
}

// Export button
Button("Export") {
    Task {
        try? await exportService.export(type: .allData, format: .json)
    }
}
.disabled(exportService.isExporting)
```

## Common Patterns

### Pattern 1: Network-Aware Data Loading

```swift
Task {
    // Try cache first
    if let cached = try? await cacheService.getMessages(for: roomId) {
        messages = cached
    }

    // Sync if network available
    if networkMonitor.isConnected {
        try? await syncService.sync(type: .messages, priority: .normal)
        messages = try await cacheService.getMessages(for: roomId)
    }
}
```

### Pattern 2: Auto-Sync on Network Change

```swift
networkMonitor.statusPublisher
    .filter { $0.isConnected }
    .sink { _ in
        Task {
            if syncService.pendingItems > 0 {
                try? await syncService.syncAll(priority: .normal)
            }
        }
    }
    .store(in: &cancellables)
```

### Pattern 3: Progressive Export

```swift
exportService.progressPublisher
    .sink { progress in
        guard let progress = progress else { return }

        Task { @MainActor in
            progressValue = progress.percentage / 100.0
            currentStep = progress.currentStep
            itemsProcessed = progress.itemsProcessed
            totalItems = progress.totalItems
        }
    }
    .store(in: &cancellables)
```

### Pattern 4: Error Handling

```swift
do {
    let result = try await syncService.syncAll(priority: .normal)
    // Handle success
} catch let error as SyncError {
    switch error {
    case .networkUnavailable:
        showAlert("No network connection")
    case .authenticationRequired:
        showAlert("Please log in")
    case .conflict(let resolution):
        showAlert("Conflict: \(resolution.description)")
    default:
        showAlert("Sync failed: \(error.localizedDescription)")
    }
}
```

## Enum Reference

### ConnectionType

```swift
.none          // No connection
.wifi          // Wi-Fi connection
.cellular      // Cellular connection (expensive)
.ethernet      // Wired Ethernet
.other         // Other connection types
```

### ConnectionQuality

```swift
.excellent      // Latency < 50ms
.good          // Latency 50-100ms
.fair          // Latency 100-200ms
.poor          // Latency > 200ms
.unknown       // Unknown quality
```

### SyncStatus

```swift
.idle          // Not syncing
.syncing       // Currently syncing
.success       // Sync completed successfully
.failed        // Sync failed
.partial       // Partial success (some failures)
```

### CacheType

```swift
.messages          // Chat messages
.studyRecords      // Study sessions
.userProfile       // User profile
.images            // Image cache
```

### ExportType

```swift
.allData           // All user data
.messages          // Messages only
.studyRecords      // Study records only
.chatHistory       // Complete chat history
.learningProgress  // Learning statistics
.userProfile       // User profile only
```

### ExportFormat

```swift
.json        // JSON format
.csv         // CSV format
.pdf         // PDF format (future)
```

## Quick Checks

### Network Available?

```swift
if networkMonitor.isConnected {
    // Proceed with network operation
}
```

### Should Sync?

```swift
if networkMonitor.isConnected && syncService.pendingItems > 0 {
    // Trigger sync
}
```

### Cache Needs Cleanup?

```swift
let stats = try await cacheService.getStatistics(type: .messages)
if stats.expiredEntries > 0 || stats.usagePercentage > 80 {
    // Trigger cleanup
}
```

### Expensive Connection?

```swift
if networkMonitor.isExpensive {
    // Show warning or defer large downloads
}
```

## Performance Tips

1. **Use Adaptive Sync**: Let the service decide when to sync
2. **Monitor Cache Size**: Check usage percentage regularly
3. **Batch Operations**: Sync multiple items at once
4. **Check Connection Type**: Defer large operations on cellular
5. **Clean Expired Cache**: Run cleanup periodically
6. **Use High Priority**: For urgent sync operations

## Common Errors

### CacheError

```swift
.notFound           // Key doesn't exist
.expired            // Data expired
.storageError       // Storage failure
.sizeLimitExceeded  // Cache too large
.invalidData        // Corrupted data
.encodingFailed     // Couldn't encode
.decodingFailed     // Couldn't decode
```

### SyncError

```swift
.networkUnavailable      // No network
.authenticationRequired  // Need login
.conflict               // Data conflict
.serverError            // Server failure
.clientError            // Client failure
.timeout                // Operation timeout
.cancelled              // User cancelled
.unknown                // Unknown error
```

### ExportError

```swift
.notAuthenticated       // Need login
.permissionDenied       // File permission denied
.storageUnavailable     // Storage unavailable
.invalidFormat          // Invalid format
.dataUnavailable        // No data
.encodingFailed         // Encoding failed
.fileWriteFailed        // Write failed
.cancelled              // User cancelled
.unknown                // Unknown error
```

## Initialization

### In AppDelegate

```swift
func application(_ application: UIApplication,
                didFinishLaunchingWithOptions...) -> Bool {

    // Start network monitoring
    NetworkMonitor.shared.startMonitoring()

    // Configure sync
    DataSyncService.shared.setStrategy(.adaptive)
    DataSyncService.shared.setConflictResolution(.mostRecent)

    return true
}
```

### In Root View

```swift
struct RootView: View {
    @StateObject private var networkMonitor = NetworkMonitor.shared

    var body: some View {
        ContentView()
            .task {
                // Initial setup
                if networkMonitor.isConnected {
                    // Trigger initial sync if needed
                }
            }
    }
}
```

## Testing

### Test Network Monitor

```swift
let monitor = NetworkMonitor.shared
monitor.startMonitoring()
// Simulate network changes
// Verify status updates
```

### Test Cache

```swift
let service = OfflineCacheService.shared
try await service.cache(data, forKey: "test", type: .messages)
let retrieved = try await service.retrieve(key: "test", type: .messages)
XCTAssertEqual(data, retrieved)
```

### Test Sync

```swift
let service = DataSyncService.shared
let result = try await service.sync(type: .messages, priority: .normal)
XCTAssertTrue(result.isSuccessful)
```

## File Locations

```
ios/TRIX3DCompanion/Core/Services/
├── OfflineCacheService.swift
├── NetworkMonitor.swift
├── DataSyncService.swift
└── DataExportService.swift

ios/
├── PHASE6C_SERVICES.md (detailed docs)
└── PHASE6C_SUMMARY.md (implementation summary)

ios/TRIX3DCompanion/Features/Data/
└── PersistenceIntegrationExample.swift (example views)
```

## Related Documentation

- **Detailed Guide**: `PHASE6C_SERVICES.md`
- **Implementation Summary**: `PHASE6C_SUMMARY.md`
- **Integration Examples**: `PersistenceIntegrationExample.swift`
- **Inline Documentation**: See each service file for detailed comments

---

**Quick Reference v1.0.0**
**Last Updated**: 2026-02-26
