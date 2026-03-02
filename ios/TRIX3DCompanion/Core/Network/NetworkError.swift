//
//  NetworkError.swift
//  TRIX3DCompanion
//
//  Network error types for the application
//

import Foundation

/// Network error types
enum NetworkError: Error, LocalizedError, Hashable {
    /// No internet connection
    case noConnection

    /// Request timeout
    case timeout

    /// Server error with status code
    case serverError(statusCode: Int, message: String?)

    /// Response decoding error
    case decodingError(underlying: Error?)

    /// Invalid URL
    case invalidURL

    /// Invalid response from server
    case invalidResponse

    /// Unauthorized (401)
    case unauthorized

    /// Forbidden (403)
    case forbidden

    /// Not found (404)
    case notFound

    /// Custom error with message
    case custom(message: String)

    /// Unknown error
    case unknown(Error?)

    /// Type mismatch error
    case typeMismatch(String)

    // MARK: - Hashable

    func hash(into hasher: inout Hasher) {
        switch self {
        case .noConnection:
            hasher.combine(0)
        case .timeout:
            hasher.combine(1)
        case .serverError(let statusCode, let message):
            hasher.combine(2)
            hasher.combine(statusCode)
            hasher.combine(message)
        case .decodingError:
            hasher.combine(3)
        case .invalidURL:
            hasher.combine(4)
        case .invalidResponse:
            hasher.combine(5)
        case .unauthorized:
            hasher.combine(6)
        case .forbidden:
            hasher.combine(7)
        case .notFound:
            hasher.combine(8)
        case .custom(let message):
            hasher.combine(9)
            hasher.combine(message)
        case .unknown:
            hasher.combine(10)
        case .typeMismatch(let message):
            hasher.combine(11)
            hasher.combine(message)
        }
    }

    static func == (lhs: NetworkError, rhs: NetworkError) -> Bool {
        switch (lhs, rhs) {
        case (.noConnection, .noConnection):
            return true
        case (.timeout, .timeout):
            return true
        case (.serverError(let l1, let m1), .serverError(let l2, let m2)):
            return l1 == l2 && m1 == m2
        case (.decodingError, .decodingError):
            return true
        case (.invalidURL, .invalidURL):
            return true
        case (.invalidResponse, .invalidResponse):
            return true
        case (.unauthorized, .unauthorized):
            return true
        case (.forbidden, .forbidden):
            return true
        case (.notFound, .notFound):
            return true
        case (.custom(let m1), .custom(let m2)):
            return m1 == m2
        case (.unknown, .unknown):
            return true
        case (.typeMismatch(let m1), .typeMismatch(let m2)):
            return m1 == m2
        default:
            return false
        }
    }

    var errorDescription: String? {
        switch self {
        case .noConnection:
            return "No internet connection. Please check your network settings."
        case .timeout:
            return "Request timed out. The server is taking too long to respond. Please try again later."
        case .serverError(let statusCode, let message):
            return message ?? "Server error (Status: \(statusCode))"
        case .decodingError(let underlying):
            if let error = underlying {
                return "Failed to decode response: \(error.localizedDescription)"
            }
            return "Failed to decode response"
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid response from server"
        case .unauthorized:
            return "Unauthorized. Please log in again."
        case .forbidden:
            return "Access forbidden"
        case .notFound:
            return "Resource not found"
        case .custom(let message):
            return message
        case .unknown(let error):
            return error?.localizedDescription ?? "Unknown error occurred"
        case .typeMismatch(let message):
            return "Type mismatch: \(message)"
        }
    }

    /// Check if error is network-related
    var isNetworkError: Bool {
        switch self {
        case .noConnection, .timeout:
            return true
        default:
            return false
        }
    }

    /// Check if error requires re-authentication
    var requiresReauthentication: Bool {
        switch self {
        case .unauthorized, .forbidden:
            return true
        default:
            return false
        }
    }
}
