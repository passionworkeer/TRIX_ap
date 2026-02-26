//
//  CameraService.swift
//  TRIX3DCompanion
//
//  相机服务实现 - 使用 AVFoundation 框架
//

import Foundation
import AVFoundation
import UIKit
import Combine

// MARK: - Camera Service

/// 相机服务实现类
/// 遵循 NSObject 基类、AVCapturePhotoCaptureDelegate 协议和 ObservableObject 协议
@MainActor
final class CameraService: NSObject, ObservableObject, CameraServiceProtocol {

    // MARK: - Singleton

    static let shared = CameraService()

    // MARK: - Published Properties

    /// 相机会话是否正在运行
    @Published private(set) var isSessionRunning: Bool = false

    /// 当前闪光灯模式
    @Published var flashMode: AVCaptureDevice.FlashMode = .off

    /// 当前摄像头位置
    @Published var cameraPosition: AVCaptureDevice.Position = .back

    /// 最后的错误
    @Published private(set) var lastError: CameraError?

    // MARK: - Private Properties

    /// AVCaptureSession 实例
    private let captureSession: AVCaptureSession

    /// 照片输出
    private let photoOutput: AVCapturePhotoOutput

    /// 视频输入
    private var videoInput: AVCaptureDeviceInput?

    /// 当前活跃的设备
    private var currentDevice: AVCaptureDevice?

    /// 照片捕获的continuation
    private var photoContinuation: CheckedContinuation<UIImage, Error>?

    /// 权限状态
    private var permissionStatus: AVAuthorizationStatus = .notDetermined

    // MARK: - Initialization

    private override init() {
        self.captureSession = AVCaptureSession()
        self.photoOutput = AVCapturePhotoOutput()

        super.init()

        // 设置默认会话配置
        setupCaptureSession()
    }

    // MARK: - Setup

    /// 配置捕获会话
    private func setupCaptureSession() {
        captureSession.beginConfiguration()

        // 设置会话质量
        if captureSession.canSetSessionPreset(.photo) {
            captureSession.sessionPreset = .photo
        }

        // 添加照片输出
        if captureSession.canAddOutput(photoOutput) {
            captureSession.addOutput(photoOutput)

            // 启用高分辨率照片
            photoOutput.isHighResolutionCaptureEnabled = true

            // 设置照片格式
            if #available(iOS 16.0, *) {
                photoOutput.maxPhotoQualityPrioritization = .quality
            }
        }

