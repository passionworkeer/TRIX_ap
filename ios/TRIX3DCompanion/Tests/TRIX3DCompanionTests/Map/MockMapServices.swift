//
//  MockMapServices.swift
//  TRIX3DCompanionTests
//
//  Mock services for Map module testing
//

import Foundation
import CoreLocation
import UIKit
import AVFoundation
import Combine
@testable import TRIX3DCompanion

// MARK: - Mock Location Service for Map Tests

@MainActor
final class MockLocationService: LocationServiceProtocol {
    var currentLocation: CLLocation?
    var authorizationStatus: CLAuthorizationStatus = .authorizedWhenInUse
    var isLocationUpdating: Bool = false

    var mockPermissionResult: Bool = true
    var mockFetchNearbyLocationsResult: Result<[Location], LocationError>?
    var mockShareLocationResult: Result<Bool, LocationError>?
    var mockShouldReturnCachedLocation: Bool = true

    var requestPermissionCallCount: Int = 0
    var getCurrentLocationCallCount: Int = 0
    var startLocationUpdatesCallCount: Int = 0
    var stopLocationUpdatesCallCount: Int = 0
    var fetchNearbyLocationsCallCount: Int = 0
    var shareLocationCallCount: Int = 0
    var lastFetchRadius: Double?
    var lastShareCompanionId: String?

    func requestPermission() -> Bool {
        requestPermissionCallCount += 1
        return mockPermissionResult
    }

    func getCurrentLocation() -> CLLocation? {
        getCurrentLocationCallCount += 1
        if mockShouldReturnCachedLocation {
            return currentLocation
        }
        return currentLocation
    }

    func startLocationUpdates() {
        startLocationUpdatesCallCount += 1
        isLocationUpdating = true
    }

    func stopLocationUpdates() {
        stopLocationUpdatesCallCount += 1
        isLocationUpdating = false
    }

    func fetchNearbyLocations(radius: Double) async -> LocationResult<[Location]> {
        fetchNearbyLocationsCallCount += 1
        lastFetchRadius = radius
        return mockFetchNearbyLocationsResult ?? .success([])
    }

    func shareLocation(with companionId: String) async -> LocationResult<Bool> {
        shareLocationCallCount += 1
        lastShareCompanionId = companionId
        return mockShareLocationResult ?? .success(true)
    }

    func reset() {
        currentLocation = nil
        authorizationStatus = .authorizedWhenInUse
        isLocationUpdating = false
        mockPermissionResult = true
        mockFetchNearbyLocationsResult = nil
        mockShareLocationResult = nil
        mockShouldReturnCachedLocation = true
        requestPermissionCallCount = 0
        getCurrentLocationCallCount = 0
        startLocationUpdatesCallCount = 0
        stopLocationUpdatesCallCount = 0
        fetchNearbyLocationsCallCount = 0
        shareLocationCallCount = 0
        lastFetchRadius = nil
        lastShareCompanionId = nil
    }
}

// MARK: - Mock Map Search Service

@MainActor
final class MockMapSearchService: MapSearchServiceProtocol {
    var isAvailable: Bool { true }

    func initialize(completion: @escaping (Bool) -> Void) {
        completion(true)
    }

    var shouldFailSearchPOI: Bool = false
    var shouldFailRoutePlan: Bool = false
    var mockPOIResults: [POIResult] = []
    var mockRouteResult: RouteResult?

    var searchPOICallCount: Int = 0
    var searchNearbyCallCount: Int = 0
    var routePlanCallCount: Int = 0
    var lastSearchKeyword: String?
    var lastRouteFrom: CLLocationCoordinate2D?
    var lastRouteTo: CLLocationCoordinate2D?

    func searchPOI(keyword: String, city: String, completion: @escaping ([POIResult]) -> Void) {
        searchPOICallCount += 1
        lastSearchKeyword = keyword

        if shouldFailSearchPOI {
            completion([])
            return
        }

        let results = mockPOIResults.isEmpty ? Self.defaultMockResults(keyword: keyword) : mockPOIResults
        completion(results)
    }

