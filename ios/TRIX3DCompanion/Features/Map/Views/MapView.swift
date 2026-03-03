//
//  MapView.swift
//  TRIX3DCompanion
//
//  Map view showing nearby locations with search and detail sheets
//

import SwiftUI
import MapKit
import CoreLocation

// MARK: - Map View

/// Map view displaying nearby locations with search functionality
struct MapView: View {

    // MARK: - State Objects

    @StateObject private var viewModel: MapViewModel

    // MARK: - Environment

    @EnvironmentObject private var appState: AppState

    // MARK: - State

    @State private var showPermissionAlert = false

    // MARK: - Focus State

    @FocusState private var isSearchFocused: Bool

    // MARK: - Initialization

    init(viewModel: MapViewModel? = nil) {
        _viewModel = StateObject(wrappedValue: viewModel ?? MapViewModel())
    }

    // MARK: - Body

    var body: some View {
        ZStack(alignment: .top) {
            // Map
            mapContent

            // Search bar overlay
            searchBarOverlay
                .padding(.top, 8)

            // Floating action buttons
            floatingButtons

            // Loading overlay
            if viewModel.isLoading {
                loadingOverlay
            }
        }
        .ignoresSafeArea(edges: .bottom)
        .task {
            await viewModel.loadNearbyLocations()
        }
        .onAppear {
            viewModel.checkLocationPermission()
        }
        .sheet(isPresented: $viewModel.showLocationDetail) {
            if let location = viewModel.selectedLocation {
                LocationDetailView(
                    location: location,
                    onNavigate: { navigateToLocation(location) },
                    onShare: { shareLocationWithCompanion(location) }
                )
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
            }
        }
        .alert("Location Permission Required", isPresented: $showPermissionAlert) {
            Button("Settings") {
                openAppSettings()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Please enable location access in Settings to see nearby locations.")
        }
        .alert("Error", isPresented: .constant(viewModel.errorMessage != nil)) {
            Button("OK") {
                viewModel.clearError()
            }
        } message: {
            if let error = viewModel.errorMessage {
                Text(error)
            }
        }
    }

    // MARK: - View Components

    /// Main map content
    private var mapContent: some View {
        Map(coordinateRegion: $viewModel.region, showsUserLocation: true, annotationItems: viewModel.filteredLocations) { location in
            MapAnnotation(coordinate: location.coordinate) {
                LocationMarker(
                    location: location,
                    color: viewModel.markerColor(for: location),
                    iconName: viewModel.iconName(for: location)
                ) {
                    viewModel.selectLocation(location)
                }
            }
        }
    }

    /// Search bar overlay
    private var searchBarOverlay: some View {
        VStack(spacing: 0) {
            // Search bar
            HStack(spacing: 12) {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.textSecondary)

                TextField("Search locations...", text: $viewModel.searchQuery)
                    .textFieldStyle(.plain)
                    .font(.body)
                    .focused($isSearchFocused)
                    .autocapitalization(.none)
                    .disableAutocorrection(true)

                if !viewModel.searchQuery.isEmpty {
                    Button(action: { viewModel.clearSearch() }) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(.textTertiary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .shadow(color: .shadow, radius: 8, x: 0, y: 4)
            .padding(.horizontal)

            // Category filters
            categoryFilterBar
                .padding(.top, 8)
        }
    }

    /// Category filter bar
    private var categoryFilterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                // All categories
                CategoryFilterChip(
                    title: "All",
                    icon: "mappin.circle.fill",
                    isSelected: viewModel.selectedCategory == nil
                ) {
                    viewModel.setCategoryFilter(nil)
                }

                // Individual categories
                ForEach(LocationCategory.allCases, id: \.self) { category in
                    CategoryFilterChip(
                        title: category.displayName,
                        icon: category.iconName,
                        isSelected: viewModel.selectedCategory == category
                    ) {
                        viewModel.setCategoryFilter(category)
                    }
                }
            }
            .padding(.horizontal)
        }
    }

