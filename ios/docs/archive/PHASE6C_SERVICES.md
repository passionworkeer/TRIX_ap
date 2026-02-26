# Phase 6C: Data Persistence Services

This document describes the Phase 6C data persistence services implemented for the TRIX 3D Companion iOS app.

## Overview

Phase 6C implements four core services for offline data persistence, synchronization, and export:

1. **OfflineCacheService** - Local data caching with automatic expiration
2. **NetworkMonitor** - Network status monitoring using NWPathMonitor
3. **DataSyncService** - Offline-to-online data synchronization
4. **DataExportService** - User data export in multiple formats

## Services

### 1. OfflineCacheService

**File:** `Core/Services/OfflineCacheService.swift`

**Purpose:** Provides intelligent local caching with automatic cleanup based on age and size limits.

**Features:**
- Configurable cache policies (7-day, 30-day, 24-hour expiration)
- Size limits per cache type (100MB messages, 50MB study records, etc.)
- Automatic cleanup of expired data
- Type-safe caching using generics

**Cache Policies:**
```swift
struct CachePolicy {
    let expirationInterval: TimeInterval
    let maxSizeBytes: Int64
}

// Predefined policies:
- .messages: 7 days, 100MB
- .studyRecords: 30 days, 50MB
- .userProfile: 24 hours, 1MB
- .images: 7 days, 200MB
```

**Usage Examples:**
```swift
let cacheService = OfflineCacheService.shared

// Cache data
try await cacheService.cache(chatMessages, forKey: "room_123", type: .messages)

// Retrieve data
let messages = try await cacheService.retrieve(key: "room_123", type: .messages) as [ChatMessage]

// Get statistics
let stats = try await cacheService.getStatistics(type: .messages)
print("Cache size: \(stats.formattedSize)")
print("Usage: \(stats.usagePercentage)%")

// Clean expired entries
try await cacheService.cleanExpired()
```

**Convenience Methods:**
```swift
// Chat messages
try await cacheService.cacheMessages(messages, for: roomId)
let messages = try await cacheService.getMessages(for: roomId)

// Study sessions
try await cacheService.cacheStudySessions(sessions, for: userId)
let sessions = try await cacheService.getStudySessions(for: userId)

// User profile
try await cacheService.cacheUserProfile(user)
let user = try await cacheService.getUserProfile()

// Images
try await cacheService.cacheImage(imageData, forKey: "avatar_123")
let imageData = try await cacheService.getImage(forKey: "avatar_123")
```

### 2. NetworkMonitor

**File:** `Core/Services/NetworkMonitor.swift`

**Purpose:** Monitors network connectivity and quality using Apple's NWPathMonitor framework.

**Features:**
- Real-time connection status (WiFi, Cellular, Ethernet, None)
- Connection quality assessment (Excellent, Good, Fair, Poor)
- Expensive connection detection (cellular)
- Latency measurement
- Combine publishers and AsyncStream support

**Usage Examples:**
```swift
let networkMonitor = NetworkMonitor.shared

// Start monitoring
networkMonitor.startMonitoring()

// Check current status
if networkMonitor.isConnected {
    print("Connected via \(networkMonitor.connectionType.displayName)")
    print("Quality: \(networkMonitor.quality.displayName)")
}

// Subscribe to changes
networkMonitor.statusPublisher
    .sink { status in
        print("Status changed: \(status.isConnected)")
    }
    .store(in: &cancellables)

// Measure latency
let latency = try await networkMonitor.measureLatency()
print("Latency: \(latency * 1000)ms")

// Wait for connection
try await networkMonitor.waitForConnection(timeout: 30)
```

**AsyncStream Support:**
```swift
for await status in networkMonitor.statusStream {
    print("Network status: \(status.isConnected ? "Connected" : "Disconnected")")
}

for await isConnected in networkMonitor.connectionStream {
    if isConnected {
        // Trigger sync when network becomes available
    }
}
```

**Connection Types:**
- `.wifi` - Wi-Fi connection
- `.cellular` - Cellular connection (expensive)
- `.ethernet` - Wired Ethernet
- `.other` - Other connection types
- `.none` - No connection

**Quality Levels:**
- `.excellent` - Latency < 50ms
- `.good` - Latency 50-100ms
- `.fair` - Latency 100-200ms
- `.poor` - Latency > 200ms

### 3. DataSyncService

**File:** `Core/Services/DataSyncService.swift`

**Purpose:** Manages synchronization between local cache and server with conflict resolution.

**Features:**
- Automatic sync when network becomes available
- Configurable sync strategies (immediate, deferred, manual, adaptive)
- Conflict resolution strategies
- Progress tracking
- Batch synchronization

**Sync Strategies:**
```swift
enum SyncStrategy {
    case immediate    // Sync immediately on data change
    case deferred     // Wait for optimal conditions
    case manual       // Only sync on user request
    case adaptive     // Automatically choose based on context
}
```

**Conflict Resolution:**
```swift
enum ConflictResolution {
    case clientWins    // Client version takes precedence
    case serverWins    // Server version takes precedence
    case mostRecent    // Most recently modified version
    case manual        // Manual resolution required
}
```

