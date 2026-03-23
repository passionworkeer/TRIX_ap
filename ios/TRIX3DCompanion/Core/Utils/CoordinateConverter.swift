//
//  CoordinateConverter.swift
//  TRIX3DCompanion
//
//  Coordinate system conversion utilities for China map services
//  WGS-84 (GPS), GCJ-02 (Mars/Google), BD-09 (Baidu)
//

import Foundation
import CoreLocation

// MARK: - Coordinate System

/// Coordinate system types used in China map services
enum CoordinateSystem: String {
    case wgs84 = "WGS-84"       // GPS (international standard)
    case gcj02 = "GCJ-02"       // Mars/Google (Chinese encrypted)
    case bd09 = "BD-09"         // Baidu (further encrypted)
}

// MARK: - Coordinate Converter

/// Coordinate converter for WGS-84, GCJ-02, and BD-09 coordinate systems
/// Used to convert between GPS coordinates and Chinese map service coordinates
struct CoordinateConverter {

    // MARK: - Constants

    /// PI constant
    private static let pi = 3.1415926535897932384626433832795

    /// Semi-axis of Earth (WGS-84)
    private static let a: Double = 6378245.0

    /// Flattening of Earth (WGS-84)
    private static let ee: Double = 0.00669342162296594323

    // MARK: - WGS-84 <-> GCJ-02

    /// Convert WGS-84 coordinates to GCJ-02 (Mars/Google coordinates)
    /// - Parameters:
    ///   - lat: WGS-84 latitude
    ///   - lon: WGS-84 longitude
    /// - Returns: Tuple of (latitude, longitude) in GCJ-02
    static func wgs84ToGCJ02(lat: Double, lon: Double) -> (Double, Double) {
        let (dLat, dLon) = transform(lat: lat, lon: lon)
        return (lat + dLat, lon + dLon)
    }

    /// Convert GCJ-02 coordinates to WGS-84 (GPS coordinates)
    /// - Parameters:
    ///   - lat: GCJ-02 latitude
    ///   - lon: GCJ-02 longitude
    /// - Returns: Tuple of (latitude, longitude) in WGS-84
    static func gcj02ToWGS84(lat: Double, lon: Double) -> (Double, Double) {
        let (dLat, dLon) = transform(lat: lat, lon: lon)
        return (lat - dLat, lon - dLon)
    }

    // MARK: - BD-09 <-> GCJ-02

    /// Convert BD-09 coordinates (Baidu) to GCJ-02
    /// - Parameters:
    ///   - lat: BD-09 latitude
    ///   - lon: BD-09 longitude
    /// - Returns: Tuple of (latitude, longitude) in GCJ-02
    static func bd09ToGCJ02(lat: Double, lon: Double) -> (Double, Double) {
        let x = lon - 0.0065
        let y = lat - 0.006
        let z = sqrt(x * x + y * y) - 0.00002 * sin(y * pi * 3000.0 / 180.0)
        let theta = atan2(y, x) - 0.000003 * cos(x * pi * 3000.0 / 180.0)
        return (z * sin(theta), z * cos(theta))
    }

    /// Convert GCJ-02 coordinates to BD-09 (Baidu)
    /// - Parameters:
    ///   - lat: GCJ-02 latitude
    ///   - lon: GCJ-02 longitude
    /// - Returns: Tuple of (latitude, longitude) in BD-09
    static func gcj02ToBD09(lat: Double, lon: Double) -> (Double, Double) {
        let z = sqrt(lon * lon + lat * lat) + 0.00002 * sin(lat * pi * 3000.0 / 180.0)
        let theta = atan2(lat, lon) + 0.000003 * cos(lon * pi * 3000.0 / 180.0)
        return (z * sin(theta) + 0.006, z * cos(theta) + 0.0065)
    }

    // MARK: - WGS-84 <-> BD-09

    /// Convert WGS-84 coordinates directly to BD-09 (Baidu)
    /// - Parameters:
    ///   - lat: WGS-84 latitude
    ///   - lon: WGS-84 longitude
    /// - Returns: Tuple of (latitude, longitude) in BD-09
    static func wgs84ToBD09(lat: Double, lon: Double) -> (Double, Double) {
        let (gcjLat, gcjLon) = wgs84ToGCJ02(lat: lat, lon: lon)
        return gcj02ToBD09(lat: gcjLat, lon: gcjLon)
    }

    /// Convert BD-09 coordinates directly to WGS-84 (GPS)
    /// - Parameters:
    ///   - lat: BD-09 latitude
    ///   - lon: BD-09 longitude
    /// - Returns: Tuple of (latitude, longitude) in WGS-84
    static func bd09ToWGS84(lat: Double, lon: Double) -> (Double, Double) {
        let (gcjLat, gcjLon) = bd09ToGCJ02(lat: lat, lon: lon)
        return gcj02ToWGS84(lat: gcjLat, lon: gcjLon)
    }

    // MARK: - CLLocationCoordinate2D Extensions

    /// Convert WGS-84 coordinate to GCJ-02
    static func wgs84ToGCJ02(_ coordinate: CLLocationCoordinate2D) -> CLLocationCoordinate2D {
        let (lat, lon) = wgs84ToGCJ02(lat: coordinate.latitude, lon: coordinate.longitude)
        return CLLocationCoordinate2D(latitude: lat, longitude: lon)
    }

