//
//  UIRenderingOptimizer.swift
//  TRIX3DCompanion
//
//  UI rendering performance optimization utilities
//
//  Targets: 60 FPS stable, <16ms frame time
//

import SwiftUI
import QuartzCore

/// UI rendering optimizer for 60 FPS performance
@MainActor
final class UIRenderingOptimizer {

    // MARK: - Singleton

    static let shared = UIRenderingOptimizer()

    // MARK: - Types

    struct FrameMetrics {
        let frameTime: TimeInterval
        let droppedFrames: Int
        let targetFrameRate: Int

        var isOptimal: Bool {
            frameTime <= 16.67 // 60 FPS = 16.67ms per frame
        }
    }

    // MARK: - Properties

    private var displayLink: CADisplayLink?
    private var lastTimestamp: CFTimeInterval = 0
    private var frameTimes: [TimeInterval] = []
    private let maxFrameHistory = 60

    private var metrics: FrameMetrics {
        let avgFrameTime = frameTimes.isEmpty ? 0 : frameTimes.reduce(0, +) / Double(frameTimes.count)
        let dropped = frameTimes.filter { $0 > 16.67 }.count

        return FrameMetrics(
            frameTime: avgFrameTime,
            droppedFrames: dropped,
            targetFrameRate: 60
        )
    }

    // MARK: - Initialization

    private init() {
        setupDisplayLink()
    }

    // MARK: - Public Methods

    /// Start monitoring frame rate
    func startMonitoring() {
        displayLink?.isPaused = false
    }

    /// Stop monitoring frame rate
    func stopMonitoring() {
        displayLink?.isPaused = true
    }

    /// Get current frame metrics
    func getMetrics() -> FrameMetrics {
        return metrics
    }

    /// Check if rendering is optimal (60 FPS)
    func isOptimal() -> Bool {
        return metrics.isOptimal
    }

    /// Optimize view rendering for heavy content
    static func optimizeViewRender<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        content()
            .drawingGroup()  // Render in separate layer
    }

    /// Apply list optimization settings
    static func optimizeListPerformance<Content: View>(
        @ViewBuilder content: () -> Content
    ) -> some View {
        content()
            .listRowInsets(EdgeInsets())  // Reduce insets
    }

    /// Configure for smooth scrolling
    static func optimizeScrolling<Content: View>(
        @ViewBuilder content: () -> Content
    ) -> some View {
        content()
            .clipped()  // Clip content to bounds
            .contentShape(Rectangle())  // Improve hit testing
    }

    // MARK: - Private Methods

    private func setupDisplayLink() {
        displayLink = CADisplayLink(target: self, selector: #selector(displayLinkFired))
        displayLink?.add(to: .main, forMode: .common)
        displayLink?.isPaused = true
    }

    @objc private func displayLinkFired(_ displayLink: CADisplayLink) {
        let timestamp = displayLink.timestamp

        if lastTimestamp > 0 {
            let frameTime = (timestamp - lastTimestamp) * 1000  // ms

            frameTimes.append(frameTime)
            if frameTimes.count > maxFrameHistory {
                frameTimes.removeFirst()
            }
        }

        lastTimestamp = timestamp
    }
}

// MARK: - SwiftUI Performance Modifiers

extension View {

    /// Optimize for 60 FPS rendering
    func renderOptimized() -> some View {
        self
            .drawingGroup(opaque: false)  // Use Metal rendering
            .clipped()  // Reduce overdraw
    }

    /// Optimize list item rendering
    func listItemOptimized() -> some View {
        self
            .drawingGroup()
            .contentShape(Rectangle())
    }

    /// Optimize image rendering
    func imageOptimized() -> some View {
        self
            .drawingGroup()
            .clipped()
    }

    /// Measure frame render time (debug only)
    func measureRenderTime(label: String) -> some View {
        #if DEBUG
        let startTime = CFAbsoluteTimeGetCurrent()
        return self.onAppear {
            let duration = CFAbsoluteTimeGetCurrent() - startTime
            print("[Render Time] \(label): \(String(format: "%.2f", duration * 1000))ms")
        }
        #else
        return self
        #endif
    }
}

// MARK: - Frame Metrics Report

/// Frame performance report model
struct UIRenderingReport: Codable {
    let timestamp: Date
    let averageFrameTime: Double
    let droppedFrames: Int
    let targetFrameRate: Int
    let isOptimal: Bool

    var summary: String {
        """
        UI Rendering Report - \(timestamp)
        ===================================
        Average Frame Time: \(String(format: "%.2f", averageFrameTime))ms (Target: 16.67ms) \(isOptimal ? "✅" : "❌")
        Frame Rate: \(Int(1000 / averageFrameTime)) FPS
        Dropped Frames: \(droppedFrames)

        Status: \(isOptimal ? "✅ OPTIMAL (60 FPS)" : "⚠️ SUBOPTIMAL")
        """
    }
}
