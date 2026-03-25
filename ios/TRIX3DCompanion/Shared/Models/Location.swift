import Foundation
import CoreLocation

/// 位置模型
struct Location: Codable, Identifiable, Equatable {
    let id: String
    let userId: String
    let name: String
    let description: String?
    let latitude: Double
    let longitude: Double
    let address: String?
    let category: LocationCategory?
    let createdAt: Date
    let updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case name
        case description
        case latitude
        case longitude
        case address
        case category
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    /// 转换为 CLLocationCoordinate2D
    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}

/// 位置类别
enum LocationCategory: String, Codable, CaseIterable {
    case school
    case library
    case cafe
    case restaurant
    case entertainment
    case home
    case park
    case other
}

/// 位置创建请求
struct CreateLocationRequest: Codable {
    let name: String
    let description: String?
    let latitude: Double
    let longitude: Double
    let address: String?
    let category: LocationCategory?
}

/// 附近位置响应
struct NearbyLocationsResponse: Codable {
    let locations: [Location]
    let totalCount: Int
    let radius: Double

    enum CodingKeys: String, CodingKey {
        case locations
        case totalCount = "total_count"
        case radius
    }
}
