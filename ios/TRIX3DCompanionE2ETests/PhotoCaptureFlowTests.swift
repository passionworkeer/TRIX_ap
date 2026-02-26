//
//  PhotoCaptureFlowTests.swift
//  TRIX3DCompanionE2ETests
//
//  E2E tests for photo capture flow
//

import XCTest

/// E2E tests for photo capture flow
final class PhotoCaptureFlowTests: XCTestCase {

    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
    }

    // MARK: - Complete Photo Capture Flow

    func test_completePhotoCaptureFlow() throws {
        app.launchArguments = ["--skip-onboarding", "--mock-camera"]
        app.launch()

        // Navigate to camera
        app.buttons["Camera"].tap()

        // Wait for camera preview
        let cameraPreview = app.images["Camera Preview"]
        XCTAssertTrue(cameraPreview.waitForExistence(timeout: 10))

        // Take photo
        let captureButton = app.buttons["Capture"]
        captureButton.tap()

        // Wait for preview
        let previewImage = app.images["Photo Preview"]
        XCTAssertTrue(previewImage.waitForExistence(timeout: 5))

        // Save photo
        let saveButton = app.buttons["Save"]
        saveButton.tap()

        // Verify saved confirmation
        let successMessage = app.staticTexts["Photo saved"]
        XCTAssertTrue(successMessage.waitForExistence(timeout: 5))
    }

    func test_retakePhoto() throws {
        app.launchArguments = ["--skip-onboarding", "--mock-camera"]
        app.launch()

        // Navigate to camera
        app.buttons["Camera"].tap()

        // Take photo
        app.buttons["Capture"].tap()

        // Tap retake
        let retakeButton = app.buttons["Retake"]
        retakeButton.tap()

        // Should be back at camera preview
        let cameraPreview = app.images["Camera Preview"]
        XCTAssertTrue(cameraPreview.waitForExistence(timeout: 5))
    }

    func test_addCaptionToPhoto() throws {
        app.launchArguments = ["--skip-onboarding", "--mock-camera"]
        app.launch()

        // Navigate to camera
        app.buttons["Camera"].tap()

        // Take photo
        app.buttons["Capture"].tap()

        // Add caption
        let captionField = app.textFields["Add caption"]
        captionField.tap()
        captionField.typeText("Beautiful sunset!")

        // Save
        app.buttons["Save"].tap()

        // Verify saved with caption
        let successMessage = app.staticTexts["Photo saved"]
        XCTAssertTrue(successMessage.waitForExistence(timeout: 5))
    }

    func test_cancelCaptureFlow() throws {
        app.launchArguments = ["--skip-onboarding", "--mock-camera"]
        app.launch()

        // Navigate to camera
        app.buttons["Camera"].tap()

        // Take photo
        app.buttons["Capture"].tap()

        // Cancel
        let cancelButton = app.buttons["Cancel"]
        cancelButton.tap()

        // Should be back at camera
        let cameraPreview = app.images["Camera Preview"]
        XCTAssertTrue(cameraPreview.waitForExistence(timeout: 5))
    }

    func test_switchCamera() throws {
        app.launchArguments = ["--skip-onboarding", "--mock-camera"]
        app.launch()

        // Navigate to camera
        app.buttons["Camera"].tap()

        // Switch to front camera
        let switchCameraButton = app.buttons["Switch Camera"]
        switchCameraButton.tap()

        // Should still have camera preview
        let cameraPreview = app.images["Camera Preview"]
        XCTAssertTrue(cameraPreview.waitForExistence(timeout: 5))
    }
}
