import Foundation

/// 快照/拍照模型
struct Snapshot: Codable, Identifiable {
    let id: String
    let userId: String
    let imageUrl: String
    let thumbnailUrl: String?
    let locationId: String?
    let locationName: String?
    let latitude: Double?
    let longitude: Double?
    let caption: String?
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case imageUrl = "image_url"
        case thumbnailUrl = "thumbnail_url"
        case locationId = "location_id"
        case locationName = "location_name"
        case latitude
        case longitude
        case caption
        case createdAt = "created_at"
    }
}

/// 快照创建请求
struct CreateSnapshotRequest: Codable {
    let imageBase64: String
    let locationId: String?
    let latitude: Double?
    let longitude: Double?
    let caption: String?

    enum CodingKeys: String, CodingKey {
        case imageBase64 = "image_base64"
        case locationId = "location_id"
        case latitude
        case longitude
        case caption
    }
}

/// 快照列表响应
struct SnapshotsResponse: Codable {
    let snapshots: [Snapshot]
    let totalCount: Int
    let page: Int
    let limit: Int

    enum CodingKeys: String, CodingKey {
        case snapshots
        case totalCount = "total_count"
        case page
        case limit
    }
}

/// 相机状态
enum CameraState: String, Codable {
    case notAuthorized
    case authorized
    case capturing
}

/// 媒体信息
struct MediaInfo: Codable {
    let uri: String
    let type: String
    let size: Int?
    let category: MediaCategory?
    let metadata: MediaInfoMetadata?

    enum CodingKeys: String, CodingKey {
        case uri
        case type
        case size
        case category
        case metadata
    }
}

/// 媒体类别
enum MediaCategory: String, Codable {
    case image
    case video
}

/// 媒体信息元数据
struct MediaInfoMetadata: Codable {
    let width: Int?
    let height: Int?
    let duration: Int?

    enum CodingKeys: String, CodingKey {
        case width
        case height
        case duration
    }
}
