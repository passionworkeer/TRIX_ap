//
//  ColorGradientExtension.swift
//  TRIX3DCompanion
//
//  Color gradient utilities for SwiftUI
//

import SwiftUI
import UIKit

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

    /// Brand gradient
    static var brandGradient: LinearGradient {
        LinearGradient(
            colors: [Color.brandPurple, Color.brandPink],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }
}

extension ShapeStyle where Self == Color {
    /// Brand purple color
    static var brandPurple: Color {
        Color(UIColor(red: 139/255, green: 92/255, blue: 246/255, alpha: 1))
    }

    /// Brand pink color
    static var brandPink: Color {
        Color(UIColor(red: 236/255, green: 72/255, blue: 153/255, alpha: 1))
    }

    /// Success color
    static var success: Color {
        Color(UIColor(red: 16/255, green: 185/255, blue: 129/255, alpha: 1))
    }

    /// Warning color
    static var warning: Color {
        Color(UIColor(red: 245/255, green: 158/255, blue: 11/255, alpha: 1))
    }

    /// Error color
    static var error: Color {
        Color(UIColor(red: 239/255, green: 68/255, blue: 68/255, alpha: 1))
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
