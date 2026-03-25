//
//  MapSearchService.swift
//  TRIX3DCompanion
//
//  MapKit-based search service replacing BaiduMapService
//  Uses MKLocalSearch for POI search and MKDirections for routing
//

import Foundation
import MapKit
import CoreLocation

// MARK: - POI Result

/// POI search result (MapKit version)
struct POIResult: Identifiable, Equatable {
    let id = UUID()
    let name: String
    let address: String
    let coordinate: CLLocationCoordinate2D
    let latitude: Double
    let longitude: Double

    init(name: String, address: String, coordinate: CLLocationCoordinate2D) {
        self.name = name
        self.address = address
        self.coordinate = coordinate
        self.latitude = coordinate.latitude
        self.longitude = coordinate.longitude
    }

    init(from mapItem: MKMapItem) {
        self.name = mapItem.name ?? "未知地点"
        self.address = mapItem.placemark.title ?? ""
        self.coordinate = mapItem.placemark.coordinate
        self.latitude = coordinate.latitude
        self.longitude = coordinate.longitude
    }

    static func == (lhs: POIResult, rhs: POIResult) -> Bool {
        lhs.name == rhs.name && lhs.address == rhs.address &&
        lhs.latitude == rhs.latitude && lhs.longitude == rhs.longitude
    }
}

// MARK: - Route Result

/// Route planning result (MapKit version)
struct RouteResult: Equatable {
    let distance: Double       // meters
    let duration: TimeInterval // seconds
    let coordinates: [CLLocationCoordinate2D]

    var formattedDistance: String {
        if distance >= 1000 {
            return String(format: "%.1f km", distance / 1000)
        }
        return String(format: "%.0f m", distance)
    }

    var formattedDuration: String {
        let minutes = Int(duration / 60)
        if minutes >= 60 {
            let hours = minutes / 60
            let mins = minutes % 60
            return "\(hours)小时\(mins)分钟"
        }
        return "\(minutes)分钟"
    }

    static func == (lhs: RouteResult, rhs: RouteResult) -> Bool {
        lhs.distance == rhs.distance && lhs.duration == rhs.duration
    }
}

// MARK: - Search Service Protocol

/// Protocol for map search service dependency injection in tests
protocol MapSearchServiceProtocol: AnyObject {
    var isAvailable: Bool { get }
    func initialize(completion: @escaping (Bool) -> Void)
    func searchPOI(keyword: String, city: String, completion: @escaping ([POIResult]) -> Void)
    func searchNearby(latitude: Double, longitude: Double, radius: Int, keyword: String, completion: @escaping ([POIResult]) -> Void)
    func routePlan(from: CLLocationCoordinate2D, to: CLLocationCoordinate2D, completion: @escaping (RouteResult?) -> Void)
    func openNavigation(toLatitude: Double, toLongitude: Double, toName: String, fromLatitude: Double?, fromLongitude: Double?)
}

/// Map search service using MapKit
/// Provides POI search, geocoding, and route planning
final class MapSearchService: NSObject, MapSearchServiceProtocol {

    static let shared = MapSearchService()

    /// Whether the service is available (always true for MapKit)
    var isAvailable: Bool { true }

    /// Initialize the service
    func initialize(completion: @escaping (Bool) -> Void) {
        // MapKit doesn't need initialization
        completion(true)
    }

    // MARK: - POI Search

    /// Search POI by keyword
    /// - Parameters:
    ///   - keyword: Search keyword
    ///   - city: City to search in
    ///   - completion: Callback with results
    func searchPOI(keyword: String, city: String = "上海", completion: @escaping ([POIResult]) -> Void) {
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = keyword
        request.resultTypes = .pointOfInterest

        let search = MKLocalSearch(request: request)
        search.start { response, error in
            if let error = error {
                SecureLogger.shared.warning("MapSearchService: searchPOI error: \(error.localizedDescription)")
                // Fallback to mock
                completion(Self.mockSearchResults(keyword: keyword, city: city))
                return
            }

            let results = (response?.mapItems ?? []).map { POIResult(from: $0) }
            completion(results.isEmpty ? Self.mockSearchResults(keyword: keyword, city: city) : results)
        }
    }

