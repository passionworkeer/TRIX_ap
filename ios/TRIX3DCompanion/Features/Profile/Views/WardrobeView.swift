//
//  WardrobeView.swift
//  TRIX3DCompanion
//
//  Wardrobe/衣橱 - Avatar 装扮预览和管理
//

import SwiftUI

// MARK: - Wardrobe View

/// Avatar 装扮管理界面
struct WardrobeView: View {

    // MARK: - Environment

    @EnvironmentObject private var appState: AppState

    // MARK: - State

    @State private var selectedCategory: WardrobeCategory = .all
    @State private var equippedOutfits: Set<String> = []
    @State private var ownedOutfits: Set<String> = []

    // MARK: - Data

    private let allOutfits: [WardrobeItem] = [
        // 帽子
        WardrobeItem(id: "hat1", name: "学术帽", category: .hat, rarity: .common, points: 50, icon: "graduationcap.fill", color: .blue),
        WardrobeItem(id: "hat2", name: "魔法帽", category: .hat, rarity: .rare, points: 200, icon: "star.fill", color: .purple),
        WardrobeItem(id: "hat3", name: "派对帽", category: .hat, rarity: .epic, points: 500, icon: "sparkles", color: .pink),

        // 披风
        WardrobeItem(id: "cape1", name: "学士袍", category: .cape, rarity: .common, points: 100, icon: "mail.fill", color: .gray),
        WardrobeItem(id: "cape2", name: "凤凰披风", category: .cape, rarity: .legendary, points: 1000, icon: "flame.fill", color: .orange),

        // 魔杖
        WardrobeItem(id: "wand1", name: "基础魔杖", category: .wand, rarity: .common, points: 50, icon: "wand.and.stars.inverse", color: .brown),
        WardrobeItem(id: "wand2", name: "星光魔杖", category: .wand, rarity: .rare, points: 300, icon: "sparkles", color: .yellow),
        WardrobeItem(id: "wand3", name: "月亮魔杖", category: .wand, rarity: .epic, points: 600, icon: "moon.stars.fill", color: .blue),

        // 背景
        WardrobeItem(id: "bg1", name: "星空背景", category: .background, rarity: .common, points: 80, icon: "sparkles", color: .purple),
        WardrobeItem(id: "bg2", name: "彩虹背景", category: .background, rarity: .rare, points: 250, icon: "rainbow", color: .pink),
        WardrobeItem(id: "bg3", name: "宇宙背景", category: .background, rarity: .legendary, points: 800, icon: "circle.hexagongrid.fill", color: .blue)
    ]

    private var filteredOutfits: [WardrobeItem] {
        if selectedCategory == .all {
            return allOutfits
        }
        return allOutfits.filter { $0.category == selectedCategory }
    }

    // MARK: - Body

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                // Header with stats
                headerSection
                    .padding(.horizontal, 20)
                    .padding(.top, 60)
                    .padding(.bottom, 20)

                // Avatar preview
                avatarPreviewSection

                // Category filter
                categoryFilterSection
                    .padding(.horizontal, 20)
                    .padding(.bottom, 16)

