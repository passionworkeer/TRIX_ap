import SwiftUI

// MARK: - Design System
/// TRIX 3D Companion 统一设计系统
/// 提供一致的圆角、间距、阴影、动画等视觉规范
enum DesignSystem {

    // MARK: - Corner Radius (圆角统一)
    enum CornerRadius {
        /// 小圆角 - 8pt
        static let small: CGFloat = 8

        /// 中圆角 - 12pt
        static let medium: CGFloat = 12

        /// 大圆角 - 16pt
        static let large: CGFloat = 16

        /// 特大圆角 - 20pt
        static let extraLarge: CGFloat = 20

        /// 圆形/药丸形 - 9999pt
        static let circular: CGFloat = 9999

        /// 按钮圆角 - 使用 medium
        static let button: CGFloat = medium

        /// 卡片圆角 - 使用 large
        static let card: CGFloat = large

        /// 输入框圆角 - 使用 small
        static let input: CGFloat = small

        /// 图片圆角 - 使用 medium
        static let image: CGFloat = medium
    }

    // MARK: - Spacing (间距统一)
    enum Spacing {
        /// 紧凑间距 - 4pt
        static let tight: CGFloat = 4

        /// 小间距 - 8pt
        static let small: CGFloat = 8

        /// 中间距 - 12pt
        static let medium: CGFloat = 12

        /// 大间距 - 16pt
        static let large: CGFloat = 16

        /// 特大间距 - 24pt
        static let extraLarge: CGFloat = 24

        /// 超大间距 - 32pt
        static let ultraLarge: CGFloat = 32

        /// 组件内间距 - 使用 medium
        static let component: CGFloat = medium

        /// 列表项间距 - 使用 small
        static let listItem: CGFloat = small

        /// 区块间距 - 使用 large
        static let section: CGFloat = large
    }

    // MARK: - Padding (内边距统一)
    enum Padding {
        /// 小内边距 - 8pt
        static let small: CGFloat = 8

        /// 中内边距 - 16pt
        static let medium: CGFloat = 16

        /// 大内边距 - 20pt
        static let large: CGFloat = 20

        /// 特大内边距 - 24pt
        static let extraLarge: CGFloat = 24

        /// 卡片内边距 - 使用 large
        static let card: CGFloat = large

        /// 按钮内边距 - 使用 medium
        static let button: CGFloat = medium

        /// 屏幕边缘水平内边距 - 16pt
        static let screenHorizontal: CGFloat = 16

        /// 屏幕边缘垂直内边距 - 24pt
        static let screenVertical: CGFloat = 24
    }

    // MARK: - Shadow (阴影统一)
    enum Shadow {
        /// 阴影样式
        struct ShadowStyle {
            let color: Color
            let radius: CGFloat
            let x: CGFloat
            let y: CGFloat

            /// 应用阴影到视图
            @ViewBuilder
            func apply(to view: some View) -> some View {
                view.shadow(color: color, radius: radius, x: x, y: y)
            }
        }

        /// 小阴影 - 用于轻微浮起效果
        static let small = ShadowStyle(
            color: .black.opacity(0.1),
            radius: 4,
            x: 0,
            y: 2
        )

        /// 中阴影 - 用于卡片等组件
        static let medium = ShadowStyle(
            color: .black.opacity(0.15),
            radius: 8,
            x: 0,
            y: 4
        )

        /// 大阴影 - 用于弹窗、浮层
        static let large = ShadowStyle(
            color: .black.opacity(0.2),
            radius: 16,
            x: 0,
            y: 8
        )

        /// 品牌阴影 - 使用品牌色
        static let brand = ShadowStyle(
            color: Color.brandPurple.opacity(0.25),
            radius: 12,
            x: 0,
            y: 4
        )

        /// 按钮悬停阴影
        static let buttonHover = ShadowStyle(
            color: .black.opacity(0.2),
            radius: 10,
            x: 0,
            y: 5
        )
    }

    // MARK: - Animation (动画统一)
    enum Animation {
        /// 快速动画 - 200ms
        static let quick = SwiftUI.Animation.easeInOut(duration: 0.2)

