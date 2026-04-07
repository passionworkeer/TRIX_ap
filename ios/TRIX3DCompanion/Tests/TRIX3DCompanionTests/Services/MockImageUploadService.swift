//
//  MockImageUploadService.swift
//  TRIX3DCompanionTests
//
//  Mock implementation for ImageUploadService testing
//

import Foundation
import UIKit
import Combine
@testable import TRIX3DCompanion

/// Mock implementation of ImageUploadService for unit testing
@MainActor
final class MockImageUploadService: ObservableObject, ImageUploadServiceProtocol {

    // MARK: - Published Properties

    @Published private(set) var isUploading: Bool = false
    @Published private(set) var uploadProgress: Double = 0.0
    @Published private(set) var lastError: UploadError?

    var isUploadingPublisher: Published<Bool>.Publisher { $isUploading }
    var uploadProgressPublisher: Published<Double>.Publisher { $uploadProgress }

    // MARK: - Mock Configuration

    var mockUploadResult: UploadResult?
    var mockCompressResult: Data?
    var shouldSimulateNetworkError: Bool = false
    var simulatedNetworkError: Error?

    // Call tracking
    var uploadImageCallCount: Int = 0
    var compressImageCallCount: Int = 0
    var resizeImageCallCount: Int = 0
    var validateImageSizeCallCount: Int = 0

    // MARK: - Initialization

    init() {}

    // MARK: - Public Methods

    func uploadImage(_ image: UIImage, quality: CGFloat? = nil) async -> UploadResult {
        uploadImageCallCount += 1
        isUploading = true
        uploadProgress = 0.0

        defer {
            isUploading = false
        }

        // Simulate network delay
        try? await Task.sleep(nanoseconds: 100_000_000) // 0.1 second

        uploadProgress = 0.5

        if shouldSimulateNetworkError {
            let error = simulatedNetworkError ?? NSError(
                domain: "Network",
                code: -1,
                userInfo: [NSLocalizedDescriptionKey: "Network error"]
            )
            lastError = .networkError(error)
            return .failure(.networkError(error))
        }

        if let result = mockUploadResult {
            uploadProgress = 1.0
            lastError = nil
            return result
        }

        // Default: return a mock URL
        uploadProgress = 1.0
        lastError = nil
        return .success("https://example.com/uploaded/image.jpg")
    }

    func compressImage(_ image: UIImage, quality: CGFloat) -> Data? {
        compressImageCallCount += 1
        return mockCompressResult ?? image.jpegData(compressionQuality: quality)
    }

    func validateImageSize(_ imageData: Data) -> Bool {
        validateImageSizeCallCount += 1
        return imageData.count <= (5 * 1024 * 1024) // 5MB
    }

    func resizeImage(_ image: UIImage, maxWidth: CGFloat, maxHeight: CGFloat) -> UIImage {
        resizeImageCallCount += 1

        let size = image.size
        let widthRatio = maxWidth / size.width
        let heightRatio = maxHeight / size.height
        let ratio = min(widthRatio, heightRatio)

        guard ratio < 1.0 else {
            return image
        }

        let newSize = CGSize(width: size.width * ratio, height: size.height * ratio)

        UIGraphicsBeginImageContextWithOptions(newSize, false, image.scale)
        image.draw(in: CGRect(origin: .zero, size: newSize))
        let resizedImage = UIGraphicsGetImageFromCurrentImageContext() ?? image
        UIGraphicsEndImageContext()

        return resizedImage
    }

    // MARK: - Helper Methods

    func setMockUploadSuccess(url: String = "https://example.com/image.jpg") {
        mockUploadResult = .success(url)
    }

    func setMockUploadFailure(_ error: UploadError) {
        mockUploadResult = .failure(error)
    }

    func setMockCompressionFailure() {
        mockCompressResult = nil
    }

    func resetCallCounts() {
        uploadImageCallCount = 0
        compressImageCallCount = 0
        resizeImageCallCount = 0
        validateImageSizeCallCount = 0
    }

    func createTestImage(size: CGSize = CGSize(width: 100, height: 100)) -> UIImage {
        UIGraphicsBeginImageContextWithOptions(size, true, 1.0)
        UIColor.blue.setFill()
        UIRectFill(CGRect(origin: .zero, size: size))
        let image = UIGraphicsGetImageFromCurrentImageContext() ?? UIImage()
        UIGraphicsEndImageContext()
        return image
    }
}
