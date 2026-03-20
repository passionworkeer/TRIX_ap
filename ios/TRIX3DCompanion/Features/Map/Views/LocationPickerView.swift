//
//  LocationPickerView.swift
//  TRIX3DCompanion
//
//  Location picker view using MapKit SwiftUI Map
//

import SwiftUI
import MapKit

// MARK: - Localization Helper

private func L(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

// MARK: - Location Picker View

/// A view for picking a location using MapKit
struct LocationPickerView: View {

    // MARK: - Environment

    @Environment(\.dismiss) private var dismiss

    // MARK: - State

    /// Map camera position (MapKit uses CameraPosition)
    @State private var cameraPosition: MapCameraPosition = .automatic

    /// Selected location coordinate
    @State private var selectedCoordinate: CLLocationCoordinate2D?

    @State private var searchText = ""

    /// Annotation for selected location
    @State private var selectedAnnotation: MapAnnotationItem?

    /// Search results
    @State private var searchResults: [POIResult] = []
    @State private var isSearching = false

    /// Map region (derived from camera position)
    @State private var mapRegion = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 31.2304, longitude: 121.4737),
        span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01)
    )

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

                // Search results
                if !searchResults.isEmpty {
                    searchResultsList
                }

                // Map view using MapKit
                mapView
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
                        if showAsSheet {
                            dismiss()
                        }
                    }
                    .disabled(selectedCoordinate == nil)
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
                .onSubmit {
                    performSearch()
                }
        }
        .padding(12)
        .background(Color(.systemGray6))
        .cornerRadius(10)
        .padding()
    }

    // MARK: - Search Results List

    private var searchResultsList: some View {
        ScrollView {
            LazyVStack(spacing: 8) {
                ForEach(searchResults) { result in
                    Button(action: {
                        selectedCoordinate = result.coordinate
                        selectedAnnotation = MapAnnotationItem(
                            id: result.id.uuidString,
                            name: result.name,
                            subtitle: result.address,
                            coordinate: result.coordinate,
                            category: .other
                        )
                        mapRegion = MKCoordinateRegion(
                            center: result.coordinate,
                            span: MKCoordinateSpan(latitudeDelta: 0.005, longitudeDelta: 0.005)
                        )
                        searchResults = []
                        searchText = ""
                    }) {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(result.name)
                                    .font(.subheadline)
                                    .fontWeight(.medium)
                                    .foregroundColor(.primary)
                                Text(result.address)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                    .lineLimit(1)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        .padding(12)
                        .background(Color(.systemBackground))
                        .cornerRadius(10)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal)
        }
        .frame(maxHeight: 200)
        .background(Color(.systemGray6))
    }

    // MARK: - Map View

    private var mapView: some View {
        ZStack {
            MapReader { proxy in
                Map(position: $cameraPosition) {
                    // Selected annotation
                    if let annotation = selectedAnnotation {
                        Annotation(annotation.name, coordinate: annotation.coordinate) {
                            VStack(spacing: 0) {
                                Circle()
                                    .fill(Color.brandPurple.gradient)
                                    .frame(width: 36, height: 36)
                                    .shadow(color: .brandPurple.opacity(0.4), radius: 4, x: 0, y: 2)
                                Triangle()
                                    .fill(Color.brandPurple.gradient)
                                    .frame(width: 12, height: 8)
                                    .offset(y: -2)
                            }
                        }
                    }
                }
                .mapControls {
                    MapCompass()
                    MapScaleView()
                }
                .mapStyle(.standard)
                .onTapGesture { coordinate in
                    if let coord = proxy.convert(coordinate, from: .local) {
                        handleMapTap(at: coord)
                    }
                }
            }
            .ignoresSafeArea(edges: .bottom)

            // Center crosshair when no location selected
            if selectedCoordinate == nil {
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

            // Instruction banner
            if selectedCoordinate == nil && !searchResults.isEmpty == false {
                VStack {
                    Text("点击地图选择位置")
                        .font(.caption)
                        .foregroundColor(.white)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Color.black.opacity(0.6))
                        .cornerRadius(16)
                        .padding(.top, 8)
                    Spacer()
                }
            }
        }
        .onMapCameraChange { context in
            mapRegion = context.region
        }
    }

    // MARK: - Methods

    private func performSearch() {
        let keyword = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !keyword.isEmpty else {
            searchResults = []
            return
        }

        isSearching = true
        MapSearchService.shared.searchPOI(keyword: keyword) { results in
            DispatchQueue.main.async {
                self.isSearching = false
                self.searchResults = results
            }
        }
    }

    /// Handle map tap to select location
    private func handleMapTap(at coordinate: CLLocationCoordinate2D) {
        selectedCoordinate = coordinate
        selectedAnnotation = MapAnnotationItem(
            id: UUID().uuidString,
            name: "选中的位置",
            subtitle: nil,
            coordinate: coordinate,
            category: .other
        )
        searchResults = []
    }
}

// MARK: - Preview

#Preview("Location Picker") {
    LocationPickerView()
}
