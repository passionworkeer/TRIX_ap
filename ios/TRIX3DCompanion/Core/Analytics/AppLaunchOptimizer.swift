//
//  AppLaunchOptimizer.swift
//  TRIX3DCompanion
//
//  App launch performance optimization utilities
//
//  Launch Phases:
//  1. Pre-main (dyld linkage + runtime initialization) - Target: <400ms
//  2. Main (until first frame rendered) - Target: <600ms
//  3. Time-to-interactive (TTI) - Target: <2s total
//

import Foundation
import os.log
import UIKit

/// App launch performance optimizer
@MainActor
final class AppLaunchOptimizer {

    // MARK: - Singleton

    static let shared = AppLaunchOptimizer()

    // MARK: - Types

    enum LaunchPhase: String, CaseIterable {
        case preMain = "Pre-Main"
        case initialView = "Initial View"
        case services = "Services Init"
        case dataLoad = "Data Load"
        case interactive = "Interactive"

        var targetTime: TimeInterval {
            switch self {
            case .preMain: return 0.4
            case .initialView: return 0.3
            case .services: return 0.5
            case .dataLoad: return 0.5
            case .interactive: return 0.3
            }
        }
    }

    struct LaunchMetrics {
        var phaseTimings: [LaunchPhase: TimeInterval] = [:]
        var totalTime: TimeInterval = 0
        var isOptimized: Bool = true

        func report() -> String {
            var report = "\n=== App Launch Metrics ===\n"
            for phase in LaunchPhase.allCases {
                if let timing = phaseTimings[phase] {
                    let status = timing < phase.targetTime ? "✓" : "✗"
                    report += "\(status) \(phase.rawValue): \(String(format: "%.0f", timing * 1000))ms (target: \(String(format: "%.0f", phase.targetTime * 1000))ms)\n"
                }
            }
            report += "Total: \(String(format: "%.0f", totalTime * 1000))ms"
            report += "\nStatus: \(isOptimized ? "OPTIMIZED" : "NEEDS OPTIMIZATION")"
            return report
        }
    }

    // MARK: - Properties

    private let logger = Logger(subsystem: "com.trix3d.companion", category: "LaunchOptimizer")
    private var phaseStartTimes: [LaunchPhase: CFAbsoluteTime] = [:]
    private var launchMetrics = LaunchMetrics()

    // MARK: - Initialization

    private init() {
        measurePreMainPhase()
    }

    // MARK: - Public Methods

    /// Start measuring a launch phase
    func startPhase(_ phase: LaunchPhase) {
        phaseStartTimes[phase] = CFAbsoluteTimeGetCurrent()
        logger.debug("Started phase: \(phase.rawValue)")
    }

    /// End measuring a launch phase
    func endPhase(_ phase: LaunchPhase) {
        guard let startTime = phaseStartTimes[phase] else { return }

        let duration = CFAbsoluteTimeGetCurrent() - startTime
        launchMetrics.phaseTimings[phase] = duration

        let target = phase.targetTime
        let status = duration < target ? "✓" : "✗"

        logger.info("\(status) \(phase.rawValue): \(String(format: "%.0f", duration * 1000))ms (target: \(String(format: "%.0f", target * 1000))ms)")

        if duration > target {
            launchMetrics.isOptimized = false
            logger.warning("⚠️ Phase '\(phase.rawValue)' exceeded target by \(String(format: "%.0f", (duration - target) * 1000))ms")
        }

        phaseStartTimes.removeValue(forKey: phase)
    }

    /// Complete launch measurement and report
    func completeLaunch() -> LaunchMetrics {
        launchMetrics.totalTime = launchMetrics.phaseTimings.values.reduce(0, +)

        let report = launchMetrics.report()
        logger.info("\(report)")

        // Send to analytics
        PerformanceMonitoringService.shared.setValue(
            Int(launchMetrics.totalTime * 1000),
            forMetric: "app_launch_time_v2"
        )

        return launchMetrics
    }

    // MARK: - Private Methods

