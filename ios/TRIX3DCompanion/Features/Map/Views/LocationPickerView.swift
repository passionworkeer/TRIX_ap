//
//  LocationPickerView.swift
//  TRIX3DCompanion
//
//  Location picker view for selecting locations using Baidu Map
//

import SwiftUI
import CoreLocation
import BaiduMapAPI_Map
import BaiduMapAPI_Utils

// MARK: - Localization Helper

private func L(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

// MARK: - Location Annotation

/// Annotation item for map marker
struct LocationAnnotation: Identifiable {
    let id = UUID()
    let coordinate: CLLocationCoordinate2D
}

// MARK: - Location Picker View

/// A view for picking a location using Baidu Map
struct LocationPickerView: View {

    // MARK: - Environment

    @Environment(\.dismiss) private var dismiss

    // MARK: - State

    /// Current region center (stored as CLLocationCoordinate2D for Baidu)
    @State private var centerCoordinate = CLLocationCoordinate2D(latitude: 31.2304, longitude: 121.4737)

    /// Zoom level for Baidu Map
    @State private var zoomLevel: Float = 14

    /// Selected location coordinate
    @State private var selectedLocation: CLLocationCoordinate2D?

    @State private var searchText = ""

    /// Annotation for selected location
    @State private var selectedAnnotation: MapAnnotationItem?

    // MARK: - Properties

    var showAsSheet: Bool = true

    // MARK: - Initialization

    init(showAsSheet: Bool = true) {
        self.showAsSheet = showAsSheet
    }

    // MARK: - Body

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Search bar
                searchBar

                // Map view using Baidu
                baiduMapView

                // Selected location info
                if let location = selectedLocation {
                    selectedLocationInfo(coordinate: location)
                }
            }
            .navigationTitle(L("location.pick"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    if showAsSheet {
                        Button(L("action.cancel")) {
                            dismiss()
                        }
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(L("action.done")) {
                        // Handle done action
                        if showAsSheet {
                            dismiss()
                        }
                    }
                    .disabled(selectedLocation == nil)
                }
            }
        }
    }

    // MARK: - Search Bar

    private var searchBar: some View {
        HStack {
            Image(systemName: "magnifyingglass")
                .foregroundColor(.secondary)

            TextField(L("location.search"), text: $searchText)
                .textFieldStyle(.plain)
        }
        .padding(12)
        .background(Color(.systemGray6))
        .cornerRadius(10)
        .padding()
    }

    // MARK: - Baidu Map View

    private var baiduMapView: some View {
        ZStack {
            BMKMapViewRepresentable(
                centerCoordinate: $centerCoordinate,
                zoomLevel: $zoomLevel,
                annotations: selectedAnnotation.map { [$0] } ?? [],
                routeCoordinates: nil,
                showsUserLocation: true,
                userTrackingMode: BMKUserTrackingMode(rawValue: 2),
                onAnnotationTapped: { id, name in
                    // Handle annotation tap if needed
                },
                onRegionChanged: { coordinate in
                    // Update center coordinate on pan
                },
                onMapClicked: { coordinate in
                    // When map is clicked, set selected location
                    handleMapClick(at: coordinate)
                },
                isInteractive: true
            )
            .ignoresSafeArea(edges: .bottom)

            // Center crosshair for location picking
            if selectedLocation == nil {
                VStack {
                    Spacer()
                    HStack {
                        Spacer()
                        Image(systemName: "plus")
                            .font(.system(size: 30, weight: .thin))
                            .foregroundColor(.brandPurple.opacity(0.5))
                        Spacer()
                    }
                    Spacer()
                }
            }
        }
    }

    // MARK: - Methods

    /// Handle map click to select location
    private func handleMapClick(at coordinate: CLLocationCoordinate2D) {
        // Convert from GCJ-02 (Baidu map internal) to WGS-84 for external use
        let wgs84Coord = BMKCoordTrans(coordinate, BMK_COORD_TYPE(rawValue: 1)!, BMK_COORD_TYPE(rawValue: 0)!)

        selectedLocation = wgs84Coord
        selectedAnnotation = MapAnnotationItem(
            id: "selected",
            name: "选中的位置",
            subtitle: nil,
            coordinate: coordinate, // Use original coordinate for display on Baidu map
            category: .other
        )
    }

    // MARK: - Computed Properties

    private var selectedLocations: [LocationAnnotation] {
        guard let location = selectedLocation else { return [] }
        return [LocationAnnotation(coordinate: location)]
    }

    // MARK: - Selected Location Info

    private func selectedLocationInfo(coordinate: CLLocationCoordinate2D) -> some View {
        VStack(spacing: 8) {
            HStack {
                Image(systemName: "location.fill")
                    .foregroundColor(.purple)

                Text(L("location.selected"))
                    .font(.headline)

                Spacer()

                Text("\(coordinate.latitude, specifier: "%.4f"), \(coordinate.longitude, specifier: "%.4f")")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .padding()
        }
        .background(Color(.systemBackground))
    }
}

// MARK: - Preview

#Preview("Location Picker") {
    LocationPickerView()
}
