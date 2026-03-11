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
    let localizationKey: String
    let isCore: Bool

    var label: String {
        localizationKey.localized
    }

    static let tabs: [GlassDockTab] = [
        GlassDockTab(tab: .map, icon: "map.fill", localizationKey: "nav.map", isCore: false),
        GlassDockTab(tab: .study, icon: "book.fill", localizationKey: "nav.study", isCore: false),
        GlassDockTab(tab: .core, icon: "camera.fill", localizationKey: "nav.core", isCore: true),
        GlassDockTab(tab: .chat, icon: "message.fill", localizationKey: "nav.chat", isCore: false),
        GlassDockTab(tab: .profile, icon: "person.fill", localizationKey: "nav.profile", isCore: false)
    ]
}

// MARK: - GlassDock View

struct GlassDockView: View {
    @Binding var selectedTab: MainTab
    @Binding var isWorkbenchPresented: Bool

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
        .padding(.bottom, 18)
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
            let generator = UIImpactFeedbackGenerator(style: .light)
            generator.impactOccurred()

            withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                selectedIndex = index
                selectedTab = dockTab.tab
                isWorkbenchPresented = false
            }
        } label: {
            VStack(spacing: 4) {
                ZStack {
                    if isSelected {
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .fill(
                                LinearGradient(
                                    colors: [
                                        Color.brandPurple.opacity(0.18),
                                        Color.brandPink.opacity(0.1)
                                    ],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .frame(width: 52, height: 52)
                    }

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
                        .frame(width: 44, height: 44)
                        .scaleEffect(isSelected ? 1.1 : 1.0)
                        .accessibilityLabel(dockTab.label)
                }

                Text(dockTab.label)
                    .font(.system(size: 10, weight: isSelected ? .semibold : .regular))
                    .foregroundColor(isSelected ? Color.brandPurple : .secondary)
            }
            .frame(width: 56, height: 56)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Core Button (Center Gem)

    private var coreButton: some View {
        Button {
            let generator = UIImpactFeedbackGenerator(style: .medium)
            generator.impactOccurred()

            withAnimation(.spring(response: 0.4, dampingFraction: 0.6)) {
                if selectedTab == .home && isWorkbenchPresented {
                    isWorkbenchPresented = false
                    return
                }

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

                VStack(spacing: 2) {
                    Image(systemName: "camera.fill")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundColor(.white)
                        .shadow(color: .black.opacity(0.2), radius: 2, x: 0, y: 1)

                    Text("Core")
                        .font(.system(size: 8, weight: .bold, design: .rounded))
                        .foregroundStyle(.white.opacity(0.88))
                }
            }
        }
        .buttonStyle(.plain)
    }

    // MARK: - Helpers

    private func updateSelectedIndex(for tab: MainTab) {
        let dockSelection = tab == .home ? MainTab.core : tab
        if let index = GlassDockTab.tabs.firstIndex(where: { $0.tab == dockSelection }) {
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
                isWorkbenchPresented: .constant(false)
            )
        }
    }
}