    func searchNearby(
        latitude: Double,
        longitude: Double,
        radius: Int,
        keyword: String,
        completion: @escaping ([POIResult]) -> Void
    ) {
        searchNearbyCallCount += 1
        lastSearchKeyword = keyword

        if shouldFailSearchPOI {
            completion([])
            return
        }

        let results = mockPOIResults.isEmpty ? Self.defaultMockResults(keyword: keyword) : mockPOIResults
        completion(results)
    }

    func routePlan(from: CLLocationCoordinate2D, to: CLLocationCoordinate2D, completion: @escaping (RouteResult?) -> Void) {
        routePlanCallCount += 1
        lastRouteFrom = from
        lastRouteTo = to

        if shouldFailRoutePlan {
            completion(nil)
            return
        }

        completion(mockRouteResult ?? Self.defaultMockRouteResult)
    }

    func openNavigation(
        toLatitude: Double,
        toLongitude: Double,
        toName: String,
        fromLatitude: Double? = nil,
        fromLongitude: Double? = nil
    ) {
        // Mock navigation - no-op
    }

    func reset() {
        shouldFailSearchPOI = false
        shouldFailRoutePlan = false
        mockPOIResults = []
        mockRouteResult = nil
        searchPOICallCount = 0
        searchNearbyCallCount = 0
        routePlanCallCount = 0
        lastSearchKeyword = nil
        lastRouteFrom = nil
        lastRouteTo = nil
    }

    // MARK: - Default Mock Data

    static var defaultMockRouteResult: RouteResult {
        RouteResult(
            distance: 2500,
            duration: 600,
            coordinates: []
        )
    }

    static func defaultMockResults(keyword: String) -> [POIResult] {
        [
            POIResult(
                name: "24H 沉浸自习室",
                address: "市中心, 上海",
                coordinate: CLLocationCoordinate2D(latitude: 31.2319, longitude: 121.4719)
            ),
            POIResult(
                name: "中心区市立图书馆",
                address: "中心区, 上海",
                coordinate: CLLocationCoordinate2D(latitude: 31.2286, longitude: 121.4708)
            )
        ]
    }
}

// MARK: - Mock Camera Service for Snapshot Tests

@MainActor
final class MockCameraServiceForSnapshot: CameraServiceProtocol {
    // MARK: - State

    @Published var isSessionRunningValue: Bool = false
    @Published var flashModeValue: AVCaptureDevice.FlashMode = .off
    @Published var cameraPositionValue: AVCaptureDevice.Position = .back
    var lastErrorValue: CameraError?
    var shouldFailCapture: Bool = false
    var shouldFailStart: Bool = false
    var mockCapturedImage: UIImage?
    var simulatedCaptureDelayNanoseconds: UInt64 = 0
    var simulatedStartDelayNanoseconds: UInt64 = 0

    // MARK: - Call Tracking

    var requestPermissionCallCount: Int = 0
    var capturePhotoCallCount: Int = 0
    var switchCameraCallCount: Int = 0
    var toggleFlashCallCount: Int = 0
    var startCameraSessionCallCount: Int = 0
    var stopCameraSessionCallCount: Int = 0

    // MARK: - CameraServiceProtocol

    func requestPermission() async -> Bool {
        requestPermissionCallCount += 1
        return true
    }

    func capturePhoto() async -> Result<UIImage, CameraError> {
        capturePhotoCallCount += 1

        if simulatedCaptureDelayNanoseconds > 0 {
            try? await Task.sleep(nanoseconds: simulatedCaptureDelayNanoseconds)
        }

        if shouldFailCapture {
            lastErrorValue = .captureFailed(NSError(domain: "Test", code: -1))
            return .failure(lastErrorValue!)
        }

        let image = mockCapturedImage ?? UIImage(systemName: "photo")!
        return .success(image)
    }

    func switchCamera() {
        switchCameraCallCount += 1
        cameraPositionValue = cameraPositionValue == .back ? .front : .back
    }

    func toggleFlash() {
        toggleFlashCallCount += 1
        switch flashModeValue {
        case .off: flashModeValue = .on
        case .on: flashModeValue = .auto
        case .auto: flashModeValue = .off
        @unknown default: flashModeValue = .off
        }
    }

    func startCameraSession() async -> Result<Void, CameraError> {
        startCameraSessionCallCount += 1

        if simulatedStartDelayNanoseconds > 0 {
            try? await Task.sleep(nanoseconds: simulatedStartDelayNanoseconds)
        }

        if shouldFailStart {
            lastErrorValue = .sessionNotRunning
            return .failure(lastErrorValue!)
        }

        isSessionRunningValue = true
        return .success(())
    }

