//
//  SSLPinningManager.swift
//  TRIX3DCompanion
//
//  SSL Certificate Pinning Manager for secure network connections
//

import Foundation
import Alamofire
import CommonCrypto

private struct SSLPinningConfigurationError: Error, LocalizedError {
    let message: String

    var errorDescription: String? {
        message
    }
}

private struct FailingTrustEvaluator: ServerTrustEvaluating {
    let message: String

    func evaluate(_ trust: SecTrust, forHost host: String) throws {
        throw AFError.serverTrustEvaluationFailed(
            reason: .customEvaluationFailed(
                error: SSLPinningConfigurationError(
                    message: "\(message) (host: \(host))"
                )
            )
        )
    }
}

/// SSL Pinning Manager for certificate validation
/// Implements certificate pinning to prevent man-in-the-middle attacks
final class SSLPinningManager {

    // MARK: - Singleton

    static let shared = SSLPinningManager()

    // MARK: - Types

    /// Pinning mode
    enum PinningMode {
        case none           // No pinning - only use system validation
        case certificate    // Pin certificate
        case publicKey      // Pin public key (recommended for cert rotation)
    }

    /// Hash algorithm for certificate pinning
    enum HashAlgorithm {
        case sha256
        case sha1

        var algorithmId: Int32 {
            switch self {
            case .sha256: return CC_SHA256_DIGEST_LENGTH
            case .sha1: return CC_SHA1_DIGEST_LENGTH
            }
        }
    }

    // MARK: - Properties

    /// Current pinning mode
    private(set) var pinningMode: PinningMode

    /// Allowed certificate hashes (base64 encoded)
    private var allowedHashes: [String]

    /// Allowed public key hashes (base64 encoded)
    private var allowedPublicKeys: [String]

    /// Hash algorithm to use
    private let hashAlgorithm: HashAlgorithm

    /// Enable pinning in production
    private let enablePinning: Bool

    // MARK: - Initialization

    private init() {
        // In production, always enable pinning
        #if DEBUG
        self.enablePinning = false // Disable in dev for flexibility
        #else
        self.enablePinning = true // Always enable in production
        #endif

        // Default to public key pinning (allows cert rotation)
        self.pinningMode = .publicKey
        self.hashAlgorithm = .sha256

        // Initialize with empty arrays - will be loaded from bundle
        self.allowedHashes = []
        self.allowedPublicKeys = []

        // Load certificates from bundle
        loadCertificates()
    }

    // MARK: - Public Methods

    /// Create server trust evaluator for Alamofire
    /// - Returns: ServerTrustEvaluating instance
    func makeServerTrustEvaluator() -> ServerTrustEvaluating {
        // In DEBUG we disable pinning to keep local/dev environments usable.
        guard enablePinning else {
            return DefaultTrustEvaluator()
        }

        switch pinningMode {
        case .none:
            // Use default system validation
            return DefaultTrustEvaluator()

        case .certificate:
            // Pin specific certificates
            let certificates = getCertificates()
            guard !certificates.isEmpty else {
                let message = "SSLPinningManager: certificate pinning is enabled but no bundled certificates were found"
                SecureLogger.shared.error(message)
                return FailingTrustEvaluator(message: message)
            }
            return PinnedCertificatesTrustEvaluator(
                certificates: certificates,
                acceptSelfSignedCertificates: false,
                performDefaultValidation: true,
                validateHost: true
            )

        case .publicKey:
            // Pin public keys (recommended - allows cert rotation)
            let publicKeys = getPublicKeys()
            guard !publicKeys.isEmpty else {
                let message = "SSLPinningManager: public-key pinning is enabled but no bundled certificates were found"
                SecureLogger.shared.error(message)
                return FailingTrustEvaluator(message: message)
            }
            return PublicKeysTrustEvaluator(
                keys: publicKeys,
                performDefaultValidation: true,
                validateHost: true
            )
        }
    }

    /// Validate server trust manually
    /// - Parameters:
    ///   - trust: Server trust object
    ///   - host: Host name
    /// - Returns: True if trust is valid
    func validateServerTrust(_ trust: SecTrust, forHost host: String) -> Bool {
        guard enablePinning else {
            // Pinning disabled - use system validation
            return validateWithSystem(trust)
        }

        switch pinningMode {
        case .none:
            return validateWithSystem(trust)

        case .certificate:
            return validateCertificatePinning(trust)

        case .publicKey:
            return validatePublicKeyPinning(trust)
        }
    }

    /// Update allowed hashes
    /// - Parameters:
    ///   - hashes: Base64 encoded certificate hashes
    ///   - publicKeys: Base64 encoded public key hashes
    func updateAllowedHashes(hashes: [String], publicKeys: [String]) {
        self.allowedHashes = hashes
        self.allowedPublicKeys = publicKeys
        SecureLogger.shared.info("SSL pinning hashes updated")
    }

    func hasOperationalPinningMaterial(for mode: PinningMode? = nil) -> Bool {
        switch mode ?? pinningMode {
        case .none:
            return true
        case .certificate:
            return !getCertificates().isEmpty
        case .publicKey:
            return !getPublicKeys().isEmpty
        }
    }

