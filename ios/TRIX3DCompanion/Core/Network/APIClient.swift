//
//  APIClient.swift
//  TRIX3DCompanion
//
//  HTTP client based on Alamofire with security enhancements
//

import Foundation
import Alamofire

// MARK: - APIClient Protocol

/// Protocol for API Client operations to enable testing with mocks
protocol APIClientProtocol {
    func get<T: Codable>(_ endpoint: APIEndpoint) async throws -> T
    func post<T: Codable>(_ endpoint: APIEndpoint, body: Encodable) async throws -> T
    func put<T: Codable>(_ endpoint: APIEndpoint, body: Encodable) async throws -> T
    func delete<T: Codable>(_ endpoint: APIEndpoint) async throws -> T
    func upload<T: Codable>(_ endpoint: APIEndpoint, data: Data, fileName: String) async throws -> T
    func download(from url: String) async throws -> Data
}

/// API Client for making HTTP requests
/// Features:
/// - SSL Pinning
/// - Request retry with exponential backoff
/// - Request deduplication
/// - Security headers validation
final class APIClient: APIClientProtocol {

    // MARK: - Singleton
    static let shared = APIClient()

    // MARK: - Properties
    private let session: Session
    private let baseURL: String
    private let decoder: JSONDecoder
    private let authDecoder: JSONDecoder
    private let encoder: JSONEncoder
    private let authInterceptor: AuthInterceptor

    // Security managers
    private let sslPinningManager: SSLPinningManager
    private let retryManager: RequestRetryManager
    private let deduplicator: RequestDeduplicator
    private let headersValidator: SecurityHeadersValidator
    private let networkLogger: NetworkLogger

    // MARK: - Initialization
    private init() {
        self.baseURL = APIBaseURL.current

        // Initialize security managers
        self.sslPinningManager = SSLPinningManager.shared
        self.retryManager = RequestRetryManager.shared
        self.deduplicator = RequestDeduplicator.shared
        self.headersValidator = SecurityHeadersValidator.shared
        self.networkLogger = NetworkLogger.shared

        // Create auth interceptor for automatic token management
        self.authInterceptor = AuthInterceptor()

        // Configure session with security features
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 30
        configuration.timeoutIntervalForResource = 60

        // Create composite interceptor
        let compositeInterceptor = Interceptor(
            adapters: [authInterceptor, deduplicator],
            retriers: [authInterceptor, retryManager]
        )

        // Create session with SSL pinning.
        // ServerTrustManager expects hostname keys (not full URL strings).
        let evaluator = sslPinningManager.makeServerTrustEvaluator()
        let serverTrustManager: ServerTrustManager?
        if let host = URL(string: baseURL)?.host {
            serverTrustManager = ServerTrustManager(
                allHostsMustBeEvaluated: false,
                evaluators: [host: evaluator]
            )
        } else {
            serverTrustManager = nil
            SecureLogger.shared.warning("APIClient: invalid baseURL host for trust manager, fallback to default trust handling")
        }

        self.session = Session(
            configuration: configuration,
            interceptor: compositeInterceptor,
            serverTrustManager: serverTrustManager
        )

        // Configure decoder
        self.decoder = JSONDecoder()
        JSONDateDecoding.configure(self.decoder)
        self.decoder.keyDecodingStrategy = .convertFromSnakeCase

        // Auth payloads use explicit snake_case CodingKeys and must avoid key conversion.
        self.authDecoder = JSONDecoder()
        JSONDateDecoding.configure(self.authDecoder)
        self.authDecoder.keyDecodingStrategy = .useDefaultKeys

        // Configure encoder
        self.encoder = JSONEncoder()
        self.encoder.dateEncodingStrategy = .iso8601
        self.encoder.keyEncodingStrategy = .convertToSnakeCase

        SecureLogger.shared.info("APIClient initialized with security features")
    }

    // MARK: - Public Methods

    /// Perform GET request
    ///
    /// Sends a GET request to the specified API endpoint with optional query parameters.
    ///
    /// - Parameters:
    ///   - endpoint: The API endpoint to request
    ///   - parameters: Optional query parameters to include in the request
    ///   - headers: Optional custom HTTP headers
    /// - Returns: Decoded response of type T
    /// - Throws: NetworkError if the request fails
    func get<T: Codable>(
        _ endpoint: APIEndpoint,
        parameters: Parameters? = nil,
        headers: HTTPHeaders? = nil
    ) async throws -> T {
        return try await performRequest(
            endpoint: endpoint,
            method: .get,
            parameters: parameters,
            headers: headers
        )
    }

