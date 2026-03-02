//
//  CameraServiceProtocol.swift
//  TRIX3DCompanion
//
//  相机服务协议接口定义
//

import Foundation
import AVFoundation
import UIKit

// MARK: - Camera Error

/// 相机错误类型
enum CameraError: Error, LocalizedError {
    /// 权限被拒绝
    case permissionDenied

    /// 会话未运行
    case sessionNotRunning

    /// 拍照失败
    case captureFailed(Error)

    /// 设备不可用
    case deviceUnavailable

    /// 相机未配置
    case notConfigured

    /// 未知错误
    case unknown(Error?)

    var errorDescription: String? {
        switch self {
        case .permissionDenied:
            return "相机权限被拒绝。请在设置中开启相机权限。"
        case .sessionNotRunning:
            return "相机会话未运行。"
        case .captureFailed(let error):
            return "拍照失败: \(error.localizedDescription)"
        case .deviceUnavailable:
            return "相机设备不可用。"
        case .notConfigured:
            return "相机未正确配置。"
        case .unknown(let error):
            return error?.localizedDescription ?? "发生未知错误。"
        }
    }

    var isRecoverable: Bool {
        switch self {
        case .permissionDenied, .deviceUnavailable:
            return false
        default:
            return true
        }
    }
}

// MARK: - Camera Service Protocol

/// 相机服务协议接口
protocol CameraServiceProtocol {
    /// 请求相机权限
    /// - Returns: 权限是否被授予
    func requestPermission() async -> Bool

    /// 捕获照片
    /// - Returns: 照片结果 (UIImage 或 错误)
    func capturePhoto() async -> Result<UIImage, CameraError>

    /// 切换前后摄像头
    func switchCamera()

    /// 切换闪光灯模式
    func toggleFlash()

    /// 启动相机会话
    /// - Returns: 启动结果
    func startCameraSession() async -> Result<Void, CameraError>

    /// 停止相机会话
    func stopCameraSession()

    /// 当前会话是否正在运行
    var isSessionRunning: Bool { get }

    /// 当前闪光灯模式
    var flashMode: AVCaptureDevice.FlashMode { get }

    /// 当前摄像头位置
    var cameraPosition: AVCaptureDevice.Position { get }

    /// 最后的错误
    var lastError: CameraError? { get }
}

// MARK: - Camera Position Extension

extension AVCaptureDevice.Position {
    /// 获取相反的摄像头位置
    var opposite: AVCaptureDevice.Position {
        switch self {
        case .back:
            return .front
        case .front:
            return .back
        case .unspecified:
            return .back
        @unknown default:
            return .back
        }
    }
}
