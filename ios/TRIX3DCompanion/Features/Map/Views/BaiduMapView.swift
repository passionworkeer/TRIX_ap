//
//  BaiduMapView.swift
//  TRIX3DCompanion
//
//  Baidu Map SwiftUI view using real BMKMapView
//

import SwiftUI
import CoreLocation
import BaiduMapAPI_Map
import BaiduMapAPI_Utils

// MARK: - Baidu Map View

/// Baidu Map SwiftUI view using BMKMapView
struct BaiduMapView: View {

    // MARK: - Properties

    /// Center coordinate
    @Binding var centerCoordinate: CLLocationCoordinate2D

    /// Zoom level
    @Binding var zoomLevel: Double

    /// Annotations
    let annotations: [MapAnnotationItem]

    /// Annotation tap callback
    var onAnnotationTapped: ((MapAnnotationItem) -> Void)?

    /// Map pan callback
    var onRegionChanged: ((CLLocationCoordinate2D) -> Void)?

    /// Whether to show user location
    let showsUserLocation: Bool

    /// Route coordinates for polyline overlay
    let routeCoordinates: [CLLocationCoordinate2D]?

    /// Route color
    let routeColor: Color

    // MARK: - State

    @State private var bmkZoomLevel: Float = 14

    // MARK: - Body

    var body: some View {
        ZStack {
            // Baidu Map via UIViewRepresentable
            BMKMapViewRepresentable(
                centerCoordinate: $centerCoordinate,
                zoomLevel: $bmkZoomLevel,
                annotations: annotations,
                routeCoordinates: routeCoordinates,
                showsUserLocation: showsUserLocation,
                userTrackingMode: BMKUserTrackingMode(rawValue: 2),
                onAnnotationTapped: { id, name in
                    if let annotation = annotations.first(where: { $0.id == id }) {
                        onAnnotationTapped?(annotation)
                    }
                },
                onRegionChanged: { coordinate in
                    onRegionChanged?(coordinate)
                },
                isInteractive: true
            )
            .ignoresSafeArea()

            // Zoom controls overlay
            VStack {
                Spacer()
                HStack {
                    Spacer()
                    ZoomControlsView(zoomLevel: $zoomLevel) { action in
                        handleZoomAction(action)
                    }
                    .padding()
                }
            }
        }
        .onAppear {
            bmkZoomLevel = Float(zoomLevel)
        }
        .onChange(of: zoomLevel) { newValue in
            bmkZoomLevel = Float(newValue)
        }
    }

    // MARK: - Methods

    private func handleZoomAction(_ action: ZoomControlAction) {
        withAnimation {
            switch action {
            case .zoomIn:
                bmkZoomLevel = min(21, bmkZoomLevel + 1)
                zoomLevel = Double(bmkZoomLevel)
            case .zoomOut:
                bmkZoomLevel = max(3, bmkZoomLevel - 1)
                zoomLevel = Double(bmkZoomLevel)
            case .centerUser:
                if let location = LocationManager.shared.currentLocation {
                    // Convert from WGS-84 (device) to GCJ-02 for Baidu Map
                    let gcj02Coord = BMKCoordTrans(location.coordinate, BMK_COORD_TYPE(rawValue: 0)!, BMK_COORD_TYPE(rawValue: 1)!)
                    centerCoordinate = gcj02Coord
                }
            }
        }
    }
}

// MARK: - Zoom Control Action

/// Zoom control action
enum ZoomControlAction {
    case zoomIn
    case zoomOut
    case centerUser
}

// MARK: - Map Annotation Item

/// Map annotation item - compatible with both MapKit and Baidu
struct MapAnnotationItem: Identifiable {
    let id: String
    let name: String
    let subtitle: String?
    let coordinate: CLLocationCoordinate2D
    let category: LocationCategory
    let iconName: String

    init(id: String, name: String, subtitle: String? = nil, coordinate: CLLocationCoordinate2D, category: LocationCategory) {
        self.id = id
        self.name = name
        self.subtitle = subtitle
        self.coordinate = coordinate
        self.category = category
        self.iconName = MapAnnotationItem.iconForCategory(category)
    }

    static func iconForCategory(_ category: LocationCategory) -> String {
        switch category {
        case .school: return "building.columns.fill"
        case .library: return "books.vertical.fill"
        case .cafe: return "cup.and.saucer.fill"
        case .restaurant: return "fork.knife"
        case .entertainment: return "gamecontroller.fill"
        case .home: return "house.fill"
        case .park: return "leaf.fill"
        case .other: return "mappin"
        }
    }
}

