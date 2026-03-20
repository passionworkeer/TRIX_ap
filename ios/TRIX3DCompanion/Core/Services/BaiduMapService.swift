//
//  BaiduMapService.swift
//  TRIX3DCompanion
//
//  Baidu Map Service - POI search, geocoding, routing with real BaiduMapKit SDK
//

import Foundation
import UIKit
import CoreLocation
import BaiduMapAPI_Base
import BaiduMapAPI_Search

// MARK: - Baidu Map Configuration

/// Baidu Map configuration
enum BaiduMapConfig {
    /// API Key from Info.plist or environment variable
    /// MUST be configured in Info.plist with key "BAIDU_MAP_AK"
    static var apiKey: String? {
        if let key = Bundle.main.object(forInfoDictionaryKey: "BAIDU_MAP_AK") as? String,
           !key.isEmpty,
           key != "YOUR_BAIDU_MAP_AK" {
            return key
        }
        if let key = ProcessInfo.processInfo.environment["BAIDU_MAP_AK"],
           !key.isEmpty {
            return key
        }
        return nil
    }

    /// Whether the service is configured
    static var isConfigured: Bool {
        apiKey != nil
    }
}

// MARK: - POI Search Result

/// POI search result
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

    /// Convert to Location model
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

/// POI search type
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

/// POI category
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

// MARK: - Geocoding Result

/// Geocoding result
struct BaiduGeocodingResult {
    let latitude: Double
    let longitude: Double
    let address: String?
    let province: String?
    let city: String?
    let district: String?
}

// MARK: - Navigation Route

/// Navigation route result
struct BaiduRoute {
    let distance: Double  // meters
    let duration: Int     // seconds
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

/// Route step
struct RouteStep {
    let instruction: String
    let distance: Double
    let duration: Int
}

// MARK: - Service Protocol

/// Baidu Map service protocol
protocol BaiduMapServiceProtocol: AnyObject {
    /// Whether the service is available
    var isAvailable: Bool { get }

    /// Initialize the service
    func initialize(completion: @escaping (Bool) -> Void)

    /// Get current location
    func getCurrentLocation(completion: @escaping (CLLocation?) -> Void)

    /// POI keyword search
    func searchPOI(keyword: String, city: String?, completion: @escaping ([BaiduPOI]) -> Void)

    /// POI nearby search
    func searchNearby(latitude: Double, longitude: Double, radius: Int, keyword: String?, completion: @escaping ([BaiduPOI]) -> Void)

    /// Geocoding (address -> coordinate)
    func geocode(address: String, city: String?, completion: @escaping (BaiduGeocodingResult?) -> Void)

    /// Reverse geocoding (coordinate -> address)
    func reverseGeocode(latitude: Double, longitude: Double, completion: @escaping (BaiduGeocodingResult?) -> Void)

    /// Route planning
    func routePlan(from: CLLocationCoordinate2D, to: CLLocationCoordinate2D, completion: @escaping (BaiduRoute?) -> Void)

    /// Open Baidu Map navigation
    func openNavigation(toLatitude: Double, toLongitude: Double, toName: String, fromLatitude: Double?, fromLongitude: Double?)
}

// MARK: - Baidu Map Service Implementation

/// Baidu Map service implementation using BaiduMapKit SDK (v6.x API)
final class BaiduMapService: NSObject, BaiduMapServiceProtocol, BMKGeneralDelegate {

    // MARK: - Singleton

    static let shared = BaiduMapService()

    // MARK: - Properties

    var isAvailable: Bool {
        return BaiduMapConfig.isConfigured && isInitialized
    }

    private var isInitialized = false
    private var locationManager: CLLocationManager?
    private var currentLocation: CLLocation?

    /// BMKMapManager instance
    private let mapManager = BMKMapManager()

    /// BMKPoiSearch instance for POI search (BaiduMapKit 6.x API)
    private var poiSearch: BMKPoiSearch?

    /// BMKGeoCodeSearch instance for geocoding (BaiduMapKit 6.x API)
    private var geoSearch: BMKGeoCodeSearch?

    /// BMKRouteSearch instance for routing
    private var routeSearch: BMKRouteSearch?

    /// Search completion handlers
    private var poiSearchCompletion: (([BaiduPOI]) -> Void)?
    private var geocodeCompletion: ((BaiduGeocodingResult?) -> Void)?
    private var reverseGeocodeCompletion: ((BaiduGeocodingResult?) -> Void)?
    private var routePlanCompletion: ((BaiduRoute?) -> Void)?

