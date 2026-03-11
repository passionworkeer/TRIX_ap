//
//  LocationServiceProtocol.swift
//  TRIX3DCompanion
//
//  Location service protocol defining the interface for location operations
//

import Foundation
import CoreLocation

/// 位置服务错误类型
enum LocationError: Error, LocalizedError {
    /// 位置权限被拒绝
    case permissionDenied
    /// 位置服务不可用
    case locationUnavailable
    /// 网络错误
    case networkError(Error)
    /// 请求超时
    case timeout
    /// 无效的坐标
    case invalidCoordinates

    var errorDescription: String? {
        switch self {
        case .permissionDenied:
            return "位置权限被拒绝，请在设置中启用位置权限"
        case .locationUnavailable:
            return "无法获取位置信息，请检查GPS是否开启"
        case .networkError(let error):
            return "网络错误: \(error.localizedDescription)"
        case .timeout:
            return "获取位置超时，请重试"
        case .invalidCoordinates:
            return "无效的坐标数据"
        }
    }

    var isRecoverable: Bool {
        switch self {
        case .permissionDenied, .locationUnavailable:
            return false
        case .networkError, .timeout, .invalidCoordinates:
            return true
        }
    }
}

/// 位置服务结果类型
typealias LocationResult<T> = Result<T, LocationError>

/// 位置分享请求
struct ShareLocationRequest: Codable {
    let companionId: String
    let latitude: Double
    let longitude: Double
    let timestamp: Date

    enum CodingKeys: String, CodingKey {
        case companionId = "companion_id"
        case latitude
        case longitude
        case timestamp
    }
}

/// 位置分享响应
struct ShareLocationResponse: Codable {
    let success: Bool
    let sharedAt: Date?
    let expiresAt: Date?

    enum CodingKeys: String, CodingKey {
        case success
        case sharedAt = "shared_at"
        case expiresAt = "expires_at"
    }
}

/// 协议定义位置服务的接口
@MainActor
protocol LocationServiceProtocol {
    /// 当前缓存的位置
    var currentLocation: CLLocation? { get }

    /// 当前授权状态
    var authorizationStatus: CLAuthorizationStatus { get }

    /// 是否正在接收位置更新
    var isLocationUpdating: Bool { get }

    /// 请求位置权限
    /// - Returns: 是否成功请求权限（用户拒绝返回false）
    func requestPermission() -> Bool

    /// 获取当前位置
    /// - Returns: 当前位置，如果无法获取则返回nil
    func getCurrentLocation() -> CLLocation?

    /// 开始持续位置更新
    func startLocationUpdates()

    /// 停止位置更新
    func stopLocationUpdates()

    /// 获取指定半径内的附近位置
    /// - Parameter radius: 搜索半径（米）
    /// - Returns: 附近位置列表
    func fetchNearbyLocations(radius: Double) async -> LocationResult<[Location]>

    /// 分享当前位置给指定的伴读设备
    /// - Parameter companionId: 伴读设备ID
    /// - Returns: 是否分享成功
    func shareLocation(with companionId: String) async -> LocationResult<Bool>
}
