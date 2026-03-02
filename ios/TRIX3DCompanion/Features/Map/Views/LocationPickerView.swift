//
//  LocationPickerView.swift
//  TRIX3DCompanion
//
//  Location picker view for selecting locations
//

import SwiftUI
import MapKit

// MARK: - Location Picker View

/// A view for picking a location using MapKit
struct LocationPickerView: View {

    // MARK: - Environment

    @Environment(\.dismiss) private var dismiss

    // MARK: - State

    @State private var region = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 37.7749, longitude: -122.4194),
        span: MKCoordinateSpan(latitudeDelta: 0.1, longitudeDelta: 0.1)
    )

    @State private var selectedLocation: CLLocationCoordinate2D?

    @State private var searchText = ""

    // MARK: - Properties

    var showAsSheet: Bool = true

    // MARK: - Body

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Search bar
                searchBar

                // Map view
                mapView

                // Selected location info
                if let location = selectedLocation {
                    selectedLocationInfo(coordinate: location)
                }
            }
            .navigationTitle("Pick Location")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    if showAsSheet {
                        Button("Cancel") {
                            dismiss()
                        }
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
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

            TextField("Search for a place", text: $searchText)
                .textFieldStyle(.plain)
        }
        .padding(12)
        .background(Color(.systemGray6))
        .cornerRadius(10)
        .padding()
    }

    // MARK: - Map View

    private var mapView: some View {
        Map(coordinateRegion: $region, annotationItems: []) { location in
            MapMarker(coordinate: location.coordinate, tint: .purple)
        }
        .onTapGesture { coordinate in
            selectedLocation = coordinate
        }
        .ignoresSafeArea(edges: .bottom)
    }

    // MARK: - Selected Location Info

    private func selectedLocationInfo(coordinate: CLLocationCoordinate2D) -> some View {
        VStack(spacing: 8) {
            HStack {
                Image(systemName: "location.fill")
                    .foregroundColor(.purple)

                Text("Selected Location")
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
    LocationPickerView(showAsSheet: false)
}
