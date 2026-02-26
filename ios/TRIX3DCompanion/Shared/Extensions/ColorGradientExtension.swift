//
//  ColorGradientExtension.swift
//  TRIX3DCompanion
//
//  Color gradient utilities for SwiftUI
//

import SwiftUI

// MARK: - Color Gradient Extension

extension Color {
    /// Create a color from hex string
    /// - Parameter hex: Hex color string (e.g., "FF0000")
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }

        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// MARK: - Shape Style Extension

extension ShapeStyle where Self == LinearGradient {
    /// Create a gradient from color array
    static func gradient(
        colors: [Color],
        startPoint: UnitPoint = .topLeading,
        endPoint: UnitPoint = .bottomTrailing
    ) -> LinearGradient {
        LinearGradient(colors: colors, startPoint: startPoint, endPoint: endPoint)
    }
}

// MARK: - View Extension

extension View {
    /// Apply gradient foreground
    func foregroundGradient(
        colors: [Color],
        startPoint: UnitPoint = .topLeading,
        endPoint: UnitPoint = .bottomTrailing
    ) -> some View {
        self.foregroundStyle(
            LinearGradient(colors: colors, startPoint: startPoint, endPoint: endPoint)
        )
    }

    /// Apply gradient background
    func backgroundGradient(
        colors: [Color],
        startPoint: UnitPoint = .topLeading,
        endPoint: UnitPoint = .bottomTrailing
    ) -> some View {
        self.background(
            LinearGradient(colors: colors, startPoint: startPoint, endPoint: endPoint)
        )
    }
}

// MARK: - Background Gradient Modifier

struct BackgroundGradient: ViewModifier {
    let colors: [Color]
    let startPoint: UnitPoint
    let endPoint: UnitPoint

    func body(content: Content) -> some View {
        content
            .background(
                LinearGradient(colors: colors, startPoint: startPoint, endPoint: endPoint)
            )
    }
}

extension View {
    /// Apply background gradient using modifier
    func backgroundGradient(
        _ colors: [Color],
        from startPoint: UnitPoint = .topLeading,
        to endPoint: UnitPoint = .bottomTrailing
    ) -> some View {
        modifier(BackgroundGradient(colors: colors, startPoint: startPoint, endPoint: endPoint))
    }
}
