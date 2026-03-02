//
//  LocationService.swift
//  TRIX3DCompanion
//
//  Location service for managing GPS location, permissions, and location sharing
//

import Foundation
import CoreLocation
import Combine

// MARK: - Location Service

/// 位置服务实现，处理GPS定位、权限管理和位置分享
@MainActor
final class LocationService: NSObject, ObservableObject, LocationServiceProtocol, CLLocationManagerDelegate {

    // MARK: - Singleton

    static let shared = LocationService()

    // MARK: - Published Properties

    /// 当前缓存的位置
    @Published private(set) var currentLocation: CLLocation?

    /// 当前授权状态
    @Published private(set) var authorizationStatus: CLAuthorizationStatus

    /// 是否正在接收位置更新
    @Published private(set) var isLocationUpdating: Bool = false

    /// 附近位置列表
    @Published private(set) var nearbyLocations: [Location] = []

    /// 最后的位置错误
    @Published private(set) var lastError: LocationError?

    /// 是否正在加载附近位置
    @Published private(set) var isLoadingNearbyLocations: Bool = false

    /// 是否正在分享位置
    @Published private(set) var isSharingLocation: Bool = false

    // MARK: - Dependencies

    private let apiClient: APIClient
    private let authService: AuthService

    // MARK: - Private Properties

    /// Core Location 管理器
    private let locationManager: CLLocationManager

    /// 位置更新超时时间（秒）
    private let locationTimeout: TimeInterval = 10.0

    /// 位置精度要求
    private let desiredAccuracy: CLLocationAccuracy = kCLLocationAccuracyBest

    /// 最小更新距离（米）
    private let distanceFilter: CLLocationDistance = 10.0

    /// 位置请求超时任务
    private var timeoutTask: Task<Void, Never>?

    /// Cancellables for Combine subscriptions
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    /// 初始化位置服务
    /// - Parameters:
    ///   - apiClient: API 客户端实例
    ///   - authService: 认证服务实例
    init(
        apiClient: APIClient = .shared,
        authService: AuthService = .shared
    ) {
        self.apiClient = apiClient
        self.authService = authService

        // 初始化位置管理器
        self.locationManager = CLLocationManager()
        self.authorizationStatus = locationManager.authorizationStatus

        super.init()

        // 配置位置管理器
        setupLocationManager()
    }

    // MARK: - Setup

    /// 配置位置管理器
    private func setupLocationManager() {
        locationManager.delegate = self
        locationManager.desiredAccuracy = desiredAccuracy
        locationManager.distanceFilter = distanceFilter
        locationManager.pausesLocationUpdatesAutomatically = true
        locationManager.allowsBackgroundLocationUpdates = false // 默认不启用后台更新

        // 检查当前授权状态
        authorizationStatus = locationManager.authorizationStatus
    }

    // MARK: - Public Methods - Permission

    /// 请求位置权限
    /// - Returns: 是否成功请求权限
    func requestPermission() -> Bool {
        // 检查当前位置服务是否启用
        guard CLLocationManager.locationServicesEnabled() else {
            let error = LocationError.locationUnavailable
            lastError = error
            return false
        }

        // 检查当前授权状态
        let status = locationManager.authorizationStatus

        switch status {
        case .notDetermined:
            // 请求"使用时"权限
            locationManager.requestWhenInUseAuthorization()
            return true

        case .restricted, .denied:
            // 权限被拒绝或受限
            let error = LocationError.permissionDenied
            lastError = error
            return false

        case .authorizedAlways, .authorizedWhenInUse:
            // 已有权限
            lastError = nil
            return true

        @unknown default:
            // 未知状态，尝试请求权限
            locationManager.requestWhenInUseAuthorization()
            return true
        }
    }

    // MARK: - Public Methods - Location Updates

    /// 获取当前位置
    /// - Returns: 当前位置，如果无法获取则返回nil
    func getCurrentLocation() -> CLLocation? {
        // 检查权限
        guard hasValidAuthorization() else {
            lastError = .permissionDenied
            return nil
        }

        // 如果有缓存的位置且不太旧（5分钟内），直接返回
        if let location = currentLocation,
           Date().timeIntervalSince(location.timestamp) < 300 {
            return location
        }

        // 请求一次性位置更新
        requestOneTimeLocation()

        return currentLocation
    }

    /// 开始持续位置更新
    func startLocationUpdates() {
        // 检查权限
        guard hasValidAuthorization() else {
            lastError = .permissionDenied
            return
        }

        // 检查位置服务是否启用
        guard CLLocationManager.locationServicesEnabled() else {
            lastError = .locationUnavailable
            return
        }

        // 开始更新
        locationManager.startUpdatingLocation()
        isLocationUpdating = true
        lastError = nil
    }

