//
//  APIService.swift
//  TRIX Native
//

import Foundation

class APIService {
    static let shared = APIService()

    private var baseURL: String = ""
    private var pluginToken: String = ""

    // MARK: - Configuration

    func configure(baseURL: String) {
        self.baseURL = baseURL
    }

    func setToken(_ token: String) {
        self.pluginToken = token
    }

    var isConfigured: Bool {
        return !baseURL.isEmpty
    }

    // MARK: - Pairing

    func createPairing() async throws -> PairingResponse {
        guard let url = URL(string: "\(baseURL)/api/pairings") else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard httpResponse.statusCode == 200 else {
            throw APIError.serverError(statusCode: httpResponse.statusCode)
        }

        let decoder = JSONDecoder()
        return try decoder.decode(PairingResponse.self, from: data)
    }

    func getPairingStatus(code: String) async throws -> PairingStatusResponse {
        guard let url = URL(string: "\(baseURL)/api/pairings/\(code)") else {
            throw APIError.invalidURL
        }

        let (data, response) = try await URLSession.shared.data(from: url)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard httpResponse.statusCode == 200 else {
            throw APIError.serverError(statusCode: httpResponse.statusCode)
        }

        let decoder = JSONDecoder()
        return try decoder.decode(PairingStatusResponse.self, from: data)
    }

    func claimPairing(code: String, deviceId: String, deviceName: String) async throws -> ClaimPairingResponse {
        guard let url = URL(string: "\(baseURL)/api/pairings/\(code)/claim") else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body = ClaimPairingRequest(deviceId: deviceId, deviceName: deviceName)
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard httpResponse.statusCode == 200 else {
            let errorData = try? JSONDecoder().decode(ClaimPairingResponse.self, from: data)
            throw APIError.serverError(
                statusCode: httpResponse.statusCode,
                message: errorData?.error ?? "Unknown error"
            )
        }

        let decoder = JSONDecoder()
        let result = try decoder.decode(ClaimPairingResponse.self, from: data)

        // 保存 token
        self.pluginToken = result.pluginToken
        UserDefaults.standard.set(result.pluginToken, forKey: "trix_plugin_token")

        return result
    }

    // MARK: - Messages

    func sendMessage(conversationId: String, text: String?, attachments: [Attachment]?) async throws -> SendMessageResponse {
        guard let url = URL(string: "\(baseURL)/api/messages/from-phone") else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body: [String: Any] = [
            "conversationId": conversationId,
            "text": text ?? "",
            "attachments": attachments?.map { att -> [String: Any] in
                var dict: [String: Any] = [
                    "type": att.type.rawValue,
                    "url": att.url
                ]
                if let mimeType = att.mimeType { dict["mimeType"] = mimeType }
                if let fileName = att.fileName { dict["fileName"] = fileName }
                return dict
            } as [[String: Any]]
        ]

        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard httpResponse.statusCode == 200 else {
            throw APIError.serverError(statusCode: httpResponse.statusCode)
        }

        let decoder = JSONDecoder()
        return try decoder.decode(SendMessageResponse.self, from: data)
    }

    // MARK: - Upload

    func uploadFile(data: Data, fileName: String, type: Attachment.AttachmentType) async throws -> UploadResponse {
        guard let url = URL(string: "\(baseURL)/api/upload") else {
            throw APIError.invalidURL
        }

        let boundary = UUID().uuidString
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        var body = Data()
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(fileName)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: \(getMimeType(for: fileName))\r\n\r\n".data(using: .utf8)!)
        body.append(data)
        body.append("\r\n".data(using: .utf8)!)
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"type\"\r\n\r\n".data(using: .utf8)!)
        body.append("\(type.rawValue)\r\n".data(using: .utf8)!)
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)

        request.httpBody = body

        let (responseData, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard httpResponse.statusCode == 200 else {
            throw APIError.serverError(statusCode: httpResponse.statusCode)
        }

        let decoder = JSONDecoder()
        return try decoder.decode(UploadResponse.self, from: responseData)
    }

    // MARK: - Helpers

    private func getMimeType(for fileName: String) -> String {
        let ext = (fileName as NSString).pathExtension.lowercased()
        let mimeTypes: [String: String] = [
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
            "png": "image/png",
            "gif": "image/gif",
            "webp": "image/webp",
            "mp3": "audio/mpeg",
            "wav": "audio/wav",
            "mp4": "video/mp4",
            "mov": "video/quicktime"
        ]
        return mimeTypes[ext] ?? "application/octet-stream"
    }
}

// MARK: - Errors

enum APIError: Error, LocalizedError {
    case invalidURL
    case invalidResponse
    case serverError(statusCode: Int, message: String? = nil)
    case networkError(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid response from server"
        case .serverError(let statusCode, let message):
            return message ?? "Server error: \(statusCode)"
        case .networkError(let error):
            return error.localizedDescription
        }
    }
}
