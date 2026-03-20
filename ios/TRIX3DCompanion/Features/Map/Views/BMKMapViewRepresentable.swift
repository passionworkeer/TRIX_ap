//
//  BMKMapViewRepresentable.swift
//  TRIX3DCompanion
//
//  UIViewRepresentable wrapper for BMKMapView to use in SwiftUI
//

import SwiftUI
import BaiduMapAPI_Map
import CoreLocation

// MARK: - Custom Annotation with ID Storage

/// Custom annotation that stores ID for tap handling
/// BMKPointAnnotation has no userData property in Swift, so we subclass
final class BMKCustomAnnotation: BMKPointAnnotation {
    /// Unique identifier for the annotation
    var annotationId: String = ""
    /// Category string for styling
    var categoryString: String = ""
}

// MARK: - BMKMapView Representable

/// UIViewRepresentable wrapper for BMKMapView
/// Allows using Baidu Map in SwiftUI views
struct BMKMapViewRepresentable: UIViewRepresentable {

    // MARK: - Coordinator

    /// Coordinator for BMKMapViewDelegate
    /// Stores a reference to the parent Binding for updating center coordinate
    class Coordinator: NSObject, BMKMapViewDelegate {

        // MARK: - Properties

        /// Binding to the parent view's center coordinate
        var centerCoordinateBinding: Binding<CLLocationCoordinate2D>?

        /// Current annotations on the map
        private var currentAnnotations: [BMKCustomAnnotation] = []

        /// Current route overlay
        private var currentOverlay: BMKPolyline?

        // MARK: - Callback Closures

        var onAnnotationTapped: ((String, String) -> Void)?
        var onRegionChanged: ((CLLocationCoordinate2D) -> Void)?
        var onMapClicked: ((CLLocationCoordinate2D) -> Void)?

        // MARK: - BMKMapViewDelegate

        func mapView(_ mapView: BMKMapView!, didSelectAnnotationView view: BMKAnnotationView!) {
            guard let annotation = view.annotation as? BMKCustomAnnotation else { return }
            onAnnotationTapped?(annotation.annotationId, annotation.title ?? "")
        }

        func mapView(_ mapView: BMKMapView!, regionDidChangeAnimated animated: Bool) {
            let center = mapView.centerCoordinate
            centerCoordinateBinding?.wrappedValue = center
            onRegionChanged?(center)
        }

        func mapView(_ mapView: BMKMapView!, onClickedMapCoordinate mapCoordinate: CLLocationCoordinate2D) {
            onMapClicked?(mapCoordinate)
        }

        func mapView(_ mapView: BMKMapView!, viewFor overlay: BMKOverlay!) -> BMKOverlayView! {
            if let polyline = overlay as? BMKPolyline {
                let overlayView = BMKPolylineView(polyline: polyline)
                overlayView?.strokeColor = UIColor(red: 0.58, green: 0.39, blue: 0.95, alpha: 1.0)
                overlayView?.lineWidth = 5.0
                return overlayView
            }
            return nil
        }

        // MARK: - Public Methods

        /// Update annotations on the map
        func updateAnnotations(_ annotations: [MapAnnotationItem], mapView: BMKMapView) {
            mapView.removeAnnotations(currentAnnotations)
            currentAnnotations.removeAll()

            var newAnnotations: [BMKCustomAnnotation] = []
            for item in annotations {
                let annotation = BMKCustomAnnotation()
                annotation.coordinate = item.coordinate
                annotation.title = item.name
                annotation.subtitle = item.subtitle
                annotation.annotationId = item.id
                annotation.categoryString = item.category.rawValue
                newAnnotations.append(annotation)
            }

            mapView.addAnnotations(newAnnotations)
            currentAnnotations = newAnnotations
        }

