import Foundation

/// 设备类型
enum DeviceType: String, Codable {
    case mobile
    case desktop
    case tablet
    case web
}

/// 连接状态
enum ConnectionStatus: String, Codable {
    case disconnected
    case connecting
    case connected
    case authFailed = "AUTH_FAILED"
    case error
    case reconnecting
}

/// 配对状态
enum PairingStatus: String, Codable {
    case pending
    case approved
    case denied
    case cancelled
    case expired
}

/// 配对元数据
struct PairingMetadata: Codable {
    let deviceName: String
    let deviceType: DeviceType
    let platform: String?
    let userAgent: String?

    enum CodingKeys: String, CodingKey {
        case deviceName = "device_name"
        case deviceType = "device_type"
        case platform
        case userAgent = "user_agent"
    }
}

/// 设备模型
struct Device: Codable, Identifiable {
    let id: String
    let deviceId: String
    let deviceName: String
    let deviceType: DeviceType
    let pairedAt: Date
    let isOnline: Bool

    enum CodingKeys: String, CodingKey {
        case id
        case deviceId = "device_id"
        case deviceName = "device_name"
        case deviceType = "device_type"
        case pairedAt = "paired_at"
        case isOnline = "is_online"
    }
}

/// 配对请求
struct PairingRequest: Codable {
    let userId: String

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
    }
}

/// 配对响应
struct PairingResponse: Codable {
    let requestId: String
    let code: String?
    let token: String?
    let expiresIn: Int
    let qrUrl: String?

    enum CodingKeys: String, CodingKey {
        case requestId = "request_id"
        case code
        case token
        case expiresIn = "expires_in"
        case qrUrl = "qr_url"
    }
}

/// 配对确认请求
struct PairingConfirmRequest: Codable {
    let code: String
    let confirmed: Bool
    let permissions: [DevicePermission]?

    enum CodingKeys: String, CodingKey {
        case code
        case confirmed
        case permissions
    }
}

/// 设备权限
enum DevicePermission: String, Codable {
    case read
    case write
    case execute
}

/// 配对状态查询响应
struct PairingStatusResponse: Codable {
    let success: Bool
    let paired: Bool
    let deviceId: String?
    let deviceName: String?
    let botOnline: Bool?
    let pairedAt: String?

    enum CodingKeys: String, CodingKey {
        case success
        case paired
        case deviceId = "device_id"
        case deviceName = "device_name"
        case botOnline = "bot_online"
        case pairedAt = "paired_at"
    }
}

/// 设备信息
struct DeviceInfo: Codable {
    let deviceId: String
    let deviceName: String
    let pairedAt: Date

    enum CodingKeys: String, CodingKey {
        case deviceId = "device_id"
        case deviceName = "device_name"
        case pairedAt = "paired_at"
    }
}
