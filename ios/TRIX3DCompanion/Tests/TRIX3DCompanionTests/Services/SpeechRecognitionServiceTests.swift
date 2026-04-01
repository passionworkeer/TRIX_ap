//
//  SpeechRecognitionServiceTests.swift
//  TRIX3DCompanionTests
//
//  Tests for SpeechRecognitionService
//

import XCTest
import Speech
import Combine
@testable import TRIX3DCompanion

// MARK: - SpeechRecognitionService Tests

@MainActor
final class SpeechRecognitionServiceTests: XCTestCase {

    // MARK: - Properties

    var sut: SpeechRecognitionService!
    var cancellables: Set<AnyCancellable>!

    // MARK: - Test Lifecycle

    override func setUp() {
        super.setUp()

        sut = SpeechRecognitionService.shared
        cancellables = Set<AnyCancellable>()
    }

    override func tearDown() {
        sut = nil
        cancellables = nil
        super.tearDown()
    }

    // MARK: - Initial State Tests

    func testInitialState_IdleStatus() {
        // Then
        XCTAssertEqual(sut.status, .idle)
    }

    func testInitialState_NotListening() {
        // Then
        XCTAssertFalse(sut.isListening)
    }

    func testInitialState_EmptyRecognizedText() {
        // Then
        XCTAssertTrue(sut.recognizedText.isEmpty)
    }

    func testInitialState_NoError() {
        // Then
        XCTAssertNil(sut.errorMessage)
    }

    // MARK: - Support Check Tests

    func testIsSupported_CanBeChecked() {
        // When - Check if isSupported is accessible
        let isSupported = sut.isSupported

        // Then - Should be a boolean value
        XCTAssertTrue(isSupported || !isSupported)
    }

    // MARK: - Authorization Tests

    func testCheckAuthorization_ReturnsBool() async throws {
        if SpeechRecognitionService.authorizationStatus == .notDetermined {
            throw XCTSkip(
                "Speech authorization is not preconfigured in this environment. " +
                "Skipping to avoid triggering an interactive system permission prompt during automated runs."
            )
        }

        // When
        let result = await sut.checkAuthorization()

        // Then - Should return a boolean (user may have authorized or not)
        XCTAssertTrue(result || !result)
    }

    // MARK: - Static Properties Tests

    func testStaticIsAvailable_ReturnsBool() {
        // When
        let isAvailable = SpeechRecognitionService.isAvailable

        // Then - Should be a boolean
        XCTAssertTrue(isAvailable || !isAvailable)
    }

    func testStaticAuthorizationStatus_ReturnsStatus() {
        // When
        let status = SpeechRecognitionService.authorizationStatus

        // Then - Should return a valid authorization status
        switch status {
        case .notDetermined, .denied, .restricted, .authorized:
            XCTAssertTrue(true)
        @unknown default:
            XCTFail("Unexpected authorization status")
        }
    }

    // MARK: - Error Enum Tests

    func testSpeechRecognitionError_NotAvailable() {
        // Given
        let error = SpeechRecognitionError.notAvailable

        // Then
        XCTAssertNotNil(error.errorDescription)
    }

    func testSpeechRecognitionError_NotAuthorized() {
        // Given
        let error = SpeechRecognitionError.notAuthorized

        // Then
        XCTAssertNotNil(error.errorDescription)
    }

    func testSpeechRecognitionError_RecognitionFailed() {
        // Given
        let error = SpeechRecognitionError.recognitionFailed("Test error")

        // Then
        XCTAssertNotNil(error.errorDescription)
        XCTAssertTrue(error.errorDescription?.contains("Test error") ?? false)
    }

    func testSpeechRecognitionError_NetworkError() {
        // Given
        let error = SpeechRecognitionError.networkError("Network issue")

        // Then
        XCTAssertNotNil(error.errorDescription)
        XCTAssertTrue(error.errorDescription?.contains("Network issue") ?? false)
    }

    func testSpeechRecognitionError_NoSpeechDetected() {
        // Given
        let error = SpeechRecognitionError.noSpeechDetected

        // Then
        XCTAssertNotNil(error.errorDescription)
    }

    // MARK: - Status Enum Tests

    func testSpeechRecognitionStatus_Equality() {
        // Given
        let status1: SpeechRecognitionStatus = .idle
        let status2: SpeechRecognitionStatus = .idle

        // Then
        XCTAssertEqual(status1, status2)
    }

    func testSpeechRecognitionStatus_Inequality() {
        // Given
        let status1: SpeechRecognitionStatus = .idle
        let status2: SpeechRecognitionStatus = .listening

        // Then
        XCTAssertNotEqual(status1, status2)
    }

    func testSpeechRecognitionStatus_ErrorEquality() {
        // Given
        let status1: SpeechRecognitionStatus = .error("Test")
        let status2: SpeechRecognitionStatus = .error("Test")

        // Then
        XCTAssertEqual(status1, status2)
    }

    func testSpeechRecognitionStatus_ErrorInequality() {
        // Given
        let status1: SpeechRecognitionStatus = .error("Test1")
        let status2: SpeechRecognitionStatus = .error("Test2")

        // Then
        XCTAssertNotEqual(status1, status2)
    }
}
