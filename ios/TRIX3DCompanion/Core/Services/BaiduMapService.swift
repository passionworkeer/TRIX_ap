//
//  BaiduMapService.swift
//  TRIX3DCompanion
//
//  百度地图服务 - 提供 POI 搜索、定位、导航等功能
//

import Foundation
import UIKit
import CoreLocation

// MARK: - Baidu Map Configuration

/// 百度地图配置
enum BaiduMapConfig {
    /// API Key - 从 Info.plist 或环境变量读取
    static var apiKey: String {
        if let key = Bundle.main.object(forInfoDictionaryKey: "BAIDU_MAP_AK") as? String,
           !key.isEmpty,
           key != "YOUR_BAIDU_MAP_AK" {
            return key
        }
        if let key = ProcessInfo.processInfo.environment["BAIDU_MAP_AK"],
           !key.isEmpty {
            return key
        }
        return ""
    }

    /// 是否已配置
    static var isConfigured: Bool {
        !apiKey.isEmpty && apiKey != "YOUR_BAIDU_MAP_AK"
    }
}

// MARK: - POI Search Result

/// POI 搜索结果
struct BaiduPOI: Identifiable, Codable {
    let id: String
    let name: String
    let address: String
    let latitude: Double
    let longitude: Double
    let province: String?
    let city: String?
    let district: String?
    let street: String?
    let telephone: String?
    let distance: Double?
    let type: String?

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    /// 转换为 Location 模型
    func toLocation(category: LocationCategory = .other) -> Location {
        Location(
            id: id,
            userId: "baidu",
            name: name,
            description: nil,
            latitude: latitude,
            longitude: longitude,
            address: address,
            category: category,
            createdAt: Date(),
            updatedAt: Date()
        )
    }
}

// MARK: - Search Type

/// POI 搜索类型
enum POISearchType: String, CaseIterable {
    case keyword = "关键词搜索"
    case nearby = "周边搜索"
    case city = "城市内搜索"
    case detail = "详情检索"

    var baiduType: String {
        switch self {
        case .keyword: return "区域检索"
        case .nearby: return "周边检索"
        case .city: return "城市检索"
        case .detail: return "详情检索"
        }
    }
}

// MARK: - POI Category

/// POI 分类
enum BaiduPOICategory: String, CaseIterable {
    case all = "全部"
    case school = "学校"
    case library = "图书馆"
    case cafe = "美食"
    case hotel = "酒店"
    case cinema = "电影院"
    case gym = "运动"
    case park = "公园"

    var keywords: [String] {
        switch self {
        case .all: return []
        case .school: return ["学校", "大学", "学院"]
        case .library: return ["图书馆", "自习室"]
        case .cafe: return ["咖啡", "奶茶", "餐厅"]
        case .hotel: return ["酒店", "宾馆"]
        case .cinema: return ["电影院", "影院"]
        case .gym: return ["健身房", "运动"]
        case .park: return ["公园", "景区"]
        }
    }

    var locationCategory: LocationCategory {
        switch self {
        case .all: return .other
        case .school: return .school
        case .library: return .library
        case .cafe, .hotel, .cinema: return .restaurant
        case .gym: return .other
        case .park: return .park
        }
    }
}

// MARK: - Baidu Geocoding Result

/// 地理编码结果
struct BaiduGeocodingResult {
    let latitude: Double
    let longitude: Double
    let address: String
    let province: String?
    let city: String?
    let district: String?
}

// MARK: - Navigation Route

/// 导航路线结果
struct BaiduRoute {
    let distance: Double  // 米
    let duration: Int     // 秒
    let steps: [RouteStep]

    var formattedDistance: String {
        if distance >= 1000 {
            return String(format: "%.1f km", distance / 1000)
        }
        return "\(Int(distance)) m"
    }

    var formattedDuration: String {
        if duration >= 3600 {
            let hours = duration / 3600
            let minutes = (duration % 3600) / 60
            return "\(hours)小时\(minutes)分钟"
        } else if duration >= 60 {
            return "\(duration / 60)分钟"
        }
        return "\(duration)秒"
    }
}

/// 路线步骤
struct RouteStep {
    let instruction: String
    let distance: Double
    let duration: Int
}

// MARK: - Service Protocol

/// 百度地图服务协议
protocol BaiduMapServiceProtocol: AnyObject {
    /// 是否可用
    var isAvailable: Bool { get }

    /// 初始化服务
    func initialize(completion: @escaping (Bool) -> Void)

    /// 获取当前定位
    func getCurrentLocation(completion: @escaping (CLLocation?) -> Void)

    /// POI 关键词搜索
    func searchPOI(keyword: String, city: String?, completion: @escaping ([BaiduPOI]) -> Void)

