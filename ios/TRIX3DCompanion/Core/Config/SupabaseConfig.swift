//
//  SupabaseConfig.swift
//  TRIX3DCompanion
//
//  Supabase configuration - values from web .env file
//

import Foundation

/// Supabase configuration values
enum SupabaseConfig {
    /// Supabase Project URL
    static let url = "https://__SUPABASE_PROJECT_REF_REDACTED__.supabase.co"

    /// Supabase Anonymous Key (public)
    static let anonKey = "__SUPABASE_ANON_KEY_REDACTED__"

    /// Supabase Storage Bucket Name
    static let storageBucket = "avatars"

    /// Enable debug logging
    #if DEBUG
    static let debugMode = true
    #else
    static let debugMode = false
    #endif
}