    /// Perform POST request
    ///
    /// Sends a POST request to the specified API endpoint with optional body content.
    ///
    /// - Parameters:
    ///   - endpoint: The API endpoint to request
    ///   - parameters: Optional query parameters to include in the request
    ///   - body: Optional request body to encode as JSON
    ///   - headers: Optional custom HTTP headers
    /// - Returns: Decoded response of type T
    /// - Throws: NetworkError if the request fails
    func post<T: Codable>(
        _ endpoint: APIEndpoint,
        parameters: Parameters? = nil,
        body: Encodable? = nil,
        headers: HTTPHeaders? = nil
    ) async throws -> T {
        return try await performRequest(
            endpoint: endpoint,
            method: .post,
            parameters: parameters,
            body: body,
            headers: headers
        )
    }

    /// Perform PUT request
    ///
    /// Sends a PUT request to the specified API endpoint with optional body content.
    ///
    /// - Parameters:
    ///   - endpoint: The API endpoint to request
    ///   - parameters: Optional query parameters to include in the request
    ///   - body: Optional request body to encode as JSON
    ///   - headers: Optional custom HTTP headers
    /// - Returns: Decoded response of type T
    /// - Throws: NetworkError if the request fails
    func put<T: Codable>(
        _ endpoint: APIEndpoint,
        parameters: Parameters? = nil,
        body: Encodable? = nil,
        headers: HTTPHeaders? = nil
    ) async throws -> T {
        return try await performRequest(
            endpoint: endpoint,
            method: .put,
            parameters: parameters,
            body: body,
            headers: headers
        )
    }

    /// Perform DELETE request
    ///
    /// Sends a DELETE request to the specified API endpoint.
    ///
    /// - Parameters:
    ///   - endpoint: The API endpoint to request
    ///   - parameters: Optional query parameters to include in the request
    ///   - headers: Optional custom HTTP headers
    /// - Returns: Decoded response of type T
    /// - Throws: NetworkError if the request fails
    func delete<T: Codable>(
        _ endpoint: APIEndpoint,
        parameters: Parameters? = nil,
        headers: HTTPHeaders? = nil
    ) async throws -> T {
        return try await performRequest(
            endpoint: endpoint,
            method: .delete,
            parameters: parameters,
            headers: headers
        )
    }

    /// Perform PATCH request
    ///
    /// Sends a PATCH request to the specified API endpoint with optional body content.
    ///
    /// - Parameters:
    ///   - endpoint: The API endpoint to request
    ///   - parameters: Optional query parameters to include in the request
    ///   - body: Optional request body to encode as JSON
    ///   - headers: Optional custom HTTP headers
    /// - Returns: Decoded response of type T
    /// - Throws: NetworkError if the request fails
    func patch<T: Codable>(
        _ endpoint: APIEndpoint,
        parameters: Parameters? = nil,
        body: Encodable? = nil,
        headers: HTTPHeaders? = nil
    ) async throws -> T {
        return try await performRequest(
            endpoint: endpoint,
            method: .patch,
            parameters: parameters,
            body: body,
            headers: headers
        )
    }

    // MARK: - Security Configuration

    /// Update retry policy
    /// - Parameter policy: New retry policy
    func updateRetryPolicy(_ policy: RequestRetryManager.RetryPolicy) {
        retryManager.updatePolicy(policy)
    }

    /// Update SSL pinning mode
    /// - Parameter mode: New pinning mode
    func updateSSLPinningMode(_ mode: SSLPinningManager.PinningMode) {
        sslPinningManager.configure(mode: mode)
    }

    /// Enable or disable request deduplication
    /// - Parameter enabled: Whether to enable deduplication
    func setDeduplicationEnabled(_ enabled: Bool) {
        deduplicator.setEnabled(enabled)
    }

    /// Update security headers validation mode
    /// - Parameter mode: New validation mode
    func updateSecurityHeadersMode(_ mode: SecurityHeadersValidator.ValidationMode) {
        headersValidator.updateMode(mode)
    }

    // MARK: - Private Methods