    /// POI 周边搜索
    func searchNearby(latitude: Double, longitude: Double, radius: Int, keyword: String?, completion: @escaping ([BaiduPOI]) -> Void)

    /// 地理编码 (地址 → 坐标)
    func geocode(address: String, city: String?, completion: @escaping (BaiduGeocodingResult?) -> Void)

    /// 反地理编码 (坐标 → 地址)
    func reverseGeocode(latitude: Double, longitude: Double, completion: @escaping (BaiduGeocodingResult?) -> Void)

    /// 路线规划
    func routePlan(from: CLLocationCoordinate2D, to: CLLocationCoordinate2D, completion: @escaping (BaiduRoute?) -> Void)

    /// 打开百度地图导航
    func openNavigation(toLatitude: Double, toLongitude: Double, toName: String, fromLatitude: Double?, fromLongitude: Double?)
}

// MARK: - Default Implementation

/// 百度地图服务默认实现
/// 注意：需要安装 BaiduMapKit CocoaPods 并配置 API Key
final class BaiduMapService: NSObject, BaiduMapServiceProtocol {

    // MARK: - Singleton

    static let shared = BaiduMapService()

    // MARK: - Properties

    var isAvailable: Bool {
        return BaiduMapConfig.isConfigured
    }

    private var isInitialized = false
    private var locationManager: CLLocationManager?
    private var currentLocation: CLLocation?

    // MARK: - Initialization

    private override init() {
        super.init()
        setupLocationManager()
    }

    private func setupLocationManager() {
        locationManager = CLLocationManager()
        locationManager?.delegate = self
        locationManager?.desiredAccuracy = kCLLocationAccuracyBest
        locationManager?.distanceFilter = 10
    }

    // MARK: - Public Methods

    func initialize(completion: @escaping (Bool) -> Void) {
        guard isAvailable else {
            SecureLogger.shared.warning("BaiduMapService: Not configured - API Key missing")
            completion(false)
            return
        }

        if isInitialized {
            completion(true)
            return
        }

        // 初始化百度地图
        // BMKMapManager 类来自 BaiduMapKit pod
        // 由于是纯 Swift 环境，这里使用模拟实现
        // 实际使用时需要导入: import BaiduMapKit

        SecureLogger.shared.info("BaiduMapService: Initialized with API Key")
        isInitialized = true
        completion(true)
    }

