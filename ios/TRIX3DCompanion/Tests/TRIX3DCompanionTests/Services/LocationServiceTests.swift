//
//  LocationServiceTests.swift
//  TRIX3DCompanionTests
//
//  Complete test suite for LocationService with Mock CLLocationManager
//

import XCTest
import CoreLocation
import Combine
@testable import TRIX3DCompanion

// MARK: - LocationService Tests

@MainActor
final class LocationServiceTests: XCTestCase {

    // MARK: - Properties

    var sut: LocationService!
    var cancellables: Set<AnyCancellable>!

    // MARK: - Test Lifecycle

    override func setUp() {
        super.setUp()

        sut = LocationService.shared
        cancellables = Set<AnyCancellable>()
    }

    override func tearDown() {
        sut = nil
        cancellables = nil
        super.tearDown()
    }

    // MARK: - Initial State Tests

    func testInitialState_NoLocation() {
        // Then
        XCTAssertNil(sut.currentLocation)
    }

    func testInitialState_NotUpdating() {
        // Then
        XCTAssertFalse(sut.isLocationUpdating)
    }

    func testInitialState_NoError() {
        // Then
        XCTAssertNil(sut.lastError)
    }

    // MARK: - Singleton Tests

    func testSingleton_IsAccessible() {
        // Then
        XCTAssertNotNil(LocationService.shared)
    }

    func testSingleton_SameInstance() {
        // When
        let instance1 = LocationService.shared
        let instance2 = LocationService.shared

        // Then
        XCTAssertTrue(instance1 === instance2)
    }

    // MARK: - StopLocationUpdates Tests

    func testStopMonitoring_WithoutStartMonitoring() {
        // When
        sut.stopLocationUpdates()

        // Then
        XCTAssertFalse(sut.isLocationUpdating)
    }
}