**Usage Examples:**
```swift
let syncService = DataSyncService.shared

// Sync specific type
let result = try await syncService.sync(type: .messages, priority: .high)
print("Synced \(result.syncedItems) items")

// Sync all data
let allResult = try await syncService.syncAll(priority: .normal)
print("Total synced: \(allResult.syncedItems)")
print("Failed: \(allResult.failedItems)")

// Configure strategy
syncService.setStrategy(.adaptive)
syncService.setConflictResolution(.mostRecent)

// Check pending items
let pendingCount = try await syncService.getPendingSyncCount()
print("Pending items: \(pendingCount)")

// Subscribe to status changes
syncService.statusPublisher
    .sink { status in
        print("Sync status: \(status.displayName)")
    }
    .store(in: &cancellables)
```

**Sync Types:**
- `.messages` - Chat messages
- `.studySessions` - Learning sessions
- `.userProfile` - User profile data
- `.points` - Points transactions
- `.settings` - App settings

**AsyncStream Support:**
```swift
for await status in syncService.statusStream {
    if status == .syncing {
        print("Sync in progress...")
    }
}

for await progress in syncService.progressStream {
    print("Progress: \(progress * 100)%")
}
```

### 4. DataExportService

**File:** `Core/Services/DataExportService.swift`

**Purpose:** Enables users to export their data in various formats for backup or analysis.

**Features:**
- Export to JSON, CSV formats
- Multiple export types (all data, messages, study records, etc.)
- Progress tracking
- Export history
- Share functionality

**Export Formats:**
```swift
enum ExportFormat {
    case json   // Structured JSON format
    case csv    // Comma-separated values
    case pdf    // PDF format (future)
}
```

**Export Types:**
```swift
enum ExportType {
    case allData           // All user data
    case messages          // Chat messages only
    case studyRecords      // Study sessions only
    case chatHistory       // Complete chat history
    case learningProgress  // Learning statistics
    case userProfile       // User profile only
}
```

**Usage Examples:**
```swift
let exportService = DataExportService.shared

// Export specific data type
let result = try await exportService.export(type: .studyRecords, format: .json)
print("Exported \(result.itemCount) items")
print("File size: \(result.formattedFileSize)")
print("Duration: \(result.formattedDuration)")

// Export all data
let allData = try await exportService.exportAll(format: .json)

// Get export history
let history = exportService.getExportHistory()

// Subscribe to progress
exportService.progressPublisher
    .sink { progress in
        if let progress = progress {
            print("Export progress: \(progress.percentage)%")
            print("Current step: \(progress.currentStep)")
        }
    }
    .store(in: &cancellables)

// Share exported file
let fileURL = exportService.shareExportedFile(result)

// Delete exported file
try exportService.deleteExportedFile(result)
```

**Exported Data Structure:**
```json
{
  "userProfile": { ... },
  "messages": [ ... ],
  "studySessions": [ ... ],
  "pointsHistory": [ ... ],
  "exportDate": "2026-02-26T11:00:00Z",
  "version": "1.0"
}
```

## Architecture

### Design Patterns

1. **Protocol-Oriented Design**
   - Each service has a corresponding protocol (`*ServiceProtocol`)
   - Enables dependency injection and testing

2. **Singleton Pattern**
   - Services use singleton for easy access
   - Thread-safe via `@MainActor`

3. **Combine Publishers**
   - All services publish state changes
   - Easy UI integration

4. **Async/Await**
   - Modern concurrency
   - AsyncStream support for async iteration

5. **Repository Pattern**
   - Services abstract data access
   - Single source of truth

### Dependencies

```
OfflineCacheService
  ├── DatabaseManager (SQLite)
  └── FileManager

NetworkMonitor
  └── NWPathMonitor (Network framework)

DataSyncService
  ├── NetworkMonitor
  ├── OfflineCacheService
  ├── DatabaseManager
  ├── APIClient
  └── AuthService

DataExportService
  ├── OfflineCacheService
  ├── DatabaseManager
  ├── AuthService
  └── FileManager
```

## Integration Guide

### 1. Setup Network Monitoring

In your AppDelegate or main view:

```swift
class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication,
                    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {

        // Start network monitoring
        NetworkMonitor.shared.startMonitoring()

        return true
    }
}
```

### 2. Configure Auto-Sync

In your root view or app coordinator:

```swift
struct RootView: View {
    @StateObject private var syncService = DataSyncService.shared
    @StateObject private var networkMonitor = NetworkMonitor.shared

    var body: some View {
        ContentView()
            .onAppear {
                // Configure sync strategy
                syncService.setStrategy(.adaptive)
                syncService.setConflictResolution(.mostRecent)
            }
    }
}
```

### 3. Implement Sync UI

```swift
struct SyncStatusView: View {
    @StateObject private var syncService = DataSyncService.shared
    @StateObject private var networkMonitor = NetworkMonitor.shared

    var body: some View {
        VStack {
            // Network status
            HStack {
                Circle()
                    .fill(networkMonitor.isConnected ? Color.green : Color.red)
                    .frame(width: 10, height: 10)

                Text(networkMonitor.connectionType.displayName)
            }

            // Sync status
            if syncService.isSyncing {
                ProgressView(value: syncService.progress)
                Text("Syncing...")
            } else {
                Button("Sync Now") {
                    Task {
                        try? await syncService.syncAll(priority: .normal)
                    }
                }
                .disabled(!networkMonitor.isConnected)
            }
        }
    }
}
```

