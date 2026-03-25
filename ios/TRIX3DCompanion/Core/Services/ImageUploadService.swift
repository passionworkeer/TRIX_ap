//
//  ImageUploadService.swift
//  TRIX3DCompanion
//
//  图片上传服务 - 支持图片压缩和上传到 OSS
//

import Foundation
import UIKit
import Combine

// MARK: - Upload Error

/// 上传错误类型
enum UploadError: Error, LocalizedError {
    /// 图片压缩失败
    case compressionFailed

    /// 文件过大
    case fileTooLarge

    /// 网络错误
    case networkError(Error)

    /// 无效响应
    case invalidResponse

    /// 权限不足
    case unauthorized

    /// 服务器错误
    case serverError(statusCode: Int, message: String?)

    /// 无效的图片数据
    case invalidImageData

    /// 未知错误
    case unknown(Error?)

    var errorDescription: String? {
        switch self {
        case .compressionFailed:
            return "图片压缩失败。"
        case .fileTooLarge:
            return "文件大小超过限制 (最大 5MB)。"
        case .networkError(let error):
            return "网络错误: \(error.localizedDescription)"
        case .invalidResponse:
            return "服务器响应无效。"
        case .unauthorized:
            return "未授权，请先登录。"
        case .serverError(let statusCode, let message):
            return message ?? "服务器错误 (状态码: \(statusCode))"
        case .invalidImageData:
            return "图片数据无效。"
        case .unknown(let error):
            return error?.localizedDescription ?? "发生未知错误。"
        }
    }

    var isRecoverable: Bool {
        switch self {
        case .networkError, .serverError:
            return true
        default:
            return false
        }
    }
}

// MARK: - Upload Result

/// 上传结果类型
typealias UploadResult = Result<String, UploadError>

// MARK: - Image Upload Status

/// 单个图片的上传状态
struct ImageUploadStatus: Identifiable {
    let id: String
    let index: Int
    var state: UploadState
    var progress: Double
    var url: String?
    var error: UploadError?
    var retryCount: Int

    enum UploadState {
        case pending
        case uploading
        case completed
        case failed
    }

    init(index: Int) {
        self.id = UUID().uuidString
        self.index = index
        self.state = .pending
        self.progress = 0.0
        self.url = nil
        self.error = nil
        self.retryCount = 0
    }
}

// MARK: - Image Upload Service Protocol

/// Protocol for image upload service
@MainActor
protocol ImageUploadServiceProtocol: ObservableObject {
    var isUploading: Bool { get }
    var uploadProgress: Double { get }
    var isUploadingPublisher: Published<Bool>.Publisher { get }
    var uploadProgressPublisher: Published<Double>.Publisher { get }
    func uploadImage(_ image: UIImage, quality: CGFloat?) async -> UploadResult
}

// MARK: - Image Upload Service

/// 图片上传服务
@MainActor
final class ImageUploadService: ObservableObject, ImageUploadServiceProtocol {

    // MARK: - Singleton

    static let shared = ImageUploadService()

    // MARK: - Published Properties

    /// 是否正在上传
    @Published private(set) var isUploading: Bool = false

    /// 上传进度 (0.0 - 1.0)
    @Published private(set) var uploadProgress: Double = 0.0

    /// 最后的错误
    @Published private(set) var lastError: UploadError?

    /// 每个图片的上传状态
    @Published private(set) var uploadStatuses: [ImageUploadStatus] = []

    // MARK: - Protocol Publishers

    var isUploadingPublisher: Published<Bool>.Publisher { $isUploading }
    var uploadProgressPublisher: Published<Double>.Publisher { $uploadProgress }

    // MARK: - Configuration

    /// 最大重试次数
    private let maxRetryCount: Int = 3

    /// 最大文件大小 (5MB)
    private let maxFileSize: Int = 5 * 1024 * 1024

    /// 默认压缩质量 (80%)
    private let defaultCompressionQuality: CGFloat = 0.8

    /// 支持的图片格式
    private let supportedFormats: [String] = ["jpeg", "jpg", "png"]

    /// API 客户端
    private let apiClient: APIClient

    // MARK: - Initialization

    private init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    // MARK: - Public Methods

