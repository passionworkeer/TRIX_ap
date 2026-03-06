//
//  GlassDockView.swift
//  TRIX3DCompanion
//
//  Glass-morphism bottom floating navigation dock
//

import SwiftUI

// MARK: - GlassDock Tab Model

struct GlassDockTab: Identifiable, Hashable {
    let id = UUID()
    let tab: MainTab
    let icon: String
    let label: String
    let isCore: Bool

    static let tabs: [GlassDockTab] = [
        GlassDockTab(tab: .map, icon: "map.fill", label: NSLocalizedString("nav.map", comment: ""), isCore: false),
        GlassDockTab(tab: .study, icon: "book.fill", label: NSLocalizedString("nav.study", comment: ""), isCore: false),
        GlassDockTab(tab: .core, icon: "camera.fill", label: NSLocalizedString("nav.core", comment: ""), isCore: true),
        GlassDockTab(tab: .chat, icon: "message.fill", label: NSLocalizedString("nav.chat", comment: ""), isCore: false),
        GlassDockTab(tab: .profile, icon: "person.fill", label: NSLocalizedString("nav.profile", comment: ""), isCore: false)
    ]
}

// MARK: - GlassDock View

struct GlassDockView: View {
    @Binding var selectedTab: MainTab
    @Binding var isWorkbenchPresented: Bool
    @Binding var isChatPresented: Bool

    @State private var selectedIndex: Int = 2  // 默认选中中间的核心按钮（摄像头）- 主界面
    @State private var animateGlow = false

    private let dockHeight: CGFloat = 70
    private let dockPadding: CGFloat = 16
    private let itemSpacing: CGFloat = 8

    var body: some View {
        HStack(spacing: itemSpacing) {
            ForEach(Array(GlassDockTab.tabs.enumerated()), id: \.element.id) { index, dockTab in
                if dockTab.isCore {
                    coreButton
                } else {
                    tabButton(for: dockTab, index: index)
                }
            }
        }
        .padding(.horizontal, dockPadding)
        .padding(.vertical, 12)
        .frame(height: dockHeight)
        .background(
            RoundedRectangle(cornerRadius: 35)
                .fill(.ultraThinMaterial)
                .shadow(color: .black.opacity(0.15), radius: 20, x: 0, y: 10)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 35)
                .stroke(
                    LinearGradient(
                        colors: [.white.opacity(0.4), .white.opacity(0.1)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 1
                )
        )
        .padding(.horizontal, 20)
        .padding(.bottom, 8)
        .onChange(of: selectedTab) { newValue in
            updateSelectedIndex(for: newValue)
        }
        .onAppear {
            updateSelectedIndex(for: selectedTab)
            startGlowAnimation()
        }
    }

    // MARK: - Tab Button

    @ViewBuilder
    private func tabButton(for dockTab: GlassDockTab, index: Int) -> some View {
        let isSelected = selectedIndex == index

        Button {
            withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                selectedIndex = index
                selectedTab = dockTab.tab

                if dockTab.tab == .chat {
                    isChatPresented = true
                }
            }
        } label: {
            VStack(spacing: 4) {
                ZStack {
                    // Glow effect when selected
                    if isSelected {
                        Circle()
                            .fill(
                                RadialGradient(
                                    colors: [Color.brandPurple.opacity(0.4), .clear],
                                    center: .center,
                                    startRadius: 0,
                                    endRadius: 20
                                )
                            )
                            .frame(width: 44, height: 44)
                            .blur(radius: 8)
                            .scaleEffect(animateGlow ? 1.1 : 1.0)
                    }

                    Image(systemName: dockTab.icon)
                        .font(.system(size: 20, weight: .medium))
                        .foregroundColor(isSelected ? Color.brandPurple : .secondary)
                        .frame(width: 32, height: 32)
                        .scaleEffect(isSelected ? 1.1 : 1.0)
                }

                Text(dockTab.label)
                    .font(.system(size: 10, weight: isSelected ? .semibold : .regular))
                    .foregroundColor(isSelected ? Color.brandPurple : .secondary)
            }
            .frame(width: 50, height: 50)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Core Button (Center Gem)

    private var coreButton: some View {
        Button {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.6)) {
                // 相机按钮点击后切换到Home页并弹出工作台（让用户选择功能）
                selectedTab = .home
                isWorkbenchPresented = true
            }
        } label: {
            ZStack {
                // Outer glow
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [Color.brandPurple.opacity(0.5), Color.brandPink.opacity(0.3), .clear],
                            center: .center,
                            startRadius: 0,
                            endRadius: 30
                        )
                    )
                    .frame(width: 60, height: 60)
                    .blur(radius: 10)
                    .scaleEffect(animateGlow ? 1.15 : 1.0)

                // Gem gradient background
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [Color.brandPurple, Color.brandPink, Color.brandPurple.opacity(0.8)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 50, height: 50)
                    .shadow(color: Color.brandPurple.opacity(0.5), radius: 8, x: 0, y: 4)

                // Inner shine
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [.white.opacity(0.4), .clear],
                            startPoint: .topLeading,
                            endPoint: .center
                        )
                    )
                    .frame(width: 50, height: 50)

                // Camera icon (core button)
                Image(systemName: "camera.fill")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundColor(.white)
                    .shadow(color: .black.opacity(0.2), radius: 2, x: 0, y: 1)
            }
        }
        .buttonStyle(.plain)
    }

    // MARK: - Helpers

    private func updateSelectedIndex(for tab: MainTab) {
        if let index = GlassDockTab.tabs.firstIndex(where: { $0.tab == tab }) {
            selectedIndex = index
        }
    }

    private func startGlowAnimation() {
        withAnimation(.easeInOut(duration: 2.0).repeatForever(autoreverses: true)) {
            animateGlow = true
        }
    }
}

// MARK: - Preview

#Preview("GlassDock") {
    ZStack {
        Color.gray.opacity(0.2)
            .ignoresSafeArea()

        VStack {
            Spacer()
            GlassDockView(
                selectedTab: .constant(.home),
                isWorkbenchPresented: .constant(false),
                isChatPresented: .constant(false)
            )
        }
    }
}