    private func performRequest<T: Codable>(
        endpoint: APIEndpoint,
        method: HTTPMethod,
        parameters: Parameters? = nil,
        body: Encodable? = nil,
        headers: HTTPHeaders? = nil
    ) async throws -> T {
        // Build URL with endpoint query parameters and GET parameters.
        guard var components = URLComponents(string: baseURL + endpoint.path) else {
            throw NetworkError.invalidURL
        }

        var queryItems = components.queryItems ?? []
        if let endpointQueryParams = endpoint.queryParameters {
            queryItems.append(contentsOf: endpointQueryParams.map {
                URLQueryItem(name: $0.key, value: $0.value)
            })
        }
        if method == .get, let parameters {
            queryItems.append(contentsOf: parameters.map {
                URLQueryItem(name: $0.key, value: String(describing: $0.value))
            })
        }
        if !queryItems.isEmpty {
            components.queryItems = queryItems
        }
        guard let url = components.url else {
            throw NetworkError.invalidURL
        }

        let urlString = url.absoluteString

        var requestHeaders = headers ?? HTTPHeaders()
        let requestStartTime = Date()

        // NOTE: Authorization header is now handled automatically by AuthInterceptor
        // We no longer manually add it here to avoid conflicts with the interceptor
        // The interceptor will:
        // 1. Add Bearer token to requests automatically via adapt()
        // 2. Handle 401 responses by refreshing the token via retry()
        // 3. Retry the request with the new token

        // Add content type for requests carrying JSON body payload.
        if body != nil || (method != .get && parameters != nil) {
            requestHeaders.add(.contentType("application/json"))
        }

        // Add Supabase API key header for development
        #if DEBUG
        let supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtYnVranZyYnloYnVxdW1xZHVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MDY5NTgsImV4cCI6MjA4NjI4Mjk1OH0.i6xwAotL826Dob_P71YrnhW6jITyVMV3xU5zmIbNs20"
        requestHeaders.add(name: "apikey", value: supabaseKey)
        #endif

        // Log request
        let headersDict = requestHeaders.dictionary
        let logEntryId = networkLogger.logRequest(
            method: method.rawValue,
            url: urlString,
            headers: headersDict,
            body: body
        )

        // Build request and encode body/payload.
        var urlRequest = try URLRequest(
            url: url,
            method: Alamofire.HTTPMethod(rawValue: method.rawValue),
            headers: requestHeaders
        )

        // Encode body if present
        if let body = body {
            urlRequest.httpBody = try encoder.encode(body)
        } else if method != .get, let parameters {
            // Preserve legacy behavior for non-GET calls that pass parameters without body.
            urlRequest = try JSONEncoding.default.encode(urlRequest, with: parameters)
        }

        // Use the configured Session so auth interceptor / retry / dedup are applied.
        let request = session.request(urlRequest)

        // Execute request with security validation
        return try await withCheckedThrowingContinuation { continuation in
            request.responseData { response in
                // Calculate request duration
                let duration = Date().timeIntervalSince(requestStartTime)

                // Log response
                let statusCode = response.response?.statusCode ?? 0
                self.networkLogger.logResponse(
                    entryId: logEntryId,
                    statusCode: statusCode,
                    body: response.data,
                    duration: duration,
                    error: response.error
                )

                // Validate security headers if response is successful
                if let httpResponse = response.response,
                   case .success = response.result {
                    self.headersValidator.validateAndLog(httpResponse)
                }

                switch response.result {
                case .success(let data):
                    // HTTP status validation first
                    if let httpResponse = response.response,
                       !(200...299).contains(httpResponse.statusCode) {
                        continuation.resume(throwing: self.mapHTTPStatusError(statusCode: httpResponse.statusCode, data: data))
                        return
                    }

                    do {
                        let value: T = try self.decodeResponse(data, as: T.self)
                        continuation.resume(returning: value)
                    } catch {
                        continuation.resume(throwing: NetworkError.decodingError(underlying: error))
                    }

                case .failure(let error):
                    let networkError = self.mapError(error: error, response: response.response)
                    continuation.resume(throwing: networkError)
                }
            }
        }
    }

    private func decodeResponse<T: Codable>(_ data: Data, as type: T.Type) throws -> T {
        // 1) Try direct decoding first
        if let direct = try? decoder.decode(T.self, from: data) {
            return direct
        }

        // 1.5) Auth responses use explicit snake_case CodingKeys.
        if type == AuthResponse.self,
           let auth = try? authDecoder.decode(AuthResponse.self, from: data),
           let typed = auth as? T {
            return typed
        }

        // 2) Try wrapped decoding: { success, data, ... }
        if let wrapped = try? decoder.decode(APIResponse<T>.self, from: data) {
            if let value = wrapped.data {
                return value
            }
            if wrapped.success, let empty = makeEmptyResponse(as: type) {
                return empty
            }
            throw NetworkError.custom(message: wrapped.error ?? wrapped.message ?? "Empty response payload")
        }

        // 3) Special case for EmptyResponse
        if let empty = makeEmptyResponse(as: type),
           let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
           (json["success"] as? Bool) == true {
            return empty
        }

        // 4) Special case for UploadResponse variations
        if type == UploadResponse.self,
           let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] {
            if let parsed = parseUploadResponse(from: json), let typed = parsed as? T {
                return typed
            }
            if let wrappedData = json["data"] as? [String: Any],
               let parsed = parseUploadResponse(from: wrappedData),
               let typed = parsed as? T {
                return typed
            }
        }