    // MARK: - Private Methods

    /// Load certificates from bundle
    private func loadCertificates() {
        // Look for .cer files in bundle
        let certificateNames = [
            "trix3d-api",
            "trix3d-prod"
        ]

        for name in certificateNames {
            if let certPath = Bundle.main.path(forResource: name, ofType: "cer") {
                if let certData = try? Data(contentsOf: URL(fileURLWithPath: certPath)) {
                    if let cert = SecCertificateCreateWithData(nil, certData as CFData) {
                        // Extract hash
                        if let hash = hashCertificate(cert) {
                            allowedHashes.append(hash)
                        }
                        // Extract public key hash
                        if let pubKeyHash = hashPublicKey(cert) {
                            allowedPublicKeys.append(pubKeyHash)
                        }
                    }
                }
            }
        }

        SecureLogger.shared.info("Loaded \(allowedHashes.count) certificates for pinning")

        if enablePinning && !hasOperationalPinningMaterial(for: pinningMode) {
            SecureLogger.shared.error(
                "SSLPinningManager: pinning is enabled but no bundled certificates are available. " +
                "Release builds must ship the expected .cer resources."
            )
        }
    }

    /// Get certificates from bundle
    private func getCertificates() -> [SecCertificate] {
        var certificates: [SecCertificate] = []

        let certificateNames = [
            "trix3d-api",
            "trix3d-prod"
        ]

        for name in certificateNames {
            if let certPath = Bundle.main.path(forResource: name, ofType: "cer") {
                if let certData = try? Data(contentsOf: URL(fileURLWithPath: certPath)) {
                    if let cert = SecCertificateCreateWithData(nil, certData as CFData) {
                        certificates.append(cert)
                    }
                }
            }
        }

        return certificates
    }

    /// Get public keys from certificates
    private func getPublicKeys() -> [SecKey] {
        var publicKeys: [SecKey] = []

        for certificate in getCertificates() {
            if let publicKey = SecCertificateCopyPublicKey(certificate) {
                publicKeys.append(publicKey)
            }
        }

        return publicKeys
    }

    /// Validate with system defaults
    private func validateWithSystem(_ trust: SecTrust) -> Bool {
        var error: CFError?
        let isValid = SecTrustEvaluateWithError(trust, &error)
        return isValid
    }

    /// Validate certificate pinning
    private func validateCertificatePinning(_ trust: SecTrust) -> Bool {
        guard let serverCert = SecTrustGetCertificateAtIndex(trust, 0) else {
            return false
        }

        guard let serverHash = hashCertificate(serverCert as SecCertificate) else {
            return false
        }

        return allowedHashes.contains(serverHash)
    }

    /// Validate public key pinning
    private func validatePublicKeyPinning(_ trust: SecTrust) -> Bool {
        guard let serverCert = SecTrustGetCertificateAtIndex(trust, 0) else {
            return false
        }

        guard let serverKeyHash = hashPublicKey(serverCert as SecCertificate) else {
            return false
        }

        return allowedPublicKeys.contains(serverKeyHash)
    }

    /// Hash certificate data
    private func hashCertificate(_ certificate: SecCertificate) -> String? {
        let data = SecCertificateCopyData(certificate) as Data
        return hashData(data)
    }

    /// Hash public key from certificate
    private func hashPublicKey(_ certificate: SecCertificate) -> String? {
        guard let publicKey = SecCertificateCopyPublicKey(certificate) else {
            return nil
        }

        // Export public key to data
        var error: Unmanaged<CFError>?
        guard let keyData = SecKeyCopyExternalRepresentation(publicKey, &error) as Data? else {
            return nil
        }

        return hashData(keyData)
    }

    /// Hash data using configured algorithm
    private func hashData(_ data: Data) -> String? {
        let hashLength = hashAlgorithm.algorithmId

        var hash = [UInt8](repeating: 0, count: Int(hashLength))

        data.withUnsafeBytes { bytes in
            switch hashAlgorithm {
            case .sha256:
                _ = CC_SHA256(bytes.baseAddress, CC_LONG(data.count), &hash)
            case .sha1:
                _ = CC_SHA1(bytes.baseAddress, CC_LONG(data.count), &hash)
            }
        }

        return Data(hash).base64EncodedString()
    }
}

// MARK: - Configuration

extension SSLPinningManager {

    /// Configure pinning for specific environment
    /// - Parameters:
    ///   - mode: Pinning mode to use
    ///   - hashes: Allowed certificate hashes
    ///   - publicKeys: Allowed public key hashes
    func configure(
        mode: PinningMode,
        hashes: [String] = [],
        publicKeys: [String] = []
    ) {
        self.pinningMode = mode
        self.allowedHashes = hashes
        self.allowedPublicKeys = publicKeys
    }

    /// Disable pinning (for testing only)
    func disablePinning() {
        #if DEBUG
        self.pinningMode = .none
        SecureLogger.shared.warning("SSL pinning disabled - DEBUG ONLY")
        #endif
    }

    /// Enable pinning
    func enablePinningNow() {
        self.pinningMode = .publicKey
        SecureLogger.shared.info("SSL pinning enabled")
    }
}
