//
//  SupabaseConfig.swift
//  TRIX3DCompanion
//
//  Supabase configuration - values from web .env file
//

import Foundation

/// Supabase configuration values
/// NOTE: anonKey is a public key meant for client-side use.
/// It should be configured via Info.plist or environment variables.
enum SupabaseConfig {
    /// Supabase Project URL
    /// Priority: Info.plist > Environment Variable > Default
    static var url: String {
        // First try Info.plist
        if let url = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_URL") as? String,
           !url.isEmpty {
            return url
        }
        // Then try environment variable
        if let url = ProcessInfo.processInfo.environment["SUPABASE_URL"],
           !url.isEmpty {
            return url
        }
        // Fall back to default (should not happen in production)
        return SupabaseConfig.placeholderURL
    }

    /// Supabase Anonymous Key (public)
    /// Priority: Info.plist > Environment Variable > Default
    static var anonKey: String {
        // First try Info.plist
        if let key = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String,
           !key.isEmpty {
            return key
        }
        // Then try environment variable
        if let key = ProcessInfo.processInfo.environment["SUPABASE_ANON_KEY"],
           !key.isEmpty {
            return key
        }
        // Fall back to default (should not happen in production)
        return SupabaseConfig.placeholderAnonKey
    }

    /// Placeholder URL (returned when not configured)
    private static let placeholderURL = "https://placeholder.supabase.co"

    /// Placeholder Anon Key (returned when not configured)
    private static let placeholderAnonKey = "placeholder-anon-key"

    /// Supabase Storage Bucket Name
    static let storageBucket = "avatars"

    /// Check if Supabase is properly configured
    static var isConfigured: Bool {
        return url != placeholderURL && anonKey != placeholderAnonKey
    }

    /// Validate configuration and log warning if not properly configured
    static func validateConfiguration() {
        if !isConfigured {
            SecureLogger.shared.warning(
                "SupabaseConfig: Supabase is not configured. " +
                "Please set SUPABASE_URL and SUPABASE_ANON_KEY in Info.plist " +
                "or as environment variables."
            )
        }
    }

    /// Enable debug logging
    #if DEBUG
    static let debugMode = true
    #else
    static let debugMode = false
    #endif
}