### 4. Implement Export UI

```swift
struct ExportDataView: View {
    @StateObject private var exportService = DataExportService.shared

    var body: some View {
        List {
            Section("Export Data") {
                Button("Export All Data (JSON)") {
                    Task {
                        let result = try await exportService.export(type: .allData, format: .json)
                        // Share file
                    }
                }

                Button("Export Study Records (CSV)") {
                    Task {
                        let result = try await exportService.export(type: .studyRecords, format: .csv)
                        // Share file
                    }
                }
            }

            if exportService.isExporting {
                Section("Progress") {
                    if let progress = exportService.currentProgress {
                        ProgressView(value: progress.percentage / 100.0)
                        Text(progress.currentStep)
                    }
                }
            }
        }
    }
}
```

## Best Practices

### 1. Error Handling

Always handle export/sync errors gracefully:

```swift
do {
    let result = try await syncService.syncAll(priority: .normal)
    // Handle success
} catch let error as SyncError {
    // Show appropriate error message
    switch error {
    case .networkUnavailable:
        showAlert("Network unavailable")
    case .authenticationRequired:
        showAlert("Please log in")
    default:
        showAlert("Sync failed: \(error.localizedDescription)")
    }
}
```

### 2. Background Sync

Use adaptive strategy to sync when appropriate:

```swift
syncService.setStrategy(.adaptive)
// Will automatically sync when:
// - Network becomes available
// - App enters foreground
// - User manually triggers
```

### 3. Cache Management

Regularly clean expired cache:

```swift
// In app lifecycle
Task {
    try? await OfflineCacheService.shared.cleanExpired()

    // Or schedule periodic cleanup
    Timer.publish(every: 24 * 60 * 60, on: .main, in: .common)
        .autoconnect()
        .sink { _ in
            Task {
                try? await OfflineCacheService.shared.cleanExpired()
            }
        }
}
```

### 4. Progress Feedback

Always provide user feedback during long operations:

```swift
exportService.progressPublisher
    .sink { progress in
        guard let progress = progress else { return }

        // Update UI
        progressValue = progress.percentage / 100.0
        statusText = progress.currentStep
    }
    .store(in: &cancellables)
```

## Testing

### Unit Tests

```swift
func testOfflineCacheExpiration() async throws {
    let service = OfflineCacheService.shared

    // Cache data
    let data = "test".data(using: .utf8)!
    try await service.cache(data, forKey: "test", type: .userProfile)

    // Retrieve immediately - should work
    let retrieved = try await service.retrieve(key: "test", type: .userProfile)

    // Wait for expiration
    try await Task.sleep(nanoseconds: 24 * 60 * 60 * 1_000_000_000)

    // Should throw expired error
    XCTAssertThrowsError(try await service.retrieve(key: "test", type: .userProfile))
}

func testNetworkMonitor() async throws {
    let monitor = NetworkMonitor.shared

    monitor.startMonitoring()

    // Wait for status change
    for await status in monitor.statusStream.prefix(1) {
        XCTAssertTrue(status.isConnected || !status.isConnected)
    }
}
```

## Performance Considerations

1. **Batch Operations**: Use batch sync for multiple items
2. **Background Tasks**: Perform heavy operations in background
3. **Throttle Updates**: Don't sync on every small change
4. **Cache Size**: Monitor cache size to prevent storage issues
5. **Network Quality**: Adjust sync strategy based on connection quality

## Troubleshooting

### Common Issues

**Sync fails with "network unavailable"**
- Check network monitor status
- Ensure network monitoring is started

**Export fails with "permission denied"**
- Check file system permissions
- Ensure Documents directory is accessible

**Cache returns expired data**
- Verify cache policy settings
- Run cleanup manually

**High memory usage**
- Check cache size limits
- Clear expired data more frequently

## Future Enhancements

1. **PDF Export**: Complete PDF export implementation
2. **Incremental Sync**: Only sync changed data
3. **Compression**: Compress exported files
4. **Cloud Backup**: Direct cloud storage integration
5. **Conflict UI**: User interface for manual conflict resolution
6. **Delta Sync**: Send only changed fields
7. **Batch Optimization**: Optimize large batch operations

## Dependencies

- **iOS 15.0+**: For async/await support
- **Network Framework**: NWPathMonitor for network monitoring
- **Combine**: For reactive programming
- **GRDB**: SQLite database (existing)
- **Alamofire**: HTTP client (existing)

## Related Files

- `Core/Storage/DatabaseManager.swift` - SQLite database operations
- `Core/Services/AuthService.swift` - Authentication service
- `Core/Network/APIClient.swift` - HTTP client
- `Shared/Models/*.swift` - Data models

---

**Last Updated:** 2026-02-26
**Version:** 1.0.0
**Author:** Claude Code Assistant
