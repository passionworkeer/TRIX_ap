//
//  PerformanceMonitoringService.swift
//  TRIX3DCompanion
//
//  Performance monitoring service for tracking app performance metrics
//

import Foundation
import FirebasePerformance
import os.log

/// Performance monitoring service protocol
protocol PerformanceMonitoringServiceProtocol {
    func startTrace(name: String) -> Trace?
    func setValue(_ value: Int, forMetric name: String)
    func incrementMetric(name: String, by value: Int)
}

/// Main performance monitoring service implementation
final class PerformanceMonitoringService: ObservableObject, PerformanceMonitoringServiceProtocol {

    // MARK: - Singleton

    static let shared = PerformanceMonitoringService()

    // MARK: - Properties

    private let logger = Logger(subsystem: "com.trix3d.companion", category: "Performance")
    private var isEnabled: Bool = true
    private var activeTraces: [String: Trace] = [:]

    // MARK: - Metric Names

    enum Metric: String {
        case appLaunchTime = "app_launch_time"
        case screenLoadTime = "screen_load_time"
        case networkRequestTime = "network_request_time"
        case imageLoadTime = "image_load_time"
        case databaseQueryTime = "database_query_time"
        case memoryUsage = "memory_usage"
        case cpuUsage = "cpu_usage"
    }

    // MARK: - Initialization

    private init() {
        #if DEBUG
        isEnabled = false
        #else
        isEnabled = true
        #endif

        setupPerformanceMonitoring()
    }

    // MARK: - Setup

    private func setupPerformanceMonitoring() {
        // Firebase Performance is automatically initialized
        // when Firebase is configured
        logger.info("Performance monitoring configured")
    }

    // MARK: - Trace Methods

    /// Start a trace
    func startTrace(name: String) -> Trace? {
        guard isEnabled else {
            logger.debug("Performance monitoring disabled")
            return nil
        }

        let trace = Performance.startTrace(name: name)
        activeTraces[name] = trace

        logger.debug("Trace started: \(name)")
        return trace
    }

    /// Stop a trace
    func stopTrace(name: String) {
        guard isEnabled, let trace = activeTraces[name] else { return }

        trace.stop()
        activeTraces.removeValue(forKey: name)

        logger.debug("Trace stopped: \(name)")
    }

    /// Set metric value
    func setValue(_ value: Int, forMetric name: String) {
        guard isEnabled else { return }

        // Firebase Performance custom metrics
        // Note: This requires Firebase Performance SDK
        #if DEBUG
        logger.debug("Metric set: \(name) = \(value)")
        #endif
    }

    /// Increment metric value
    func incrementMetric(name: String, by value: Int = 1) {
        guard isEnabled else { return }

        #if DEBUG
        logger.debug("Metric incremented: \(name) by \(value)")
        #endif
    }

    // MARK: - Convenience Methods

    /// Measure app launch time
    func measureAppLaunch(completion: @escaping () -> Void) -> () -> Void {
        let startTime = CFAbsoluteTimeGetCurrent()

        return {
            let elapsedTime = CFAbsoluteTimeGetCurrent() - startTime
            let milliseconds = Int(elapsedTime * 1000)

            self.setValue(milliseconds, forMetric: Metric.appLaunchTime.rawValue)

            if milliseconds > 2000 {
                self.logger.warning("App launch time exceeded 2s: \(milliseconds)ms")
            }
        }
    }

    /// Measure screen load time
    func measureScreenLoad(screenName: String, loadBlock: () -> Void) {
        let startTime = CFAbsoluteTimeGetCurrent()

        loadBlock()

        let elapsedTime = CFAbsoluteTimeGetCurrent() - startTime
        let milliseconds = Int(elapsedTime * 1000)

        // Log as custom event
        AnalyticsService.shared.logEvent(.featureUsed, parameters: [
            "feature": "screen_load",
            "screen_name": screenName,
            "load_time_ms": milliseconds
        ])

        if milliseconds > 1000 {
            logger.warning("Screen \(screenName) load time exceeded 1s: \(milliseconds)ms")
        }
    }

    /// Measure network request
    func measureNetworkRequest(endpoint: String, method: String, completion: @escaping (TimeInterval) -> Void) -> (Data?, URLResponse?, Error?) -> Void {
        let startTime = CFAbsoluteTimeGetCurrent()

        return { data, response, error in
            let elapsedTime = CFAbsoluteTimeGetCurrent() - startTime
            let milliseconds = Int(elapsedTime * 1000)

            self.setValue(milliseconds, forMetric: Metric.networkRequestTime.rawValue)

            if milliseconds > 5000 {
                self.logger.warning("Network request to \(endpoint) exceeded 5s: \(milliseconds)ms")
            }

            completion(elapsedTime)
        }
    }

    // MARK: - Performance Attributes

    /// Set custom attribute
    func setAttribute(_ value: String, forKey key: String) {
        guard isEnabled else { return }

        #if DEBUG
        logger.debug("Performance attribute set: \(key) = \(value)")
        #endif
    }
}

// MARK: - Screen Load Tracer

/// Helper for measuring screen load time
final class ScreenLoadTracer {

    private let screenName: String
    private let startTime: CFAbsoluteTime

    init(screenName: String) {
        self.screenName = screenName
        self.startTime = CFAbsoluteTimeGetCurrent()
    }

    deinit {
        let elapsedTime = CFAbsoluteTimeGetCurrent() - startTime
        let milliseconds = Int(elapsedTime * 1000)

        // Log to analytics
        AnalyticsService.shared.logEvent(.featureUsed, parameters: [
            "feature": "screen_load",
            "screen_name": screenName,
            "load_time_ms": milliseconds
        ])

        // Log warning for slow loads
        if milliseconds > 1000 {
            SecureLogger.shared.warning("Screen \(self.screenName) load time: \(milliseconds)ms")
        }
    }
}