        captureSession.commitConfiguration()
    }

    // MARK: - Permission

    /// 请求相机权限
    func requestPermission() async -> Bool {
        // 检查当前权限状态
        let status = AVCaptureDevice.authorizationStatus(for: .video)

        switch status {
        case .authorized:
            permissionStatus = .authorized
            return true

        case .notDetermined:
            // 请求权限
            let granted = await AVCaptureDevice.requestAccess(for: .video)
            permissionStatus = granted ? .authorized : .denied
            return granted

        case .denied, .restricted:
            permissionStatus = status
            lastError = .permissionDenied
            return false

        @unknown default:
            permissionStatus = .notDetermined
            return false
        }
    }

    /// 检查是否有相机权限
    var hasPermission: Bool {
        permissionStatus == .authorized
    }

    // MARK: - Session Management

    /// 启动相机会话
    func startCameraSession() async -> Result<Void, CameraError> {
        // 先检查权限
        guard hasPermission else {
            let granted = await requestPermission()
            if !granted {
                return .failure(.permissionDenied)
            }
        }

        // 检查设备是否可用
        guard let device = getCameraDevice(for: cameraPosition) else {
            lastError = .deviceUnavailable
            return .failure(.deviceUnavailable)
        }

        do {
            // 配置视频输入
            try configureVideoInput(for: device)

            // 在后台线程启动会话
            await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
                DispatchQueue.global(qos: .userInitiated).async { [weak self] in
                    self?.captureSession.startRunning()
                    DispatchQueue.main.async {
                        self?.isSessionRunning = self?.captureSession.isRunning ?? false
                        continuation.resume()
                    }
                }
            }

            isSessionRunning = captureSession.isRunning
            lastError = nil

            return isSessionRunning ? .success(()) : .failure(.sessionNotRunning)

        } catch {
            let cameraError = CameraError.captureFailed(error)
            lastError = cameraError
            return .failure(cameraError)
        }
    }

    /// 停止相机会话
    func stopCameraSession() {
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            self?.captureSession.stopRunning()
            DispatchQueue.main.async {
                self?.isSessionRunning = false
            }
        }
    }

    // MARK: - Camera Control

    /// 切换前后摄像头
    func switchCamera() {
        // 切换到相反的摄像头
        let newPosition = cameraPosition.opposite

        // 获取新设备
        guard let newDevice = getCameraDevice(for: newPosition) else {
            lastError = .deviceUnavailable
            return
        }

        // 配置新输入
        do {
            try configureVideoInput(for: newDevice)
            cameraPosition = newPosition
            lastError = nil
        } catch {
            lastError = .captureFailed(error)
        }
    }

    /// 切换闪光灯模式
    func toggleFlash() {
        flashMode.cycle()
    }

    /// 设置闪光灯模式
    /// - Parameter mode: 闪光灯模式
    func setFlashMode(_ mode: AVCaptureDevice.FlashMode) {
        flashMode = mode
    }

    // MARK: - Photo Capture

    /// 捕获照片
    func capturePhoto() async -> Result<UIImage, CameraError> {
        // 确保会话正在运行
        guard isSessionRunning else {
            let error = CameraError.sessionNotRunning
            lastError = error
            return .failure(error)
        }

        // 确保设备可用
        guard let device = currentDevice, device.hasFlash else {
            // 继续尝试拍照，即使没有闪光灯
        }

        // 创建照片设置
        let settings = createPhotoSettings()

        // 设置委托
        photoOutput.delegate = self

        // 捕获照片
        return await withCheckedContinuation { continuation in
            self.photoContinuation = continuation

            photoOutput.capturePhoto(with: settings, delegate: self)

            // 设置超时 (10秒)
            Task {
                try? await Task.sleep(nanoseconds: 10_000_000_000)
                if let cont = self.photoContinuation {
                    self.photoContinuation = nil
                    let error = CameraError.captureFailed(NSError(
                        domain: "CameraService",
                        code: -1,
                        userInfo: [NSLocalizedDescriptionKey: "Capture timeout"]
                    ))
                    cont.resume(throwing: error)
                }
            }
        }
    }

    /// 创建照片捕获设置
    private func createPhotoSettings() -> AVCapturePhotoSettings {
        let settings: AVCapturePhotoSettings

        if let photoSettings = AVCapturePhotoSettings.availablePhotoCodecTypes.contains(.hevc)
            ? AVCapturePhotoSettings(format: [AVVideoCodecKey: AVVideoCodecType.hevc])
            : AVCapturePhotoSettings() {
            settings = photoSettings
        } else {
            settings = AVCapturePhotoSettings()
        }

        // 设置闪光灯
        if currentDevice?.hasFlash == true {
            settings.flashMode = flashMode
        }

        // 启用高分辨率
        settings.isHighResolutionPhotoEnabled = true

        return settings
    }

    // MARK: - Private Helpers

    /// 获取指定位置的相机设备
    /// - Parameter position: 摄像头位置
    /// - Returns: 相机设备
    private func getCameraDevice(for position: AVCaptureDevice.Position) -> AVCaptureDevice? {
        // 获取所有可用的相机设备
        let discoverySession = AVCaptureDevice.DiscoverySession(
            deviceTypes: [.builtInWideAngleCamera, .builtInDualCamera, .builtInTripleCamera],
            mediaType: .video,
            position: position
        )

        return discoverySession.devices.first
    }

    /// 配置视频输入
    /// - Parameter device: 相机设备
    private func configureVideoInput(for device: AVCaptureDevice) throws {
        // 移除现有输入
        if let existingInput = videoInput {
            captureSession.removeInput(existingInput)
        }

        // 创建新输入
        let input = try AVCaptureDeviceInput(device: device)

        // 添加新输入
        guard captureSession.canAddInput(input) else {
            throw CameraError.notConfigured
        }

        captureSession.addInput(input)
        videoInput = input
        currentDevice = device
    }

    /// 释放资源
    func cleanup() {
        stopCameraSession()
        videoInput = nil
        currentDevice = nil
    }

    // MARK: - Preview Layer

    /// 创建预览层
    /// - Returns: AVCaptureVideoPreviewLayer 实例
    func createPreviewLayer() -> AVCaptureVideoPreviewLayer {
        let previewLayer = AVCaptureVideoPreviewLayer(session: captureSession)
        previewLayer.videoGravity = .resizeAspectFill
        return previewLayer
    }
}

