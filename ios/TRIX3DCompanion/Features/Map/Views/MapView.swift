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
    @State private var selectedFriendId: String?

    // MARK: - Focus State

    @FocusState private var isSearchFocused: Bool

    // MARK: - Initialization

    init(viewModel: MapViewModel? = nil) {
        _viewModel = StateObject(wrappedValue: viewModel ?? MapViewModel())
    }

    // MARK: - Body

    var body: some View {
        GeometryReader { proxy in
            let mapOverlayBottomInset = bottomOverlayInset(for: proxy.safeAreaInsets.bottom)
            let locationButtonBottomInset = max(56, mapOverlayBottomInset - 56)

            ZStack {
                // Map
                mapContent

                // Top search area - pinned right below status bar/safe area
                VStack {
                    searchBarOverlay
                        .padding(.top, 8)

                    Spacer()
                }

                // Bottom content
                VStack {
                    Spacer()

                    // Friend markers bar
                    friendMarkersBar
                        .padding(.bottom, 8)

                    // Bottom status bar - always above GlassDock
                    bottomStatusBar
                        .padding(.bottom, mapOverlayBottomInset)
                }

                // Location button (right side)
                VStack {
                    Spacer()

                    HStack {
                        Spacer()

                        Button(action: centerOnUserLocation) {
                            ZStack {
                                Circle()
                                    .fill(.ultraThinMaterial)
                                    .frame(width: 56, height: 56)
                                    .overlay(
                                        Circle()
                                            .stroke(Color.white.opacity(0.35), lineWidth: 1)
                                    )
                                    .shadow(color: .shadow, radius: 8, x: 0, y: 4)

                                Image(systemName: viewModel.isUserLocationAvailable ? "location.fill" : "location")
                                    .font(.system(size: 20, weight: .semibold))
                                    .symbolRenderingMode(.hierarchical)
                                    .foregroundStyle(
                                        viewModel.isUserLocationAvailable
                                            ? Color.brandPurple
                                            : Color.textSecondary
                                    )
                            }
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("My location")
                        .padding(.trailing, 16)
                        .padding(.bottom, locationButtonBottomInset)
                    }
                }

                // Loading overlay
                if viewModel.isLoading {
                    loadingOverlay
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
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
        .sheet(
            isPresented: $viewModel.showFriendDetail,
            onDismiss: {
                selectedFriendId = nil
                viewModel.clearSelectedFriend()
            }
        ) {
            if let friend = viewModel.selectedFriend {
                FriendDetailSheet(friend: friend)
                    .presentationDetents([.fraction(0.35), .medium])
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
            // Base map with location markers and friend markers
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
            .ignoresSafeArea()

            // Heat zone overlays
            ForEach(viewModel.heatZones) { heatZone in
                HeatZoneOverlay(heatZone: heatZone, region: viewModel.region)
            }
        }
    }

    /// Friend markers bar at bottom
    private var friendMarkersBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(viewModel.friendLocations) { friend in
                    FriendMarkerView(
                        friend: friend,
                        isSelected: selectedFriendId == friend.id
                    ) {
                        selectedFriendId = friend.id
                        viewModel.selectFriend(friend)
                    }
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
        }
        .background(.ultraThinMaterial)
        .overlay(
            RoundedRectangle(cornerRadius: 20)
                .stroke(Color.white.opacity(0.28), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .shadow(color: .shadow, radius: 8, x: 0, y: 4)
        .padding(.horizontal, 16)
        .frame(height: 64)
    }

    /// Search bar overlay
    private var searchBarOverlay: some View {
        VStack(spacing: 10) {
            // Search bar
            HStack(spacing: 12) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Color.textSecondary)

                TextField("Search locations...", text: $viewModel.searchQuery)
                    .textFieldStyle(.plain)
                    .font(.body)
                    .focused($isSearchFocused)
                    .autocapitalization(.none)
                    .disableAutocorrection(true)
                    .accessibilityLabel("Search locations")

                if !viewModel.searchQuery.isEmpty {
                    Button(action: { viewModel.clearSearch() }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(Color.textTertiary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(.ultraThinMaterial)
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(Color.white.opacity(0.25), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .shadow(color: .shadow, radius: 8, x: 0, y: 4)
            .padding(.horizontal, 16)

            // Search results list
            if isSearchFocused && !viewModel.filteredLocations.isEmpty {
                searchResultsList
            }

            // Category filters
            categoryFilterBar
        }
    }

    /// Category filter bar
    private var categoryFilterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                // All categories
                CategoryFilterChip(
                    title: "All",
                    icon: "line.3.horizontal.decrease.circle.fill",
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
            .padding(.horizontal, 16)
            .padding(.vertical, 2)
        }
    }

    /// Search results list
    private var searchResultsList: some View {
        ScrollView {
            LazyVStack(spacing: 8) {
                ForEach(viewModel.filteredLocations) { location in
                    SearchResultRow(location: location) {
                        viewModel.selectLocation(location)
                        isSearchFocused = false
                    }
                }
            }
            .padding(.horizontal)
            .padding(.top, 8)
        }
        .frame(maxHeight: 200)
        .background(Color.cardBackground.shadow(color: .shadow, radius: 8, x: 0, y: 4))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .padding(.horizontal, 16)
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

    /// Keep overlays above the floating bottom dock on every iPhone size.
    private func bottomOverlayInset(for safeBottom: CGFloat) -> CGFloat {
        let dockHeight: CGFloat = 70
        let dockBottomPadding: CGFloat = 8
        let spacingAboveDock: CGFloat = 56
        return safeBottom + dockHeight + dockBottomPadding + spacingAboveDock
    }
}

// MARK: - Location Marker

/// Custom map marker for locations
struct LocationMarker: View {
    let location: Location
    let color: Color
    let iconName: String
    let action: () -> Void

    @State private var isPressed = false

    var body: some View {
        Button(action: {
            SecureLogger.shared.debug("LocationMarker tapped: \(location.name)")
            action()
        }) {
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
                .scaleEffect(isPressed ? 1.2 : 1.0)

                // Triangle pointer
                Triangle()
                    .fill(color.gradient)
                    .frame(width: 12, height: 8)
                    .offset(y: -4)
            }
        }
        .buttonStyle(.plain)
        .frame(width: 50, height: 60) // Make tappable area larger
    }
}

// MARK: - Triangle Shape

/// Search result row for location selection
struct SearchResultRow: View {
    let location: Location
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                // Category icon
                ZStack {
                    Circle()
                        .fill(categoryColor.opacity(0.2))
                        .frame(width: 40, height: 40)

                    Image(systemName: location.category?.iconName ?? "mappin.circle.fill")
                        .font(.system(size: 16))
                        .foregroundColor(categoryColor)
                }

                // Location info
                VStack(alignment: .leading, spacing: 2) {
                    Text(location.name)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(.textPrimary)

                    Text(location.address ?? "")
                        .font(.caption)
                        .foregroundColor(.textSecondary)
                        .lineLimit(1)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundColor(.textTertiary)
            }
            .padding(12)
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
    }

    private var categoryColor: Color {
        guard let category = location.category else { return .gray }
        switch category {
        case .school: return .blue
        case .library: return .purple
        case .cafe: return .orange
        case .home: return .green
        case .park: return .green
        case .other: return .gray
        }
    }
}

/// Triangle shape for marker pointer

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
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 14, weight: .semibold))
                    .frame(width: 16, height: 16)
                    .symbolRenderingMode(.hierarchical)

                Text(title)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .lineLimit(1)
            }
            .foregroundStyle(isSelected ? Color.white : Color.textPrimary)
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(
                isSelected
                    ? Color.brandPurple
                    : Color.cardBackground.opacity(0.95)
            )
            .overlay(
                Capsule()
                    .stroke(
                        isSelected ? Color.brandPurple.opacity(0.35) : Color.separator.opacity(0.6),
                        lineWidth: 1
                    )
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

private struct FriendDetailSheet: View {
    let friend: FriendMapLocation

    var body: some View {
        VStack(spacing: 16) {
            HStack(spacing: 12) {
                Circle()
                    .fill(avatarGradient)
                    .frame(width: 56, height: 56)
                    .overlay(
                        Text(String(friend.name.prefix(1)).uppercased())
                            .font(.title3)
                            .fontWeight(.bold)
                            .foregroundStyle(.white)
                    )

                VStack(alignment: .leading, spacing: 4) {
                    Text(friend.name)
                        .font(.headline)
                        .foregroundStyle(Color.textPrimary)

                    HStack(spacing: 6) {
                        Circle()
                            .fill(statusColor)
                            .frame(width: 8, height: 8)
                        Text(statusText)
                            .font(.subheadline)
                            .foregroundStyle(Color.textSecondary)
                    }
                }

                Spacer()
            }

            HStack(spacing: 10) {
                Label(
                    friend.isStudying ? "正在学习" : "暂未学习",
                    systemImage: friend.isStudying ? "book.fill" : "moon.zzz.fill"
                )
                .font(.subheadline)
                .foregroundStyle(friend.isStudying ? Color.green : Color.textSecondary)

                Spacer()
            }

            HStack(spacing: 10) {
                Image(systemName: "mappin.and.ellipse")
                    .foregroundStyle(Color.brandPurple)
                Text(String(format: "纬度 %.4f，经度 %.4f", friend.latitude, friend.longitude))
                    .font(.caption)
                    .foregroundStyle(Color.textSecondary)
                Spacer()
            }
        }
        .padding(20)
        .background(Color.background)
    }

    private var avatarGradient: LinearGradient {
        let colors: [Color] = [.blue, .purple, .pink, .orange, .green, .teal]
        let color = colors[abs(friend.name.hashValue) % colors.count]
        return LinearGradient(
            colors: [color, color.opacity(0.7)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

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

    private var statusText: String {
        switch friend.status {
        case "online":
            return "在线"
        case "away":
            return "离开中"
        default:
            return "离线"
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
// MARK: - Friend Marker View

/// Friend marker view for map annotations - proper size with letter
private struct FriendMarkerView: View {
    let friend: FriendMapLocation
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 8) {
                // Avatar with status
                ZStack(alignment: .bottomTrailing) {
                    Circle()
                        .fill(avatarGradient)
                        .frame(width: 26, height: 26)
                        .overlay(
                            Text(String(friend.name.prefix(1)).uppercased())
                                .font(.system(size: 11, weight: .bold))
                                .foregroundStyle(.white)
                        )
                        .overlay(
                            Circle()
                                .strokeBorder(.white.opacity(0.9), lineWidth: 1)
                        )

                    Circle()
                        .fill(statusColor)
                        .frame(width: 9, height: 9)
                        .overlay(
                            Circle()
                                .strokeBorder(.white, lineWidth: 1)
                        )
                        .offset(x: 2, y: 2)
                }

                Text(friend.name)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundStyle(Color.textPrimary)

                if friend.isStudying {
                    Image(systemName: "book.fill")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Color.green)
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(
                isSelected
                    ? Color.brandPurple.opacity(0.18)
                    : Color.cardBackground.opacity(0.92)
            )
            .overlay(
                Capsule()
                    .stroke(
                        isSelected ? Color.brandPurple.opacity(0.65) : Color.separator.opacity(0.55),
                        lineWidth: 1
                    )
            )
            .clipShape(Capsule())
            .shadow(color: isSelected ? Color.brandPurple.opacity(0.28) : .clear, radius: 6, x: 0, y: 3)
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
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