    /// Convert GCJ-02 coordinate to WGS-84
    static func gcj02ToWGS84(_ coordinate: CLLocationCoordinate2D) -> CLLocationCoordinate2D {
        let (lat, lon) = gcj02ToWGS84(lat: coordinate.latitude, lon: coordinate.longitude)
        return CLLocationCoordinate2D(latitude: lat, longitude: lon)
    }

    /// Convert BD-09 coordinate to GCJ-02
    static func bd09ToGCJ02(_ coordinate: CLLocationCoordinate2D) -> CLLocationCoordinate2D {
        let (lat, lon) = bd09ToGCJ02(lat: coordinate.latitude, lon: coordinate.longitude)
        return CLLocationCoordinate2D(latitude: lat, longitude: lon)
    }

    /// Convert GCJ-02 coordinate to BD-09
    static func gcj02ToBD09(_ coordinate: CLLocationCoordinate2D) -> CLLocationCoordinate2D {
        let (lat, lon) = gcj02ToBD09(lat: coordinate.latitude, lon: coordinate.longitude)
        return CLLocationCoordinate2D(latitude: lat, longitude: lon)
    }

    /// Convert WGS-84 coordinate to BD-09
    static func wgs84ToBD09(_ coordinate: CLLocationCoordinate2D) -> CLLocationCoordinate2D {
        let (lat, lon) = wgs84ToBD09(lat: coordinate.latitude, lon: coordinate.longitude)
        return CLLocationCoordinate2D(latitude: lat, longitude: lon)
    }

    /// Convert BD-09 coordinate to WGS-84
    static func bd09ToWGS84(_ coordinate: CLLocationCoordinate2D) -> CLLocationCoordinate2D {
        let (lat, lon) = bd09ToWGS84(lat: coordinate.latitude, lon: coordinate.longitude)
        return CLLocationCoordinate2D(latitude: lat, longitude: lon)
    }

    // MARK: - Helper Methods

    /// Check if coordinate is within China
    static func isCoordinateInChina(lat: Double, lon: Double) -> Bool {
        return lat >= 18.0 && lat <= 54.0 && lon >= 73.0 && lon <= 135.0
    }

    /// Convert coordinate to specified system
    static func convert(_ coordinate: CLLocationCoordinate2D, from: CoordinateSystem, to: CoordinateSystem) -> CLLocationCoordinate2D {
        if from == to {
            return coordinate
        }

        switch (from, to) {
        case (.wgs84, .gcj02):
            return wgs84ToGCJ02(coordinate)
        case (.wgs84, .bd09):
            return wgs84ToBD09(coordinate)
        case (.gcj02, .wgs84):
            return gcj02ToWGS84(coordinate)
        case (.gcj02, .bd09):
            return gcj02ToBD09(coordinate)
        case (.bd09, .wgs84):
            return bd09ToWGS84(coordinate)
        case (.bd09, .gcj02):
            return bd09ToGCJ02(coordinate)
        default:
            return coordinate
        }
    }

    // MARK: - Private Methods

    /// Transform helper for WGS-84 <-> GCJ-02 conversion
    private static func transform(lat: Double, lon: Double) -> (Double, Double) {
        var dLat = transformLat(x: lon - 105.0, y: lat - 35.0)
        var dLon = transformLon(x: lon - 105.0, y: lat - 35.0)

        let radLat = lat / 180.0 * pi
        var magic = sin(radLat)
        magic = 1 - ee * magic * magic
        let sqrtMagic = sqrt(magic)

        dLat = (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * pi)
        dLon = (dLon * 180.0) / (a / sqrtMagic * cos(radLat) * pi)

        return (dLat, dLon)
    }

    /// Transform latitude helper
    private static func transformLat(x: Double, y: Double) -> Double {
        var ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * sqrt(abs(x))
        ret += (20.0 * sin(6.0 * x * pi) + 20.0 * sin(2.0 * x * pi)) / 3.0
        ret += (20.0 * sin(y * pi) + 40.0 * sin(y / 3.0 * pi)) / 3.0
        ret += (160.0 * sin(y / 12.0 * pi) + 320.0 * sin(y * pi / 30.0)) / 3.0
        return ret
    }

    /// Transform longitude helper
    private static func transformLon(x: Double, y: Double) -> Double {
        var ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * sqrt(abs(x))
        ret += (20.0 * sin(6.0 * x * pi) + 20.0 * sin(2.0 * x * pi)) / 3.0
        ret += (20.0 * sin(x * pi) + 40.0 * sin(x / 3.0 * pi)) / 3.0
        ret += (150.0 * sin(x / 12.0 * pi) + 300.0 * sin(x / 30.0 * pi)) / 3.0
        return ret
    }
}

// MARK: - CLLocationCoordinate2D Extension

extension CLLocationCoordinate2D {
    /// Convert to GCJ-02 coordinate
    func toGCJ02() -> CLLocationCoordinate2D {
        return CoordinateConverter.wgs84ToGCJ02(self)
    }

    /// Convert to BD-09 coordinate
    func toBD09() -> CLLocationCoordinate2D {
        let gcj02 = CoordinateConverter.wgs84ToGCJ02(self)
        return CoordinateConverter.gcj02ToBD09(gcj02)
    }

    /// Check if this coordinate is valid
    var isValid: Bool {
        return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
    }
}