        throw NetworkError.decodingError(underlying: NSError(
            domain: "APIClient",
            code: -1001,
            userInfo: [NSLocalizedDescriptionKey: "Failed to decode response"]
        ))
    }

    private func parseUploadResponse(from json: [String: Any]) -> UploadResponse? {
        guard let url = json["url"] as? String else {
            return nil
        }
        let key = (json["key"] as? String)
            ?? (json["objectKey"] as? String)
            ?? (json["object_key"] as? String)
            ?? ""
        return UploadResponse(url: url, key: key)
    }

    private func makeEmptyResponse<T: Codable>(as type: T.Type) -> T? {
        guard type == EmptyResponse.self else {
            return nil
        }
        return EmptyResponse() as? T
    }

    private func mapHTTPStatusError(statusCode: Int, data: Data?) -> NetworkError {
        let serverMessage: String? = {
            guard let data,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                return nil
            }
            return (json["error"] as? String)
                ?? (json["message"] as? String)
                ?? (json["msg"] as? String)
                ?? (json["error_description"] as? String)
                ?? ((json["data"] as? [String: Any])?["message"] as? String)
        }()

        switch statusCode {
        case 400:
            return .custom(message: serverMessage ?? "Bad request")
        case 401:
            return .unauthorized
        case 403:
            return .forbidden
        case 404:
            return .notFound
        case 500...599:
            return .serverError(statusCode: statusCode, message: serverMessage)
        default:
            return .custom(message: serverMessage ?? "HTTP \(statusCode)")
        }
    }

    private func mapError(error: AFError, response: HTTPURLResponse?) -> NetworkError {
        if let statusCode = response?.statusCode {
            switch statusCode {
            case 401:
                return .unauthorized
            case 403:
                return .forbidden
            case 404:
                return .notFound
            case 500...599:
                let message = response?.description
                return .serverError(statusCode: statusCode, message: message)
            default:
                break
            }
        }

        // Check for specific error types
        if let underlyingError = error.underlyingError {
            let nsError = underlyingError as NSError
            if nsError.code == NSURLErrorNotConnectedToInternet {
                return .noConnection
            }
            if nsError.code == NSURLErrorTimedOut {
                return .timeout
            }
        }

        // Check if it's a decoding error
        if case .responseSerializationFailed = error {
            return .decodingError(underlying: error)
        }

        return .unknown(error)
    }
}

// MARK: - Auth Manager (Token Management)

/// Manager for authentication tokens
/// Note: This is a local wrapper. For full token management, use AuthService
final class AuthManager {
    static let shared = AuthManager()

    private let keychain = KeychainManager.shared

    private init() {}

    var accessToken: String? {
        get { keychain.getAccessToken() }
        set {
            if let value = newValue {
                try? keychain.saveAccessToken(value)
            } else {
                try? keychain.deleteAccessToken()
            }
        }
    }

    var refreshToken: String? {
        get { keychain.getRefreshToken() }
        set {
            if let value = newValue {
                try? keychain.saveRefreshToken(value)
            } else {
                try? keychain.deleteRefreshToken()
            }
        }
    }

    var isAuthenticated: Bool {
        accessToken != nil
    }

    func clearTokens() {
        accessToken = nil
        refreshToken = nil
    }
}

// MARK: - Convenience API Methods

extension APIClient {

    // MARK: - Auth

    func login(email: String, password: String) async throws -> AuthResponse {
        let request = LoginRequest(email: email, password: password)
        return try await post(.authLogin, body: request)
    }

    func register(username: String, email: String, password: String) async throws -> User {
        let request = RegisterRequest(username: username, email: email, password: password)
        return try await post(.authRegister, body: request)
    }

    func logout() async throws {
        let _: EmptyResponse = try await post(.authLogout)
    }

    func getCurrentUser() async throws -> User {
        return try await get(.authMe)
    }

    // MARK: - User

    func getUserProfile() async throws -> User {
        return try await get(.userProfile)
    }

    func updateUserProfile(_ update: ProfileUpdate) async throws -> User {
        return try await put(.userUpdateProfile, body: update)
    }

    func getUserStats() async throws -> UserStats {
        return try await get(.userStats)
    }

    // MARK: - Chat

    func getChatRooms() async throws -> [ChatRoom] {
        if let rooms: [ChatRoom] = try? await get(.chatRooms) {
            return rooms
        }
        let response: PaginatedResponse<ChatRoom> = try await get(.chatRooms)
        return response.data
    }

    func getChatRoom(id: String) async throws -> ChatRoom {
        return try await get(.chatRoom(id: id))
    }

    func getChatMessages(roomId: String, page: Int = 1, limit: Int = 50) async throws -> [ChatMessage] {
        let params: Parameters = ["page": page, "limit": limit]
        if let messages: [ChatMessage] = try? await get(.chatRoomMessages(roomId: roomId), parameters: params) {
            return messages
        }
        let response: PaginatedResponse<ChatMessage> = try await get(.chatRoomMessages(roomId: roomId), parameters: params)
        return response.data
    }

