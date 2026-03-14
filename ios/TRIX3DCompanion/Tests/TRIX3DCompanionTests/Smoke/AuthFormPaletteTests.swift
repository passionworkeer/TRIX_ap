import XCTest
import SwiftUI
import UIKit
@testable import TRIX3DCompanion

final class AuthFormPaletteTests: XCTestCase {
    func testPrimaryTextDoesNotInvertInDarkMode() {
        let light = resolvedComponents(for: AuthFormPalette.primaryText, style: .light)
        let dark = resolvedComponents(for: AuthFormPalette.primaryText, style: .dark)

        XCTAssertEqual(light.red, dark.red, accuracy: 0.001)
        XCTAssertEqual(light.green, dark.green, accuracy: 0.001)
        XCTAssertEqual(light.blue, dark.blue, accuracy: 0.001)
        XCTAssertEqual(light.alpha, dark.alpha, accuracy: 0.001)
    }

    func testPrimaryTextContrastAgainstWhiteMeetsWCAGAA() {
        XCTAssertGreaterThanOrEqual(
            contrastRatio(for: AuthFormPalette.primaryText, against: .white),
            7.0
        )
    }

    func testPlaceholderTextContrastAgainstWhiteMeetsWCAGAA() {
        XCTAssertGreaterThanOrEqual(
            contrastRatio(for: AuthFormPalette.placeholderText, against: .white),
            4.5
        )
    }

    private func resolvedComponents(
        for color: Color,
        style: UIUserInterfaceStyle
    ) -> (red: CGFloat, green: CGFloat, blue: CGFloat, alpha: CGFloat) {
        let resolved = UIColor(color).resolvedColor(
            with: UITraitCollection(userInterfaceStyle: style)
        )

        var red: CGFloat = 0
        var green: CGFloat = 0
        var blue: CGFloat = 0
        var alpha: CGFloat = 0
        XCTAssertTrue(
            resolved.getRed(&red, green: &green, blue: &blue, alpha: &alpha),
            "Expected RGBA-compatible color"
        )

        return (red, green, blue, alpha)
    }

    private func contrastRatio(for foreground: Color, against background: UIColor) -> CGFloat {
        let foregroundLuminance = relativeLuminance(for: UIColor(foreground))
        let backgroundLuminance = relativeLuminance(for: background)
        let lighter = max(foregroundLuminance, backgroundLuminance)
        let darker = min(foregroundLuminance, backgroundLuminance)

        return (lighter + 0.05) / (darker + 0.05)
    }

    private func relativeLuminance(for color: UIColor) -> CGFloat {
        var red: CGFloat = 0
        var green: CGFloat = 0
        var blue: CGFloat = 0
        var alpha: CGFloat = 0
        XCTAssertTrue(
            color.getRed(&red, green: &green, blue: &blue, alpha: &alpha),
            "Expected RGBA-compatible color"
        )

        func adjusted(_ channel: CGFloat) -> CGFloat {
            if channel <= 0.03928 {
                return channel / 12.92
            }
            return pow((channel + 0.055) / 1.055, 2.4)
        }

        return 0.2126 * adjusted(red) + 0.7152 * adjusted(green) + 0.0722 * adjusted(blue)
    }
}
