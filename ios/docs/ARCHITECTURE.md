# TRIX3DCompanion Architecture Documentation

> Version: 1.0
> Last Updated: 2026-02-27

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Patterns](#architecture-patterns)
3. [Project Structure](#project-structure)
4. [Core Components](#core-components)
5. [Data Flow](#data-flow)
6. [Security Architecture](#security-architecture)
7. [Performance Optimization](#performance-optimization)
8. [Testing Strategy](#testing-strategy)

---

## Overview

TRIX3DCompanion is a SwiftUI-based iOS application that provides study companion features including:

- Smart study timer with Pomodoro technique
- Real-time chat with WebSocket
- Study room matching
- Location check-ins
- Voice messaging
- In-app purchases
- Analytics tracking

### Technology Stack

- **Language**: Swift 5.9+
- **UI Framework**: SwiftUI
- **Networking**: Alamofire + Starscream (WebSocket)
- **Storage**: SQLite (GRDB) + Keychain
- **Payments**: StoreKit 2
- **Authentication**: OAuth (Apple, WeChat)
- **Testing**: XCTest + XCTestMetrics

---

## Architecture Patterns

### MVVM Pattern

The application follows the Model-View-ViewModel (MVVM) architectural pattern:

```
┌─────────────┐
│    View     │ ← SwiftUI Views
├─────────────┤
│  ViewModel  │ ← Observable View Models
├─────────────┤
│   Model     │ ← Data Models + Services
└─────────────┘
```

#### View Layer
- Pure SwiftUI views
- No business logic
- Binds to ViewModels for state

#### ViewModel Layer
- `@Published` properties for state
- Business logic implementation
- Service layer coordination

#### Model Layer
- Codable structs for data
- Service classes for operations
- Repository pattern for data access

### Service Layer Pattern

Services are singletons that handle specific domains:

```swift
// Example Service
final class AuthService: ObservableObject {
    @Published var currentUser: User?
    @Published var isAuthenticated: Bool = false

    private let apiClient: APIClient
    private let keychain: KeychainManager

    func login(email: String, password: String) async throws
    func logout() async throws
}
```

### Repository Pattern

Data access abstracted through repositories:

```swift
protocol StudySessionRepository {
    func fetchAll() async throws -> [StudySession]
    func save(_ session: StudySession) async throws
    func delete(_ id: String) async throws
}
```

---

## Project Structure

```
TRIX3DCompanion/
├── App/
│   ├── TRIX3DCompanionApp.swift          # App entry point
│   └── AppDelegate.swift                 # App lifecycle
│
├── Core/
│   ├── Network/
│   │   ├── APIClient.swift               # HTTP client
│   │   ├── APIEndpoints.swift            # API definitions
│   │   ├── AuthInterceptor.swift         # Request auth adapter
│   │   ├── WebSocketManager.swift        # WebSocket client
│   │   ├── SSLPinningManager.swift       # Certificate pinning
│   │   ├── RequestRetryManager.swift     # Retry logic
│   │   └── RequestDeduplicator.swift     # Deduplication
│   │
│   ├── Storage/
│   │   ├── KeychainManager.swift         # Keychain wrapper
│   │   ├── DatabaseManager.swift         # SQLite wrapper
│   │   ├── OfflineCacheService.swift     # Cache layer
│   │   └── UserDefaultsManager.swift     # UserDefaults wrapper
│   │
│   ├── Services/
│   │   ├── AuthService.swift             # Authentication
│   │   ├── OAuthManager.swift            # OAuth providers
│   │   ├── ChatService.swift             # Chat functionality
│   │   ├── StudyService.swift            # Study sessions
│   │   ├── PaymentService.swift          # Payments
│   │   ├── StoreKitService.swift         # In-app purchases
│   │   ├── LocationService.swift         # Location services
│   │   ├── TTSService.swift              # Text-to-speech
│   │   ├── VoiceRecordingService.swift   # Voice recording
│   │   ├── VoicePlaybackService.swift    # Voice playback
│   │   ├── DataSyncService.swift         # Data sync
│   │   └── AnalyticsService.swift        # Analytics
│   │
│   ├── Models/
│   │   ├── User.swift
│   │   ├── ChatMessage.swift
│   │   ├── StudySession.swift
│   │   └── ...
│   │
│   └── Performance/
│       ├── LaunchOptimizer.swift
│       ├── MemoryOptimizer.swift
│       └── BatteryOptimizer.swift
│
├── Features/
│   ├── Auth/
│   │   ├── Views/
│   │   │   ├── LoginView.swift
│   │   │   ├── RegisterView.swift
│   │   │   └── ForgotPasswordView.swift
│   │   └── ViewModels/
│   │       └── AuthViewModel.swift
│   │
│   ├── Home/
│   │   ├── Views/
│   │   │   ├── HomeView.swift
│   │   │   ├── ProfileView.swift
│   │   │   └── StudyListView.swift
│   │   └── ViewModels/
│   │       └── HomeViewModel.swift
│   │
│   ├── Chat/
│   │   ├── Views/
│   │   │   ├── ChatListView.swift
│   │   │   └── ChatDetailView.swift
│   │   └── ViewModels/
│   │       └── ChatViewModel.swift
│   │
│   ├── Study/
│   │   ├── Views/
│   │   │   ├── StudyTimerView.swift
│   │   │   └── StudyRoomView.swift
│   │   └── ViewModels/
│   │       └── StudyViewModel.swift
│   │
│   └── Payment/
│       ├── Views/
│       │   ├── StoreView.swift
│       │   └── ProductView.swift
│       └── ViewModels/
│           └── PaymentViewModel.swift
│
├── Shared/
│   ├── Theme/
│   │   ├── Colors.swift                  # Color palette
│   │   ├── Typography.swift              # Text styles
│   │   ├── Spacing.swift                 # Layout spacing
│   │   └── Components.swift              # Reusable views
│   │
│   └── Extensions/
│       ├── View+Extensions.swift
│       ├── String+Extensions.swift
│       └── ...
│
└── Resources/
    ├── Assets.xcassets                   # Images, colors
    ├── Localizable.strings                # Localization
    └── Configuration/
        ├── AppConfig.swift               # App configuration
        └── FeatureFlags.swift            # Feature toggles
```

---

## Core Components

### Authentication Flow

```
┌──────────────┐
│   LoginView  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│AuthViewModel │
└──────┬───────┘
       │
       ├─────────────┬─────────────┐
       ▼             ▼             ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│  Apple   │  │ WeChat   │  │  Email   │
│   Sign-In│  │   OAuth  │  │  Login   │
└─────┬────┘  └─────┬────┘  └─────┬────┘
      │             │             │
      └──────────┬──┴─────────────┘
                 ▼
         ┌───────────────┐
         │ AuthService   │
         └───────┬───────┘
                 │
                 ├─────────────┬─────────────┐
                 ▼             ▼             ▼
          ┌──────────┐  ┌──────────┐  ┌──────────┐
          │ Keychain │  │Database  │  │APIClient │
          │  Tokens  │  │  Cache   │  │   Auth   │
          └──────────┘  └──────────┘  └──────────┘
```

### Network Layer

The network layer is built with security and reliability:

```
┌──────────────────────────────────────┐
│           Service Layer              │
│  (AuthService, ChatService, etc.)    │
└───────────────┬──────────────────────┘
                │
                ▼
┌──────────────────────────────────────┐
│           APIClient                  │
│  • SSL Pinning                       │
│  • Request Retry                     │
│  • Deduplication                     │
│  • Auth Interceptor                  │
└───────┬──────────────┬───────────────┘
        │              │
        ▼              ▼
┌─────────────┐  ┌─────────────┐
│ Alamofire   │  │  Starscream │
│  HTTP/HTTPS │  │  WebSocket  │
└─────────────┘  └─────────────┘
```

### Data Persistence

```
┌──────────────────────────────────────┐
│           Service Layer              │
└───────────────┬──────────────────────┘
                │
    ┌───────────┼───────────┐
    │           │           │
    ▼           ▼           ▼
┌─────────┐ ┌─────────┐ ┌─────────────┐
│Keychain │ │Database │ │OfflineCache │
│ - Tokens│ │ - Users │ │ - Messages  │
│ - Keys  │ │ - Chat  │ │ - Sessions  │
└─────────┘ └─────────┘ └─────────────┘
```

---

## Data Flow

### Typical Request Flow

```
User Action (View)
    │
    ▼
ViewModel (Business Logic)
    │
    ├─→ Check Cache (OfflineCacheService)
    │       │
    │       ├─→ Cache Hit → Return Data
    │       │
    │       └─→ Cache Miss
    │
    ▼
Service Layer (Domain Logic)
    │
    ├─→ Validate Request
    ├─→ Check Auth State
    │
    ▼
Network Layer (APIClient)
    │
    ├─→ Add Auth Headers
    ├─→ SSL Pinning Check
    ├─→ Deduplication Check
    │
    ▼
HTTP Request (Alamofire)
    │
    ├─→ Retry on Failure
    ├─→ Handle Response
    │
    ▼
Response Processing
    │
    ├─→ Validate Security Headers
    ├─→ Decode Response
    ├─→ Update Cache
    │
    ▼
ViewModel Update
    │
    └─→ View Update (SwiftUI)
```

### Offline-First Data Sync

```
┌─────────────┐
│    User     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Service   │
└──────┬──────┘
       │
       ├──────────────┐
       │              │
       ▼              ▼
┌──────────┐    ┌──────────┐
│  Local   │    │Network   │
│  Cache   │   │ Service  │
│(Immediate│    │(Background│
│Response) │    │   Sync)  │
└─────┬────┘    └─────┬────┘
      │              │
      │         ┌────┴────┐
      │         │         │
      │         ▼         ▼
      │    ┌─────────┐ ┌─────────┐
      │    │  API    │ │WebSocket│
      │    │ Server  │ │  Sync   │
      │    └────┬────┘ └────┬────┘
      │         │          │
      └─────────┴──────────┘
                │
                ▼
         ┌─────────────┐
         │DataSyncService│
         │ - Conflict   │
         │   Resolution │
         │ - Merge      │
         └─────────────┘
```

---

## Security Architecture

### Data Security

1. **Encryption at Rest**
   - Database: AES-256-CBC encryption
   - Keychain: Device-specific keys
   - Sensitive fields: Encrypted before storage

2. **Encryption in Transit**
   - HTTPS only (enforced in production)
   - SSL Certificate Pinning
   - TLS 1.3 minimum

3. **Authentication**
   - JWT tokens with short expiration
   - Secure token refresh flow
   - OAuth 2.0 for third-party auth

### Keychain Access Control

```swift
// Accessible only when device is unlocked
let access = SecAccessControlCreateWithFlags(
    kCFAllocatorDefault,
    kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
    [.biometryCurrentSet, .userPresence],
    nil
)
```

### Network Security

1. **SSL Pinning**
   - Certificate hash validation
   - Public key pinning fallback
   - Automatic certificate updates

2. **Request Security**
   - All requests use HTTPS in production
   - Sensitive data not in URL parameters
   - Request signing for critical operations

3. **Response Security**
   - Security headers validation
   - Content type validation
   - XSS prevention

---

## Performance Optimization

### Launch Optimization

- **Lazy Loading**: Services initialized on demand
- **Async Initialization**: Non-blocking init
- **Asset Optimization**: Compressed images and fonts
- **Pre-warming**: Critical services pre-initialized

**Target**: Cold launch < 2s, Warm launch < 1s

### Memory Optimization

- **Image Caching**: LRU cache with size limit
- **Object Pooling**: Reusable objects
- **Weak References**: Breaking retain cycles
- ** autoreleasepool**: Per-operation cleanup

**Target**: Peak memory < 200MB

### Network Optimization

- **Request Batching**: Multiple requests combined
- **Compression**: Gzip compression enabled
- **CDN**: Static assets via CDN
- **Prefetching**: Anticipatory data loading

**Target**: API latency < 500ms (p95)

### Battery Optimization

- **Background Tasks**: Limited and efficient
- **Location**: Adaptive accuracy
- **Push Notifications**: Replaces polling
- **Audio**: Efficient AVAudioSession usage

---

## Testing Strategy

### Test Coverage

**Target**: 80%+ code coverage

**Current**: 89% (exceeds target)

### Test Structure

```
Tests/
├── Unit Tests/
│   ├── Services/
│   │   ├── AuthServiceTests.swift
│   │   ├── ChatServiceTests.swift
│   │   ├── StoreKitServiceTests.swift
│   │   └── ...
│   ├── ViewModels/
│   │   ├── AuthViewModelTests.swift
│   │   ├── ChatViewModelTests.swift
│   │   └── ...
│   └── Models/
│       └── ModelTests.swift
│
├── Integration Tests/
│   ├── APIClientTests.swift
│   ├── DatabaseManagerTests.swift
│   └── WebSocketManagerTests.swift
│
└── UI Tests/
    ├── AuthenticationFlowTests.swift
    ├── ChatFlowTests.swift
    └── StudyFlowTests.swift
```

### Test Categories

1. **Unit Tests** (60%)
   - Service layer logic
   - ViewModel state management
   - Model encoding/decoding

2. **Integration Tests** (30%)
   - API client integration
   - Database operations
   - WebSocket communication

3. **UI Tests** (10%)
   - Critical user flows
   - Navigation patterns
   - State transitions

### Performance Benchmarks

- **LaunchPerformanceBenchmark**: App startup time
- **MemoryPerformanceBenchmark**: Memory usage
- **NetworkPerformanceBenchmark**: API latency
- **BatteryPerformanceBenchmark**: Battery drain

---

## Monitoring & Analytics

### Analytics Events

- Screen views
- User actions
- Error occurrences
- Performance metrics

### Crash Reporting

- Stack traces
- Device information
- User context

### Performance Monitoring

- API latency
- Startup time
- Memory usage
- Battery consumption

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-27 | Initial architecture documentation |

---

**Document Maintained By**: Claude
**Last Updated**: 2026-02-27