        /// 标准动画 - 300ms
        static let defaultAnimation = SwiftUI.Animation.easeInOut(duration: 0.3)

        /// 慢速动画 - 500ms
        static let slow = SwiftUI.Animation.easeInOut(duration: 0.5)

        /// 弹性动画 - 400ms with spring
        static let spring = SwiftUI.Animation.spring(response: 0.4, dampingFraction: 0.7)

        /// 弹性动画 - 快速
        static let springFast = SwiftUI.Animation.spring(response: 0.3, dampingFraction: 0.8)

        /// 弹性动画 - 慢速
        static let springSlow = SwiftUI.Animation.spring(response: 0.6, dampingFraction: 0.6)

        /// 弹跳动画
        static let bounce = SwiftUI.Animation.spring(response: 0.5, dampingFraction: 0.5)

        /// 流畅动画 - 用于过渡
        static let smooth = SwiftUI.Animation.easeInOut(duration: 0.25)

        /// 交错动画延迟
        static func staggeredDelay(index: Int, baseDelay: Double = 0.05) -> Double {
            Double(index) * baseDelay
        }
    }

    // MARK: - Border Width (边框宽度)
    enum BorderWidth {
        /// 细边框 - 1pt
        static let thin: CGFloat = 1

        /// 中边框 - 2pt
        static let medium: CGFloat = 2

        /// 粗边框 - 3pt
        static let thick: CGFloat = 3
    }

    // MARK: - Icon Size (图标尺寸)
    enum IconSize {
        /// 超小图标 - 12pt
        static let extraSmall: CGFloat = 12

        /// 小图标 - 16pt
        static let small: CGFloat = 16

        /// 中图标 - 20pt
        static let medium: CGFloat = 20

        /// 大图标 - 24pt
        static let large: CGFloat = 24

        /// 超大图标 - 32pt
        static let extraLarge: CGFloat = 32

        /// 特大图标 - 48pt
        static let ultraLarge: CGFloat = 48
    }

    // MARK: - Component Size (组件尺寸)
    enum ComponentSize {
        /// 按钮高度 - 小
        static let buttonSmall: CGFloat = 36

        /// 按钮高度 - 中
        static let buttonMedium: CGFloat = 44

        /// 按钮高度 - 大
        static let buttonLarge: CGFloat = 52

        /// 输入框高度 - 标准
        static let inputHeight: CGFloat = 44

        /// 头像尺寸 - 小
        static let avatarSmall: CGFloat = 32

        /// 头像尺寸 - 中
        static let avatarMedium: CGFloat = 48

        /// 头像尺寸 - 大
        static let avatarLarge: CGFloat = 64

        /// 头像尺寸 - 特大
        static let avatarExtraLarge: CGFloat = 96

        /// 标签栏高度
        static let tabBarHeight: CGFloat = 49

        /// 导航栏高度
        static let navBarHeight: CGFloat = 44

        /// 工具栏高度
        static let toolbarHeight: CGFloat = 44
    }

    // MARK: - Opacity (透明度)
    enum Opacity {
        /// 禁用状态 - 0.5
        static let disabled: Double = 0.5

        /// 次要内容 - 0.6
        static let secondary: Double = 0.6

        /// 悬停效果 - 0.8
        static let hover: Double = 0.8

        /// 遮罩 - 0.4
        static let overlay: Double = 0.4

        /// 深色遮罩 - 0.6
        static let overlayDark: Double = 0.6
    }
}

// MARK: - View Extensions

extension View {
    /// 应用设计系统阴影
    func applyShadow(_ style: DesignSystem.Shadow.ShadowStyle) -> some View {
        self.shadow(
            color: style.color,
            radius: style.radius,
            x: style.x,
            y: style.y
        )
    }

    /// 应用设计系统阴影 - 小
    func applyShadowSmall() -> some View {
        self.applyShadow(DesignSystem.Shadow.small)
    }

    /// 应用设计系统阴影 - 中
    func applyShadowMedium() -> some View {
        self.applyShadow(DesignSystem.Shadow.medium)
    }

