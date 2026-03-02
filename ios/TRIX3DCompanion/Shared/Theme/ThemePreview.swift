import SwiftUI

/// 主题系统演示视图
#if DEBUG
struct ThemePreviewView: View {
    @State private var themeManager = ThemeManager.shared

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    // 主题选择器
                    themePickerSection

                    Divider()

                    // 品牌颜色
                    brandColorsSection

                    Divider()

                    // 文本颜色
                    textColorsSection

                    Divider()

                    // 状态颜色
                    statusColorsSection

                    Divider()

                    // 字体样式
                    typographySection

                    Divider()

                    // 组件示例
                    componentExamplesSection
                }
                .padding()
            }
            .navigationTitle("主题系统")
            .themed()
        }
    }

    // MARK: - Theme Picker Section

    private var themePickerSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("主题设置")
                .font(.headlineStyle)
                .foregroundColor(Color.textPrimary)

            Picker("主题", selection: Binding(
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

                Text("当前模式: \(themeManager.isDarkMode ? "深色" : "浅色")")
                    .font(.subheadlineStyle)
                    .foregroundColor(Color.textSecondary)
            }
            .padding(.top, 8)
        }
    }

    // MARK: - Brand Colors Section

    private var brandColorsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("品牌颜色")
                .font(.headlineStyle)
                .foregroundColor(Color.textPrimary)

            HStack(spacing: 16) {
                colorCard(name: "品牌紫", color: .brandPurple)
                colorCard(name: "品牌粉", color: .brandPink)
            }

            // 渐变展示
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.brandGradient)
                .frame(height: 60)
                .overlay(
                    Text("品牌渐变")
                        .font(.button)
                        .foregroundColor(Color.white)
                )
        }
    }

    // MARK: - Text Colors Section

    private var textColorsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("文本颜色")
                .font(.headlineStyle)
                .foregroundColor(Color.textPrimary)

            VStack(alignment: .leading, spacing: 8) {
                textRow(label: "主要文本", color: .textPrimary)
                textRow(label: "次要文本", color: .textSecondary)
                textRow(label: "三级文本", color: .textTertiary)
                textRow(label: "占位符", color: .textPlaceholder)
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
            Text("状态颜色")
                .font(.headlineStyle)
                .foregroundColor(Color.textPrimary)

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                colorCard(name: "成功", color: .success, icon: "checkmark.circle.fill")
                colorCard(name: "警告", color: .warning, icon: "exclamationmark.triangle.fill")
                colorCard(name: "错误", color: .error, icon: "xmark.circle.fill")
                colorCard(name: "信息", color: .info, icon: "info.circle.fill")
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
            Text("字体样式")
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
            Text("组件示例")
                .font(.headlineStyle)
                .foregroundColor(Color.textPrimary)

            // 按钮
            VStack(spacing: 12) {
                Button("主要按钮") {
                    SecureLogger.shared.debug("Primary button tapped")
                }
                .font(.button)
                .foregroundColor(Color.white)
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.brandGradient)
                .cornerRadius(12)

                Button("次要按钮") {
                    SecureLogger.shared.debug("Secondary button tapped")
                }
                .font(.button)
                .foregroundColor(Color.brandPurple)
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.brandPurple.opacity(0.1))
                .cornerRadius(12)
            }

            // 卡片
            VStack(spacing: 12) {
                cardView(
                    title: "学习进度",
                    subtitle: "今日已学习 2 小时",
                    icon: "book.fill"
                )

                cardView(
                    title: "积分余额",
                    subtitle: "1,250 积分",
                    icon: "star.fill"
                )
            }

            // 输入框示例
            VStack(alignment: .leading, spacing: 8) {
                Text("输入框")
                    .font(.subheadlineStyle)
                    .foregroundColor(Color.textSecondary)

                TextField("请输入内容", text: .constant(""))
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
        .themed(with: .preview)
}

#Preview("Dark Theme") {
    ThemePreviewView()
        .themed(with: .previewDark)
}
#endif