    func deleteChatRoom(roomId: String) async throws {
        let _: EmptyResponse = try await delete(.chatRoomDelete(id: roomId))
    }

    func archiveChatRoom(roomId: String) async throws {
        let _: EmptyResponse = try await post(.chatRoomArchive(id: roomId), body: EmptyRequest())
    }

    func muteChatRoom(roomId: String) async throws {
        let _: EmptyResponse = try await post(.chatRoomMute(id: roomId), body: EmptyRequest())
    }

    func unmuteChatRoom(roomId: String) async throws {
        let _: EmptyResponse = try await post(.chatRoomUnmute(id: roomId), body: EmptyRequest())
    }

    func sendMessage(
        roomId: String,
        content: String,
        contentType: MessageType = .text,
        mediaUrl: String? = nil,
        mediaMimeType: String? = nil
    ) async throws -> ChatMessage {
        let request = SendMessageRequest(
            content: content,
            contentType: contentType,
            mediaUrl: mediaUrl,
            mediaMimeType: mediaMimeType
        )
        return try await post(.chatRoomMessagesSend(roomId: roomId), body: request)
    }

    /// Mark a message as read
    /// - Parameters:
    ///   - roomId: The room ID
    ///   - messageId: The message ID to mark as read
    func markMessageAsRead(roomId: String, messageId: String) async throws {
        let request = MarkAsReadRequest(messageId: messageId)
        let _: EmptyResponse = try await post(.chatRoomMessagesRead(roomId: roomId), body: request)
    }

    // MARK: - Study

    func getStudySessions(page: Int = 1, limit: Int = 20) async throws -> [StudySession] {
        let params: Parameters = ["page": page, "limit": limit]
        if let sessions: [StudySession] = try? await get(.studySessions, parameters: params) {
            return sessions
        }
        let response: PaginatedResponse<StudySession> = try await get(.studySessions, parameters: params)
        return response.data
    }

    func getStudyStats() async throws -> StudyStats {
        return try await get(.studyStats)
    }

    // MARK: - Pairing

    /// Initiate pairing with a code
    /// - Parameters:
    ///   - code: Pairing code
    ///   - userId: User ID
    /// - Returns: Pairing response with request ID
    func initiatePairingWithCode(code: String, userId: String) async throws -> PairingResponse {
        let request = PairWithCodeRequest(code: code, userId: userId)
        return try await post(.pairingRequest, body: request)
    }

    /// Initiate pairing with a token
    /// - Parameters:
    ///   - token: Pairing token
    ///   - userId: User ID
    /// - Returns: Pairing response with request ID
    func initiatePairingWithToken(token: String, userId: String) async throws -> PairingResponse {
        let request = PairWithTokenRequest(token: token, userId: userId)
        return try await post(.pairingRequest, body: request)
    }

    /// Check pairing status
    /// - Parameter requestId: The pairing request ID
    /// - Returns: Pairing status response
    func checkPairingStatus(requestId: String) async throws -> PairingStatusResponse {
        return try await get(.pairingStatus(requestId: requestId))
    }

    /// Confirm pairing
    /// - Parameters:
    ///   - code: Pairing code
    ///   - confirmed: Whether the pairing is confirmed
    ///   - permissions: Optional device permissions
    /// - Returns: Pairing response
    func confirmPairing(code: String, confirmed: Bool, permissions: [DevicePermission]? = nil) async throws -> PairingResponse {
        let request = PairingConfirmRequest(code: code, confirmed: confirmed, permissions: permissions)
        return try await post(.pairingConfirm, body: request)
    }

    func getPairedDevices() async throws -> [PairedDevice] {
        if let devices: [PairedDevice] = try? await get(.pairingDevices) {
            return devices
        }
        let response: PaginatedResponse<PairedDevice> = try await get(.pairingDevices)
        return response.data
    }

    func unpairDevice(deviceId: String) async throws {
        let _: EmptyResponse = try await delete(.pairingDevice(id: deviceId))
    }

    // MARK: - Points

    func getPoints() async throws -> PointsResponse {
        return try await get(.points)
    }

    func getPointsHistory(page: Int = 1, limit: Int = 20) async throws -> [PointsTransaction] {
        let params: Parameters = ["page": page, "limit": limit]
        if let transactions: [PointsTransaction] = try? await get(.pointsHistory, parameters: params) {
            return transactions
        }
        let response: PaginatedResponse<PointsTransaction> = try await get(.pointsHistory, parameters: params)
        return response.data
    }

    // MARK: - Locations

    func getLocations() async throws -> [Location] {
        if let locations: [Location] = try? await get(.locations) {
            return locations
        }
        let response: PaginatedResponse<Location> = try await get(.locations)
        return response.data
    }

