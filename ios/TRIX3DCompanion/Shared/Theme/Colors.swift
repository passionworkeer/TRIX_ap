import SwiftUI
import UIKit

// MARK: - Color Initializers

extension Color {

    /// 从十六进制字符串创建颜色
    /// - Parameter hex: 十六进制字符串，支持 "RGB", "RRGGBB", "RRGGBBAA" 格式
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

    /// 创建支持浅色/深色模式的颜色
    /// - Parameters:
    ///   - light: 浅色模式下的颜色
    ///   - dark: 深色模式下的颜色
    init(light: Color, dark: Color) {
        self.init(UIColor { traitCollection in
            switch traitCollection.userInterfaceStyle {
            case .dark:
                return UIColor(dark)
            default:
                return UIColor(light)
            }
        })
    }
}

/// TRIX 3D Companion 颜色系统
/// 支持浅色/深色模式，使用语义化命名
extension Color {

    // MARK: - Brand Colors (品牌色)

    /// 主色 - 紫色
    static let brandPurple = Color(hex: "8B5CF6")

    /// 次要色 - 粉色
    static let brandPink = Color(hex: "EC4899")

    /// 品牌渐变色
    static let brandGradient = LinearGradient(
        colors: [.brandPurple, .brandPink],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    // MARK: - Primary Colors (主要颜色)

    /// 主要操作色
    static var primary: Color {
        Color(hex: "8B5CF6")
    }

    /// 次要操作色
    static var secondary: Color {
        Color(hex: "A78BFA")
    }

    /// 强调色
    static var accent: Color {
        Color(hex: "EC4899")
    }

    // MARK: - Background Colors (背景色)

    /// 主背景色
    static var background: Color {
        Color(light: Color(hex: "FFFFFF"), dark: Color(hex: "000000"))
    }

    /// 次级背景色
    static var secondaryBackground: Color {
        Color(light: Color(hex: "F9FAFB"), dark: Color(hex: "111827"))
    }

    /// 三级背景色
    static var tertiaryBackground: Color {
        Color(light: Color(hex: "F3F4F6"), dark: Color(hex: "1F2937"))
    }

    /// 分组背景色
    static var groupedBackground: Color {
        Color(light: Color(hex: "F2F2F7"), dark: Color(hex: "1C1C1E"))
    }

    // MARK: - Text Colors (文本色)

    /// 主要文本色
    static var textPrimary: Color {
        Color(light: Color(hex: "111827"), dark: Color(hex: "F9FAFB"))
    }

    /// 次要文本色
    static var textSecondary: Color {
        Color(light: Color(hex: "6B7280"), dark: Color(hex: "9CA3AF"))
    }

    /// 三级文本色
    static var textTertiary: Color {
        Color(light: Color(hex: "9CA3AF"), dark: Color(hex: "6B7280"))
    }

    /// 占位符文本色
    static var textPlaceholder: Color {
        Color(light: Color(hex: "D1D5DB"), dark: Color(hex: "4B5563"))
    }

    // MARK: - Status Colors (状态色)

    /// 成功色
    static var success: Color {
        Color(hex: "10B981")
    }

    /// 警告色
    static var warning: Color {
        Color(hex: "F59E0B")
    }

    /// 错误色
    static var error: Color {
        Color(hex: "EF4444")
    }

    /// 信息色
    static var info: Color {
        Color(hex: "3B82F6")
    }

    // MARK: - Component Colors (组件颜色)

    /// 卡片背景色
    static var cardBackground: Color {
        Color(light: Color(hex: "FFFFFF"), dark: Color(hex: "1C1C1E"))
    }

    /// 分割线/边框色
    static var separator: Color {
        Color(light: Color(hex: "E5E7EB"), dark: Color(hex: "374151"))
    }

    /// 边框色
    static var border: Color {
        Color(light: Color(hex: "E5E7EB"), dark: Color(hex: "374151"))
    }

    /// 阴影色
    static var shadow: Color {
        Color(light: Color(hex: "000000").opacity(0.05), dark: Color(hex: "000000").opacity(0.3))
    }

    // MARK: - Special Colors (特殊颜色)

    /// 遮罩色
    static var overlay: Color {
        Color(light: Color(hex: "000000").opacity(0.4), dark: Color(hex: "000000").opacity(0.6))
    }

    /// 禁用色
    static var disabled: Color {
        Color(light: Color(hex: "E5E7EB"), dark: Color(hex: "4B5563"))
    }

    /// 禁用文本色
    static var disabledText: Color {
        Color(light: Color(hex: "9CA3AF"), dark: Color(hex: "6B7280"))
    }

    // MARK: - Gray Scale Colors (灰度颜色)

    /// 灰度 900 - 用于深色背景
    static let gray900 = Color(light: Color(hex: "111827"), dark: Color(hex: "F9FAFB"))
}

// MARK: - Preview Helpers

#if DEBUG
extension Color {
    /// 预览用的颜色示例
    static var previewColors: [(name: String, color: Color)] {
        [
            ("Brand Purple", .brandPurple),
            ("Brand Pink", .brandPink),
            ("Primary", .primary),
            ("Secondary", .secondary),
            ("Accent", .accent),
            ("Success", .success),
            ("Warning", .warning),
            ("Error", .error),
            ("Info", .info),
        ]
    }
}
#endif
