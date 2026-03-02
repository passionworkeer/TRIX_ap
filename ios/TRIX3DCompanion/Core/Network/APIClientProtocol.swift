//
//  APIClientProtocol.swift
//  TRIX3DCompanion
//
//  Protocol for API Client to enable testing with mocks
//

import Foundation

/// Protocol for API Client operations
protocol APIClientProtocol {

    /// Perform GET request
    /// - Parameters:
    ///   - endpoint: The API endpoint to request
    /// - Returns: Decoded response of type T
    /// - Throws: NetworkError if the request fails
    func get<T: Decodable>(_ endpoint: APIEndpoint) async throws -> T

    /// Perform POST request
    /// - Parameters:
    ///   - endpoint: The API endpoint to request
    ///   - body: Request body to encode as JSON
    /// - Returns: Decoded response of type T
    /// - Throws: NetworkError if the request fails
    func post<T: Decodable>(_ endpoint: APIEndpoint, body: Encodable) async throws -> T

    /// Perform PUT request
    /// - Parameters:
    ///   - endpoint: The API endpoint to request
    ///   - body: Request body to encode as JSON
    /// - Returns: Decoded response of type T
    /// - Throws: NetworkError if the request fails
    func put<T: Decodable>(_ endpoint: APIEndpoint, body: Encodable) async throws -> T

    /// Perform DELETE request
    /// - Parameters:
    ///   - endpoint: The API endpoint to request
    /// - Returns: Decoded response of type T
    /// - Throws: NetworkError if the request fails
    func delete<T: Decodable>(_ endpoint: APIEndpoint) async throws -> T

    /// Upload file
    /// - Parameters:
    ///   - endpoint: The API endpoint to upload to
    ///   - data: File data
    ///   - fileName: Name of the file
    /// - Returns: Decoded response of type T
    /// - Throws: NetworkError if the request fails
    func upload<T: Decodable>(_ endpoint: APIEndpoint, data: Data, fileName: String) async throws -> T

    /// Download file
    /// - Parameter url: URL to download from
    /// - Returns: Downloaded data
    /// - Throws: NetworkError if the request fails
    func download(from url: String) async throws -> Data
}

// Extend APIClient to conform to the protocol
extension APIClient: APIClientProtocol {

    func get<T: Decodable>(_ endpoint: APIEndpoint) async throws -> T {
        return try await get(endpoint, parameters: nil, headers: nil)
    }

    func post<T: Decodable>(_ endpoint: APIEndpoint, body: Encodable) async throws -> T {
        return try await post(endpoint, parameters: nil, body: body, headers: nil)
    }

    func put<T: Decodable>(_ endpoint: APIEndpoint, body: Encodable) async throws -> T {
        return try await put(endpoint, parameters: nil, body: body, headers: nil)
    }

    func delete<T: Decodable>(_ endpoint: APIEndpoint) async throws -> T {
        return try await delete(endpoint, parameters: nil, headers: nil)
    }

    func upload<T: Decodable>(_ endpoint: APIEndpoint, data: Data, fileName: String) async throws -> T {
        // For now, throw not implemented - actual implementation would be in APIClient
        throw NetworkError.custom(message: "Upload not implemented in protocol extension")
    }

    func download(from url: String) async throws -> Data {
        // For now, throw not implemented - actual implementation would be in APIClient
        throw NetworkError.custom(message: "Download not implemented in protocol extension")
    }
}
