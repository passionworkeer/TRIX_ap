//
//  NetworkError.swift
//  TRIX3DCompanion
//
//  Network error types for the application
//

import Foundation

/// Network error types
enum NetworkError: Error, LocalizedError {
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