// MARK: - Annotation View

/// Annotation view for displaying map markers
struct AnnotationView: View {
    let annotation: MapAnnotationItem
    var onTapped: ((MapAnnotationItem) -> Void)?

    @State private var isSelected = false

    var body: some View {
        VStack(spacing: 0) {
            ZStack {
                Circle()
                    .fill(annotationColor)
                    .frame(width: isSelected ? 44 : 36, height: isSelected ? 44 : 36)
                    .shadow(color: .black.opacity(0.2), radius: 4, x: 0, y: 2)

                Image(systemName: annotation.iconName)
                    .font(.system(size: isSelected ? 18 : 14, weight: .semibold))
                    .foregroundColor(.white)
            }

            // Tail
            PointerShape()
                .fill(annotationColor)
                .frame(width: 12, height: 8)
                .offset(y: -2)
        }
        .scaleEffect(isSelected ? 1.1 : 1.0)
        .animation(.spring(response: 0.3), value: isSelected)
        .onTapGesture {
            withAnimation {
                isSelected = true
            }
            onTapped?(annotation)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                isSelected = false
            }
        }
    }

    private var annotationColor: Color {
        switch annotation.category {
        case .school: return .blue
        case .library: return .purple
        case .cafe: return .orange
        case .restaurant: return .red
        case .entertainment: return .pink
        case .home: return .green
        case .park: return .mint
        case .other: return .gray
        }
    }
}

// MARK: - Pointer Shape

/// Pointer shape for annotation tail
struct PointerShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.midX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        path.closeSubpath()
        return path
    }
}

// MARK: - Zoom Controls View

/// Zoom controls view
struct ZoomControlsView: View {
    @Binding var zoomLevel: Double
    var onAction: ((ZoomControlAction) -> Void)?

    var body: some View {
        VStack(spacing: 0) {
            Button(action: { onAction?(.zoomIn) }) {
                Image(systemName: "plus")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(.primary)
                    .frame(width: 44, height: 44)
            }

            Divider()
                .frame(width: 24)

            Button(action: { onAction?(.zoomOut) }) {
                Image(systemName: "minus")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(.primary)
                    .frame(width: 44, height: 44)
            }

            Divider()
                .frame(width: 24)

            Button(action: { onAction?(.centerUser) }) {
                Image(systemName: "location.fill")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(.brandPurple)
                    .frame(width: 44, height: 44)
            }
        }
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .shadow(color: .black.opacity(0.1), radius: 8, x: 0, y: 4)
    }
}

// MARK: - Route Overlay View

/// Route overlay view for displaying paths
struct RouteOverlayView: View {
    let coordinates: [CLLocationCoordinate2D]
    let color: Color

    var body: some View {
        GeometryReader { geometry in
            Path { path in
                guard coordinates.count > 1 else { return }

                let firstCoord = coordinates[0]
                let minLat = coordinates.map { $0.latitude }.min() ?? firstCoord.latitude
                let maxLat = coordinates.map { $0.latitude }.max() ?? firstCoord.latitude
                let minLon = coordinates.map { $0.longitude }.min() ?? firstCoord.longitude
                let maxLon = coordinates.map { $0.longitude }.max() ?? firstCoord.longitude

                let latRange = maxLat - minLat
                let lonRange = maxLon - minLon

                guard latRange > 0, lonRange > 0 else { return }

                func normalizeCoord(_ coord: CLLocationCoordinate2D) -> CGPoint {
                    let x = (coord.longitude - minLon) / lonRange * geometry.size.width
                    let y = (1 - (coord.latitude - minLat) / latRange) * geometry.size.height
                    return CGPoint(x: x, y: y)
                }

                path.move(to: normalizeCoord(coordinates[0]))
                for coord in coordinates.dropFirst() {
                    path.addLine(to: normalizeCoord(coord))
                }
            }
            .stroke(color, style: StrokeStyle(lineWidth: 4, lineCap: .round, lineJoin: .round))
        }
        .allowsHitTesting(false)
    }
}

// MARK: - Location Manager

/// Simple location manager
final class LocationManager: NSObject, ObservableObject, CLLocationManagerDelegate {
    static let shared = LocationManager()

    @Published var currentLocation: CLLocation?
    @Published var authorizationStatus: CLAuthorizationStatus = .notDetermined

