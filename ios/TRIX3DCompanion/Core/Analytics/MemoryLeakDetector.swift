//
//  MemoryLeakDetector.swift
//  TRIX3DCompanion
//
//  Memory leak detection and monitoring utilities
//
//  Features:
//  - Object lifecycle tracking
//  - Retain cycle detection hints
//  - Memory growth monitoring
//  - Debug-only instrumentation
//

import Foundation
import os.log
import UIKit

/// Memory leak detector for development and debugging
final class MemoryLeakDetector {

    // MARK: - Singleton

    static let shared = MemoryLeakDetector()

    // MARK: - Types

    struct TrackedObject {
        let id: UUID
        let type: String
        let createTime: CFAbsoluteTime
        var stackTrace: String?
    }

    enum LeakSuspect {
        case circularReference(owner: String, held: [String])
        case singletonRetained(type: String, retainCount: Int)
        case neverReleased(type: String, lifetime: TimeInterval)
        case growthDetected(type: String, count: Int, rate: Double)
    }

    // MARK: - Properties

    private let logger = Logger(subsystem: "com.trix3d.companion", category: "MemoryLeak")
    private var trackedObjects: [String: TrackedObject] = [:]
    private var objectCounts: [String: [CFAbsoluteTime]] = [:]
    private let queue = DispatchQueue(label: "com.trix3d.leakdetector")

    #if DEBUG
    private var isEnabled: Bool = true
    #else
    private var isEnabled: Bool = false
    #endif

    private var memorySnapshots: [MemorySnapshot] = []
    private var lastSnapshotTime: CFAbsoluteTime?

    // MARK: - Initialization

    private init() {
        if isEnabled {
            startMonitoring()
        }
    }

    // MARK: - Public Methods

    /// Track an object's lifecycle
    func track(_ object: AnyObject, name: String? = nil) {
        guard isEnabled else { return }

        let objectId = String(describing: Unmanaged.passUnretained(object).toOpaque())
        let typeName = name ?? String(describing: type(of: object))

        queue.async { [weak self] in
            guard let self = self else { return }

            let tracked = TrackedObject(
                id: UUID(),
                type: typeName,
                createTime: CFAbsoluteTimeGetCurrent(),
                stackTrace: self.captureStackTrace()
            )

            self.trackedObjects[objectId] = tracked

            // Track counts over time
            if self.objectCounts[typeName] == nil {
                self.objectCounts[typeName] = []
            }
            self.objectCounts[typeName]?.append(CFAbsoluteTimeGetCurrent())

            self.logger.debug("Tracking object: \(typeName) [\(objectId)]")
        }
    }

    /// Stop tracking an object
    func untrack(_ object: AnyObject) {
        guard isEnabled else { return }

        let objectId = String(describing: Unmanaged.passUnretained(object).toOpaque())

        queue.async { [weak self] in
            guard let self = self else { return }

            if let tracked = self.trackedObjects.removeValue(forKey: objectId) {
                let lifetime = CFAbsoluteTimeGetCurrent() - tracked.createTime
                self.logger.debug("Untracked object: \(tracked.type), lifetime: \(String(format: "%.2f", lifetime))s")
            }
        }
    }

    /// Analyze for potential leaks
    func analyzeLeaks() -> [LeakSuspect] {
        guard isEnabled else { return [] }

        var suspects: [LeakSuspect] = []

        queue.sync { [weak self] in
            guard let self = self else { return }

            let now = CFAbsoluteTimeGetCurrent()

            // Check for never-released objects
            for (id, tracked) in self.trackedObjects {
                let lifetime = now - tracked.createTime

                // Objects alive longer than 5 minutes might be leaks
                if lifetime > 300 {
                    suspects.append(.neverReleased(type: tracked.type, lifetime: lifetime))
                }
            }

            // Check for object count growth
            for (type, timestamps) in self.objectCounts {
                guard timestamps.count > 10 else { continue }

                let recent = timestamps.suffix(10)
                let timeSpan = recent.last! - recent.first!
                let rate = Double(recent.count) / max(timeSpan, 1.0)

                if rate > 1.0 { // More than 1 object per second
                    suspects.append(.growthDetected(type: type, count: timestamps.count, rate: rate))
                }
            }
        }

        return suspects
    }

    /// Force a memory snapshot
    func takeSnapshot() -> MemorySnapshot {
        let snapshot = MemorySnapshot(
            timestamp: Date(),
            memoryUsage: getCurrentMemoryUsage(),
            trackedObjectCount: trackedObjects.count
        )

        memorySnapshots.append(snapshot)
        lastSnapshotTime = CFAbsoluteTimeGetCurrent()

        logger.info("Memory snapshot: \(snapshot.memoryUsage / 1024 / 1024)MB, objects: \(snapshot.trackedObjectCount)")

        return snapshot
    }