    /// 停止位置更新
    func stopLocationUpdates() {
        locationManager.stopUpdatingLocation()
        isLocationUpdating = false
        cancelTimeoutTask()
    }

    // MARK: - Public Methods - API Operations

    /// 获取指定半径内的附近位置
    /// - Parameter radius: 搜索半径（米）
    /// - Returns: 附近位置列表
    func fetchNearbyLocations(radius: Double) async -> LocationResult<[Location]> {
        // 验证认证状态
        guard authService.isLoggedIn else {
            let error = LocationError.networkError(NSError(domain: "Auth", code: -1))
            lastError = error
            return .failure(error)
        }

        // 获取当前位置
        guard let location = getCurrentLocation() else {
            let error = lastError ?? .locationUnavailable
            return .failure(error)
        }

        // 验证坐标有效性
        guard isValidCoordinate(latitude: location.coordinate.latitude,
                               longitude: location.coordinate.longitude) else {
            let error = LocationError.invalidCoordinates
            lastError = error
            return .failure(error)
        }

        isLoadingNearbyLocations = true
        lastError = nil

        do {
            let locations = try await apiClient.getNearbyLocations(radius: radius)
            nearbyLocations = locations
            isLoadingNearbyLocations = false

            return .success(locations)

        } catch let error as NetworkError {
            isLoadingNearbyLocations = false
            let locationError = mapNetworkError(error)
            lastError = locationError
            return .failure(locationError)

        } catch {
            isLoadingNearbyLocations = false
            let locationError = LocationError.networkError(error)
            lastError = locationError
            return .failure(locationError)
        }
    }

    /// 分享当前位置给指定的伴读设备
    /// - Parameter companionId: 伴读设备ID
    /// - Returns: 是否分享成功
    func shareLocation(with companionId: String) async -> LocationResult<Bool> {
        // 验证认证状态
        guard authService.isLoggedIn else {
            let error = LocationError.networkError(NSError(domain: "Auth", code: -1))
            lastError = error
            return .failure(error)
        }

        // 验证伴读设备ID
        guard !companionId.isEmpty else {
            let error = LocationError.networkError(NSError(domain: "Validation", code: -1))
            lastError = error
            return .failure(error)
        }

        // 获取当前位置
        guard let location = getCurrentLocation() else {
            let error = lastError ?? .locationUnavailable
            return .failure(error)
        }

        // 验证坐标有效性
        guard isValidCoordinate(latitude: location.coordinate.latitude,
                               longitude: location.coordinate.longitude) else {
            let error = LocationError.invalidCoordinates
            lastError = error
            return .failure(error)
        }

        isSharingLocation = true
        lastError = nil

        do {
            // 创建分享请求
            let request = ShareLocationRequest(
                companionId: companionId,
                latitude: location.coordinate.latitude,
                longitude: location.coordinate.longitude,
                timestamp: Date()
            )

            // 调用API
            let response = try await apiClient.shareLocation(request)

            isSharingLocation = false

            if response.success {
                return .success(true)
            } else {
                let error = LocationError.networkError(NSError(domain: "API", code: -1))
                lastError = error
                return .failure(error)
            }

        } catch let error as NetworkError {
            isSharingLocation = false
            let locationError = mapNetworkError(error)
            lastError = locationError
            return .failure(locationError)

        } catch {
            isSharingLocation = false
            let locationError = LocationError.networkError(error)
            lastError = locationError
            return .failure(locationError)
        }
    }

    // MARK: - CLLocationManagerDelegate