                // Outfits grid
                outfitsGridSection
                    .padding(.horizontal, 20)
                    .padding(.bottom, 120)
            }
        }
        .background(backgroundGradient)
        .ignoresSafeArea()
        .onAppear {
            loadOwnedOutfits()
        }
    }

    // MARK: - Header Section

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("我的衣橱")
                .font(.title)
                .fontWeight(.bold)
                .foregroundColor(.white)

            HStack(spacing: 20) {
                StatDot(label: "已拥有", value: "\(ownedOutfits.count)")
                StatDot(label: "已装备", value: "\(equippedOutfits.count)")
            }
        }
    }

    // MARK: - Avatar Preview

    private var avatarPreviewSection: some View {
        VStack(spacing: 16) {
            // Avatar preview
            ZStack {
                // Background circle
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [Color.brandPurple.opacity(0.3), .clear],
                            center: .center,
                            startRadius: 0,
                            endRadius: 80
                        )
                    )
                    .frame(width: 150, height: 150)

                // Rotating decoration ring
                Circle()
                    .stroke(
                        Color.brandPurple.opacity(0.5),
                        style: StrokeStyle(lineWidth: 2, dash: [8, 4])
                    )
                    .frame(width: 140, height: 140)
                    .rotationEffect(.degrees(isRotating ? 360 : 0))

                // Avatar
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [Color.brandPurple, Color.brandPink],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 100, height: 100)
                    .overlay {
                        Image(systemName: "person.fill")
                            .font(.system(size: 40))
                            .foregroundColor(.white)
                    }
                    .overlay {
                        // VIP Badge
                        if ownedOutfits.count >= 5 {
                            VStack {
                                Image(systemName: "crown.fill")
                                    .font(.caption)
                                    .foregroundColor(.yellow)
                                Text("VIP")
                                    .font(.caption2)
                                    .fontWeight(.bold)
                                    .foregroundColor(.yellow)
                            }
                            .offset(y: 70)
                        }
                    }
            }
            .frame(height: 160)
        }
        .onAppear {
            isRotating = true
        }
    }

    @State private var isRotating = false

    // MARK: - Category Filter

    private var categoryFilterSection: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                ForEach(WardrobeCategory.allCases, id: \.self) { category in
                    CategoryButton(
                        category: category,
                        isSelected: selectedCategory == category
                    ) {
                        withAnimation(.spring(response: 0.3)) {
                            selectedCategory = category
                        }
                    }
                }
            }
            .padding(.vertical, 8)
        }
    }

    // MARK: - Outfits Grid

    private var outfitsGridSection: some View {
        LazyVGrid(columns: [
            GridItem(.flexible(), spacing: 16),
            GridItem(.flexible(), spacing: 16)
        ], spacing: 16) {
            ForEach(filteredOutfits) { item in
                WardrobeItemCard(
                    item: item,
                    isOwned: ownedOutfits.contains(item.id),
                    isEquipped: equippedOutfits.contains(item.id),
                    onEquip: { equipOutfit(item) },
                    onUnequip: { unequipOutfit(item) },
                    onPurchase: { purchaseOutfit(item) }
                )
            }
        }
    }

    // MARK: - Background

    private var backgroundGradient: some View {
        LinearGradient(
            colors: [
                Color.brandPurple.opacity(0.3),
                Color.brandPink.opacity(0.2),
                Color.clear
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .ignoresSafeArea()
    }

    // MARK: - Actions

    private func loadOwnedOutfits() {
        // Load owned outfits from API
        // For demo, give user some starter items
        ownedOutfits = Set(["hat1", "wand1"])
        equippedOutfits = Set(["hat1"])
    }

    private func equipOutfit(_ item: WardrobeItem) {
        _ = withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
            equippedOutfits.insert(item.id)
        }
        let generator = UIImpactFeedbackGenerator(style: .medium)
        generator.impactOccurred()
    }

    private func unequipOutfit(_ item: WardrobeItem) {
        _ = withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
            equippedOutfits.remove(item.id)
        }
    }

    private func purchaseOutfit(_ item: WardrobeItem) {
        if appState.spendPoints(item.points) {
            _ = withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                ownedOutfits.insert(item.id)
            }
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.success)
        } else {
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.error)
        }
    }
}

// MARK: - Wardrobe Item Model

struct WardrobeItem: Identifiable {
    let id: String
    let name: String
    let category: WardrobeCategory
    let rarity: ItemRarity
    let points: Int
    let icon: String
    let color: Color
}

// MARK: - Wardrobe Category

enum WardrobeCategory: String, CaseIterable {
    case all = "全部"
    case hat = "帽子"
    case cape = "披风"
    case wand = "魔杖"
    case background = "背景"

