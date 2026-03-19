//
//  BMKMapViewRepresentable.swift
//  TRIX3DCompanion
//
//  UIViewRepresentable wrapper for BMKMapView to use in SwiftUI
//

import SwiftUI
import BaiduMapKit
import CoreLocation

// MARK: - BMKMapView Representable

/// UIViewRepresentable wrapper for BMKMapView
/// Allows using Baidu Map in SwiftUI views
struct BMKMapViewRepresentable: UIViewRepresentable {

    // MARK: - Coordinator

    /// Coordinator for BMKMapViewDelegate
    class Coordinator: NSObject, BMKMapViewDelegate {

        // MARK: - Properties

        /// Parent representable view
        weak var parent: BMKMapViewRepresentable?

        /// Current annotations on the map
        private var currentAnnotations: [BMKPointAnnotation] = []

        /// Current route overlay
        private var currentOverlay: BMKPolyline?

        // MARK: - Initialization

        init(parent: BMKMapViewRepresentable) {
            self.parent = parent
        }

        // MARK: - BMKMapViewDelegate

        func mapView(_ mapView: BMKMapView!, didSelect view: BMKMapViewAnnotation!) {
            guard let annotation = view as? BMKPointAnnotation,
                  let userInfo = annotation.userData as? [String: Any] else { return }

            let id = userInfo["id"] as? String ?? ""
            let name = annotation.title ?? ""
            parent?.onAnnotationTapped?(id, name)
        }

        func mapView(_ mapView: BMKMapView!, regionDidChangeAnimated animated: Bool) {
            let center = mapView.centerCoordinate
            parent?.centerCoordinate = center
            parent?.onRegionChanged?(center)
        }

        func mapView(_ mapView: BMKMapView!, onClickedMapCoordinate mapCoordinate: CLLocationCoordinate2D) {
            parent?.onMapClicked?(mapCoordinate)
        }

        func mapView(_ mapView: BMKMapView!, didAddOverlayviews overlayviews: [Any]!) {
            // Handle overlay additions if needed
        }

        func mapView(_ mapView: BMKMapView!, viewFor overlay: BMKOverlay!) -> BMKOverlayView! {
            if let polyline = overlay as? BMKPolyline {
                let overlayView = BMKPolylineView(polyline: polyline)
                overlayView?.strokeColor = UIColor(red: 0.58, green: 0.39, blue: 0.95, alpha: 1.0) // brandPurple
                overlayView?.lineWidth = 5.0
                return overlayView
            }
            return nil
        }

        // MARK: - Public Methods

        /// Update annotations on the map
        func updateAnnotations(_ annotations: [MapAnnotationItem], mapView: BMKMapView) {
            // Remove old annotations
            mapView.removeAnnotations(currentAnnotations)
            currentAnnotations.removeAll()

            // Add new annotations
            var newAnnotations: [BMKPointAnnotation] = []
            for item in annotations {
                let annotation = BMKPointAnnotation()
                annotation.coordinate = item.coordinate
                annotation.title = item.name
                annotation.subtitle = item.subtitle
                annotation.userData = ["id": item.id, "category": item.category.rawValue]
                newAnnotations.append(annotation)
            }

            mapView.addAnnotations(newAnnotations)
            currentAnnotations = newAnnotations
        }

        /// Update route overlay on the map
        func updateRouteOverlay(_ coordinates: [CLLocationCoordinate2D], mapView: BMKMapView) {
            // Remove old overlay
            if let oldOverlay = currentOverlay {
                mapView.remove(oldOverlay)
            }

            guard coordinates.count > 1 else { return }

            // Create new overlay
            let points = coordinates.map { BMKMapPointForCGPoint(CGPoint(x: $0.longitude, y: $0.latitude)) }
            // Use coordinate array directly for polyline
            let polyline = BMKPolyline(coordinates: coordinates, count: UInt(coordinates.count))
            currentOverlay = polyline
            mapView.add(polyline)
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

        // Configure map view
        mapView.centerCoordinate = centerCoordinate
        mapView.zoomLevel = zoomLevel
        mapView.isZoomEnabled = true
        mapView.isScrollEnabled = true
        mapView.isRotateEnabled = false
        mapView.showsUserLocation = showsUserLocation
        mapView.userTrackingMode = userTrackingMode

        // Set map type to standard
        mapView.mapType = .standard

        // Set padding
        mapView.contentInset = UIEdgeInsets(top: 0, left: 0, bottom: 0, right: 0)

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
        // Update center coordinate if changed significantly
        let currentCenter = mapView.centerCoordinate
        let latDiff = abs(currentCenter.latitude - centerCoordinate.latitude)
        let lonDiff = abs(currentCenter.longitude - centerCoordinate.longitude)

        if latDiff > 0.0001 || lonDiff > 0.0001 {
            mapView.setCenter(centerCoordinate, animated: true)
        }

        // Update zoom level if changed
        if abs(mapView.zoomLevel - zoomLevel) > 0.5 {
            mapView.setZoomLevel(zoomLevel, animated: true)
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
        return Coordinator(parent: self)
    }
}

// MARK: - BMKUserTrackingMode Extension

extension BMKUserTrackingMode: @retroactive CaseIterable {
    public static var allCases: [BMKUserTrackingMode] {
        [.none, .follow, .followWithHeading]
    }
}
