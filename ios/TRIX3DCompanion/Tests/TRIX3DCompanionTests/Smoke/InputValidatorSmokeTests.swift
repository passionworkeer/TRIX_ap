import XCTest
@testable import TRIX3DCompanion

final class InputValidatorSmokeTests: XCTestCase {
    private let validator = InputValidator.shared

    func testValidateAPIParameterAcceptsAlphanumericDashUnderscore() {
        let result = validator.validateAPIParameter("ABC123_device-01")

        switch result {
        case .success:
            XCTAssertTrue(true)
        case .failure(let error):
            XCTFail("Expected success but got \(error)")
        }
    }

    func testValidateAPIParameterRejectsInvalidCharacters() {
        let result = validator.validateAPIParameter("ABC 123!")

        switch result {
        case .success:
            XCTFail("Expected failure for invalid API parameter")
        case .failure(let error):
            if case .invalidFormat = error {
                XCTAssertTrue(true)
            } else {
                XCTFail("Expected .invalidFormat but got \(error)")
            }
        }
    }

    func testValidateRadiusRange() {
        switch validator.validateRadius(1000) {
        case .success:
            XCTAssertTrue(true)
        case .failure(let error):
            XCTFail("Expected valid radius but got \(error)")
        }

        switch validator.validateRadius(0) {
        case .success:
            XCTFail("Expected invalid radius for zero")
        case .failure(let error):
            if case .invalidFormat = error {
                XCTAssertTrue(true)
            } else {
                XCTFail("Expected .invalidFormat but got \(error)")
            }
        }

        switch validator.validateRadius(50001) {
        case .success:
            XCTFail("Expected invalid radius above max")
        case .failure(let error):
            if case .inputTooLong(let maxLength) = error {
                XCTAssertEqual(maxLength, 50000)
            } else {
                XCTFail("Expected .inputTooLong(maxLength: 50000) but got \(error)")
            }
        }
    }
}