    /// Floating action buttons
    private var floatingButtons: some View {
        VStack {
            Spacer()

            HStack {
                Spacer()

                VStack(spacing: 12) {
                    // Locate me button
                    Button(action: { centerOnUserLocation() }) {
                        ZStack {
                            Circle()
                                .fill(.ultraThinMaterial)
                                .frame(width: 56, height: 56)
                                .shadow(color: .shadow, radius: 8, x: 0, y: 4)

                            Image(systemName: viewModel.isUserLocationAvailable ? "location.fill" : "location")
                                .font(.title2)
                                .foregroundStyle(
                                    viewModel.isUserLocationAvailable
                                        ? Color.brandPurple
                                        : Color.textSecondary
                                )
                        }
                    }
                    .buttonStyle(.plain)
                }
                .padding(.trailing, 16)
            }
        }
    }

    /// Loading overlay
    private var loadingOverlay: some View {
        ZStack {
            Color.background.opacity(0.3)
                .ignoresSafeArea()

            VStack(spacing: 12) {
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: .brandPurple))
                    .scaleEffect(1.5)

                Text("Loading locations...")
                    .font(.subheadline)
                    .foregroundColor(.textSecondary)
            }
            .padding(24)
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 16))
        }
    }

    // MARK: - Actions

    /// Center on user location
    private func centerOnUserLocation() {
        if !viewModel.hasLocationPermission {
            showPermissionAlert = true
            return
        }

        viewModel.centerOnUserLocation()
    }

    /// Navigate to location
    /// - Parameter location: Location to navigate to
    private func navigateToLocation(_ location: Location) {
        let coordinate = location.coordinate
        let placemark = MKPlacemark(coordinate: coordinate)
        let mapItem = MKMapItem(placemark: placemark)
        mapItem.name = location.name

        let options: [String: Any] = [
            MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeDriving
        ]

        mapItem.openInMaps(launchOptions: options)
    }

    /// Share location with companion
    /// - Parameter location: Location to share
    private func shareLocationWithCompanion(_ location: Location) {
        guard let companionId = appState.currentUser?.companionId else {
            return
        }

        Task {
            await viewModel.shareLocation(with: companionId)
        }
    }

    /// Open app settings
    private func openAppSettings() {
        if let url = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(url)
        }
    }
}

// MARK: - Location Marker

/// Custom map marker for locations
struct LocationMarker: View {
    let location: Location
    let color: Color
    let iconName: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 0) {
                // Marker pin
                ZStack {
                    Circle()
                        .fill(color.gradient)
                        .frame(width: 40, height: 40)
                        .shadow(color: color.opacity(0.4), radius: 4, x: 0, y: 2)

                    Image(systemName: iconName)
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundColor(.white)
                }

                // Triangle pointer
                Triangle()
                    .fill(color.gradient)
                    .frame(width: 12, height: 8)
                    .offset(y: -4)
            }
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Triangle Shape

/// Triangle shape for marker pointer
struct Triangle: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.midX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        path.closeSubpath()
        return path
    }
}

// MARK: - Category Filter Chip

/// Category filter button chip
struct CategoryFilterChip: View {
    let title: String
    let icon: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.caption)

                Text(title)
                    .font(.subheadline)
                    .fontWeight(.medium)
            }
            .foregroundColor(isSelected ? .white : .textPrimary)
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(
                isSelected
                    ? Color.brandPurple
                    : Color.cardBackground
            )
            .clipShape(Capsule())
            .shadow(color: isSelected ? .brandPurple.opacity(0.3) : .clear, radius: 4, x: 0, y: 2)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Location Category Extensions

extension LocationCategory {
    /// Display name for category
    var displayName: String {
        switch self {
        case .school:
            return "School"
        case .library:
            return "Library"
        case .cafe:
            return "Cafe"
        case .home:
            return "Home"
        case .park:
            return "Park"
        case .other:
            return "Other"
        }
    }

    /// SF Symbol icon name for category
    var iconName: String {
        switch self {
        case .school:
            return "graduationcap.fill"
        case .library:
            return "books.vertical.fill"
        case .cafe:
            return "cup.and.saucer.fill"
        case .home:
            return "house.fill"
        case .park:
            return "tree.fill"
        case .other:
            return "mappin.circle.fill"
        }
    }
}

// MARK: - Preview

#Preview("Map View") {
    MapView(viewModel: .preview)
        .environmentObject(AppState.shared)
}

#Preview("Dark Mode") {
    MapView(viewModel: .preview)
        .environmentObject(AppState.shared)
        .preferredColorScheme(.dark)
}