    /// Get memory trend
    func getMemoryTrend() -> MemoryTrend {
        guard memorySnapshots.count >= 2 else {
            return .stable
        }

        let recent = memorySnapshots.suffix(5)
        let first = recent.first!
        let last = recent.last!

        let growth = last.memoryUsage - first.memoryUsage
        let percentChange = Double(growth) / Double(first.memoryUsage)

        if percentChange > 0.2 { // >20% growth
            return .growing(rate: percentChange)
        } else if percentChange < -0.1 { // <-10% decline
            return .shrinking
        } else {
            return .stable
        }
    }

    /// Generate diagnostic report
    func generateDiagnosticReport() -> String {
        var report = "\n=== Memory Leak Detection Report ===\n"
        report += "Generated: \(Date())\n\n"

        // Current state
        let snapshot = takeSnapshot()
        report += "Current Memory: \(snapshot.memoryUsage / 1024 / 1024)MB\n"
        report += "Tracked Objects: \(snapshot.trackedObjectCount)\n\n"

        // Leak suspects
        let suspects = analyzeLeaks()
        if suspects.isEmpty {
            report += "No leak suspects detected ✅\n"
        } else {
            report += "Leak Suspects (\(suspects.count)):\n"
            for suspect in suspects {
                report += "  - \(describeSuspect(suspect))\n"
            }
        }

        // Memory trend
        report += "\nMemory Trend: \(describeTrend(getMemoryTrend()))\n"

        return report
    }

    // MARK: - Private Methods

    private func startMonitoring() {
        // Take periodic snapshots
        Timer.scheduledTimer(withTimeInterval: 30.0, repeats: true) { [weak self] _ in
            self?.takeSnapshot()
        }

        // Monitor memory warnings
        NotificationCenter.default.addObserver(
            forName: UIApplication.didReceiveMemoryWarningNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.handleMemoryWarning()
        }
    }

    private func handleMemoryWarning() {
        logger.warning("Memory warning received, generating diagnostic")

        let suspects = analyzeLeaks()
        if !suspects.isEmpty {
            logger.error("⚠️ Potential memory leaks detected: \(suspects.count)")
        }

        // Auto-generate report on memory warning
        _ = generateDiagnosticReport()
    }

    private func captureStackTrace() -> String {
        // Simplified stack trace capture
        Thread.callStackSymbols.prefix(5).joined(separator: "\n")
    }

    private func describeSuspect(_ suspect: LeakSuspect) -> String {
        switch suspect {
        case .circularReference(let owner, let held):
            return "Possible cycle: \(owner) holds \(held.joined(separator: ", "))"
        case .singletonRetained(let type, let count):
            return "Singleton \(type) retained \(count) times"
        case .neverReleased(let type, let lifetime):
            return "\(type) never released, alive for \(String(format: "%.0f", lifetime))s"
        case .growthDetected(let type, let count, let rate):
            return "\(type) count growing: \(count) objects, \(String(format: "%.1f", rate))/s"
        }
    }

    private func describeTrend(_ trend: MemoryTrend) -> String {
        switch trend {
        case .stable:
            return "Stable ✅"
        case .shrinking:
            return "Shrinking ✅"
        case .growing(let rate):
            return "Growing ⚠️ (\(String(format: "%.1f", rate * 100))%)"
        }
    }

    private func getCurrentMemoryUsage() -> UInt64 {
        var info = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size) / 4

        let result = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), $0, &count)
            }
        }

        if result == KERN_SUCCESS {
            return info.resident_size
        }

        return 0
    }

    // MARK: - Types

    struct MemorySnapshot {
        let timestamp: Date
        let memoryUsage: UInt64
        let trackedObjectCount: Int
    }

    enum MemoryTrend {
        case stable
        case shrinking
        case growing(rate: Double)
    }
}

// MARK: - Object Tracking Helper

/// Helper protocol for automatic object tracking
protocol Leaky: AnyObject {
    var leakDetectionId: String { get }
}

extension Leaky {
    var leakDetectionId: String {
        let id = UUID().uuidString
        MemoryLeakDetector.shared.track(self, name: String(describing: type(of: self)))
        return id
    }
}

// MARK: - Cleanup Handler

/// Property wrapper to ensure cleanup
@propertyWrapper
struct LeakTracked<Value: AnyObject> {
    private var value: Value?

    var wrappedValue: Value? {
        get { value }
        set {
            if let oldValue = value {
                MemoryLeakDetector.shared.untrack(oldValue)
            }
            value = newValue
            if let newValue = newValue {
                MemoryLeakDetector.shared.track(newValue)
            }
        }
    }
}
