//
//  BatteryConsumptionOptimizer.swift
//  TRIX3DCompanion
//
//  Battery usage optimization utilities
//
//  Targets: Minimize background activity, optimize GPS, reduce network polling
//

import Foundation
import UIKit

/// Battery consumption optimizer
@MainActor
final class BatteryConsumptionOptimizer {

    // MARK: - Singleton

    static let shared = BatteryConsumptionOptimizer()

    // MARK: - Types

    enum PowerState {
        case plugged
        case unplugged(level: Double)
    }

    struct BatteryMetrics {
        let level: Double
        let state: UIDevice.BatteryState
        let isLowPowerMode: Bool
        var timestamp: Date

        var shouldOptimize: Bool {
            level < 0.2 || isLowPowerMode || state == .unplugged
        }
    }

    // MARK: - Properties

    private var batteryMetrics: BatteryMetrics?
    private var powerStateCallback: ((PowerState) -> Void)?

    // MARK: - Initialization

    private init() {
        UIDevice.current.isBatteryMonitoringEnabled = true
    }

    // MARK: - Public Methods

    /// Start monitoring battery state
    func startMonitoring() {
        updateBatteryMetrics()

        // Listen for battery state changes
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(batteryStateChanged),
            name: UIDevice.batteryStateDidChangeNotification,
            object: nil
        )

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(batteryLevelChanged),
            name: UIDevice.batteryLevelDidChangeNotification,
            object: nil
        )

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(powerModeChanged),
            name: NSNotification.Name.NSProcessInfoPowerStateDidChange,
            object: nil
        )
    }

    /// Get current battery metrics
    func getBatteryMetrics() -> BatteryMetrics? {
        return batteryMetrics
    }

    /// Check if aggressive battery optimization should be applied
    func shouldOptimize() -> Bool {
        return batteryMetrics?.shouldOptimize ?? false
    }

    /// Register callback for power state changes
    func onPowerStateChange(_ callback: @escaping (PowerState) -> Void) {
        powerStateCallback = callback
    }

    /// Apply battery optimizations
    func applyOptimizations() {
        // Reduce background refresh
        UIApplication.shared.backgroundRefreshStatus

        // Reduce network polling frequency
        // This would be implemented in NetworkManager

        // Disable unnecessary location updates
        // This would be implemented in LocationManager
    }

    // MARK: - Private Methods

    private func updateBatteryMetrics() {
        let device = UIDevice.current
        batteryMetrics = BatteryMetrics(
            level: Double(device.batteryLevel),
            state: device.batteryState,
            isLowPowerMode: ProcessInfo.processInfo.isLowPowerModeEnabled,
            timestamp: Date()
        )
    }

    @objc private func batteryStateChanged() {
        updateBatteryMetrics()
        notifyPowerStateChange()
    }

    @objc private func batteryLevelChanged() {
        updateBatteryMetrics()
    }

    @objc private func powerModeChanged() {
        updateBatteryMetrics()
    }

    private func notifyPowerStateChange() {
        guard let metrics = batteryMetrics else { return }

        let state: PowerState
        switch metrics.state {
        case .charging, .full:
            state = .plugged
        case .unplugged, .unknown:
            state = .unplugged(level: metrics.level)
        @unknown default:
            state = .unplugged(level: metrics.level)
        }

        powerStateCallback?(state)
    }

    // MARK: - Deinitialization

    deinit {
        NotificationCenter.default.removeObserver(self)
    }
}

// MARK: - Battery Consumption Report

struct BatteryConsumptionReport: Codable {
    let timestamp: Date
    let batteryLevel: Double
    let backgroundTimeRatio: Double
    let networkRequestsPerHour: Int
    let estimatedRemainingHours: Int

    var summary: String {
        """
        Battery Consumption Report - \(timestamp)
        =========================================
        Current Battery Level: \(Int(batteryLevel * 100))%
        Background Time Ratio: \(String(format: "%.1f", backgroundTimeRatio * 100))%
        Network Requests/Hour: \(networkRequestsPerHour)
        Estimated Remaining: \(estimatedRemainingHours)h

        Status: \(estimatedRemainingHours > 2 ? "✅ GOOD" : "⚠️ LOW BATTERY")
        """
    }
}