    /// 位置更新回调
    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        Task { @MainActor in
            guard let location = locations.last else { return }

            // 验证位置准确性
            guard location.horizontalAccuracy >= 0 else { return }

            // 更新当前位置
            currentLocation = location
            lastError = nil

            // 如果是一次性请求，停止更新
            if !isLocationUpdating {
                manager.stopUpdatingLocation()
            }

            // 取消超时任务
            cancelTimeoutTask()
        }
    }

    /// 位置更新失败回调
    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in
            // 处理错误
            let locationError: LocationError

            if let clError = error as? CLError {
                switch clError.code {
                case .denied:
                    locationError = .permissionDenied
                case .locationUnknown, .network:
                    locationError = .locationUnavailable
                @unknown default:
                    locationError = .locationUnavailable
                }
            } else {
                locationError = .networkError(error)
            }

            lastError = locationError

            // 停止更新
            stopLocationUpdates()
        }
    }

    /// 授权状态变化回调
    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in
            authorizationStatus = manager.authorizationStatus

            // 根据新的授权状态采取行动
            switch manager.authorizationStatus {
            case .authorizedWhenInUse, .authorizedAlways:
                // 权限授予，清除错误
                lastError = nil

            case .denied, .restricted:
                // 权限拒绝，停止位置更新
                stopLocationUpdates()
                lastError = .permissionDenied

            case .notDetermined:
                // 尚未决定，不做任何操作
                break

            @unknown default:
                break
            }
        }
    }

    // MARK: - Private Methods

    /// 检查是否有有效的授权
    /// - Returns: 是否有授权
    private func hasValidAuthorization() -> Bool {
        let status = locationManager.authorizationStatus
        return status == .authorizedWhenInUse || status == .authorizedAlways
    }

    /// 请求一次性位置更新
    private func requestOneTimeLocation() {
        guard hasValidAuthorization() else {
            lastError = .permissionDenied
            return
        }

        // 请求位置
        locationManager.requestLocation()

        // 设置超时
        startTimeout()
    }

    /// 启动超时任务
    private func startTimeout() {
        cancelTimeoutTask()

        timeoutTask = Task {
            try? await Task.sleep(nanoseconds: UInt64(locationTimeout * 1_000_000_000))

            if !Task.isCancelled {
                await MainActor.run {
                    if currentLocation == nil {
                        self.lastError = .timeout
                        self.locationManager.stopUpdatingLocation()
                    }
                }
            }
        }
    }

    /// 取消超时任务
    private func cancelTimeoutTask() {
        timeoutTask?.cancel()
        timeoutTask = nil
    }

    /// 验证坐标有效性
    /// - Parameters:
    ///   - latitude: 纬度
    ///   - longitude: 经度
    /// - Returns: 是否有效
    private func isValidCoordinate(latitude: Double, longitude: Double) -> Bool {
        // 检查纬度范围：-90 到 90
        guard latitude >= -90 && latitude <= 90 else { return false }

        // 检查经度范围：-180 到 180
        guard longitude >= -180 && longitude <= 180 else { return false }

        // 检查是否为零点（无效位置）
        guard latitude != 0 || longitude != 0 else { return false }

        return true
    }

    /// 将网络错误映射到位置错误
    /// - Parameter error: 网络错误
    /// - Returns: 位置错误
    private func mapNetworkError(_ error: NetworkError) -> LocationError {
        switch error {
        case .noConnection, .timeout:
            return .networkError(error)
        case .unauthorized:
            return .networkError(error)
        default:
            return .networkError(error)
        }
    }
}

// MARK: - Convenience Extensions

extension LocationService {

    /// 清除位置缓存
    func clearLocationCache() {
        currentLocation = nil
        nearbyLocations = []
        lastError = nil
    }

    /// 清除错误状态
    func clearError() {
        lastError = nil
    }

    /// 获取位置描述字符串
    /// - Returns: 位置描述
    var locationDescription: String? {
        guard let location = currentLocation else { return nil }

        let lat = String(format: "%.6f", location.coordinate.latitude)
        let lon = String(format: "%.6f", location.coordinate.longitude)
        let acc = String(format: "%.1f", location.horizontalAccuracy)

        return "纬度: \(lat), 经度: \(lon), 精度: \(acc)米"
    }

    /// 检查位置权限状态
    /// - Returns: 权限状态描述
    var authorizationStatusDescription: String {
        switch authorizationStatus {
        case .notDetermined:
            return "未决定"
        case .restricted:
            return "受限"
        case .denied:
            return "已拒绝"
        case .authorizedAlways:
            return "始终允许"
        case .authorizedWhenInUse:
            return "使用时允许"
        @unknown default:
            return "未知"
        }
    }
}

// MARK: - AsyncStream Support (iOS 16+)

#if swift(>=5.9)
extension LocationService {

    /// 观察位置更新作为 AsyncStream
    var locationStream: AsyncStream<CLLocation?> {
        AsyncStream { continuation in
            // 发送初始状态
            continuation.yield(currentLocation)

            // 观察变化
            $currentLocation
                .dropFirst()
                .sink { location in
                    continuation.yield(location)
                }
                .store(in: &cancellables)

            continuation.onTermination = { _ in
                // 清理由 cancellables 处理
            }
        }
    }

    /// 观察授权状态变化作为 AsyncStream
    var authorizationStatusStream: AsyncStream<CLAuthorizationStatus> {
        AsyncStream { continuation in
            // 发送初始状态
            continuation.yield(authorizationStatus)

            // 观察变化
            $authorizationStatus
                .dropFirst()
                .sink { status in
                    continuation.yield(status)
                }
                .store(in: &cancellables)

            continuation.onTermination = { _ in
                // 清理由 cancellables 处理
            }
        }
    }
}
#endif