    /// 上传图片到 OSS
    /// - Parameters:
    ///   - image: 要上传的图片
    ///   - quality: 压缩质量 (0.0 - 1.0)，默认 0.8
    /// - Returns: 上传结果，成功返回图片 URL
    func uploadImage(_ image: UIImage, quality: CGFloat? = nil) async -> UploadResult {
        // 重置状态
        isUploading = true
        uploadProgress = 0.0
        lastError = nil

        defer {
            isUploading = false
        }

        // 压缩图片
        let compressionQuality = quality ?? defaultCompressionQuality
        guard let imageData = compressImage(image, quality: compressionQuality) else {
            let error = UploadError.compressionFailed
            lastError = error
            return .failure(error)
        }

        // 验证文件大小
        guard imageData.count <= maxFileSize else {
            let error = UploadError.fileTooLarge
            lastError = error
            return .failure(error)
        }

        // 转换为 Base64
        let base64String = imageData.base64EncodedString()

        // 创建上传请求
        let request = ImageUploadRequest(
            image: base64String,
            filename: generateFilename(),
            mimeType: "image/jpeg"
        )

        uploadProgress = 0.3

        // 执行上传
        do {
            let response: UploadResponse = try await apiClient.post(
                .uploadBase64,
                body: request
            )

            uploadProgress = 1.0
            lastError = nil

            return .success(response.url)

        } catch let error as NetworkError {
            let uploadError = mapNetworkError(error)
            lastError = uploadError
            return .failure(uploadError)

        } catch {
            let uploadError = UploadError.unknown(error)
            lastError = uploadError
            return .failure(uploadError)
        }
    }

    /// 上传多张图片（并发上传）
    /// - Parameters:
    ///   - images: 图片数组
    ///   - quality: 压缩质量
    /// - Returns: 上传结果数组（保持原始顺序）
    func uploadImages(_ images: [UIImage], quality: CGFloat? = nil) async -> [UploadResult] {
        guard !images.isEmpty else { return [] }

        // 初始化上传状态跟踪
        uploadStatuses = images.enumerated().map { ImageUploadStatus(index: $0.offset) }

        // 初始化结果数组（按原始索引顺序）
        var results: [UploadResult?] = Array(repeating: nil, count: images.count)

        // 使用 TaskGroup 进行并发上传（最多3个并发）
        await withTaskGroup(of: (Int, UploadResult).self) { group in
            for (index, image) in images.enumerated() {
                // 限制并发数为3
                if index >= 3 {
                    // 等待至少一个任务完成
                    if let (completedIndex, result) = await group.next() {
                        results[completedIndex] = result
                        // 更新状态
                        if completedIndex < self.uploadStatuses.count {
                            switch result {
                            case .success(let url):
                                self.uploadStatuses[completedIndex].state = .completed
                                self.uploadStatuses[completedIndex].url = url
                                self.uploadStatuses[completedIndex].progress = 1.0
                            case .failure(let error):
                                self.uploadStatuses[completedIndex].state = .failed
                                self.uploadStatuses[completedIndex].error = error
                            }
                        }
                        uploadProgress = Double(completedIndex + 1) / Double(images.count)
                    }
                }

                // 更新状态为上传中
                if index < uploadStatuses.count {
                    uploadStatuses[index].state = .uploading
                }

                // 添加新的上传任务
                group.addTask {
                    let result = await self.uploadImage(image, quality: quality)
                    return (index, result)
                }
            }

            // 收集剩余的结果
            await group.waitForAll()
            for await (index, result) in group {
                results[index] = result
                // 更新状态
                if index < self.uploadStatuses.count {
                    switch result {
                    case .success(let url):
                        self.uploadStatuses[index].state = .completed
                        self.uploadStatuses[index].url = url
                        self.uploadStatuses[index].progress = 1.0
                    case .failure(let error):
                        self.uploadStatuses[index].state = .failed
                        self.uploadStatuses[index].error = error
                    }
                }
            }
        }

        // 转换为非可选类型
        return results.compactMap { $0 }
    }

    /// 压缩图片
    /// - Parameters:
    ///   - image: 原始图片
    ///   - quality: 压缩质量 (0.0 - 1.0)
    /// - Returns: 压缩后的数据
    func compressImage(_ image: UIImage, quality: CGFloat) -> Data? {
        // 验证质量参数
        let validQuality = max(0.0, min(1.0, quality))

        // 压缩为 JPEG
        return image.jpegData(compressionQuality: validQuality)
    }