// MARK: - AVCapturePhotoCaptureDelegate

extension CameraService: AVCapturePhotoCaptureDelegate {

    /// 照片捕获完成
    nonisolated func photoOutput(
        _ output: AVCapturePhotoOutput,
        didFinishProcessingPhoto photo: AVCapturePhoto,
        error: Error?
    ) {
        // 处理错误
        if let error = error {
            Task { @MainActor in
                self.photoContinuation?.resume(throwing: CameraError.captureFailed(error))
                self.photoContinuation = nil
                self.lastError = .captureFailed(error)
            }
            return
        }

        // 获取图像数据
        guard let imageData = photo.fileDataRepresentation() else {
            Task { @MainActor in
                self.photoContinuation?.resume(throwing: CameraError.captureFailed(
                    NSError(
                        domain: "CameraService",
                        code: -2,
                        userInfo: [NSLocalizedDescriptionKey: "Failed to get image data"]
                    )
                ))
                self.photoContinuation = nil
                self.lastError = .captureFailed(NSError(
                    domain: "CameraService",
                    code: -2,
                    userInfo: [NSLocalizedDescriptionKey: "Failed to get image data"]
                ))
            }
            return
        }

        // 创建 UIImage
        guard let image = UIImage(data: imageData) else {
            Task { @MainActor in
                self.photoContinuation?.resume(throwing: CameraError.captureFailed(
                    NSError(
                        domain: "CameraService",
                        code: -3,
                        userInfo: [NSLocalizedDescriptionKey: "Failed to create image"]
                    )
                ))
                self.photoContinuation = nil
                self.lastError = .captureFailed(NSError(
                    domain: "CameraService",
                    code: -3,
                    userInfo: [NSLocalizedDescriptionKey: "Failed to create image"]
                ))
            }
            return
        }

        // 返回成功结果
        Task { @MainActor in
            self.photoContinuation?.resume(returning: image)
            self.photoContinuation = nil
        }
    }
}

// MARK: - Convenience Extensions

extension CameraService {

    /// 获取相机支持的闪光灯模式
    var supportedFlashModes: [AVCaptureDevice.FlashMode] {
        guard let device = currentDevice, device.hasFlash else {
            return []
        }
        return [.off, .on, .auto]
    }

    /// 检查是否支持视频录制
    var isVideoRecordingSupported: Bool {
        photoOutput.isVideoRecordingSupported
    }

    /// 获取当前设备信息
    var deviceInfo: String {
        guard let device = currentDevice else {
            return "No device"
        }
        return "\(device.localizedName) - \(device.position == .front ? "Front" : "Back")"
    }

    /// 重置为默认设置
    func resetToDefaults() {
        cameraPosition = .back
        flashMode = .off
        lastError = nil
    }
}
