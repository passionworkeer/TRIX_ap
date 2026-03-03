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
    static let url = "https://hmbukjvrbyhbuqumqdug.supabase.co"

    /// Supabase Anonymous Key (public)
    static let anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtYnVranZyYnloYnVxdW1xZHVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MDY5NTgsImV4cCI6MjA4NjI4Mjk1OH0.i6xwAotL826Dob_P71YrnhW6jITyVMV3xU5zmIbNs20"

    /// Supabase Storage Bucket Name
    static let storageBucket = "avatars"

    /// Enable debug logging
    #if DEBUG
    static let debugMode = true
    #else
    static let debugMode = false
    #endif
}