    /// 应用设计系统阴影 - 大
    func applyShadowLarge() -> some View {
        self.applyShadow(DesignSystem.Shadow.large)
    }

    /// 应用设计系统品牌阴影
    func applyShadowBrand() -> some View {
        self.applyShadow(DesignSystem.Shadow.brand)
    }

    /// 应用设计系统圆角
    func applyCornerRadius(_ radius: CGFloat) -> some View {
        self.cornerRadius(radius)
    }

    /// 应用设计系统标准圆角
    func applyCardCornerRadius() -> some View {
        self.clipShape(RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.card))
    }

    /// 应用按钮圆角
    func applyButtonCornerRadius() -> some View {
        self.clipShape(RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.button))
    }

    /// 应用圆形
    func applyCircular() -> some View {
        self.clipShape(Circle())
    }

    /// 应用内边距
    func applyPadding(_ padding: CGFloat) -> some View {
        self.padding(padding)
    }

    /// 应用标准动画
    func animate(_ animation: SwiftUI.Animation = SwiftUI.Animation.easeInOut(duration: 0.3)) -> some View {
        self.animation(animation, value: UUID())
    }
}

// MARK: - Preview Helpers

#if DEBUG
struct DesignSystem_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: DesignSystem.Spacing.large) {
            // Corner Radius
            VStack(alignment: .leading, spacing: DesignSystem.Spacing.small) {
                Text("Corner Radius")
                    .font(.headline)

                HStack(spacing: DesignSystem.Spacing.small) {
                    RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.small)
                        .fill(Color.brandPurple)
                        .frame(width: 60, height: 40)
                        .overlay(Text("Small").font(.caption2))

                    RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.medium)
                        .fill(Color.brandPurple)
                        .frame(width: 60, height: 40)
                        .overlay(Text("Medium").font(.caption2))

                    RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.large)
                        .fill(Color.brandPurple)
                        .frame(width: 60, height: 40)
                        .overlay(Text("Large").font(.caption2))

                    RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.extraLarge)
                        .fill(Color.brandPurple)
                        .frame(width: 60, height: 40)
                        .overlay(Text("XL").font(.caption2))
                }
            }
            .padding()
            .background(Color.secondaryBackground)

            // Shadow
            VStack(alignment: .leading, spacing: DesignSystem.Spacing.small) {
                Text("Shadow")
                    .font(.headline)

                HStack(spacing: DesignSystem.Spacing.large) {
                    RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.medium)
                        .fill(Color.cardBackground)
                        .frame(width: 80, height: 60)
                        .applyShadowSmall()

                    RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.medium)
                        .fill(Color.cardBackground)
                        .frame(width: 80, height: 60)
                        .applyShadowMedium()

                    RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.medium)
                        .fill(Color.cardBackground)
                        .frame(width: 80, height: 60)
                        .applyShadowLarge()
                }
            }
            .padding()
            .background(Color.secondaryBackground)

            // Spacing
            VStack(alignment: .leading, spacing: DesignSystem.Spacing.small) {
                Text("Spacing")
                    .font(.headline)

                HStack(spacing: DesignSystem.Spacing.tight) {
                    Circle().fill(Color.brandPurple).frame(width: DesignSystem.Spacing.tight, height: DesignSystem.Spacing.tight)
                    Circle().fill(Color.brandPurple).frame(width: DesignSystem.Spacing.small, height: DesignSystem.Spacing.small)
                    Circle().fill(Color.brandPurple).frame(width: DesignSystem.Spacing.medium, height: DesignSystem.Spacing.medium)
                    Circle().fill(Color.brandPurple).frame(width: DesignSystem.Spacing.large, height: DesignSystem.Spacing.large)
                    Circle().fill(Color.brandPurple).frame(width: DesignSystem.Spacing.extraLarge, height: DesignSystem.Spacing.extraLarge)
                }
            }
            .padding()
            .background(Color.secondaryBackground)
        }
        .padding()
        .background(Color.background)
        .previewDisplayName("Design System")
    }
}
#endif
