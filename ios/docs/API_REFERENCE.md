# TRIX3DCompanion API Reference

> Generated: 2026-02-27
> Version: 1.1
> Project: TRIX3DCompanion iOS App
> Last Updated: 2026-02-27

---

## Table of Contents

1. [Authentication Services](#authentication-services)
2. [Network Services](#network-services)
3. [Storage Services](#storage-services)
4. [Payment Services](#payment-services)
5. [Chat Services](#chat-services)
6. [Study Services](#study-services)
7. [Location Services](#location-services)
8. [Voice Services](#voice-services)
9. [Analytics Services](#analytics-services)

---

## Authentication Services

### AuthService

Main authentication service handling user login, registration, and session management.

```swift
final class AuthService
```

#### Methods

##### login(email:password:)
```swift
func login(email: String, password: String) async throws -> AuthResponse
```
- **Parameters**:
  - `email`: User's email address
  - `password`: User's password
- **Returns**: `AuthResponse` containing user data and session tokens
- **Throws**: `AuthError` on failure

##### register(username:email:password:)
```swift
func register(username: String, email: String, password: String) async throws -> User
```
- **Parameters**:
  - `username`: Desired username
  - `email`: User's email address
  - `password`: User's password
- **Returns**: Newly created `User`
- **Throws**: `AuthError` on failure

##### logout()
```swift
func logout() async throws
```
- Clears user session and tokens

##### refreshToken()
```swift
func refreshToken() async throws -> UserSession
```
- **Returns**: New session with refreshed tokens
- **Throws**: `AuthError` if refresh fails

---

### OAuthManager

Manages third-party OAuth providers (Apple Sign-In, WeChat).

```swift
final class OAuthManager
```

#### Methods

##### signIn(provider:)
```swift
func signIn(provider: OAuthProvider) async throws -> AuthResponse
```
- **Parameters**:
  - `provider`: OAuth provider (`.apple` or `.wechat`)
- **Returns**: `AuthResponse` with user data
- **Throws**: `OAuthError` on failure

##### linkAccount(provider:)
```swift
func linkAccount(provider: OAuthProvider) async throws -> User
```
- Links current user account with OAuth provider
- **Throws**: `OAuthError` if already linked or auth fails

##### unlinkAccount(provider:)
```swift
func unlinkAccount(provider: OAuthProvider) async throws -> User
```
- Unlinks OAuth provider from current account

---

## Network Services

### APIClient

HTTP client with SSL pinning, retry logic, and request deduplication.

```swift
final class APIClient
```

#### Methods

##### get(_:parameters:headers:)
```swift
func get<T: Codable>(
    _ endpoint: APIEndpoint,
    parameters: Parameters? = nil,
    headers: HTTPHeaders? = nil
) async throws -> T
```
- **Parameters**:
  - `endpoint`: API endpoint to request
  - `parameters`: Optional query parameters
  - `headers`: Optional custom headers
- **Returns**: Decoded response of type T
- **Throws**: `NetworkError` on failure

##### post(_:parameters:body:headers:)
```swift
func post<T: Codable>(
    _ endpoint: APIEndpoint,
    parameters: Parameters? = nil,
    body: Encodable? = nil,
    headers: HTTPHeaders? = nil
) async throws -> T
```
- Sends POST request with JSON body

##### put(_:parameters:body:headers:)
```swift
func put<T: Codable>(
    _ endpoint: APIEndpoint,
    parameters: Parameters? = nil,
    body: Encodable? = nil,
    headers: HTTPHeaders? = nil
) async throws -> T
```
- Sends PUT request for updates

##### delete(_:parameters:headers:)
```swift
func delete<T: Codable>(
    _ endpoint: APIEndpoint,
    parameters: Parameters? = nil,
    headers: HTTPHeaders? = nil
) async throws -> T
```
- Sends DELETE request

#### Security Features

- **SSL Pinning**: Certificate validation against pinned certificates
- **Retry Logic**: Exponential backoff for failed requests
- **Request Deduplication**: Prevents duplicate requests
- **Security Headers Validation**: Validates HSTS, CSP headers

---

### WebSocketManager

Real-time WebSocket communication manager.

```swift
final class WebSocketManager
```

#### Methods

##### connect(userId:)
```swift
func connect(userId: String) async throws
```
- Connects to WebSocket server with authentication

##### disconnect()
```swift
func disconnect()
```
- Gracefully disconnects WebSocket connection

##### send(message:)
```swift
func send(message: WebSocketMessage) throws
```
- **Parameters**:
  - `message`: Message to send
- **Throws**: `WebSocketError` if not connected

##### subscribe(to:)
```swift
func subscribe(to channel: WebSocketChannel) throws
```
- Subscribes to a WebSocket channel

---

### NetworkMonitor

Monitors network connectivity and quality.

```swift
final class NetworkMonitor
```

#### Properties

##### isConnected
```swift
var isConnected: Bool { get }
```
- Returns current connectivity status

##### connectionType
```swift
var connectionType: ConnectionType { get }
```
- Returns `.wifi`, `.cellular`, or `.none`

##### isExpensive
```swift
var isExpensive: Bool { get }
```
- Returns true if connection is metered

---

## Storage Services

### KeychainManager

Secure storage for sensitive data using iOS Keychain.

```swift
final class KeychainManager
```

#### Methods

##### save(_:forKey:)
```swift
func save(_ data: Data, forKey key: String) throws
```
- Saves data to Keychain with device-only accessibility
- **Throws**: `KeychainError` on failure

##### load(forKey:)
```swift
func load(forKey: String) throws -> Data
```
- **Returns**: Stored data
- **Throws**: `KeychainError` if not found

##### delete(forKey:)
```swift
func delete(forKey: String) throws
```
- Removes item from Keychain

##### saveAccessToken(_:)
```swift
func saveAccessToken(_ token: String) throws
```
- Saves OAuth access token

##### getAccessToken() / getRefreshToken()
```swift
func getAccessToken() -> String?
func getRefreshToken() -> String?
```
- Retrieves stored tokens

---

### DatabaseManager

SQLite database manager with encryption support.

```swift
final class DatabaseManager
```

#### Methods

##### initialize()
```swift
func initialize() async throws
```
- Initializes database and runs migrations

##### save(_:to:)
```swift
func save<T: Codable>(_ item: T, to table: String) async throws
```
- Saves item to specified table

##### fetch(from:where:as:)
```swift
func fetch<T: Codable>(
    from table: String,
    where predicate: String?,
    as type: T.Type
) async throws -> [T]
```
- Fetches items from table

##### delete(from:where:)
```swift
func delete(from table: String, where predicate: String?) async throws
```
- Deletes items from table

---

### OfflineCacheService

Caches network responses for offline access.

```swift
final class OfflineCacheService
```

#### Methods

##### cache(_:forKey:)
```swift
func cache<T: Codable>(_ data: T, forKey key: String) async throws
```
- Caches data with specified cache key

##### retrieve(forKey:)
```swift
func retrieve<T: Codable>(forKey: String, as type: T.Type) async throws -> T?
```
- **Returns**: Cached data if available and not expired

##### clearCache()
```swift
func clearCache() async throws
```
- Clears all cached data

---

## Payment Services

### StoreKitService

In-app purchase management using StoreKit 2.

```swift
final class StoreKitService
```

#### Methods

##### loadProducts()
```swift
func loadProducts() async throws -> [StoreKit.Product]
```
- **Returns**: Available products for purchase

##### purchase(_:)
```swift
func purchase(_ product: StoreKit.Product) async throws -> PurchaseResult
```
- **Parameters**:
  - `product`: Product to purchase
- **Returns**: `PurchaseResult` with transaction details
- **Throws**: `StoreKitError` on failure

##### checkSubscriptionStatus()
```swift
func checkSubscriptionStatus() async throws -> SubscriptionStatus
```
- **Returns**: Current subscription status

##### restorePurchases()
```swift
func restorePurchases() async throws -> [StoreKit.Transaction]
```
- **Returns**: Restored transactions

---

### PaymentService

Handles payment processing and order management.

```swift
final class PaymentService
```

#### Methods

##### purchasePoints(_:)
```swift
func purchasePoints(_ request: PointsPurchaseRequest) async throws -> PointsPurchaseResponse
```
- **Parameters**:
  - `request`: Purchase request with amount/product ID
- **Returns**: Purchase response with points added

##### verifyReceipt(_:)
```swift
func verifyReceipt(_ request: ReceiptVerificationRequest) async throws -> ReceiptVerificationResponse
```
- Verifies purchase receipt with backend

##### getOrderHistory(page:limit:)
```swift
func getOrderHistory(page: Int, limit: Int) async throws -> [Order]
```
- **Returns**: Paginated order history

##### cancelOrder(_:)
```swift
func cancelOrder(_ orderId: String) async throws
```
- Cancels a pending order

---

## Chat Services

### ChatService

Real-time messaging with WebSocket support.

```swift
final class ChatService
```

#### Properties

##### messages
```swift
var messages: [ChatMessage] { get }
```
- Current conversation messages

##### isConnected
```swift
var isConnected: Bool { get }
```
- WebSocket connection status

#### Methods

##### openConversation(_:)
```swift
func openConversation(_ conversation: ChatConversation) async
```
- Opens a chat conversation and loads history

##### closeConversation()
```swift
func closeConversation()
```
- Closes current conversation

##### sendTextMessage(_:)
```swift
func sendTextMessage(_ text: String) async
```
- Sends text message to current conversation

##### sendImageMessage(_:)
```swift
func sendImageMessage(_ imageURL: String) async
```
- Sends image message

##### loadMessages(older:)
```swift
func loadMessages(older: Bool) async
```
- Loads older messages for pagination

##### markAsRead(messageId:)
```swift
func markAsRead(messageId: String) async throws
```
- Marks message as read

---

### MessageService

Handles message persistence and sync.

```swift
final class MessageService
```

#### Methods

##### syncMessages()
```swift
func syncMessages() async throws
```
- Syncs local messages with server

##### getMessages(conversationId:)
```swift
func getMessages(conversationId: String) async throws -> [ChatMessage]
```
- **Returns**: Messages for conversation

---

## Study Services

### StudyService

Manages study sessions and rooms.

```swift
final class StudyService
```

#### Methods

##### fetchStudyRooms()
```swift
func fetchStudyRooms() async throws -> [StudyRoom]
```
- **Returns**: Available study rooms

##### createStudyRoom(_:)
```swift
func createStudyRoom(_ request: CreateStudyRoomRequest) async throws -> StudyRoom
```
- Creates new study room

##### joinStudyRoom(code:)
```swift
func joinStudyRoom(code: String) async throws -> StudyRoom
```
- Joins study room by code

##### startStudySession(duration:)
```swift
func startStudySession(duration: Int) async throws -> StudySession
```
- Starts a timed study session
- **Parameters**:
  - `duration`: Session duration in minutes

##### endStudySession(_:)
```swift
func endStudySession(_ sessionId: String) async throws -> StudySession
```
- Ends active study session and calculates earned points

##### fetchStudyStats()
```swift
func fetchStudyStats() async throws -> StudyStats
```
- **Returns**: User's study statistics

---

### DataSyncService

Handles offline data synchronization.

```swift
final class DataSyncService
```

#### Methods

##### sync()
```swift
func sync() async throws -> SyncResult
```
- Performs full data synchronization
- **Returns**: `SyncResult` with sync details

##### syncMessages()
```swift
func syncMessages() async throws
```
- Syncs chat messages only

##### syncStudySessions()
```swift
func syncStudySessions() async throws
```
- Syncs study sessions

##### cancelSync()
```swift
func cancelSync()
```
- Cancels ongoing sync operation

---

## Location Services

### LocationService

Manages location permissions and tracking.

```swift
final class LocationService
```

#### Methods

##### requestPermission()
```swift
func requestPermission() async -> LocationPermissionStatus
```
- Requests location permission

##### getCurrentLocation()
```swift
func getCurrentLocation() async throws -> CLLocation
```
- **Returns**: Current location
- **Throws**: `LocationError` if unavailable

##### startTracking()
```swift
func startTracking()
```
- Starts background location tracking

##### stopTracking()
```swift
func stopTracking()
```
- Stops location tracking

---

### MapService

Handles map display and interactions.

```swift
final class MapService
```

#### Methods

##### loadLocations(near:)
```swift
func loadLocations(near coordinate: CLLocationCoordinate2D) async throws -> [Location]
```
- **Returns**: Locations near coordinate

##### shareLocation(_:)
```swift
func shareLocation(_ request: ShareLocationRequest) async throws -> ShareLocationResponse
```
- Shares user location

---

## Voice Services

### TTSService

Text-to-speech functionality.

```swift
final class TTSService
```

#### Methods

##### speak(_:completion:)
```swift
func speak(_ text: String, completion: ((Error?) -> Void)? = nil)
```
- Speaks text using device TTS engine

##### stop()
```swift
func stop()
```
- Stops current speech

##### setRate(_:)
```swift
func setRate(_ rate: Float)
```
- Sets speech rate (0.0 - 1.0)

---

### VoiceRecordingService

Handles voice message recording.

```swift
final class VoiceRecordingService
```

#### Methods

##### startRecording()
```swift
func startRecording() throws
```
- Starts voice recording

##### stopRecording()
```swift
func stopRecording() async throws -> URL
```
- **Returns**: URL of recorded audio file

##### pauseRecording()
```swift
func pauseRecording()
```
- Pauses current recording

##### resumeRecording()
```swift
func resumeRecording()
```
- Resumes paused recording

---

### VoicePlaybackService

Plays voice messages.

```swift
final class VoicePlaybackService
```

#### Methods

##### play(_:)
```swift
func play(_ url: URL) throws
```
- Plays audio from URL

##### pause()
```swift
func pause()
```
- Pauses playback

##### stop()
```swift
func stop()
```
- Stops playback and resets position

##### seek(to:)
```swift
func seek(to time: TimeInterval)
```
- Seeks to specified time

---

## Analytics Services

### AnalyticsService

Tracks user events and analytics.

```swift
final class AnalyticsService
```

#### Methods

##### track(event:properties:)
```swift
func track(event: String, properties: [String: Any]? = nil)
```
- Tracks custom event with optional properties

##### trackScreenView(_:)
```swift
func trackScreenView(_ screenName: String)
```
- Tracks screen view

##### trackError(_:properties:)
```swift
func trackError(_ error: Error, properties: [String: Any]? = nil)
```
- Tracks error occurrence

##### setUserProperties(_:)
```swift
func setUserProperties(_ properties: [String: Any])
```
- Sets user properties for all events

---

## Additional Services

### PairingService

Manages device pairing and connections.

```swift
final class PairingService
```

#### Methods

##### generatePairingCode()
```swift
func generatePairingCode() async throws -> PairingCode
```
- **Returns**: Time-limited pairing code
- **Throws**: `PairingError` on failure

##### confirmPairing(code:)
```swift
func confirmPairing(code: String) async throws -> PairedDevice
```
- **Parameters**:
  - `code`: Pairing code to confirm
- **Returns**: Paired device information

##### getPairedDevices()
```swift
func getPairedDevices() async throws -> [PairedDevice]
```
- **Returns**: List of paired devices

##### unpairDevice(_:)
```swift
func unpairDevice(_ deviceId: String) async throws
```
- Removes device pairing

### ImageUploadService

Handles image upload and management.

```swift
final class ImageUploadService
```

#### Methods

##### uploadImage(_:compressionQuality:)
```swift
func uploadImage(_ image: UIImage, compressionQuality: CGFloat = 0.8) async throws -> ImageUploadResponse
```
- **Parameters**:
  - `image`: Image to upload
  - `compressionQuality`: JPEG compression (0.0-1.0)
- **Returns**: Upload response with image URL

##### uploadBase64(_:)
```swift
func uploadBase64(_ base64String: String) async throws -> ImageUploadResponse
```
- Uploads base64 encoded image

### CameraService

Manages camera capture and permissions.

```swift
final class CameraService
```

#### Methods

##### requestPermission()
```swift
func requestPermission() async -> Bool
```
- **Returns**: Permission granted status

##### capturePhoto() async throws -> UIImage
```swift
func capturePhoto() async throws -> UIImage
```
- **Returns**: Captured photo
- **Throws**: `CameraError` on failure

### DataExportService

Handles data export for users.

```swift
final class DataExportService
```

#### Methods

##### exportUserData() async throws -> URL
```swift
func exportUserData() async throws -> URL
```
- **Returns**: URL to exported data file (JSON format)
- **Throws**: `ExportError` on failure

##### exportStudyData() async throws -> URL
```swift
func exportStudyData() async throws -> URL
```
- Exports study sessions and statistics

### PushNotificationService

Manages push notification registration and handling.

```swift
final class PushNotificationService
```

#### Methods

##### registerForNotifications() async throws
```swift
func registerForNotifications() async throws
```
- Registers device for push notifications

##### updateDeviceToken(_:)
```swift
func updateDeviceToken(_ token: String) async throws
```
- Updates device token on server

### LocalNotificationService

Handles local notification scheduling.

```swift
final class LocalNotificationService
```

#### Methods

##### scheduleNotification(_:at:)
```swift
func scheduleNotification(_ content: UNNotificationContent, at date: Date) async throws
```
- Schedules local notification

##### cancelAllNotifications()
```swift
func cancelAllNotifications()
```
- Cancels all pending notifications

### PointsService

Manages user points and rewards.

```swift
final class PointsService
```

#### Methods

##### getPointsBalance() async throws -> Int
```swift
func getPointsBalance() async throws -> Int
```
- **Returns**: Current points balance

##### getPointsHistory() async throws -> [PointsTransaction]
```swift
func getPointsHistory() async throws -> [PointsTransaction]
```
- **Returns**: Transaction history

##### earnPoints(_:reason:)
```swift
func earnPoints(_ amount: Int, reason: String) async throws
```
- Adds points to user balance

---

## Error Types

### NetworkError
```swift
enum NetworkError: Error {
    case noConnection
    case timeout
    case unauthorized
    case forbidden
    case notFound
    case serverError(statusCode: Int, message: String?)
    case decodingError(underlying: Error)
    case unknown(Error?)
}
```

### AuthError
```swift
enum AuthError: Error {
    case invalidCredentials
    case networkError(Error)
    case tokenExpired
    case userNotFound
    case emailAlreadyExists
    case unknown(Error?)
}
```

### StoreKitError
```swift
enum StoreKitError: Error {
    case productNotFound
    case purchaseFailed(reason: String)
    case verificationFailed
    case networkError(Error)
    case userCancelled
}
```

### LocationError
```swift
enum LocationError: Error {
    case permissionDenied
    case locationUnavailable
    case networkError(Error)
}
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.1 | 2026-02-27 | Updated test coverage (89%), added BatteryPerformanceBenchmark, updated API endpoints |
| 1.0 | 2026-02-27 | Initial API Reference |

---

## API Endpoints Overview

### Base URLs

| Environment | URL | Protocol |
|-------------|-----|----------|
| Production | `https://api.trix3d.com` | HTTPS (Required) |
| Development | `http://47.243.55.130:8765` | HTTP (Debug Only) |
| WebSocket Production | `wss://api.trix3d.com` | WSS (Required) |
| WebSocket Development | `ws://47.243.55.130:8765` | WS (Debug Only) |

**Security Note**: Production builds ALWAYS enforce HTTPS/WSS protocols.

### API Endpoint Categories

| Category | Endpoints | Description |
|----------|-----------|-------------|
| Authentication | 5 | Login, register, logout, refresh, me |
| User | 5 | Profile, avatar, stats, settings |
| Chat | 5 | Rooms, messages, read status |
| Study | 8 | Sessions, rooms, stats |
| Pairing | 5 | Device pairing and management |
| Points | 2 | Points balance and history |
| Upload | 2 | File upload (multipart, base64) |
| Locations | 6 | Location sharing and nearby |
| Notifications | 3 | Device token, preferences, settings |
| Payments | 7 | Purchases, orders, subscription |
| **Total** | **48** | All REST API endpoints |

---

**Last Updated**: 2026-02-27
**Maintained By**: Claude