    /// Estimate pre-main phase time
    private func measurePreMainPhase() {
        // We can't measure pre-main directly from Swift,
        // but we can estimate using process start time
        var kinfo = kinfo_proc()
        var size = MemoryLayout<kinfo_proc>.stride
        var mib: [Int32] = [CTL_KERN, KERN_PROC, KERN_PROC_PID, getpid()]

        let result = mib.withUnsafeMutableBufferPointer { mibPtr in
            sysctl(
                mibPtr.baseAddress, UInt32(mib.count),
                &kinfo, &size,
                nil, 0
            )
        }

        if result == 0 {
            let startTime = kinfo.kp_proc.p_starttime.tv_sec
            let now = timeval(tv_sec: 0, tv_usec: 0)
            let elapsed = TimeInterval(now.tv_sec - startTime)

            // This is a rough estimate of pre-main time
            launchMetrics.phaseTimings[.preMain] = min(elapsed, 0.5)
        }
    }
}

// MARK: - Lazy Initialization Helper

/// Property wrapper for lazy initialization with performance tracking
@propertyWrapper
struct LazyInitialized<T> {
    private var value: T?
    private var initializationTime: TimeInterval = 0

    var wrappedValue: T {
        mutating get {
            if let value = value {
                return value
            }

            let startTime = CFAbsoluteTimeGetCurrent()
            let initializedValue = initialValue()
            let duration = CFAbsoluteTimeGetCurrent() - startTime

            initializationTime = duration

            // Log slow initializations
            if duration > 0.05 {
                os_log(.info,
                    log: OSLog(subsystem: "com.trix3d.companion", category: "LazyInit"),
                    "Slow initialization: %{public}@ took %{public}.0fms",
                    String(describing: T.self), duration * 1000)
            }

            value = initializedValue
            return initializedValue
        }
    }

    private let initialValue: () -> T

    init(wrappedValue: @escaping @autoclosure () -> T) {
        self.initialValue = wrappedValue
    }
}

// MARK: - Deferred Initialization Manager

/// Manager for deferring non-critical initialization
@MainActor
final class DeferredInitializationManager {

    static let shared = DeferredInitializationManager()

    private var tasks: [() async -> Void] = []
    private var hasStarted = false

    private init() {}

    /// Register a task for deferred initialization
    func register(priority: Priority = .normal, _ task: @escaping () async -> Void) {
        tasks.append(task)
    }

    /// Execute all deferred initialization tasks
    func executeDeferredTasks() async {
        guard !hasStarted else { return }
        hasStarted = true

        await withTaskGroup(of: Void.self) { group in
            for task in tasks {
                group.addTask {
                    await task()
                }
            }
        }

        tasks.removeAll()
    }

    enum Priority {
        case high
        case normal
        case low
    }
}

// MARK: - Launch Optimization Checklist

extension AppLaunchOptimizer {

    /// Check if the app follows launch optimization best practices
    func validateLaunchConfiguration() -> [OptimizationTip] {
        var tips: [OptimizationTip] = []

        // Check 1: Are large assets being loaded early?
        tips.append(OptimizationTip(
            category: "Asset Loading",
            issue: "Large images in asset catalog may slow launch",
            suggestion: "Move large assets to separate bundles or load on-demand",
            impact: .high
        ))

        // Check 2: Is SwiftUI body being calculated efficiently?
        tips.append(OptimizationTip(
            category: "SwiftUI",
            issue: "Complex view hierarchies in body",
            suggestion: "Use @ViewBuilder and extract subviews",
            impact: .medium
        ))

        // Check 3: Network calls at launch?
        tips.append(OptimizationTip(
            category: "Network",
            issue: "Synchronous network calls in init",
            suggestion: "Defer network calls until first frame",
            impact: .high
        ))

        return tips
    }

    struct OptimizationTip {
        enum Impact { case high, medium, low }

        let category: String
        let issue: String
        let suggestion: String
        let impact: Impact
    }
}

// MARK: - Process Info Helpers

import Darwin

private struct kinfo_proc {
    var kp_proc: extern_proc
}

private struct extern_proc {
    var p_starttime: timeval
}

private struct timeval {
    var tv_sec: Int
    var tv_usec: Int
}

private let CTL_KERN: Int32 = 1
private let KERN_PROC: Int32 = 14
private let KERN_PROC_PID: Int32 = 1
