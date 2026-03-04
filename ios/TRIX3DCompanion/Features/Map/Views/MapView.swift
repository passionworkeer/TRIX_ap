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
        ZStack {
            // Map
            mapContent

            // Top safe area content
            VStack {
                // Spacer for safe area
                Spacer()
                    .frame(height: UIApplication.shared.connectedScenes
                        .compactMap { $0 as? UIWindowScene }
                        .first?.windows.first?.safeAreaInsets.top ?? 47)

                // Search bar
                searchBarOverlay
                    .padding(.horizontal)

                Spacer()
            }

            // Bottom content
            VStack {
                Spacer()

                // Bottom status bar - moved up
                bottomStatusBar
                    .padding(.bottom, 50) // Above GlassDock
            }

            // Location button (right side)
            VStack {
                Spacer()

                HStack {
                    Spacer()

                    VStack(spacing: 12) {
                        // Locate me button
                        Button(action: { centerOnUserLocation() }) {
                            ZStack {
                                Circle()
                                    .fill(Color.gray.opacity(0.3))
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
                    .padding(.bottom, 60) // Above GlassDock
                }
            }

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

    /// Main map content with all markers and heat zones
    @ViewBuilder
    private var mapContent: some View {
        ZStack {
            // Base map with markers
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

            // Heat zone overlays
            ForEach(viewModel.heatZones) { heatZone in
                HeatZoneOverlay(heatZone: heatZone, region: viewModel.region)
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
            .background(Color.gray.opacity(0.2))
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

    /// Bottom status bar showing places and friends count
    private var bottomStatusBar: some View {
        HStack(spacing: 24) {
            // Places count
            HStack(spacing: 6) {
                Image(systemName: "mappin.circle.fill")
                    .foregroundStyle(.blue)
                Text("\(viewModel.filteredLocations.count) 个地点")
                    .font(.subheadline)
                    .fontWeight(.medium)
            }

            // Divider
            Rectangle()
                .fill(Color.gray.opacity(0.3))
                .frame(width: 1, height: 20)

            // Friends count
            HStack(spacing: 6) {
                Image(systemName: "person.2.fill")
                    .foregroundStyle(.green)
                Text("\(viewModel.friendLocations.count) 位好友")
                    .font(.subheadline)
                    .fontWeight(.medium)
            }
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 12)
        .background(Color.gray.opacity(0.2))
        .clipShape(Capsule())
        .shadow(color: .shadow, radius: 8, x: 0, y: 4)
        .padding(.horizontal, 40)
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
            .background(Color.gray.opacity(0.2))
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

// MARK: - Compact Friend Marker

/// Compact friend marker for map annotations
private struct CompactFriendMarker: View {
    let friend: FriendMapLocation
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            ZStack(alignment: .bottomTrailing) {
                // Avatar background
                Circle()
                    .fill(avatarGradient)
                    .frame(width: 40, height: 40)
                    .overlay(
                        Circle()
                            .strokeBorder(.white, lineWidth: 2)
                    )
                    .shadow(color: .black.opacity(0.3), radius: 3, x: 0, y: 2)

                // Avatar initials
                Text(String(friend.name.prefix(1)))
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(.white)

                // Status indicator
                Circle()
                    .fill(statusColor)
                    .frame(width: 12, height: 12)
                    .overlay(
                        Circle()
                            .strokeBorder(.white, lineWidth: 1.5)
                    )
                    .offset(x: 2, y: 2)
            }
        }
        .buttonStyle(PlainButtonStyle())
    }

    /// Avatar gradient based on name
    private var avatarGradient: LinearGradient {
        let colors: [Color] = [.blue, .purple, .pink, .orange, .green, .teal]
        let colorIndex = abs(friend.name.hashValue) % colors.count
        let color = colors[colorIndex]

        return LinearGradient(
            colors: [color, color.opacity(0.7)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    /// Status indicator color
    private var statusColor: Color {
        switch friend.status {
        case "online":
            return .green
        case "away":
            return .orange
        default:
            return .gray
        }
    }
}

// MARK: - Friend Map Pin Overlay

/// Friend avatar annotation for map
private struct FriendAvatarAnnotation: View {
    let friend: FriendMapLocation

    var body: some View {
        VStack(spacing: 2) {
            // Avatar with glow for studying
            ZStack(alignment: .bottomTrailing) {
                // Glow ring for studying friends
                if friend.isStudying {
                    Circle()
                        .fill(Color.green.opacity(0.4))
                        .frame(width: 44, height: 44)
                        .blur(radius: 4)
                }

                // Avatar background
                Circle()
                    .fill(avatarGradient)
                    .frame(width: 36, height: 36)
                    .overlay(
                        Circle()
                            .strokeBorder(.white, lineWidth: 2)
                    )
                    .shadow(color: .black.opacity(0.3), radius: 2, x: 0, y: 1)

                // Avatar initial
                Text(String(friend.name.prefix(1)))
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(.white)

                // Status indicator
                Circle()
                    .fill(statusColor)
                    .frame(width: 10, height: 10)
                    .overlay(
                        Circle()
                            .strokeBorder(.white, lineWidth: 1.5)
                    )
                    .offset(x: 2, y: 2)
            }

            // Name tag
            Text(friend.name)
                .font(.caption2)
                .fontWeight(.semibold)
                .foregroundColor(.white)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(Color.black.opacity(0.6))
                .clipShape(Capsule())
        }
    }

    private var avatarGradient: LinearGradient {
        let colors: [Color] = [.blue, .purple, .pink, .orange, .green, .teal]
        let colorIndex = abs(friend.name.hashValue) % colors.count
        let color = colors[colorIndex]
        return LinearGradient(
            colors: [color, color.opacity(0.7)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    private var statusColor: Color {
        switch friend.status {
        case "online": return .green
        case "away": return .orange
        default: return .gray
        }
    }
}

/// Friend map pin that positions itself based on coordinate region
private struct FriendMapPin: View {
    let friend: FriendMapLocation
    let region: MKCoordinateRegion

    var body: some View {
        // Using FriendAvatarAnnotation in map instead
        EmptyView()
    }
}

// MARK: - Heat Zone Overlay

/// Heat zone overlay for map visualization
struct HeatZoneOverlay: View {
    let heatZone: HeatZone
    let region: MKCoordinateRegion

    var body: some View {
        Circle()
            .fill(
                RadialGradient(
                    gradient: Gradient(colors: [heatZone.color, heatZone.color.opacity(0)]),
                    center: .center,
                    startRadius: 0,
                    endRadius: heatZone.size
                )
            )
            .frame(width: heatZone.size * 2, height: heatZone.size * 2)
            .position(
                x: coordinateToPosition(heatZone.coordinate).x,
                y: coordinateToPosition(heatZone.coordinate).y
            )
    }

    /// Convert coordinate to view position (simplified)
    private func coordinateToPosition(_ coordinate: CLLocationCoordinate2D) -> CGPoint {
        let span = region.span
        let center = region.center

        // Calculate relative position
        let latDiff = (coordinate.latitude - center.latitude) / span.latitudeDelta
        let lngDiff = (coordinate.longitude - center.longitude) / span.longitudeDelta

        // Assume screen size (will be adjusted by parent view)
        let screenWidth: CGFloat = 400
        let screenHeight: CGFloat = 600

        return CGPoint(
            x: (0.5 + lngDiff) * screenWidth,
            y: (0.5 - latDiff) * screenHeight
        )
    }
}