    private let manager = CLLocationManager()

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
    }

    func requestPermission() {
        manager.requestWhenInUseAuthorization()
    }

    func startUpdating() {
        manager.startUpdatingLocation()
    }

    func stopUpdating() {
        manager.stopUpdatingLocation()
    }

    // MARK: - CLLocationManagerDelegate

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        currentLocation = locations.last
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        authorizationStatus = manager.authorizationStatus
        if authorizationStatus == .authorizedWhenInUse || authorizationStatus == .authorizedAlways {
            manager.startUpdatingLocation()
        }
    }
}

// MARK: - POI Search Bar

/// POI search bar
struct POISearchBar: View {
    @Binding var searchText: String
    var onSearch: ((String) -> Void)?
    var onClear: (() -> Void)?

    @FocusState private var isFocused: Bool

    var body: some View {
        HStack(spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(.brandPurple.opacity(0.85))

                TextField("搜索地点、关键词", text: $searchText)
                    .textFieldStyle(.plain)
                    .font(.system(size: 16, weight: .medium))
                    .focused($isFocused)
                    .onSubmit {
                        onSearch?(searchText)
                    }

                if !searchText.isEmpty {
                    Button(action: {
                        searchText = ""
                        onClear?()
                    }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 16))
                            .foregroundStyle(.gray)
                    }
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .shadow(color: .black.opacity(0.08), radius: 8, x: 0, y: 4)

            if isFocused {
                Button("取消") {
                    searchText = ""
                    isFocused = false
                    onClear?()
                }
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(.brandPurple)
            }
        }
        .padding(.horizontal, 16)
    }
}

// MARK: - POI List Item

/// POI list item view
struct POIListItem: View {
    let poi: BaiduPOI
    var onTap: (() -> Void)?

    var body: some View {
        Button(action: { onTap?() }) {
            HStack(spacing: 12) {
                ZStack {
                    Circle()
                        .fill(LinearGradient(
                            colors: [.brandPurple.opacity(0.2), .brandPurple.opacity(0.1)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ))
                        .frame(width: 44, height: 44)

                    Image(systemName: "mappin.circle.fill")
                        .font(.system(size: 22))
                        .foregroundStyle(.brandPurple)
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text(poi.name)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Color.textPrimary)
                        .lineLimit(1)

                    Text(poi.address)
                        .font(.system(size: 13))
                        .foregroundStyle(Color.textSecondary)
                        .lineLimit(2)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(.gray)
            }
            .padding(.vertical, 8)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Navigation Card

/// Navigation card view
struct NavigationCard: View {
    let route: BaiduRoute
    let destination: String
    var onStartNavigation: (() -> Void)?
    var onClose: (() -> Void)?

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("规划路线")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Color.textSecondary)

                    Text(destination)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Color.textPrimary)
                        .lineLimit(1)
                }

                Spacer()

                Button(action: { onClose?() }) {
                    Image(systemName: "xmark")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(.gray)
                        .frame(width: 32, height: 32)
                        .background(Color.gray.opacity(0.1))
                        .clipShape(Circle())
                }
            }
            .padding()

            Divider()

            // Route info
            HStack(spacing: 24) {
                VStack(spacing: 4) {
                    Text(route.formattedDistance)
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(.brandPurple)
                    Text("距离")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.textSecondary)
                }

                VStack(spacing: 4) {
                    Text(route.formattedDuration)
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(.brandPurple)
                    Text("预计时间")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.textSecondary)
                }

                Spacer()
            }
            .padding()

            // Start navigation button
            Button(action: { onStartNavigation?() }) {
                HStack {
                    Image(systemName: "arrow.triangle.turn.up.right.circle.fill")
                        .font(.system(size: 18))
                    Text("开始导航")
                        .font(.system(size: 16, weight: .semibold))
                }
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Color.brandPurple)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .padding(.horizontal)
            .padding(.bottom)
        }
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.15), radius: 12, x: 0, y: 4)
        .padding(.horizontal, 16)
        .padding(.bottom, 100)
    }
}

// MARK: - Preview

#Preview {
    BaiduMapView(
        centerCoordinate: .constant(CLLocationCoordinate2D(latitude: 31.2304, longitude: 121.4737)),
        zoomLevel: .constant(0.01),
        annotations: [
            MapAnnotationItem(
                id: "1",
                name: "图书馆",
                subtitle: "上海市图书馆",
                coordinate: CLLocationCoordinate2D(latitude: 31.2304, longitude: 121.4737),
                category: .library
            )
        ],
        showsUserLocation: true,
        routeCoordinates: nil,
        routeColor: .brandPurple
    )
}