    func getLocation(id: String) async throws -> Location {
        return try await get(.location(id: id))
    }

    func getNearbyLocations(radius: Double) async throws -> [Location] {
        return try await get(.locationNearby(radius: radius))
    }

    func shareLocation(_ request: ShareLocationRequest) async throws -> ShareLocationResponse {
        return try await post(.locationShare, body: request)
    }

    // MARK: - Payments

    /// Purchase points using in-app purchase
    /// - Parameter request: Points purchase request
    /// - Returns: Points purchase response
    func purchasePoints(_ request: PointsPurchaseRequest) async throws -> PointsPurchaseResponse {
        return try await post(.purchasePoints, body: request)
    }

    /// Verify receipt with backend
    /// - Parameter request: Receipt verification request
    /// - Returns: Receipt verification response
    func verifyReceipt(_ request: ReceiptVerificationRequest) async throws -> ReceiptVerificationResponse {
        return try await post(.verifyReceipt, body: request)
    }

    /// Get order history
    /// - Parameters:
    ///   - page: Page number
    ///   - limit: Items per page
    /// - Returns: Orders list response
    func getOrders(page: Int = 1, limit: Int = 20) async throws -> OrdersListResponse {
        let params: Parameters = ["page": page, "limit": limit]
        return try await get(.getOrders, parameters: params)
    }

    /// Get order details
    /// - Parameter orderId: Order ID
    /// - Returns: Order details response
    func getOrder(orderId: String) async throws -> OrderDetailsResponse {
        return try await get(.getOrder(id: orderId))
    }

    /// Cancel pending order
    /// - Parameter orderId: Order ID to cancel
    /// - Returns: Empty response on success
    func cancelOrder(orderId: String) async throws {
        let _: EmptyResponse = try await put(.cancelOrder(id: orderId))
    }

    /// Get current subscription status
    /// - Returns: Subscription status response
    func getSubscription() async throws -> SubscriptionStatusResponse {
        return try await get(.getSubscription)
    }

    /// Restore previous purchases
    /// - Returns: Restore purchases response with restored orders
    func restorePurchases() async throws -> RestorePurchasesResponse {
        return try await post(.restorePurchases)
    }

    // MARK: - Notifications

    func getNotifications() async throws -> [APIAppNotification] {
        struct NotificationListResponse: Codable {
            let notifications: [APIAppNotification]
            let unreadCount: Int?

            enum CodingKeys: String, CodingKey {
                case notifications
                case unreadCount = "unread_count"
            }
        }

        if let response: NotificationListResponse = try? await get(.notificationList) {
            return response.notifications
        }
        if let response: PaginatedResponse<APIAppNotification> = try? await get(.notificationList) {
            return response.data
        }
        return try await get(.notificationList)
    }

    func markNotificationAsRead(notificationId: String) async throws {
        let _: EmptyResponse = try await post(.notificationMarkRead(id: notificationId))
    }

    func markAllNotificationsAsRead() async throws {
        let _: EmptyResponse = try await post(.notificationMarkAllRead)
    }

    // MARK: - Unread Counts

    func getUnreadCounts() async throws -> UnreadCounts {
        return try await get(.unreadCounts)
    }

    func getUnreadCount(friendId: String) async throws -> Int {
        return try await get(.unreadCount(friendId: friendId))
    }

    func updateUnreadCount(friendId: String, count: Int) async throws {
        let request = UpdateUnreadCountRequest(count: count)
        let _: EmptyResponse = try await post(.unreadUpdateCount(friendId: friendId), body: request)
    }

    func markAllAsRead() async throws {
        let _: EmptyResponse = try await post(.unreadMarkAllRead)
    }

    // MARK: - Clawbot (AI Conversation)

    func getClawbotConversations() async throws -> [ClawbotConversation] {
        return try await get(.clawbotConversations)
    }

    func createClawbotConversation(name: String?) async throws -> ClawbotConversation {
        let request = CreateClawbotConversationRequest(name: name)
        return try await post(.clawbotCreateConversation, body: request)
    }

    func getClawbotMessages(conversationId: String, page: Int = 1, limit: Int = 50) async throws -> [ClawbotMessage] {
        let params: Parameters = ["page": page, "limit": limit]
        let response: PaginatedResponse<ClawbotMessage> = try await get(.clawbotConversationMessages(conversationId: conversationId), parameters: params)
        return response.data
    }

    func sendClawbotMessage(conversationId: String, content: String) async throws -> ClawbotMessage {
        let request = SendClawbotMessageRequest(content: content)
        return try await post(.clawbotSendMessage(conversationId: conversationId), body: request)
    }

    func deleteClawbotConversation(conversationId: String) async throws {
        let _: EmptyResponse = try await delete(.clawbotDeleteConversation(conversationId: conversationId))
    }

    // MARK: - Study Goals

