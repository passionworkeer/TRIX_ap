//
//  ColorGradientExtension.swift
//  TRIX3DCompanion
//
//  Color gradient utilities for SwiftUI
//

import SwiftUI

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
