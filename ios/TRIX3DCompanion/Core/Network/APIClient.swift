//
//  APIClient.swift
//  TRIX3DCompanion
//
//  HTTP client based on Alamofire
//

import Foundation
import Alamofire

/// API Client for making HTTP requests
final class APIClient {

    // MARK: - Singleton
    static let shared = APIClient()

    // MARK: - Properties
    private let session: Session
    private let baseURL: String
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    // MARK: - Initialization
    private init() {
        self.baseURL = APIBaseURL.current

        // Configure session with interceptors
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 30
        configuration.timeoutIntervalForResource = 60

        self.session = Session(configuration: configuration)

        // Configure decoder
        self.decoder = JSONDecoder()
        self.decoder.dateDecodingStrategy = .iso8601
        self.decoder.keyDecodingStrategy = .convertFromSnakeCase

        // Configure encoder
        self.encoder = JSONEncoder()
        self.encoder.dateEncodingStrategy = .iso8601
        self.encoder.keyEncodingStrategy = .convertToSnakeCase
    }

    // MARK: - Public Methods

    /// Perform GET request
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

        // Add authorization header if required
        if endpoint.requiresAuth {
            if let token = AuthManager.shared.accessToken {
                requestHeaders.add(.authorization(bearerToken: token))
            }
        }

        // Add content type for body requests
        if body != nil {
            requestHeaders.add(.contentType("application/json"))
        }

        // Build request
        let request =AF.request(
            url,
            method: Alamofire.HTTPMethod(rawValue: method.rawValue),
            parameters: parameters,
            encoding: method == .get ? URLEncoding.default : JSONEncoding.default,
            headers: requestHeaders
        )

        // Execute request
        return try await withCheckedThrowingContinuation { continuation in
            request.responseDecodable(of: T.self, decoder: decoder) { response in
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
final class AuthManager {
    static let shared = AuthManager()

    private let keychain = KeychainManager.shared

    private init() {}

    var accessToken: String? {
        get { keychain.get(key: "accessToken") }
        set {
            if let value = newValue {
                keychain.set(key: "accessToken", value: value)
            } else {
                keychain.delete(key: "accessToken")
            }
        }
    }

    var refreshToken: String? {
        get { keychain.get(key: "refreshToken") }
        set {
            if let value = newValue {
                keychain.set(key: "refreshToken", value: value)
            } else {
                keychain.delete(key: "refreshToken")
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

// MARK: - Keychain Manager

/// Simple keychain wrapper for storing sensitive data
final class KeychainManager {
    static let shared = KeychainManager()

    private let serviceName = "com.trix3d.companion"

    private init() {}

    func set(key: String, value: String) {
        guard let data = value.data(using: .utf8) else { return }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key,
            kSecValueData as String: data
        ]

        // Delete existing item first
        SecItemDelete(query as CFDictionary)

        // Add new item
        SecItemAdd(query as CFDictionary, nil)
    }

    func get(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess,
              let data = result as? Data,
              let value = String(data: data, encoding: .utf8) else {
            return nil
        }

        return value
    }

    func delete(key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key
        ]

        SecItemDelete(query as CFDictionary)
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
}

// MARK: - Empty Response

struct EmptyResponse: Codable {}
