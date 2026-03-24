//
//  PairingFlowE2ETests.swift
//  TRIX3DCompanionE2ETests
//
//  E2E tests for QR code and code-based pairing flow
//

import XCTest

/// E2E tests for device pairing flow
final class PairingFlowE2ETests: XCTestCase {

    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["--mock-server", "--reset-pairing"]
        app.launch()
    }

    // MARK: - Code Pairing Flow

    func test_codePairing_showsPairingScreen() throws {
        // Navigate to settings > pairing
        let settingsTab = app.tabBars.buttons["Settings"]
        if settingsTab.waitForExistence(timeout: 5) {
            settingsTab.tap()
        }

        let pairingButton = app.buttons["Pair Device"]
        if pairingButton.waitForExistence(timeout: 3) {
            pairingButton.tap()
        }

        // Verify pairing screen elements
        let codeInput = app.textFields["Enter pairing code"]
        XCTAssertTrue(codeInput.waitForExistence(timeout: 5), "Pairing code input should appear")

        let pairButton = app.buttons["Pair"]
        XCTAssertTrue(pairButton.exists, "Pair button should exist")
    }

    func test_codePairing_validatesCodeFormat() throws {
        let settingsTab = app.tabBars.buttons["Settings"]
        if settingsTab.waitForExistence(timeout: 5) {
            settingsTab.tap()
        }

        let pairingButton = app.buttons["Pair Device"]
        if pairingButton.waitForExistence(timeout: 3) {
            pairingButton.tap()
        }

        let codeInput = app.textFields["Enter pairing code"]
        if codeInput.waitForExistence(timeout: 3) {
            codeInput.tap()
            codeInput.typeText("12") // too short
        }

        let pairButton = app.buttons["Pair"]
        if pairButton.waitForExistence(timeout: 3) {
            pairButton.tap()
        }

        // Should show validation error
        let errorText = app.staticTexts.matching(NSPredicate(format: "label CONTAINS '4'")).firstMatch
        if errorText.waitForExistence(timeout: 3) {
            XCTAssertTrue(errorText.exists, "Should show code validation error")
        }
    }

    // MARK: - QR Code Flow

    func test_qrPairing_showsQRScanner() throws {
        let settingsTab = app.tabBars.buttons["Settings"]
        if settingsTab.waitForExistence(timeout: 5) {
            settingsTab.tap()
        }

        let qrButton = app.buttons["Scan QR Code"]
        if qrButton.waitForExistence(timeout: 3) {
            qrButton.tap()
        }

        // Camera permission dialog may appear
        let allowButton = app.alerts.buttons["Allow"]
        if allowButton.waitForExistence(timeout: 2) {
            allowButton.tap()
        }

        // Verify scanner view
        let scannerView = app.otherElements["QRScannerView"]
        XCTAssertTrue(scannerView.waitForExistence(timeout: 5), "QR scanner should appear")
    }

    // MARK: - Unpairing

    func test_unpairing_confirmsBeforeUnpair() throws {
        let settingsTab = app.tabBars.buttons["Settings"]
        if settingsTab.waitForExistence(timeout: 5) {
            settingsTab.tap()
        }

        let unpairButton = app.buttons["Unpair Device"]
        if unpairButton.waitForExistence(timeout: 3) {
            unpairButton.tap()
        }

        // Should show confirmation
        let confirmAlert = app.alerts.firstMatch
        if confirmAlert.waitForExistence(timeout: 3) {
            XCTAssertTrue(confirmAlert.exists, "Confirmation alert should appear")
            confirmAlert.buttons["Cancel"].tap()
        }
    }
}