    var icon: String {
        switch self {
        case .all: return "square.grid.2x2.fill"
        case .hat: return "hat.fill"
        case .cape: return "coat.fill"
        case .wand: return "wand.and.stars"
        case .background: return "sparkles"
        }
    }
}

// MARK: - Item Rarity

enum ItemRarity: String {
    case common
    case rare
    case epic
    case legendary

    var color: Color {
        switch self {
        case .common: return .gray
        case .rare: return .blue
        case .epic: return .purple
        case .legendary: return .orange
        }
    }

    var name: String {
        switch self {
        case .common: return "普通"
        case .rare: return "稀有"
        case .epic: return "史诗"
        case .legendary: return "传说"
        }
    }
}

// MARK: - Category Button

struct CategoryButton: View {
    let category: WardrobeCategory
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: category.icon)
                    .font(.title3)
                    .foregroundColor(isSelected ? .white : .secondary)

                Text(category.rawValue)
                    .font(.caption)
                    .fontWeight(isSelected ? .semibold : .regular)
                    .foregroundColor(isSelected ? .white : .secondary)
            }
            .frame(width: 60)
            .padding(.vertical, 8)
            .background(
                Capsule()
                    .fill(isSelected ? Color.brandPurple : Color.white.opacity(0.1))
            )
            .overlay(
                Capsule()
                    .stroke(isSelected ? Color.clear : Color.secondary.opacity(0.3), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Wardrobe Item Card

struct WardrobeItemCard: View {
    let item: WardrobeItem
    let isOwned: Bool
    let isEquipped: Bool
    let onEquip: () -> Void
    let onUnequip: () -> Void
    let onPurchase: () -> Void

    @State private var isPressed = false

    var body: some View {
        Button {
            if isOwned {
                if isEquipped {
                    onUnequip()
                } else {
                    onEquip()
                }
            } else {
                onPurchase()
            }
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                // Header
                HStack {
                    // Icon
                    ZStack {
                        Circle()
                            .fill(item.color.opacity(0.2))
                            .frame(width: 40, height: 40)

                        Image(systemName: item.icon)
                            .foregroundColor(item.color)
                    }

                    Spacer()

                    // Rarity badge
                    Text(item.rarity.name)
                        .font(.caption2)
                        .fontWeight(.semibold)
                        .foregroundColor(item.rarity.color)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(item.rarity.color.opacity(0.2))
                        .clipShape(Capsule())

                    // Owned indicator
                    if isOwned {
                        if isEquipped {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(.green)
                        } else {
                            Image(systemName: "arrow.down.circle.fill")
                                .foregroundColor(.secondary)
                        }
                    } else {
                        Image(systemName: "cart")
                            .foregroundColor(.blue)
                    }
                }

                // Name
                Text(item.name)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(.primary)
                    .lineLimit(1)

                // Points
                if !isOwned {
                    HStack(spacing: 4) {
                        Image(systemName: "star.fill")
                            .font(.caption2)
                            .foregroundColor(.yellow)
                        Text("\(item.points)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }
            .padding(12)
            .frame(height: 90)
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isEquipped ? Color.brandPurple.opacity(0.5) : Color.clear, lineWidth: 2)
            )
        }
        .buttonStyle(.plain)
        .scaleEffect(isPressed ? 0.95 : 1.0)
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in isPressed = true }
                .onEnded { _ in isPressed = false }
        )
    }
}

// MARK: - Stat Dot

struct StatDot: View {
    let label: String
    let value: String

    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(Color.brandPurple)
                .frame(width: 8, height: 8)

            Text(label)
                .font(.caption)
                .foregroundColor(.white.opacity(0.8))

            Text(value)
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundColor(.white)
        }
    }
}

// MARK: - Preview

#Preview("Wardrobe") {
    WardrobeView()
        .environmentObject(AppState.shared)
}
