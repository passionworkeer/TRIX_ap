//
//  LocationCheckInViewModelTests.swift
//  TRIX3DCompanionTests
//
//  Regression tests for explicit check-in success/failure handling.
//

import XCTest
@testable import TRIX3DCompanion

@MainActor
final class LocationCheckInViewModelTests: XCTestCase {
    private var sut: LocationCheckInViewModel!
    private var mockService: MockPlaceCheckInService!

    override func setUpWithError() throws {
        mockService = MockPlaceCheckInService()
        sut = LocationCheckInViewModel(service: mockService)
    }

    override func tearDownWithError() throws {
        sut = nil
        mockService = nil
    }

    func testCheckInReturnsTrueOnSuccess() async {
        mockService.result = .success(())

        let result = await sut.checkIn(placeId: "place-1")

        XCTAssertTrue(result)
        XCTAssertEqual(mockService.checkInCallCount, 1)
        XCTAssertNil(sut.errorMessage)
        XCTAssertFalse(sut.isCheckingIn)
    }

    func testCheckInStoresFailureWithoutPretendingSuccess() async {
        mockService.result = .failure(NSError(domain: "test", code: 500, userInfo: [NSLocalizedDescriptionKey: "Check-in failed"]))

        let result = await sut.checkIn(placeId: "place-1")

        XCTAssertFalse(result)
        XCTAssertEqual(sut.errorMessage, "Check-in failed")
        XCTAssertFalse(sut.isCheckingIn)
    }

    func testClearErrorRemovesRetryAlertState() {
        sut.errorMessage = "failure"

        sut.clearError()

        XCTAssertNil(sut.errorMessage)
    }
}

@MainActor
private final class MockPlaceCheckInService: PlaceCheckInServiceProtocol {
    var result: Result<Void, Error> = .success(())
    var checkInCallCount = 0

    func checkIn(placeId: String) async throws {
        checkInCallCount += 1
        switch result {
        case .success:
            return
        case .failure(let error):
            throw error
        }
    }
}
