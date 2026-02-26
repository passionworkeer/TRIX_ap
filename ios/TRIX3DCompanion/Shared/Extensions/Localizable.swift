//
//  Localizable.swift
//  TRIX3DCompanion
//
//  Localization helper for SwiftUI
//

import SwiftUI

// MARK: - LocalizedStringKey Extension

extension String {
    /// Get localized string from key
    var localized: String {
        NSLocalizedString(self, comment: "")
    }

    /// Get localized string with format arguments
    /// - Parameter arguments: Format arguments
    /// - Returns: Localized formatted string
    func localized(_ arguments: CVarArg...) -> String {
        String(format: self.localized, arguments: arguments)
    }
}

// MARK: - Localized View

/// A view that displays localized text
struct LocalizedText: View {
    let key: String
    var arguments: [CVarArg] = []

    var body: Text {
        if arguments.isEmpty {
            Text(key.localized)
        } else {
            Text(String(format: key.localized, arguments: arguments))
        }
    }
}

// MARK: - View Extension for Localization

extension View {
    /// Apply localization ID for accessibility
    func localized(_ key: String) -> some View {
        self.accessibilityLabel(key.localized)
    }
}

// MARK: - Environment Values

private struct LocaleKey: EnvironmentKey {
    static let defaultValue: String = "en"
}

extension EnvironmentValues {
    var currentLocale: String {
        get { self[LocaleKey.self] }
        set { self[LocaleKey.self] = newValue }
    }
}

// MARK: - Preview

#Preview("Localized Text") {
    VStack(spacing: 20) {
        LocalizedText(key: "nav.home")
        LocalizedText(key: "action.send")
        LocalizedText(key: "study.points.earned", arguments: ["100"])
        Text("custom.key".localized)
    }
    .padding()
}
