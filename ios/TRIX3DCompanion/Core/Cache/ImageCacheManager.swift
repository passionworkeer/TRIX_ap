//
//  ImageCacheManager.swift
//  TRIX3DCompanion
//
//  Memory-efficient image caching with automatic cleanup
//
//  Features:
//  - LRU cache eviction
//  - Memory pressure monitoring
//  - Automatic cleanup on background
//  - Configurable cache limits
//

import UIKit
import os.log

/// Image cache manager with memory optimization
final class ImageCacheManager {

    // MARK: - Singleton

    static let shared = ImageCacheManager()

    // MARK: - Types

    enum ImageCachePolicy {
        case lowMemory       // ~20MB
        case balanced        // ~50MB
        case aggressive      // ~100MB
    }

    private struct CachedImage {
        let image: UIImage
        let accessTime: CFAbsoluteTime
        let accessCount: Int
    }

    // MARK: - Properties

    private let logger = Logger(subsystem: "com.trix3d.companion", category: "ImageCache")
    private var cache: [String: CachedImage] = [:]
    private var queue = DispatchQueue(label: "com.trix3d.imagecache", attributes: .concurrent)

    private var currentPolicy: ImageCachePolicy = .balanced {
        didSet {
            updateCacheLimit()
        }
    }

    private var memoryLimit: Int = 0
    private var currentMemoryUsage: Int = 0

    // MARK: - Initialization

    private init() {
        updateCacheLimit()
        observeMemoryWarnings()
        observeAppState()

        logger.info("Image cache initialized with policy: \(String(describing: self.currentPolicy))")
    }

    // MARK: - Public Methods

    /// Get image from cache
    func getImage(forKey key: String) -> UIImage? {
        var cachedImage: UIImage?

        queue.sync {
            guard let entry = cache[key] else {
                cachedImage = nil
                return
            }

            // Update access metadata
            cache[key] = CachedImage(
                image: entry.image,
                accessTime: CFAbsoluteTimeGetCurrent(),
                accessCount: entry.accessCount + 1
            )

            cachedImage = entry.image
        }

        return cachedImage
    }

    /// Store image in cache
    func setImage(_ image: UIImage, forKey key: String) {
        let imageSize = estimateImageSize(image)

        queue.async(flags: .barrier) { [self] in
            // Remove old entry if exists
            if let oldEntry = self.cache[key] {
                self.currentMemoryUsage -= self.estimateImageSize(oldEntry.image)
            }

            // Add new entry
            self.cache[key] = CachedImage(
                image: image,
                accessTime: CFAbsoluteTimeGetCurrent(),
                accessCount: 1
            )
            self.currentMemoryUsage += imageSize

            // Enforce memory limit
            self.evictIfNeeded()

            self.logger.debug("Cached image: \(key), size: \(imageSize / 1024)KB, total: \(self.currentMemoryUsage / 1024)KB")
        }
    }

    /// Remove image from cache
    func removeImage(forKey key: String) {
        queue.async(flags: .barrier) {
            if let entry = self.cache.removeValue(forKey: key) {
                self.currentMemoryUsage -= self.estimateImageSize(entry.image)
            }
        }
    }

    /// Clear all cached images
    func clearCache() {
        queue.async(flags: .barrier) {
            self.cache.removeAll()
            self.currentMemoryUsage = 0

            self.logger.info("Image cache cleared")
        }
    }

    /// Set cache policy
    func setCachePolicy(_ policy: ImageCachePolicy) {
        currentPolicy = policy
        logger.info("Cache policy changed to: \(String(describing: policy))")
    }

    /// Get current memory usage in bytes
    func getCurrentMemoryUsage() -> Int {
        var usage: Int = 0
        queue.sync {
            usage = currentMemoryUsage
        }
        return usage
    }

    /// Get cache statistics
    func getCacheStats() -> CacheStats {
        var stats = CacheStats()
        queue.sync {
            stats.count = cache.count
            stats.memoryUsage = currentMemoryUsage
            stats.memoryLimit = memoryLimit
            stats.accessCount = cache.values.reduce(0) { $0 + $1.accessCount }
        }
        return stats
    }

    // MARK: - Private Methods

    private func updateCacheLimit() {
        switch currentPolicy {
        case .lowMemory:
            memoryLimit = 20 * 1024 * 1024  // 20MB
        case .balanced:
            memoryLimit = 50 * 1024 * 1024  // 50MB
        case .aggressive:
            memoryLimit = 100 * 1024 * 1024 // 100MB
        }
    }

    private func evictIfNeeded() {
        guard self.currentMemoryUsage > self.memoryLimit else { return }

        logger.info("Evicting images, current: \(self.currentMemoryUsage / 1024)KB, limit: \(self.memoryLimit / 1024)KB")

        // Sort by access frequency and time (LRU with frequency)
        let sortedKeys = self.cache.sorted { lhs, rhs in
            let lhsScore = Double(lhs.value.accessCount * 1000) + lhs.value.accessTime
            let rhsScore = Double(rhs.value.accessCount * 1000) + rhs.value.accessTime
            return lhsScore < rhsScore
        }.map { $0.key }

        // Evict until under limit
        for key in sortedKeys {
            guard self.currentMemoryUsage > self.memoryLimit * 80 / 100 else { break }

            if let entry = self.cache.removeValue(forKey: key) {
                self.currentMemoryUsage -= self.estimateImageSize(entry.image)
            }
        }
    }

    private func estimateImageSize(_ image: UIImage) -> Int {
        guard let cgImage = image.cgImage else { return 0 }
        return cgImage.bytesPerRow * cgImage.height
    }

    private func observeMemoryWarnings() {
        NotificationCenter.default.addObserver(
            forName: UIApplication.didReceiveMemoryWarningNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.handleMemoryWarning()
        }
    }

    private func observeAppState() {
        NotificationCenter.default.addObserver(
            forName: UIApplication.didEnterBackgroundNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.handleBackground()
        }
    }

    private func handleMemoryWarning() {
        logger.warning("Memory warning received, clearing cache")

        // Switch to low memory policy
        setCachePolicy(.lowMemory)

        // Clear cache
        clearCache()
    }

    private func handleBackground() {
        logger.info("App entered background, reducing cache")

        // Reduce cache to low memory level
        setCachePolicy(.lowMemory)
    }

    // MARK: - Types

    struct CacheStats {
        var count: Int = 0
        var memoryUsage: Int = 0
        var memoryLimit: Int = 0
        var accessCount: Int = 0
        var memoryUsagePercent: Double {
            guard memoryLimit > 0 else { return 0 }
            return Double(memoryUsage) / Double(memoryLimit)
        }
    }
}

// MARK: - AsyncImage Cache Integration

extension ImageCacheManager {

    /// Generate cache key from URL
    func cacheKey(for url: URL) -> String {
        return url.absoluteString
    }

    /// Load image with caching
    func loadImage(from url: URL) async throws -> UIImage {
        let key = cacheKey(for: url)

        // Check cache first
        if let cached = getImage(forKey: key) {
            logger.debug("Cache hit for: \(key)")
            return cached
        }

        logger.debug("Cache miss for: \(key)")

        // Load from network
        let data = try await Data(contentsOf: url)
        guard let image = UIImage(data: data) else {
            throw URLError(.badURL)
        }

        // Cache the image
        setImage(image, forKey: key)

        return image
    }

    // MARK: - Cleanup

    deinit {
        NotificationCenter.default.removeObserver(self)
    }
}
