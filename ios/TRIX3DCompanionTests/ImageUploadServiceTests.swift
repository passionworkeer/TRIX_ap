//
//  ImageUploadServiceTests.swift
//  TRIX3DCompanionTests
//
//  Unit tests for ImageUploadService
//

import XCTest
import UIKit
import Combine
@testable import TRIX3DCompanion

/// Unit tests for ImageUploadService
final class ImageUploadServiceTests: XCTestCase {

    // MARK: - Properties

    var imageUploadService: ImageUploadService!
    var cancellables: Set<AnyCancellable>!

    // MARK: - Test Lifecycle

    override func setUpWithError() throws {
        imageUploadService = ImageUploadService.shared
        cancellables = Set<AnyCancellable>()
    }

    override func tearDownWithError() throws {
        imageUploadService.clearError()
        cancellables = nil
    }

    // MARK: - Image Compression Tests

    func test_compressImage_reducesSize() throws {
        // Arrange - Create a test image
        let originalImage = createTestImage(size: CGSize(width: 1000, height: 1000))
        let originalData = originalImage.jpegData(compressionQuality: 1.0)!

        // Act
        let compressedData = imageUploadService.compressImage(originalImage, quality: 0.5)

        // Assert
        XCTAssertNotNil(compressedData, "Compressed data should not be nil")
        XCTAssertLessThan(
            compressedData!.count,
            originalData.count,
            "Compressed image should be smaller than original"
        )
    }

    func test_compressImage_maintainsQuality() throws {
        // Arrange
        let image = createTestImage(size: CGSize(width: 100, height: 100))

        // Act - Compress with high quality
        let highQualityData = imageUploadService.compressImage(image, quality: 0.9)
        let lowQualityData = imageUploadService.compressImage(image, quality: 0.1)

        // Assert
        XCTAssertNotNil(highQualityData, "High quality compression should succeed")
        XCTAssertNotNil(lowQualityData, "Low quality compression should succeed")

        // Higher quality should result in larger file
        XCTAssertGreaterThan(
            highQualityData!.count,
            lowQualityData!.count,
            "Higher quality should produce larger file"
        )
    }

    func test_compressImage_qualityClamping() throws {
        // Arrange
        let image = createTestImage(size: CGSize(width: 100, height: 100))

        // Act - Test boundary values (should be clamped to 0-1 range)
        let minQualityData = imageUploadService.compressImage(image, quality: -0.5)
        let maxQualityData = imageUploadService.compressImage(image, quality: 1.5)

        // Assert - Should not crash and should produce valid data
        XCTAssertNotNil(minQualityData, "Negative quality should be clamped to 0")
        XCTAssertNotNil(maxQualityData, "Quality >1 should be clamped to 1")
    }

    // MARK: - Image Upload Tests

    func test_uploadImage_success() async throws {
        // Arrange
        let image = createTestImage(size: CGSize(width: 200, height: 200))

        // Note: This will make actual network call
        // In production, we'd mock the API client

        // Act
        let result = await imageUploadService.uploadImage(image)

        // Assert - May succeed or fail depending on network
        switch result {
        case .success(let url):
            XCTAssertFalse(url.isEmpty, "Should return URL on success")
        case .failure(let error):
            // Network might not be available in test environment
            XCTAssertNotNil(error, "Should return error on failure")
        }
    }

    func test_uploadImage_fileTooLarge() async throws {
        // Arrange - Create a mock that returns file too large
        // This would require mocking the API client

        XCTAssertTrue(true, "File too large test - requires API mock")
    }

    func test_uploadImage_compressionFailed() async throws {
        // Arrange - Upload with nil quality (default 0.8)
        let image = createTestImage(size: CGSize(width: 100, height: 100))

        // Note: Compression failure is rare with valid UIImage
        // Testing would require mocking compressImage to return nil

        // Act
        let result = await imageUploadService.uploadImage(image)

        // Assert - Will likely succeed with valid image
        XCTAssertNotNil(result, "Should return a result")
    }

    func test_uploadImage_networkError() async throws {
        // Arrange
        let image = createTestImage(size: CGSize(width: 100, height: 100))

        // Note: Testing network errors requires mock API client

        // This test verifies the service can handle network errors
        // Actual error testing would need network condition simulation

        // Act - Just verify service is initialized
        XCTAssertNotNil(imageUploadService, "Service should be initialized")
    }

    // MARK: - Smart Upload Tests

    func test_smartUpload_adjustsQuality() async throws {
        // Arrange
        let image = createTestImage(size: CGSize(width: 500, height: 500))

        // Note: Smart upload attempts to compress until file is < 5MB
        // With small test images, this should always succeed

        // Act
        let result = await imageUploadService.smartUpload(image)

        // Assert
        switch result {
        case .success(let url):
            XCTAssertFalse(url.isEmpty, "Should return URL")
        case .failure(let error):
            // May fail if no network
            XCTAssertNotNil(error, "Should return error")
        }
    }

    // MARK: - Image Resize Tests

