//
//  AVAudioPlayer+ExtensionsTests.swift
//  TRIX3DCompanionTests
//
//  Created by TRIX 3D Companion Team
//

import XCTest
import AVFoundation
@testable import TRIX3DCompanion

/// Unit tests for AVAudioPlayer extensions
final class AVAudioPlayer_ExtensionsTests: XCTestCase {

    // MARK: - Test Lifecycle

    override func setUpWithError() throws {
        // Put setup code here
    }

    override func tearDownWithError() throws {
        // Put teardown code here
    }

    // MARK: - Initialization Tests

    func testPlayerFromURL_Success() throws {
        // This test requires a valid audio file
        // For now, we'll test the error handling path

        let invalidURL = URL(fileURLWithPath: "/invalid/path/to/audio.m4a")

        XCTAssertThrowsError(
            try AVAudioPlayer.player(from: invalidURL),
            "Should throw error for invalid file path"
        ) { error in
            XCTAssertTrue(error is AudioPlayerError, "Error should be AudioPlayerError type")
        }
    }

    func testPlayerFromData_Success() throws {
        // Test with invalid data
        let invalidData = Data([0x00, 0x01, 0x02])

        XCTAssertThrowsError(
            try AVAudioPlayer.player(from: invalidData),
            "Should throw error for invalid audio data"
        ) { error in
            XCTAssertTrue(error is AudioPlayerError, "Error should be AudioPlayerError type")
        }
    }

    func testPlayerFromURLWithCompletion() {
        let invalidURL = URL(fileURLWithPath: "/invalid/path/to/audio.m4a")

        let expectation = XCTestExpectation(description: "Completion handler called")

        AVAudioPlayer.player(from: invalidURL) { result in
            switch result {
            case .success:
                XCTFail("Should not succeed with invalid URL")
            case .failure(let error):
                XCTAssertTrue(error is AudioPlayerError, "Error should be AudioPlayerError type")
                expectation.fulfill()
            }
        }

        wait(for: [expectation], timeout: 1.0)
    }

    // MARK: - Error Description Tests

    func testAudioPlayerErrorDescriptions() {
        let fileNotFound = AudioPlayerError.fileNotFound(path: "/test/path")
        XCTAssertEqual(
            fileNotFound.localizedDescription,
            "Audio file not found: /test/path",
            "File not found error should include path"
        )

        let invalidData = AudioPlayerError.invalidData
        XCTAssertEqual(
            invalidData.localizedDescription,
            "Invalid audio data",
            "Invalid data error description should match"
        )

        let playerCreationFailed = AudioPlayerError.playerCreationFailed(underlying: NSError(domain: "test", code: 1))
        XCTAssertTrue(
            playerCreationFailed.localizedDescription.contains("Failed to create audio player"),
            "Player creation failed error should include descriptive message"
        )

        let playbackFailed = AudioPlayerError.playbackFailed(underlying: NSError(domain: "test", code: 2))
        XCTAssertEqual(
            playbackFailed.localizedDescription,
            "Playback failed: The operation couldn't be completed. (test error 2.)",
            "Playback failed error should include underlying error"
        )
    }

    // MARK: - Duration Formatting Tests

    func testDurationFormatting() {
        let testCases: (TimeInterval, String)[] = [
            (0, "0:00"),
            (5, "0:05"),
            (10, "0:10"),
            (30, "0:30"),
            (59, "0:59"),
            (60, "1:00"),
            (90, "1:30"),
            (125, "2:05"),
            (3600, "60:00"),
            (3661, "61:01")
        ]

        for (duration, expected) in testCases {
            XCTAssertEqual(
                duration.formattedDuration,
                expected,
                "Duration \(duration)s should format as \(expected)"
            )
        }
    }
}