    func stopCameraSession() {
        stopCameraSessionCallCount += 1
        isSessionRunningValue = false
    }

    var isSessionRunning: Bool {
        return isSessionRunningValue
    }

    var flashMode: AVCaptureDevice.FlashMode {
        return flashModeValue
    }

    var cameraPosition: AVCaptureDevice.Position {
        return cameraPositionValue
    }

    var lastError: CameraError? {
        return lastErrorValue
    }

    var flashModePublisher: AnyPublisher<AVCaptureDevice.FlashMode, Never> {
        $flashModeValue.eraseToAnyPublisher()
    }

    var cameraPositionPublisher: AnyPublisher<AVCaptureDevice.Position, Never> {
        $cameraPositionValue.eraseToAnyPublisher()
    }

    var isSessionRunningPublisher: AnyPublisher<Bool, Never> {
        $isSessionRunningValue.eraseToAnyPublisher()
    }

    func reset() {
        isSessionRunningValue = false
        flashModeValue = .off
        cameraPositionValue = .back
        lastErrorValue = nil
        shouldFailCapture = false
        shouldFailStart = false
        mockCapturedImage = nil
        simulatedCaptureDelayNanoseconds = 0
        simulatedStartDelayNanoseconds = 0
        requestPermissionCallCount = 0
        capturePhotoCallCount = 0
        switchCameraCallCount = 0
        toggleFlashCallCount = 0
        startCameraSessionCallCount = 0
        stopCameraSessionCallCount = 0
    }
}

// MARK: - Mock Image Upload Service for Snapshot Tests

@MainActor
final class MockImageUploadServiceForSnapshot: ImageUploadServiceProtocol {
    var shouldFailUpload: Bool = false
    var uploadCallCount: Int = 0
    var mockUploadedURL: String = "https://example.com/snapshots/test.jpg"

    @Published var uploadProgressValue: Double = 0.0
    @Published var isUploadingValue: Bool = false

    var uploadProgress: Double {
        uploadProgressValue
    }

    var isUploading: Bool {
        isUploadingValue
    }

    var uploadProgressPublisher: Published<Double>.Publisher { $uploadProgressValue }
    var isUploadingPublisher: Published<Bool>.Publisher { $isUploadingValue }

    func uploadImage(_ image: UIImage, quality: CGFloat?) async -> Result<String, UploadError> {
        uploadCallCount += 1
        isUploadingValue = true

        if shouldFailUpload {
            isUploadingValue = false
            return .failure(.unknown(nil))
        }

        isUploadingValue = false
        return .success(mockUploadedURL)
    }

    func reset() {
        shouldFailUpload = false
        uploadCallCount = 0
        mockUploadedURL = "https://example.com/snapshots/test.jpg"
        uploadProgressValue = 0.0
        isUploadingValue = false
    }
}

// MARK: - Helper Extensions

extension MockLocationService {
    static func createMockLocation(
        id: String = "loc_1",
        name: String = "Test Location",
        latitude: Double = 31.2304,
        longitude: Double = 121.4737,
        category: LocationCategory = .library
    ) -> Location {
        Location(
            id: id,
            userId: "user1",
            name: name,
            description: "A test location",
            latitude: latitude,
            longitude: longitude,
            address: "123 Test Street, Shanghai",
            category: category,
            createdAt: Date(),
            updatedAt: Date()
        )
    }

    static func createMockFriendLocation(
        id: String = "friend_1",
        name: String = "Test Friend",
        latitude: Double = 31.2304,
        longitude: Double = 121.4737,
        isStudying: Bool = true,
        status: String = "online"
    ) -> FriendMapLocation {
        FriendMapLocation(
            id: id,
            name: name,
            avatarUrl: "https://i.pravatar.cc/150?img=1",
            latitude: latitude,
            longitude: longitude,
            isStudying: isStudying,
            status: status
        )
    }

    static func createMockCLLocation(
        latitude: Double = 31.2304,
        longitude: Double = 121.4737
    ) -> CLLocation {
        CLLocation(latitude: latitude, longitude: longitude)
    }
}
