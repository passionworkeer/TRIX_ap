import SwiftUI

/// Theme system preview
#if DEBUG
struct ThemePreviewView: View {
    @State private var themeManager = ThemeManager.preview

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    // Theme picker
                    themePickerSection

                    Divider()

                    // Brand colors
                    brandColorsSection

                    Divider()

                    // Text colors
                    textColorsSection

                    Divider()

                    // Status colors
                    statusColorsSection

                    Divider()

                    // Typography
                    typographySection

                    Divider()

                    // Component examples
                    componentExamplesSection
                }
                .padding()
            }
            .navigationTitle("theme.title".localized)
            .themed(with: themeManager)
        }
    }

    // MARK: - Theme Picker Section

    private var themePickerSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("theme.settings".localized)
                .font(.headlineStyle)
                .foregroundColor(Color.textPrimary)

            Picker("theme.picker".localized, selection: Binding(
                get: { themeManager.currentTheme },
                set: { themeManager.setTheme($0) }
            )) {
                ForEach(AppTheme.allCases, id: \.self) { theme in
                    Text(theme.displayName).tag(theme)
                }
            }
            .pickerStyle(.segmented)

            HStack {
                Image(systemName: themeManager.isDarkMode ? "moon.fill" : "sun.max.fill")
                    .foregroundStyle(themeManager.isDarkMode ? .brandPurple : .warning)

                Text(String(format: "theme.currentMode".localized, themeManager.isDarkMode ? "theme.dark".localized : "theme.light".localized))
                    .font(.subheadlineStyle)
                    .foregroundColor(Color.textSecondary)
            }
            .padding(.top, 8)
        }
    }

    // MARK: - Brand Colors Section

    private var brandColorsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("theme.brandColors".localized)
                .font(.headlineStyle)
                .foregroundColor(Color.textPrimary)

            HStack(spacing: 16) {
                colorCard(name: "theme.brandPurple".localized, color: .brandPurple)
                colorCard(name: "theme.brandPink".localized, color: .brandPink)
            }

            // Gradient showcase
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.brandGradient)
                .frame(height: 60)
                .overlay(
                    Text("theme.brandGradient".localized)
                        .font(.button)
                        .foregroundColor(Color.white)
                )
        }
    }

    // MARK: - Text Colors Section

    private var textColorsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("theme.textColors".localized)
                .font(.headlineStyle)
                .foregroundColor(Color.textPrimary)

            VStack(alignment: .leading, spacing: 8) {
                textRow(label: "theme.primaryText".localized, color: .textPrimary)
                textRow(label: "theme.secondaryText".localized, color: .textSecondary)
                textRow(label: "theme.tertiaryText".localized, color: .textTertiary)
                textRow(label: "theme.placeholder".localized, color: .textPlaceholder)
            }
        }
    }

    private func textRow(label: String, color: Color) -> some View {
        HStack {
            Text(label)
                .font(.bodyStyle)
                .foregroundStyle(color)

            Spacer()

            RoundedRectangle(cornerRadius: 4)
                .fill(color)
                .frame(width: 40, height: 24)
        }
    }

    // MARK: - Status Colors Section

    private var statusColorsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("theme.statusColors".localized)
                .font(.headlineStyle)
                .foregroundColor(Color.textPrimary)

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                colorCard(name: "theme.success".localized, color: .success, icon: "checkmark.circle.fill")
                colorCard(name: "theme.warning".localized, color: .warning, icon: "exclamationmark.triangle.fill")
                colorCard(name: "theme.error".localized, color: .error, icon: "xmark.circle.fill")
                colorCard(name: "theme.info".localized, color: .info, icon: "info.circle.fill")
            }
        }
    }

    private func colorCard(name: String, color: Color, icon: String? = nil) -> some View {
        VStack(spacing: 8) {
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(color)
                    .frame(height: 60)

                if let icon = icon {
                    Image(systemName: icon)
                        .font(.title2)
                        .foregroundColor(Color.white)
                }
            }

            Text(name)
                .font(.caption)
                .foregroundColor(Color.textSecondary)
        }
    }

    // MARK: - Typography Section

    private var typographySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("theme.typography".localized)
                .font(.headlineStyle)
                .foregroundColor(Color.textPrimary)

            VStack(alignment: .leading, spacing: 12) {
                fontRow(name: "Large Title", font: .largeTitle)
                fontRow(name: "Title", font: .titleStyle)
                fontRow(name: "Title 2", font: .title2)
                fontRow(name: "Title 3", font: .title3)
                fontRow(name: "Headline", font: .headlineStyle)
                fontRow(name: "Body", font: .bodyStyle)
                fontRow(name: "Callout", font: .callout)
                fontRow(name: "Subheadline", font: .subheadlineStyle)
                fontRow(name: "Footnote", font: .footnote)
                fontRow(name: "Caption", font: .caption)
            }
        }
    }

    private func fontRow(name: String, font: Font) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(name)
                .font(.caption)
                .foregroundColor(Color.textTertiary)

            Text("The quick brown fox")
                .font(font)
                .foregroundColor(Color.textPrimary)
        }
    }

    // MARK: - Component Examples Section

    private var componentExamplesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("theme.components".localized)
                .font(.headlineStyle)
                .foregroundColor(Color.textPrimary)

            // Buttons
            VStack(spacing: 12) {
                Button("theme.primaryButton".localized) {
                    SecureLogger.shared.debug("Primary button tapped")
                }
                .font(.button)
                .foregroundColor(Color.white)
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.brandGradient)
                .cornerRadius(12)

                Button("theme.secondaryButton".localized) {
                    SecureLogger.shared.debug("Secondary button tapped")
                }
                .font(.button)
                .foregroundColor(Color.brandPurple)
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.brandPurple.opacity(0.1))
                .cornerRadius(12)
            }

            // Cards
            VStack(spacing: 12) {
                cardView(
                    title: "theme.studyProgress".localized,
                    subtitle: String(format: "theme.todayStudied".localized, 2),
                    icon: "book.fill"
                )

                cardView(
                    title: "theme.pointsBalance".localized,
                    subtitle: String(format: "theme.points".localized, 1250),
                    icon: "star.fill"
                )
            }

            // TextField example
            VStack(alignment: .leading, spacing: 8) {
                Text("theme.textField".localized)
                    .font(.subheadlineStyle)
                    .foregroundColor(Color.textSecondary)

                TextField("theme.enterContent".localized, text: .constant(""))
                    .textFieldStyle(.roundedBorder)
                    .font(.bodyStyle)
            }
            .padding()
            .background(Color.cardBackground)
            .cornerRadius(12)
        }
    }

    private func cardView(title: String, subtitle: String, icon: String) -> some View {
        HStack {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(Color.brandPurple)
                .frame(width: 44, height: 44)
                .background(Color.brandPurple.opacity(0.1))
                .cornerRadius(10)

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headlineStyle)
                    .foregroundColor(Color.textPrimary)

                Text(subtitle)
                    .font(.subheadlineStyle)
                    .foregroundColor(Color.textSecondary)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.subheadline)
                .foregroundColor(Color.textTertiary)
        }
        .padding()
        .background(Color.cardBackground)
        .cornerRadius(12)
        .shadow(color: .shadow, radius: 4, x: 0, y: 2)
    }
}

// MARK: - Preview

#Preview("Light Theme") {
    ThemePreviewView()
        .themed(with: ThemeManager.preview)
}

#Preview("Dark Theme") {
    ThemePreviewView()
        .themed(with: ThemeManager.previewDark)
}
#endif
