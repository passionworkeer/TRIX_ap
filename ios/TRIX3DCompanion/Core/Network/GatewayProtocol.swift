//
//  GatewayProtocol.swift
//  TRIX3DCompanion
//
//  Gateway Protocol Types
//

import Foundation

// MARK: - Protocol Frames

/// Request frame (client -> server)
struct GatewayRequestFrame: Codable {
    let type: String  // "req"
    let id: String
    let method: String
    let params: [String: AnyCodable]?
}

/// Response frame (server -> client)
struct GatewayResponseFrame: Codable {
    let type: String  // "res"
    let id: String
    let ok: Bool
    let payload: AnyCodable?
    let error: GatewayErrorInfo?
}

/// Event frame (server -> client)
struct GatewayEventFrame: Codable {
    let type: String  // "event"
    let event: String
    let payload: AnyCodable?
    let seq: Int?
}

/// Error information
struct GatewayErrorInfo: Codable {
    let code: String?
    let message: String
    let details: AnyCodable?
}

// MARK: - AnyCodable

/// A type that can encode/decode any JSON value
struct AnyCodable: Codable {
    let value: Any

    init(_ value: Any) {
        self.value = value
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if container.decodeNil() {
            self.value = NSNull()
        } else if let bool = try? container.decode(Bool.self) {
            self.value = bool
        } else if let int = try? container.decode(Int.self) {
            self.value = int
        } else if let double = try? container.decode(Double.self) {
            self.value = double
        } else if let string = try? container.decode(String.self) {
            self.value = string
        } else if let array = try? container.decode([AnyCodable].self) {
            self.value = array.map { $0.value }
        } else if let dictionary = try? container.decode([String: AnyCodable].self) {
            self.value = dictionary.mapValues { $0.value }
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "AnyCodable cannot decode value")
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()

        switch value {
        case is NSNull:
            try container.encodeNil()
        case let bool as Bool:
            try container.encode(bool)
        case let int as Int:
            try container.encode(int)
        case let double as Double:
            try container.encode(double)
        case let string as String:
            try container.encode(string)
        case let array as [Any]:
            try container.encode(array.map { AnyCodable($0) })
        case let dictionary as [String: Any]:
            try container.encode(dictionary.mapValues { AnyCodable($0) })
        default:
            throw EncodingError.invalidValue(value, EncodingError.Context(codingPath: encoder.codingPath, debugDescription: "AnyCodable cannot encode value"))
        }
    }
}

// MARK: - Chat Types

struct GatewayChatMessage: Codable, Identifiable {
    let id: String
    let role: String
    let content: String
    let timestamp: Int
}

struct ChatSendRequest: Codable {
    let sessionId: String
    let message: String
    let stream: Bool?
}

struct ChatDeltaEvent: Codable {
    let sessionId: String
    let delta: String
    let final: Bool?
}

// MARK: - Session Types

struct GatewaySession: Codable, Identifiable {
    var id: String { key }
    let key: String
    let label: String
    let agentId: String
    let createdAt: Int
    let updatedAt: Int
    let messageCount: Int
}

// MARK: - Agent Types

struct GatewayAgent: Codable, Identifiable {
    let id: String
    let name: String
    let description: String
    let model: String
    let provider: String
    let skills: [String]
    let enabled: Bool
}

// MARK: - Skill Types

struct GatewaySkill: Codable, Identifiable {
    let id: String
    let name: String
    let description: String
    let version: String
    let enabled: Bool
}

// MARK: - Cron Types

struct CronJob: Codable, Identifiable {
    let id: String
    let name: String
    let schedule: String
    let content: String
    let enabled: Bool
    let lastRun: Int?
    let nextRun: Int?
}

// MARK: - Control Types

struct ModelsStatus: Codable {
    let provider: String
    let model: String
    let status: String
    let latency: Double?
}

struct CheckResult: Codable {
    let skill: String
    let status: String
    let message: String?
}

struct DoctorCheck: Codable {
    let name: String
    let status: String
    let version: String?
    let message: String?
    let error: String?
}

struct DoctorResult: Codable {
    let timestamp: String
    let checks: [DoctorCheck]
}

// MARK: - Provider Types

struct Provider: Codable, Identifiable {
    let id: String
    let name: String
    let apiBase: String?
    let apiKey: String?
    let models: [String]?
    let defaultModel: String?
}

// MARK: - Pairing Types

struct PairingResult: Codable {
    let success: Bool
    let deviceId: String?
    let deviceName: String?
    let error: String?
}

struct GatewayPairingStatus: Codable {
    let paired: Bool
    let deviceId: String?
    let deviceName: String?
    let botOnline: Bool?
    let pairedAt: String?
}

// MARK: - Relay Types

/// Relay QR Code payload
struct GatewayRelayQRPayload: Codable {
    let version: Int
    let server: String
    let gatewayId: String
    let accessCode: String
    let displayName: String
}

/// Relay device registration response
struct RelayRegisterResponse: Codable {
    let gatewayId: String
    let relaySecret: String
    let accessCode: String
}

/// Relay authentication response
struct RelayAuthResponse: Codable {
    let ok: Bool
    let error: String?
    let device: RelayDeviceInfo?
}

/// Relay device info
struct RelayDeviceInfo: Codable {
    let gatewayId: String
    let displayName: String
}