    /// 验证图片大小
    /// - Parameter imageData: 图片数据
    /// - Returns: 是否在限制内
    func validateImageSize(_ imageData: Data) -> Bool {
        return imageData.count <= maxFileSize
    }

    /// 获取压缩后的大小描述
    /// - Parameter data: 图片数据
    /// - Returns: 大小描述字符串
    func formattedSize(_ data: Data) -> String {
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useKB, .useMB]
        formatter.countStyle = .file
        return formatter.string(fromByteCount: Int64(data.count))
    }

    // MARK: - Retry Support

    /// 重试所有失败的上传
    /// - Parameter images: 原始图片数组
    /// - Parameter quality: 压缩质量
    /// - Returns: 重试结果数组
    func retryFailedUploads(with images: [UIImage], quality: CGFloat? = nil) async -> [UploadResult] {
        // 获取失败的上传索引
        let failedIndices = uploadStatuses.enumerated()
            .filter { $0.element.state == .failed && $0.element.retryCount < maxRetryCount }
            .map { $0.offset }

        guard !failedIndices.isEmpty else {
            return []
        }

        // 重置失败的状态
        for index in failedIndices {
            uploadStatuses[index].state = .pending
            uploadStatuses[index].progress = 0.0
            uploadStatuses[index].error = nil
        }

        // 重新上传失败的图片
        var results: [UploadResult?] = Array(repeating: nil, count: images.count)

        await withTaskGroup(of: (Int, UploadResult).self) { group in
            for index in failedIndices {
                if index >= 3 {
                    if let (completedIndex, result) = await group.next() {
                        results[completedIndex] = result
                    }
                }

                group.addTask {
                    let result = await self.uploadImage(images[index], quality: quality)
                    return (index, result)
                }
            }

            await group.waitForAll()
            for await (index, result) in group {
                results[index] = result
                // 更新状态
                if index < self.uploadStatuses.count {
                    switch result {
                    case .success(let url):
                        self.uploadStatuses[index].state = .completed
                        self.uploadStatuses[index].url = url
                    case .failure(let error):
                        self.uploadStatuses[index].state = .failed
                        self.uploadStatuses[index].error = error
                        self.uploadStatuses[index].retryCount += 1
                    }
                }
            }
        }

        return results.compactMap { $0 }
    }

    /// 获取失败的上传数量
    var failedUploadCount: Int {
        uploadStatuses.filter { $0.state == .failed }.count
    }

    /// 获取成功的上传数量
    var successfulUploadCount: Int {
        uploadStatuses.filter { $0.state == .completed }.count
    }

    /// 清除所有上传状态
    func clearUploadStatuses() {
        uploadStatuses.removeAll()
        uploadProgress = 0.0
        lastError = nil
    }

    // MARK: - Private Helpers

    /// 生成唯一文件名
    private func generateFilename() -> String {
        let timestamp = Int(Date().timeIntervalSince1970)
        let uuid = UUID().uuidString.prefix(8)
        return "photo_\(timestamp)_\(uuid).jpg"
    }

    /// 映射网络错误
    private func mapNetworkError(_ error: NetworkError) -> UploadError {
        switch error {
        case .noConnection, .timeout:
            return .networkError(error)
        case .unauthorized:
            return .unauthorized
        case .serverError(let statusCode, let message):
            return .serverError(statusCode: statusCode, message: message)
        case .invalidResponse:
            return .invalidResponse
        default:
            return .networkError(error)
        }
    }
}

// MARK: - Request/Response Models

/// 图片上传请求
struct ImageUploadRequest: Codable {
    /// Base64 编码的图片数据
    let image: String

    /// 文件名
    let filename: String

    /// MIME 类型
    let mimeType: String

    enum CodingKeys: String, CodingKey {
        case image
        case filename
        case mimeType = "mime_type"
    }
}

/// 图片上传响应 (复用 APIEndpoints.swift 中的 UploadResponse)
// struct UploadResponse: Codable {
//     let url: String
//     let key: String
// }

// MARK: - Convenience Extensions

extension ImageUploadService {