    func getStudyGoals() async throws -> [StudyGoal] {
        return try await get(.studyGoals)
    }

    func createStudyGoal(_ request: CreateStudyGoalRequest) async throws -> StudyGoal {
        return try await post(.studyGoalCreate, body: request)
    }

    func updateStudyGoal(id: String, request: UpdateStudyGoalRequest) async throws -> StudyGoal {
        return try await put(.studyGoalUpdate(id: id), body: request)
    }

    func deleteStudyGoal(id: String) async throws {
        let _: EmptyResponse = try await delete(.studyGoalDelete(id: id))
    }

    // MARK: - Friends

    func getFriends() async throws -> [APIFriend] {
        return try await get(.friendList)
    }

    func getFriendRecommendations(limit: Int = 8) async throws -> [APIFriendRecommendation] {
        let params: Parameters = ["limit": limit]
        return try await get(.friendRecommendations, parameters: params)
    }

    func addFriend(friendId: String) async throws {
        let request = FriendAddRequest(friendId: friendId)
        let _: EmptyResponse = try await post(.friendAdd, body: request)
    }

    func removeFriend(friendId: String) async throws {
        let _: EmptyResponse = try await delete(.friendRemove(friendId: friendId))
    }

    func getFriendRequests() async throws -> [FriendRequest] {
        return try await get(.friendRequests)
    }

    func acceptFriendRequest(requestId: String) async throws {
        let request = FriendRequestActionRequest(requestId: requestId)
        let _: EmptyResponse = try await post(.friendAccept(requestId: requestId), body: request)
    }

    func declineFriendRequest(requestId: String) async throws {
        let _: EmptyResponse = try await post(.friendDecline(requestId: requestId), body: EmptyRequest())
    }

    // MARK: - Achievements

    func getAchievements() async throws -> [Achievement] {
        return try await get(.achievementList)
    }

    func checkAchievements() async throws -> [Achievement] {
        return try await get(.achievementCheck)
    }

    func unlockAchievement(achievementId: String) async throws -> Achievement {
        return try await post(.achievementUnlock(achievementId: achievementId), body: EmptyRequest())
    }

    // MARK: - Mall

    func getMallItems() async throws -> [MallItem] {
        return try await get(.mallItems)
    }

    func getMallItem(id: String) async throws -> MallItem {
        return try await get(.mallItem(id: id))
    }

    func purchaseMallItem(itemId: String) async throws -> MallPurchaseResult {
        let request = MallPurchaseRequest(itemId: itemId)
        return try await post(.mallPurchase, body: request)
    }

    func getPurchaseHistory() async throws -> [PurchaseHistoryItem] {
        return try await get(.mallPurchaseHistory)
    }

    // MARK: - Wardrobe

    func getWardrobeOutfits() async throws -> [WardrobeOutfit] {
        return try await get(.wardrobeOutfits)
    }

    func equipOutfit(outfitId: String) async throws -> WardrobeOutfit {
        let _: EmptyResponse = try await post(.wardrobeEquip(outfitId: outfitId), body: EmptyRequest())
        return try await get(.wardrobeOutfits)
    }

    func unequipOutfit(outfitId: String) async throws {
        let _: EmptyResponse = try await delete(.wardrobeUnequip(outfitId: outfitId))
    }

    // MARK: - Schedules

    func getSchedules() async throws -> [Schedule] {
        return try await get(.scheduleList)
    }

    func createSchedule(_ schedule: ScheduleCreateRequest) async throws -> Schedule {
        return try await post(.scheduleCreate, body: schedule)
    }

    func updateSchedule(id: String, _ schedule: ScheduleUpdateRequest) async throws -> Schedule {
        return try await put(.scheduleUpdate(id: id), body: schedule)
    }

    func deleteSchedule(id: String) async throws {
        let _: EmptyResponse = try await delete(.scheduleDelete(id: id))
    }

    func getSchedulesByDateRange(start: Date, end: Date) async throws -> [Schedule] {
        let params: Parameters = ["start": ISO8601DateFormatter().string(from: start), "end": ISO8601DateFormatter().string(from: end)]
        return try await get(.scheduleByDateRange, parameters: params)
    }

    func getUpcomingSchedules() async throws -> [Schedule] {
        return try await get(.scheduleUpcoming)
    }

    // MARK: - Todos

    func getTodos() async throws -> [Todo] {
        return try await get(.todoList)
    }

    func createTodo(_ todo: TodoCreateRequest) async throws -> Todo {
        return try await post(.todoCreate, body: todo)
    }

    func updateTodo(id: String, _ todo: TodoUpdateRequest) async throws -> Todo {
        return try await put(.todoUpdate(id: id), body: todo)
    }

    func deleteTodo(id: String) async throws {
        let _: EmptyResponse = try await delete(.todoDelete(id: id))
    }