    /// Pending search results for fallback
    private var lastPOISearchResults: [BaiduPOI] = []
    private var lastGeocodeResult: BaiduGeocodingResult?
    private var lastRouteResult: BaiduRoute?

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
        guard BaiduMapConfig.isConfigured else {
            SecureLogger.shared.warning("BaiduMapService: Not configured - API Key missing")
            completion(false)
            return
        }

        if isInitialized {
            completion(true)
            return
        }

        // Start Baidu Map Manager (BaiduMapKit 6.x API)
        let ret = mapManager.start(BaiduMapConfig.apiKey, generalDelegate: self)
        if ret {
            isInitialized = true
            // Initialize search instances (BaiduMapKit 6.x API)
            poiSearch = BMKPoiSearch()
            poiSearch?.delegate = self

            geoSearch = BMKGeoCodeSearch()
            geoSearch?.delegate = self

            routeSearch = BMKRouteSearch()
            routeSearch?.delegate = self

            SecureLogger.shared.info("BaiduMapService: Initialized successfully with API Key")
            completion(true)
        } else {
            SecureLogger.shared.error("BaiduMapService: Failed to initialize BMKMapManager")
            completion(false)
        }
    }

    func getCurrentLocation(completion: @escaping (CLLocation?) -> Void) {
        if let location = currentLocation {
            completion(location)
            return
        }

        // Request location permission
        locationManager?.requestWhenInUseAuthorization()
        locationManager?.startUpdatingLocation()

        // Delay to get location
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
            completion(self?.currentLocation)
        }
    }

    func searchPOI(keyword: String, city: String?, completion: @escaping ([BaiduPOI]) -> Void) {
        guard isAvailable, let poiSearch = poiSearch else {
            SecureLogger.shared.warning("BaiduMapService: Search failed - not available")
            // Fallback to mock data
            let mockResults = BaiduMapService.mockSearchResults(keyword: keyword, city: city ?? "上海")
            completion(mockResults)
            return
        }

        poiSearchCompletion = completion

        // Search in city (BaiduMapKit 6.x API)
        let option = BMKPOICitySearchOption()
        option.keyword = keyword
        option.city = city ?? "全国"
        option.pageIndex = 0
        option.pageSize = 20

        let ret = poiSearch.poiSearch(inCity: option)

        if !ret {
            SecureLogger.shared.warning("BaiduMapService: POI search request failed")
            // Fallback to mock data
            let mockResults = BaiduMapService.mockSearchResults(keyword: keyword, city: city ?? "上海")
            completion(mockResults)
        }
    }

    func searchNearby(latitude: Double, longitude: Double, radius: Int, keyword: String?, completion: @escaping ([BaiduPOI]) -> Void) {
        guard isAvailable, let poiSearch = poiSearch else {
            SecureLogger.shared.warning("BaiduMapService: Nearby search failed - not available")
            // Fallback to mock data
            let mockResults = BaiduMapService.mockSearchResults(keyword: keyword ?? "附近", city: "上海")
            completion(mockResults)
            return
        }

        poiSearchCompletion = completion

        // Nearby search (BaiduMapKit 6.x API)
        let option = BMKPOINearbySearchOption()
        option.keywords = keyword.map { [$0] } ?? []
        option.location = CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
        option.radius = radius
        option.pageIndex = 0
        option.pageSize = 20

        let ret = poiSearch.poiSearchNear(by: option)

        if !ret {
            SecureLogger.shared.warning("BaiduMapService: Nearby search request failed")
            // Fallback to mock data
            let mockResults = BaiduMapService.mockSearchResults(keyword: keyword ?? "附近", city: "上海")
            completion(mockResults)
        }
    }

    func geocode(address: String, city: String?, completion: @escaping (BaiduGeocodingResult?) -> Void) {
        guard isAvailable, let geoSearch = geoSearch else {
            SecureLogger.shared.warning("BaiduMapService: Geocode failed - not available")
            completion(nil)
            return
        }

        geocodeCompletion = completion

        // Geocoding (BaiduMapKit 6.x API)
        let option = BMKGeoCodeSearchOption()
        option.address = address
        option.city = city ?? ""

        let ret = geoSearch.geoCode(option)

        if !ret {
            SecureLogger.shared.warning("BaiduMapService: Geocode request failed")
            completion(nil)
        }
    }

    func reverseGeocode(latitude: Double, longitude: Double, completion: @escaping (BaiduGeocodingResult?) -> Void) {
        guard isAvailable, let geoSearch = geoSearch else {
            SecureLogger.shared.warning("BaiduMapService: Reverse geocode failed - not available")
            completion(nil)
            return
        }

        reverseGeocodeCompletion = completion

        // Reverse geocoding (BaiduMapKit 6.x API)
        let option = BMKReverseGeoCodeSearchOption()
        option.location = CLLocationCoordinate2D(latitude: latitude, longitude: longitude)

        let ret = geoSearch.reverseGeoCode(option)

        if !ret {
            SecureLogger.shared.warning("BaiduMapService: Reverse geocode request failed")
            completion(nil)
        }
    }

    func routePlan(from: CLLocationCoordinate2D, to: CLLocationCoordinate2D, completion: @escaping (BaiduRoute?) -> Void) {
        guard isAvailable, let routeSearch = routeSearch else {
            SecureLogger.shared.warning("BaiduMapService: Route plan failed - not available")
            completion(nil)
            return
        }

        routePlanCompletion = completion

        // Create start and end nodes
        let startNode = BMKPlanNode()
        startNode.pt = from
        startNode.name = "起点"

        let endNode = BMKPlanNode()
        endNode.pt = to
        endNode.name = "终点"

        // Create driving route option
        let drivingRoutePlanOption = BMKDrivingRoutePlanOption()
        drivingRoutePlanOption.from = startNode
        drivingRoutePlanOption.to = endNode

        let ret = routeSearch.drivingSearch(drivingRoutePlanOption)

        if !ret {
            SecureLogger.shared.warning("BaiduMapService: Route plan request failed")
            completion(nil)
        }
    }

    func openNavigation(toLatitude: Double, toLongitude: Double, toName: String, fromLatitude: Double?, fromLongitude: Double?) {
        // Use URL Scheme to open Baidu Map App
        var urlString = "baidumap://map/direction?destination=name:\(toName)|latlng:\(toLatitude),\(toLongitude)&coord_type=gcj02&mode=driving"

        if let fromLat = fromLatitude, let fromLng = fromLongitude {
            urlString += "&origin=name:我的位置|latlng:\(fromLat),\(fromLng)"
        }

        if let url = URL(string: urlString.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "") {
            if UIApplication.shared.canOpenURL(url) {
                UIApplication.shared.open(url)
            } else {
                // Baidu Map not installed, use web version
                let webUrl = "https://api.map.baidu.com/direction?destination=\(toLatitude),\(toLongitude)&mode=driving&output=html"
                if let webURL = URL(string: webUrl) {
                    UIApplication.shared.open(webURL)
                }
            }
        }
    }

    // MARK: - Private Methods

    /// Handle POI search results (BaiduMapKit 6.x: BMKPOISearchResult with poiInfoList)
    private func handlePOISearchResults(_ result: BMKPOISearchResult?, errorCode: BMKSearchErrorCode) {
        guard let completion = poiSearchCompletion else { return }

        if errorCode == BMK_SEARCH_NO_ERROR, let result = result, let poiList = result.poiInfoList {
            let pois = poiList.enumerated().map { index, poi -> BaiduPOI in
                BaiduPOI(
                    id: poi.uid,
                    name: poi.name,
                    address: poi.address,
                    latitude: poi.pt.latitude,
                    longitude: poi.pt.longitude,
                    province: poi.province,
                    city: poi.city,
                    district: poi.area ?? "",
                    street: poi.streetID,
                    telephone: poi.phone,
                    distance: poi.distance > 0 ? Double(poi.distance) : nil,
                    type: poi.tag
                )
            }
            lastPOISearchResults = pois
            completion(pois)
        } else {
            SecureLogger.shared.warning("BaiduMapService: POI search error - \(errorCode.rawValue)")
            // Fallback to mock data
            let mockResults = BaiduMapService.mockSearchResults(keyword: "附近", city: "上海")
            completion(mockResults)
        }

        poiSearchCompletion = nil
    }

    /// Handle geocode results (BaiduMapKit 6.x: BMKGeoCodeSearchResult)
    private func handleGeocodeResults(_ result: BMKGeoCodeSearchResult?, error: BMKSearchErrorCode) {
        guard let completion = geocodeCompletion else { return }

        if error == BMK_SEARCH_NO_ERROR, let result = result {
            let geocodeResult = BaiduGeocodingResult(
                latitude: result.location.latitude,
                longitude: result.location.longitude,
                address: nil,
                province: nil,
                city: nil,
                district: nil
            )
            lastGeocodeResult = geocodeResult
            completion(geocodeResult)
        } else {
            SecureLogger.shared.warning("BaiduMapService: Geocode error - \(error.rawValue)")
            completion(nil)
        }

        geocodeCompletion = nil
    }

    /// Handle reverse geocode results (BaiduMapKit 6.x: BMKReverseGeoCodeSearchResult)
    private func handleReverseGeocodeResults(_ result: BMKReverseGeoCodeSearchResult?, error: BMKSearchErrorCode) {
        guard let completion = reverseGeocodeCompletion else { return }

        if error == BMK_SEARCH_NO_ERROR, let result = result {
            let geocodeResult = BaiduGeocodingResult(
                latitude: result.location.latitude,
                longitude: result.location.longitude,
                address: result.address,
                province: result.addressDetail?.province,
                city: result.addressDetail?.city,
                district: result.addressDetail?.district
            )
            lastGeocodeResult = geocodeResult
            completion(geocodeResult)
        } else {
            SecureLogger.shared.warning("BaiduMapService: Reverse geocode error - \(error.rawValue)")
            completion(nil)
        }

        reverseGeocodeCompletion = nil
    }

    /// Compute total duration in seconds from BMKTime object
    private func computeDurationSeconds(_ time: BMKTime?) -> Int {
        guard let t = time else { return 0 }
        let days = Int(t.dates) * 86400
        let hours = Int(t.hours) * 3600
        let minutes = Int(t.minutes) * 60
        let seconds = Int(t.seconds)
        return days + hours + minutes + seconds
    }

    /// Handle route plan results (BaiduMapKit 6.x: BMKDrivingRouteResult)
    private func handleRoutePlanResults(_ result: BMKDrivingRouteResult?, errorCode: BMKSearchErrorCode) {
        guard let completion = routePlanCompletion else { return }

        if errorCode == BMK_SEARCH_NO_ERROR, let result = result {
            // Get the first route (most optimal)
            if let route = result.routes.first as? BMKDrivingRouteLine {
                var steps: [RouteStep] = []

                // Extract steps from route (BaiduMapKit 6.x: steps is NSArray of BMKDrivingRouteStep)
                for case let step as BMKDrivingStep in route.steps {
                    let stepInfo = RouteStep(
                        instruction: step.instruction ?? "",
                        distance: Double(step.distance),
                        duration: Int(step.duration)
                    )
                    steps.append(stepInfo)
                }

                let routeResult = BaiduRoute(
                    distance: Double(route.distance),
                    duration: computeDurationSeconds(route.duration),
                    steps: steps
                )
                lastRouteResult = routeResult
                completion(routeResult)
            } else {
                completion(nil)
            }
        } else {
            SecureLogger.shared.warning("BaiduMapService: Route plan error - \(errorCode.rawValue)")
            completion(nil)
        }

        routePlanCompletion = nil
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

// MARK: - BMKGeneralDelegate methods

extension BaiduMapService {
    func onGetNetworkState(_ iError: Int32) {
        if iError != 0 {
            SecureLogger.shared.error("BaiduMapService: Network error - \(iError)")
        }
    }

    func onGetPermissionState(_ iError: Int32) {
        if iError != 0 {
            SecureLogger.shared.error("BaiduMapService: Permission error - \(iError)")
        }
    }
}

// MARK: - BMKPoiSearchDelegate

extension BaiduMapService: BMKPoiSearchDelegate {
    func onGetPoiResult(_ searcher: BMKPoiSearch, result: BMKPOISearchResult, errorCode: BMKSearchErrorCode) {
        handlePOISearchResults(result, errorCode: errorCode)
    }
}

// MARK: - BMKGeoCodeSearchDelegate

extension BaiduMapService: BMKGeoCodeSearchDelegate {
    func onGetGeoCodeResult(_ searcher: BMKGeoCodeSearch, result: BMKGeoCodeSearchResult, errorCode: BMKSearchErrorCode) {
        handleGeocodeResults(result, error: errorCode)
    }

    func onGetReverseGeoCodeResult(_ searcher: BMKGeoCodeSearch, result: BMKReverseGeoCodeSearchResult, errorCode: BMKSearchErrorCode) {
        handleReverseGeocodeResults(result, error: errorCode)
    }
}

// MARK: - BMKRouteSearchDelegate

extension BaiduMapService: BMKRouteSearchDelegate {
    func onGetDrivingRouteResult(_ searcher: BMKRouteSearch, result: BMKDrivingRouteResult, errorCode: BMKSearchErrorCode) {
        handleRoutePlanResults(result, errorCode: errorCode)
    }
}

// MARK: - Mock Data for Development

extension BaiduMapService {

    /// Generate mock POI data for development testing
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