    /// 快速上传单张图片 (使用默认压缩质量)
    /// - Parameter image: 要上传的图片
    /// - Returns: 上传结果
    func quickUpload(_ image: UIImage) async -> UploadResult {
        return await uploadImage(image, quality: defaultCompressionQuality)
    }

    /// 智能压缩并上传 (自动调整质量以满足大小限制)
    /// - Parameter image: 原始图片
    /// - Returns: 上传结果
    func smartUpload(_ image: UIImage) async -> UploadResult {
        var quality: CGFloat = defaultCompressionQuality
        var imageData = compressImage(image, quality: quality)

        // 如果文件太大，逐步降低质量
        while let data = imageData, data.count > maxFileSize && quality > 0.1 {
            quality -= 0.1
            imageData = compressImage(image, quality: quality)
        }

        guard let finalData = imageData else {
            return .failure(.compressionFailed)
        }

        // 重新创建图片
        guard let compressedImage = UIImage(data: finalData) else {
            return .failure(.invalidImageData)
        }

        return await uploadImage(compressedImage, quality: nil)
    }

    /// 获取图片信息
    /// - Parameter image: 图片
    /// - Returns: 图片信息字典
    func getImageInfo(_ image: UIImage) -> [String: Any] {
        let size = image.size
        let imageData = image.jpegData(compressionQuality: 1.0)

        return [
            "width": size.width,
            "height": size.height,
            "fileSize": imageData?.count ?? 0,
            "formattedSize": imageData.map { formattedSize($0) } ?? "Unknown",
            "orientation": image.imageOrientation.rawValue,
            "scale": image.scale
        ]
    }

    /// 清除错误状态
    func clearError() {
        lastError = nil
    }
}

// MARK: - Image Processing Helpers

extension ImageUploadService {

    /// 调整图片大小
    /// - Parameters:
    ///   - image: 原始图片
    ///   - maxWidth: 最大宽度
    ///   - maxHeight: 最大高度
    /// - Returns: 调整后的图片
    func resizeImage(_ image: UIImage, maxWidth: CGFloat, maxHeight: CGFloat) -> UIImage {
        let size = image.size

        // 计算缩放比例
        let widthRatio = maxWidth / size.width
        let heightRatio = maxHeight / size.height
        let ratio = min(widthRatio, heightRatio)

        // 如果图片已经足够小，直接返回
        guard ratio < 1.0 else {
            return image
        }

        let newSize = CGSize(width: size.width * ratio, height: size.height * ratio)

        // 渲染新图片
        UIGraphicsBeginImageContextWithOptions(newSize, false, image.scale)
        image.draw(in: CGRect(origin: .zero, size: newSize))
        let resizedImage = UIGraphicsGetImageFromCurrentImageContext()
        UIGraphicsEndImageContext()

        return resizedImage ?? image
    }

    /// 裁剪图片为正方形
    /// - Parameters:
    ///   - image: 原始图片
    ///   - size: 目标尺寸
    /// - Returns: 裁剪后的图片
    func cropToSquare(_ image: UIImage, size: CGFloat) -> UIImage {
        let refWidth = image.size.width
        let refHeight = image.size.height
        let minSize = min(refWidth, refHeight)

        let x = (refWidth - minSize) / 2.0
        let y = (refHeight - minSize) / 2.0

        let cropRect = CGRect(x: x, y: y, width: minSize, height: minSize)

        guard let cgImage = image.cgImage?.cropping(to: cropRect) else {
            return image
        }

        let croppedImage = UIImage(
            cgImage: cgImage,
            scale: image.scale,
            orientation: image.imageOrientation
        )

        // 调整到目标尺寸
        return resizeImage(croppedImage, maxWidth: size, maxHeight: size)
    }

    /// 压缩图片到指定文件大小
    /// - Parameters:
    ///   - image: 原始图片
    ///   - maxBytes: 最大字节数
    /// - Returns: 压缩后的数据
    func compressToSize(_ image: UIImage, maxBytes: Int) -> Data? {
        var quality: CGFloat = 1.0
        var imageData = image.jpegData(compressionQuality: quality)

        while let data = imageData, data.count > maxBytes && quality > 0.0 {
            quality -= 0.05
            imageData = image.jpegData(compressionQuality: quality)
        }

        return imageData
    }
}