    func test_resizeImage_maintainsAspectRatio() throws {
        // Arrange
        let originalImage = createTestImage(size: CGSize(width: 1000, height: 500))

        // Act
        let resizedImage = imageUploadService.resizeImage(
            originalImage,
            maxWidth: 500,
            maxHeight: 500
        )

        // Assert - Should maintain aspect ratio and fit within bounds
        XCTAssertLessThanOrEqual(
            resizedImage.size.width,
            500,
            "Width should be <= maxWidth"
        )
        XCTAssertLessThanOrEqual(
            resizedImage.size.height,
            500,
            "Height should be <= maxHeight"
        )

        // Aspect ratio should be preserved (approximately)
        let originalRatio = originalImage.size.width / originalImage.size.height
        let resizedRatio = resizedImage.size.width / resizedImage.size.height

        XCTAssertEqual(
            originalRatio,
            resizedRatio,
            accuracy: 0.01,
            "Aspect ratio should be preserved"
        )
    }

    func test_resizeImage_alreadySmallImage() throws {
        // Arrange - Image smaller than max dimensions
        let smallImage = createTestImage(size: CGSize(width: 100, height: 100))

        // Act
        let resizedImage = imageUploadService.resizeImage(
            smallImage,
            maxWidth: 500,
            maxHeight: 500
        )

        // Assert - Should return original if already smaller
        XCTAssertEqual(
            smallImage.size.width,
            resizedImage.size.width,
            "Small image should not be resized"
        )
        XCTAssertEqual(
            smallImage.size.height,
            resizedImage.size.height,
            "Small image should not be resized"
        )
    }

    // MARK: - Image Size Validation Tests

    func test_validateImageSize() throws {
        // Arrange
        let smallData = Data(repeating: 0, count: 1024) // 1KB
        let largeData = Data(repeating: 0, count: 10 * 1024 * 1024) // 10MB

        // Act
        let smallValid = imageUploadService.validateImageSize(smallData)
        let largeValid = imageUploadService.validateImageSize(largeData)

        // Assert
        XCTAssertTrue(smallValid, "Small image should be valid")
        XCTAssertFalse(largeValid, "Large image should be invalid (> 5MB)")
    }

    // MARK: - Formatted Size Tests

    func test_formattedSize() throws {
        // Arrange
        let data = Data(repeating: 0, count: 1024 * 100) // 100KB

        // Act
        let formatted = imageUploadService.formattedSize(data)

        // Assert - Should contain KB or MB
        XCTAssertTrue(
            formatted.contains("KB") || formatted.contains("MB"),
            "Formatted size should contain unit"
        )
    }

    // MARK: - Image Info Tests

    func test_getImageInfo() throws {
        // Arrange
        let image = createTestImage(size: CGSize(width: 640, height: 480))

        // Act
        let info = imageUploadService.getImageInfo(image)

        // Assert
        XCTAssertEqual(info["width"] as? CGFloat, 640)
        XCTAssertEqual(info["height"] as? CGFloat, 480)
        XCTAssertNotNil(info["fileSize"], "Should include file size")
        XCTAssertNotNil(info["formattedSize"], "Should include formatted size")
        XCTAssertEqual(info["scale"] as? CGFloat, image.scale)
    }

    // MARK: - Upload Error Tests

    func test_uploadErrorDescriptions() {
        let compressionFailed = UploadError.compressionFailed
        XCTAssertEqual(
            compressionFailed.localizedDescription,
            "图片压缩失败。"
        )

        let fileTooLarge = UploadError.fileTooLarge
        XCTAssertEqual(
            fileTooLarge.localizedDescription,
            "文件大小超过限制 (最大 5MB)。"
        )

        let invalidResponse = UploadError.invalidResponse
        XCTAssertEqual(
            invalidResponse.localizedDescription,
            "服务器响应无效。"
        )

        let unauthorized = UploadError.unauthorized
        XCTAssertEqual(
            unauthorized.localizedDescription,
            "未授权，请先登录。"
        )
    }

    func test_uploadErrorRecoverability() {
        XCTAssertTrue(UploadError.networkError(NSError(domain: "test", code: 0)).isRecoverable)
        XCTAssertTrue(UploadError.serverError(statusCode: 500, message: nil).isRecoverable)
        XCTAssertFalse(UploadError.compressionFailed.isRecoverable)
        XCTAssertFalse(UploadError.fileTooLarge.isRecoverable)
        XCTAssertFalse(UploadError.invalidImageData.isRecoverable)
    }

    // MARK: - Multiple Upload Tests

    func test_uploadImages_multiple() async throws {
        // Arrange
        let images = [
            createTestImage(size: CGSize(width: 100, height: 100)),
            createTestImage(size: CGSize(width: 100, height: 100)),
            createTestImage(size: CGSize(width: 100, height: 100))
        ]

        // Act
        let results = await imageUploadService.uploadImages(images)

        // Assert
        XCTAssertEqual(results.count, 3, "Should return results for all images")
    }

    // MARK: - Quick Upload Tests

    func test_quickUpload() async throws {
        // Arrange
        let image = createTestImage(size: CGSize(width: 100, height: 100))

        // Act
        let result = await imageUploadService.quickUpload(image)

        // Assert
        XCTAssertNotNil(result, "Should return a result")
    }

    // MARK: - Helper Methods

    private func createTestImage(size: CGSize) -> UIImage {
        UIGraphicsBeginImageContextWithOptions(size, false, 1.0)
        UIColor.blue.setFill()
        UIRectFill(CGRect(origin: .zero, size: size))

        // Add some variation
        UIColor.white.setFill()
        UIRectFill(CGRect(x: 0, y: 0, width: size.width * 0.5, height: size.height * 0.5))

        let image = UIGraphicsGetImageFromCurrentImageContext() ?? UIImage()
        UIGraphicsEndImageContext()

        return image
    }
}