    /// Search nearby POI
    /// - Parameters:
    ///   - latitude: Center latitude
    ///   - longitude: Center longitude
    ///   - radius: Search radius in meters
    ///   - keyword: Search keyword
    ///   - completion: Callback with results
    func searchNearby(
        latitude: Double,
        longitude: Double,
        radius: Int,
        keyword: String,
        completion: @escaping ([POIResult]) -> Void
    ) {
        let center = CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = keyword
        request.resultTypes = .pointOfInterest
        request.region = MKCoordinateRegion(
            center: center,
            latitudinalMeters: Double(radius * 2),
            longitudinalMeters: Double(radius * 2)
        )

        let search = MKLocalSearch(request: request)
        search.start { response, error in
            if let error = error {
                SecureLogger.shared.warning("MapSearchService: searchNearby error: \(error.localizedDescription)")
                completion(Self.mockSearchResults(keyword: keyword))
                return
            }

            let results = (response?.mapItems ?? []).map { POIResult(from: $0) }
            completion(results.isEmpty ? Self.mockSearchResults(keyword: keyword) : results)
        }
    }

    // MARK: - Route Planning

    /// Plan a route between two points
    /// - Parameters:
    ///   - from: Start coordinate
    ///   - to: End coordinate
    ///   - completion: Callback with route result
    func routePlan(from: CLLocationCoordinate2D, to: CLLocationCoordinate2D, completion: @escaping (RouteResult?) -> Void) {
        let request = MKDirections.Request()
        request.source = MKMapItem(placemark: MKPlacemark(coordinate: from))
        request.destination = MKMapItem(placemark: MKPlacemark(coordinate: to))
        request.transportType = .automobile

        let directions = MKDirections(request: request)
        directions.calculate { response, error in
            if let error = error {
                SecureLogger.shared.warning("MapSearchService: routePlan error: \(error.localizedDescription)")
                completion(nil)
                return
            }

            guard let route = response?.routes.first else {
                completion(nil)
                return
            }

            // Extract polyline points
            let polyline = route.polyline
            var coordinates: [CLLocationCoordinate2D] = []
            for i in 0..<polyline.pointCount {
                let point = polyline.points()[i]
                coordinates.append(point.coordinate)
            }

            let result = RouteResult(
                distance: route.distance,
                duration: route.expectedTravelTime,
                coordinates: coordinates
            )
            completion(result)
        }
    }

    // MARK: - Navigation

    /// Open Apple Maps for navigation
    func openNavigation(
        toLatitude: Double,
        toLongitude: Double,
        toName: String,
        fromLatitude: Double? = nil,
        fromLongitude: Double? = nil
    ) {
        let toCoord = CLLocationCoordinate2D(latitude: toLatitude, longitude: toLongitude)
        let placemark = MKPlacemark(coordinate: toCoord)
        let mapItem = MKMapItem(placemark: placemark)
        mapItem.name = toName

        var options: [String: Any] = [
            MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeDriving
        ]

        if let fromLat = fromLatitude, let fromLon = fromLongitude {
            let fromCoord = CLLocationCoordinate2D(latitude: fromLat, longitude: fromLon)
            let fromPlacemark = MKPlacemark(coordinate: fromCoord)
            let fromItem = MKMapItem(placemark: fromPlacemark)
            options[MKLaunchOptionsDirectionsModeKey] = MKLaunchOptionsDirectionsModeDriving
            mapItem.openInMaps(launchOptions: options)
            _ = fromItem // suppress warning
        } else {
            mapItem.openInMaps(launchOptions: options)
        }
    }

    // MARK: - Mock Data

    /// Generate mock search results for demo purposes
    static func mockSearchResults(keyword: String, city: String = "上海") -> [POIResult] {
        let mockPlaces: [(String, String, Double, Double)] = [
            ("24H 沉浸自习室", "市中心", 31.2319, 121.4719),
            ("中心区市立图书馆", "中心区", 31.2286, 121.4708),
            ("Blue Bottle 蓝瓶咖啡", "静安区", 31.2310, 121.4749),
            ("TRIX 青年创客空间", "科技园区", 31.2332, 121.4759),
            ("Fumin Bagel", "法租界", 31.2292, 121.4755),
            ("城市绿洲极客公园", "滨江绿地", 31.2296, 121.4705),
            ("光年 Livehouse KTV", "娱乐中心", 31.2276, 121.4745),
            ("VR 零界探索馆", "科技馆", 31.2336, 121.4725),
        ]

        let filtered = mockPlaces.filter { $0.0.contains(keyword) || keyword.isEmpty }
        let results = filtered.isEmpty ? mockPlaces : filtered

        return results.map { name, address, lat, lon in
            POIResult(
                name: name,
                address: "\(address), \(city)",
                coordinate: CLLocationCoordinate2D(latitude: lat, longitude: lon)
            )
        }
    }
}

// MARK: - MKLocalSearchResponse Extension

extension MKLocalSearch.Response {
    /// Map items as POI results
    var poiResults: [POIResult] {
        mapItems.map { POIResult(from: $0) }
    }
}