    func toggleTodo(id: String) async throws -> Todo {
        return try await post(.todoToggle(id: id), body: EmptyRequest())
    }

    // MARK: - Places

    func getNearbyPlaces(latitude: Double, longitude: Double, radius: Double = 1000) async throws -> [Place] {
        let params: Parameters = ["lat": latitude, "lng": longitude, "radius": radius]
        return try await get(.placeNearby, parameters: params)
    }

    func searchPlaces(query: String) async throws -> [Place] {
        let params: Parameters = ["q": query]
        return try await get(.placeSearch, parameters: params)
    }

    func getFavoritePlaces() async throws -> [Place] {
        return try await get(.placeFavorite)
    }

    func toggleFavoritePlace(placeId: String) async throws -> Place {
        return try await post(.placeFavoriteToggle(placeId: placeId), body: EmptyRequest())
    }

    // MARK: - Snapshots

    func getSnapshots() async throws -> [Snapshot] {
        return try await get(.snapshots)
    }

    func getSnapshot(id: String) async throws -> Snapshot {
        return try await get(.snapshot(id: id))
    }

    func createSnapshot(_ snapshot: CreateSnapshotRequest) async throws -> Snapshot {
        return try await post(.snapshots, body: snapshot)
    }

    func deleteSnapshot(id: String) async throws {
        let _: EmptyResponse = try await delete(.snapshot(id: id))
    }

    // MARK: - Upload

    func uploadFile(data: Data, fileName: String, mimeType: String) async throws -> UploadResponse {
        // Create multipart form data request
        return try await upload(.upload, data: data, fileName: fileName)
    }

    func uploadBase64Image(base64Data: String) async throws -> UploadResponse {
        let request = UploadBase64Request(data: base64Data)
        return try await post(.uploadBase64, body: request)
    }

    // MARK: - APIClientProtocol Conformance

    func get<T: Codable>(_ endpoint: APIEndpoint) async throws -> T {
        return try await get(endpoint, parameters: nil, headers: nil)
    }

    func post<T: Codable>(_ endpoint: APIEndpoint, body: Encodable) async throws -> T {
        return try await post(endpoint, parameters: nil, body: body, headers: nil)
    }

    func put<T: Codable>(_ endpoint: APIEndpoint, body: Encodable) async throws -> T {
        return try await put(endpoint, parameters: nil, body: body, headers: nil)
    }

    func delete<T: Codable>(_ endpoint: APIEndpoint) async throws -> T {
        return try await delete(endpoint, parameters: nil, headers: nil)
    }

    func upload<T: Codable>(_ endpoint: APIEndpoint, data: Data, fileName: String) async throws -> T {
        let url = baseURL + endpoint.path
        let requestStartTime = Date()
        let logEntryId = networkLogger.logRequest(
            method: "POST",
            url: url,
            headers: ["Content-Type": "multipart/form-data"],
            body: nil
        )

        return try await withCheckedThrowingContinuation { continuation in
            session.upload(
                multipartFormData: { multipartFormData in
                    multipartFormData.append(
                        data,
                        withName: "file",
                        fileName: fileName,
                        mimeType: "application/octet-stream"
                    )
                },
                to: url,
                method: .post
            )
            .responseData { response in
                let duration = Date().timeIntervalSince(requestStartTime)
                let statusCode = response.response?.statusCode ?? 0

                self.networkLogger.logResponse(
                    entryId: logEntryId,
                    statusCode: statusCode,
                    body: response.data,
                    duration: duration,
                    error: response.error
                )

                switch response.result {
                case .success(let responseData):
                    if let httpResponse = response.response,
                       !(200...299).contains(httpResponse.statusCode) {
                        continuation.resume(throwing: self.mapHTTPStatusError(statusCode: httpResponse.statusCode, data: responseData))
                        return
                    }
                    do {
                        let decoded: T = try self.decodeResponse(responseData, as: T.self)
                        continuation.resume(returning: decoded)
                    } catch {
                        continuation.resume(throwing: NetworkError.decodingError(underlying: error))
                    }
                case .failure(let error):
                    continuation.resume(throwing: self.mapError(error: error, response: response.response))
                }
            }
        }
    }

    func download(from url: String) async throws -> Data {
        guard let downloadURL = URL(string: url) else {
            throw NetworkError.custom(message: "Invalid download URL")
        }

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await URLSession.shared.data(from: downloadURL)
        } catch {
            throw NetworkError.noConnection
        }

        if let httpResponse = response as? HTTPURLResponse,
           !(200...299).contains(httpResponse.statusCode) {
            throw mapHTTPStatusError(statusCode: httpResponse.statusCode, data: data)
        }

        return data
    }
}

// NOTE: EmptyResponse is now defined in OAuthManager.swift
