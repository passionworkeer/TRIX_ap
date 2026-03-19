//
//  MapModels.swift
//  TRIX3DCompanion
//
//  Models for Map feature
//  Friend locations, heat zones, and map-related data structures
//

import Foundation
import MapKit
import SwiftUI

// MARK: - Friend Location Status

/// Friend location status enum
enum FriendLocationStatus: String, Codable {
    case online
    case away
    case offline

    var displayColor: Color {
        switch self {
        case .online: return .green
        case .away: return .yellow
        case .offline: return .gray
        }
    }

    init(from string: String) {
        self = FriendLocationStatus(rawValue: string) ?? .offline
    }
}

// MARK: - Friend Map Location

/// Friend location on map for displaying user avatars
struct FriendMapLocation: Identifiable, Codable, Hashable {
    let id: String
    let name: String
    let avatarUrl: String?
    let latitude: Double
    let longitude: Double
    let isStudying: Bool
    let status: String  // Raw string for JSON compatibility

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    var statusType: FriendLocationStatus {
        FriendLocationStatus(from: status)
    }
}

// MARK: - Heat Zone Model

/// Heat zone for displaying activity intensity on map
struct HeatZone: Identifiable {
    let id = UUID()
    let coordinate: CLLocationCoordinate2D
    let color: Color
    let size: CGFloat
    let intensity: Double

    /// Create a heat zone from coordinates and user count
    init(coordinate: CLLocationCoordinate2D, color: Color, size: CGFloat, intensity: Double = 0.5) {
        self.coordinate = coordinate
        self.color = color
        self.size = size
        self.intensity = intensity
    }

    /// Create a heat zone from coordinates and user count
    init(coordinate: CLLocationCoordinate2D, userCount: Int) {
        self.coordinate = coordinate
        self.intensity = min(Double(userCount) / 10.0, 1.0)
        self.size = CGFloat(20 + userCount * 5)
        self.color = HeatZone.colorForIntensity(self.intensity)
    }

    private static func colorForIntensity(_ intensity: Double) -> Color {
        if intensity < 0.3 {
            return .green.opacity(0.3)
        } else if intensity < 0.6 {
            return .yellow.opacity(0.5)
        } else {
            return .red.opacity(0.7)
        }
    }
}

// MARK: - Map Region Presets

/// Preset map regions for common locations
enum MapRegionPreset {
    case world
    case currentLocation(CLLocationCoordinate2D)
    case city(name: String, coordinate: CLLocationCoordinate2D, span: Double)

    var region: MKCoordinateRegion {
        switch self {
        case .world:
            return MKCoordinateRegion(
                center: CLLocationCoordinate2D(latitude: 30, longitude: 0),
                span: MKCoordinateSpan(latitudeDelta: 120, longitudeDelta: 180)
            )
        case .currentLocation(let coordinate):
            return MKCoordinateRegion(
                center: coordinate,
                span: MKCoordinateSpan(latitudeDelta: 0.05, longitudeDelta: 0.05)
            )
        case .city(_, let coordinate, let span):
            return MKCoordinateRegion(
                center: coordinate,
                span: MKCoordinateSpan(latitudeDelta: span, longitudeDelta: span)
            )
        }
    }
}

// MARK: - Map Annotation Type

/// Type of map annotation
enum MapAnnotationType {
    case studySpot
    case friend
    case heatZone
    case userLocation

    var iconName: String {
        switch self {
        case .studySpot: return "book.fill"
        case .friend: return "person.fill"
        case .heatZone: return "flame.fill"
        case .userLocation: return "location.fill"
        }
    }
}