        /// Update route overlay on the map
        func updateRouteOverlay(_ coordinates: [CLLocationCoordinate2D], mapView: BMKMapView) {
            if let oldOverlay = currentOverlay {
                mapView.remove(oldOverlay)
            }

            guard coordinates.count > 1 else { return }

            // Create polyline using init(coordinates:count:)
            var mutableCoords = coordinates
            if let polyline = BMKPolyline(coordinates: &mutableCoords, count: UInt(coordinates.count)) {
                currentOverlay = polyline
                mapView.add(polyline)
            }
        }

        /// Clear all overlays
        func clearOverlays(mapView: BMKMapView) {
            if let overlay = currentOverlay {
                mapView.remove(overlay)
                currentOverlay = nil
            }
        }
    }

    // MARK: - Properties

    /// Center coordinate of the map
    @Binding var centerCoordinate: CLLocationCoordinate2D

    /// Zoom level (3-21 for Baidu Map)
    @Binding var zoomLevel: Float

    /// Annotations to display
    let annotations: [MapAnnotationItem]

    /// Route coordinates for polyline overlay
    let routeCoordinates: [CLLocationCoordinate2D]?

    /// Whether to show user location
    let showsUserLocation: Bool

    /// User tracking mode
    let userTrackingMode: BMKUserTrackingMode

    /// Annotation tap callback: (id, name)
    var onAnnotationTapped: ((String, String) -> Void)?

    /// Region change callback
    var onRegionChanged: ((CLLocationCoordinate2D) -> Void)?

    /// Map click callback
    var onMapClicked: ((CLLocationCoordinate2D) -> Void)?

    /// Is map interactable
    let isInteractive: Bool

    // MARK: - Make UIView

    func makeUIView(context: Context) -> BMKMapView {
        let mapView = BMKMapView()
        mapView.delegate = context.coordinator

        // Configure coordinator with binding
        context.coordinator.centerCoordinateBinding = $centerCoordinate
        context.coordinator.onAnnotationTapped = onAnnotationTapped
        context.coordinator.onRegionChanged = onRegionChanged
        context.coordinator.onMapClicked = onMapClicked

        // Configure map view
        mapView.centerCoordinate = centerCoordinate
        mapView.zoomLevel = zoomLevel
        mapView.isZoomEnabled = true
        mapView.isScrollEnabled = true
        mapView.isRotateEnabled = false
        mapView.showsUserLocation = showsUserLocation
        mapView.userTrackingMode = userTrackingMode
        mapView.mapType = .standard

        // Update annotations
        context.coordinator.updateAnnotations(annotations, mapView: mapView)

        // Add route overlay if present
        if let routeCoords = routeCoordinates, !routeCoords.isEmpty {
            context.coordinator.updateRouteOverlay(routeCoords, mapView: mapView)
        }

        return mapView
    }

    // MARK: - Update UIView

    func updateUIView(_ mapView: BMKMapView, context: Context) {
        // Update coordinator state
        context.coordinator.centerCoordinateBinding = $centerCoordinate
        context.coordinator.onAnnotationTapped = onAnnotationTapped
        context.coordinator.onRegionChanged = onRegionChanged
        context.coordinator.onMapClicked = onMapClicked

        // Update center coordinate if changed significantly
        let currentCenter = mapView.centerCoordinate
        let latDiff = abs(currentCenter.latitude - centerCoordinate.latitude)
        let lonDiff = abs(currentCenter.longitude - centerCoordinate.longitude)

        if latDiff > 0.0001 || lonDiff > 0.0001 {
            mapView.centerCoordinate = centerCoordinate
        }

        // Update zoom level if changed
        if abs(mapView.zoomLevel - zoomLevel) > 0.5 {
            mapView.zoomLevel = zoomLevel
        }

        // Update annotations
        context.coordinator.updateAnnotations(annotations, mapView: mapView)

        // Update route overlay
        if let routeCoords = routeCoordinates {
            context.coordinator.updateRouteOverlay(routeCoords, mapView: mapView)
        } else {
            context.coordinator.clearOverlays(mapView: mapView)
        }

        // Update user location setting
        mapView.showsUserLocation = showsUserLocation
    }

    // MARK: - Make Coordinator

    func makeCoordinator() -> Coordinator {
        return Coordinator()
    }
}