    func getCurrentLocation(completion: @escaping (CLLocation?) -> Void) {
        if let location = currentLocation {
            completion(location)
            return
        }

        // 请求定位权限
        locationManager?.requestWhenInUseAuthorization()
        locationManager?.startUpdatingLocation()

        // 延迟获取
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
            completion(self?.currentLocation)
        }
    }

    func searchPOI(keyword: String, city: String?, completion: @escaping ([BaiduPOI]) -> Void) {
        guard isAvailable else {
            SecureLogger.shared.warning("BaiduMapService: Search failed - not configured")
            completion([])
            return
        }

        // 实际实现需要使用 BMKSearch
        // 这里提供 API 接口说明：

        /*
         // 1. 创建搜索实例
         let search = BMKSearch()

         // 2. 设置回调
         search.delegate = self

         // 3. 执行搜索
         search.poiSearchInCity(city ?? "全国", withKey: keyword, pageIndex: 0, pageSize: 20)

         // 4. 实现 BMKSearchDelegate 回调
         func onGetPoiResult(_ searcher: BMKSearch!, result: BMKPoiResult!, errorCode: BMKSearchErrorCode) {
             if errorCode == BMK_SEARCH_NO_ERROR {
                 // 处理结果
                 let pois = result.poiList.map { poi -> BaiduPOI in
                     BaiduPOI(
                         id: poi.uid,
                         name: poi.name,
                         address: poi.address,
                         latitude: poi.pt.lat,
                         longitude: poi.pt.lon,
                         province: poi.province,
                         city: poi.city,
                         district: poi.district,
                         street: poi.streetName,
                         telephone: poi.phone,
                         distance: poi.naviDistance.map { Double($0) },
                         type: poi.ePoiType
                     )
                 }
                 completion(pois)
             } else {
                 completion([])
             }
         }
         */

        // 临时返回空结果，等待接入真实 SDK
        SecureLogger.shared.debug("BaiduMapService: POI search for '\(keyword)'")
        completion([])
    }

    func searchNearby(latitude: Double, longitude: Double, radius: Int, keyword: String?, completion: @escaping ([BaiduPOI]) -> Void) {
        guard isAvailable else {
            completion([])
            return
        }

        /*
         let search = BMKSearch()
         search.delegate = self
         search.poiSearchNear(by: keyword ?? "", withCenter: CLLocationCoordinate2D(latitude: latitude, longitude: longitude), radius: radius, pageIndex: 0, pageSize: 20)
         */

        SecureLogger.shared.debug("BaiduMapService: Nearby search at (\(latitude), \(longitude)) radius \(radius)m")
        completion([])
    }

    func geocode(address: String, city: String?, completion: @escaping (BaiduGeocodingResult?) -> Void) {
        guard isAvailable else {
            completion(nil)
            return
        }

        /*
         let search = BMKSearch()
         search.delegate = self
         search.geocodeSearch(with: address, city: city ?? "")
         */

        SecureLogger.shared.debug("BaiduMapService: Geocode for '\(address)'")
        completion(nil)
    }

    func reverseGeocode(latitude: Double, longitude: Double, completion: @escaping (BaiduGeocodingResult?) -> Void) {
        guard isAvailable else {
            completion(nil)
            return
        }

        /*
         let search = BMKSearch()
         search.delegate = self
         search.reverseGeocode(with: CLLocationCoordinate2D(latitude: latitude, longitude: longitude))
         */

        SecureLogger.shared.debug("BaiduMapService: Reverse geocode at (\(latitude), \(longitude))")
        completion(nil)
    }

    func routePlan(from: CLLocationCoordinate2D, to: CLLocationCoordinate2D, completion: @escaping (BaiduRoute?) -> Void) {
        guard isAvailable else {
            completion(nil)
            return
        }

        /*
         let routeSearch = BMKRouteSearch()
         routeSearch.delegate = self

         let start = BMKPlanNode()
         start.pt = from
         start.name = "起点"

         let end = BMKPlanNode()
         end.pt = to
         end.name = "终点"

         let drivingRouteSearchOption = BMKDrivingRouteSearchOption()
         drivingRouteSearchOption.from = start
         drivingRouteSearchOption.to = end

         routeSearch.drivingSearch(drivingRouteSearchOption)
         */

        SecureLogger.shared.debug("BaiduMapService: Route plan from (\(from.latitude),\(from.longitude)) to (\(to.latitude),\(to.longitude))")
        completion(nil)
    }

    func openNavigation(toLatitude: Double, toLongitude: Double, toName: String, fromLatitude: Double?, fromLongitude: Double?) {
        // 使用 URL Scheme 打开百度地图 App
        var urlString = "baidumap://map/direction?destination=name:\(toName)|latlng:\(toLatitude),\(toLongitude)&coord_type=gcj02&mode=driving"

        if let fromLat = fromLatitude, let fromLng = fromLongitude {
            urlString += "&origin=name:我的位置|latlng:\(fromLat),\(fromLng)"
        }

        if let url = URL(string: urlString.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "") {
            if UIApplication.shared.canOpenURL(url) {
                UIApplication.shared.open(url)
            } else {
                // 百度地图未安装，使用网页版
                let webUrl = "https://api.map.baidu.com/direction?destination=\(toLatitude),\(toLongitude)&mode=driving&output=html"
                if let webURL = URL(string: webUrl) {
                    UIApplication.shared.open(webURL)
                }
            }
        }
    }
}

// MARK: - CLLocationManagerDelegate

extension BaiduMapService: CLLocationManagerDelegate {
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        currentLocation = locations.last
        locationManager?.stopUpdatingLocation()
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        SecureLogger.shared.error("BaiduMapService: Location failed - \(error.localizedDescription)")
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        switch manager.authorizationStatus {
        case .authorizedWhenInUse, .authorizedAlways:
            manager.startUpdatingLocation()
        default:
            break
        }
    }
}

// MARK: - Mock Data for Development

extension BaiduMapService {

    /// 生成模拟 POI 数据用于开发测试
    static func mockSearchResults(keyword: String, city: String = "上海") -> [BaiduPOI] {
        let baseLatitude = 31.2304
        let baseLongitude = 121.4737

        let results: [(String, String, Double, Double)] = [
            ("\(keyword)自习室", "浦东新区陆家嘴", 31.2344, 121.4787),
            ("\(keyword)咖啡馆", "静安区南京西路", 31.2284, 121.4637),
            ("\(keyword)图书馆", "黄浦区人民广场", 31.2254, 121.4737),
            ("\(keyword)餐厅", "徐汇区淮海中路", 31.2184, 121.4537),
            ("\(keyword)健身房", "长宁区中山公园", 31.2204, 121.4237)
        ]

        return results.enumerated().map { index, data in
            BaiduPOI(
                id: "mock-\(index)",
                name: data.0,
                address: data.1,
                latitude: data.2,
                longitude: data.3,
                province: "上海市",
                city: city,
                district: nil,
                street: nil,
                telephone: nil,
                distance: nil,
                type: keyword
            )
        }
    }
}
