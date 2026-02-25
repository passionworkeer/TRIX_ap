import SwiftUI

/// TRIX 3D Companion 字体系统
/// 定义应用的排版样式
extension Font {

    // MARK: - Title Styles (标题样式)

    /// 大标题 - 34pt, 粗体
    static var largeTitle: Font {
        .system(size: 34, weight: .bold, design: .default)
    }

    /// 标题 - 28pt, 粗体
    static var titleStyle: Font {
        .system(size: 28, weight: .bold, design: .default)
    }

    /// 标题2 - 22pt, 粗体
    static var title2: Font {
        .system(size: 22, weight: .bold, design: .default)
    }

    /// 标题3 - 20pt, 半粗体
    static var title3: Font {
        .system(size: 20, weight: .semibold, design: .default)
    }

    // MARK: - Headline Styles (标题样式)

    /// 标题文字 - 20pt, 半粗体
    static var headlineStyle: Font {
        .system(size: 20, weight: .semibold, design: .default)
    }

    /// 小标题 - 17pt, 半粗体
    static var subheadline: Font {
        .system(size: 17, weight: .semibold, design: .default)
    }

    // MARK: - Body Styles (正文样式)

    /// 正文 - 17pt, 常规
    static var bodyStyle: Font {
        .system(size: 17, weight: .regular, design: .default)
    }

    /// 呼出文字 - 16pt, 常规
    static var callout: Font {
        .system(size: 16, weight: .regular, design: .default)
    }

    /// 副标题 - 15pt, 常规
    static var subheadlineStyle: Font {
        .system(size: 15, weight: .regular, design: .default)
    }

    /// 脚注 - 13pt, 常规
    static var footnote: Font {
        .system(size: 13, weight: .regular, design: .default)
    }

    /// 说明文字 - 12pt, 常规
    static var caption: Font {
        .system(size: 12, weight: .regular, design: .default)
    }

    /// 说明文字2 - 11pt, 常规
    static var caption2: Font {
        .system(size: 11, weight: .regular, design: .default)
    }

    // MARK: - Custom Weights (自定义字重)

    /// 正文 - 轻字重
    static var bodyLight: Font {
        .system(size: 17, weight: .light, design: .default)
    }

    /// 正文 - 中等字重
    static var bodyMedium: Font {
        .system(size: 17, weight: .medium, design: .default)
    }

    /// 正文 - 半粗体
    static var bodySemibold: Font {
        .system(size: 17, weight: .semibold, design: .default)
    }

    /// 正文 - 粗体
    static var bodyBold: Font {
        .system(size: 17, weight: .bold, design: .default)
    }

    // MARK: - Special Styles (特殊样式)

    /// 数字显示 - 等宽数字
    static var monospacedDigit: Font {
        .system(size: 17, weight: .regular, design: .monospaced)
    }

    /// 大号数字显示 - 等宽数字
    static var largeMonospacedDigit: Font {
        .system(size: 34, weight: .bold, design: .monospaced)
    }

    /// 按钮文字 - 17pt, 半粗体
    static var button: Font {
        .system(size: 17, weight: .semibold, design: .default)
    }

    /// 导航栏标题 - 17pt, 半粗体
    static var navigationTitle: Font {
        .system(size: 17, weight: .semibold, design: .default)
    }

    /// Tab Bar 文字 - 10pt, 常规
    static var tabBar: Font {
        .system(size: 10, weight: .regular, design: .default)
    }
}

// MARK: - Typography Style Helpers

extension Font {

    /// 创建自定义字体样式
    /// - Parameters:
    ///   - size: 字体大小
    ///   - weight: 字重
    ///   - design: 设计风格
    /// - Returns: 自定义字体
    static func custom(
        size: CGFloat,
        weight: Font.Weight = .regular,
        design: Font.Design = .default
    ) -> Font {
        .system(size: size, weight: weight, design: design)
    }

    /// 创建响应式字体 - 根据动态类型调整
    /// - Parameters:
    ///   - size: 基础大小
    ///   - weight: 字重
    ///   - style: 动态类型样式
    /// - Returns: 响应式字体
    static func responsive(
        size: CGFloat,
        weight: Font.Weight = .regular,
        style: Font.TextStyle = .body
    ) -> Font {
        .system(size: size, weight: weight, design: .default)
    }
}

// MARK: - Font Weight Extensions

extension Font.Weight {
    /// 字重名称（用于调试和预览）
    var name: String {
        switch self {
        case .ultraLight: return "Ultra Light"
        case .thin: return "Thin"
        case .light: return "Light"
        case .regular: return "Regular"
        case .medium: return "Medium"
        case .semibold: return "Semibold"
        case .bold: return "Bold"
        case .heavy: return "Heavy"
        case .black: return "Black"
        default: return "Unknown"
        }
    }
}

// MARK: - Preview Helpers

#if DEBUG
extension Font {
    /// 预览用的字体样式示例
    static var previewFonts: [(name: String, font: Font, size: CGFloat)] {
        [
            ("Large Title", .largeTitle, 34),
            ("Title", .titleStyle, 28),
            ("Title 2", .title2, 22),
            ("Title 3", .title3, 20),
            ("Headline", .headlineStyle, 20),
            ("Body", .bodyStyle, 17),
            ("Callout", .callout, 16),
            ("Subheadline", .subheadlineStyle, 15),
            ("Footnote", .footnote, 13),
            ("Caption", .caption, 12),
            ("Caption 2", .caption2, 11),
        ]
    }
}
#endif
