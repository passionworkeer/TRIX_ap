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
    private let encoder: JSONEncoder
    private let authInterceptor: AuthInterceptor

    // Security managers
    private let sslPinningManager: SSLPinningManager
    private let retryManager: RequestRetryManager
    private let deduplicator: RequestDeduplicator
    private let headersValidator: SecurityHeadersValidator

    // MARK: - Initialization
    private init() {
        self.baseURL = APIBaseURL.current

        // Initialize security managers
        self.sslPinningManager = SSLPinningManager.shared
        self.retryManager = RequestRetryManager.shared
        self.deduplicator = RequestDeduplicator.shared
        self.headersValidator = SecurityHeadersValidator.shared

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

        // Create session with SSL pinning
        // Alamofire 6.x+ API: use evaluators dictionary instead of allHosts
        let evaluator = sslPinningManager.makeServerTrustEvaluator()
        let serverTrustManager = ServerTrustManager(
            evaluators: [APIBaseURL.current: evaluator]
        )

        self.session = Session(
            configuration: configuration,
            interceptor: compositeInterceptor,
            serverTrustManager: serverTrustManager
        )

        // Configure decoder
        self.decoder = JSONDecoder()
        self.decoder.dateDecodingStrategy = .iso8601
        self.decoder.keyDecodingStrategy = .convertFromSnakeCase

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
        let url = baseURL + endpoint.path
        var requestHeaders = headers ?? HTTPHeaders()

        // NOTE: Authorization header is now handled automatically by AuthInterceptor
        // We no longer manually add it here to avoid conflicts with the interceptor
        // The interceptor will:
        // 1. Add Bearer token to requests automatically via adapt()
        // 2. Handle 401 responses by refreshing the token via retry()
        // 3. Retry the request with the new token

        // Add content type for body requests
        if body != nil {
            requestHeaders.add(.contentType("application/json"))
        }

        // Build request
        let request = AF.request(
            url,
            method: Alamofire.HTTPMethod(rawValue: method.rawValue),
            parameters: parameters,
            encoding: method == .get ? URLEncoding.default : JSONEncoding.default,
            headers: requestHeaders
        )

        // Execute request with security validation
        return try await withCheckedThrowingContinuation { continuation in
            request.responseDecodable(of: T.self, decoder: decoder) { [weak self] response in
                guard let self = self else {
                    continuation.resume(throwing: NetworkError.unknown(nil))
                    return
                }

                // Validate security headers if response is successful
                if let httpResponse = response.response,
                   case .success = response.result {
                    self.headersValidator.validateAndLog(httpResponse)
                }

                switch response.result {
                case .success(let value):
                    continuation.resume(returning: value)

                case .failure(let error):
                    let networkError = self.mapError(error: error, response: response.response)
                    continuation.resume(throwing: networkError)
                }
            }
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
        let response: PaginatedResponse<ChatRoom> = try await get(.chatRooms)
        return response.data
    }

    func getChatRoom(id: String) async throws -> ChatRoom {
        return try await get(.chatRoom(id: id))
    }

    func getChatMessages(roomId: String, page: Int = 1, limit: Int = 50) async throws -> [ChatMessage] {
        let params: Parameters = ["page": page, "limit": limit]
        let response: PaginatedResponse<ChatMessage> = try await get(.chatRoomMessages(roomId: roomId), parameters: params)
        return response.data
    }

    func sendMessage(roomId: String, content: String, contentType: MessageType = .text, mediaUrl: String? = nil) async throws -> ChatMessage {
        let request = SendMessageRequest(
            content: content,
            contentType: contentType,
            mediaUrl: mediaUrl,
            mediaMimeType: nil
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
        let response: PaginatedResponse<StudySession> = try await get(.studySessions, parameters: params)
        return response.data
    }

    func getStudyStats() async throws -> StudyStats {
        return try await get(.studyStats)
    }

    // MARK: - Pairing

    func getPairedDevices() async throws -> [PairedDevice] {
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
        let response: PaginatedResponse<PointsTransaction> = try await get(.pointsHistory, parameters: params)
        return response.data
    }

    // MARK: - Locations

    func getLocations() async throws -> [Location] {
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
        // Upload functionality would be implemented here
        throw NetworkError.custom(message: "Upload not implemented")
    }

    func download(from url: String) async throws -> Data {
        // Download functionality would be implemented here
        throw NetworkError.custom(message: "Download not implemented")
    }
}

// NOTE: EmptyResponse is now defined in OAuthManager.swift
