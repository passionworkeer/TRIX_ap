//
//  NewProfileView.swift
//  TRIX3DCompanion
//
//  Profile main view with native iOS design
//

import SwiftUI

// MARK: - New Profile View

/// Main profile screen with native iOS design
struct NewProfileView: View {

    // MARK: - State Objects

    @StateObject private var viewModel = ProfileViewModel()

    // MARK: - Environment

    @EnvironmentObject private var appState: AppState

    // MARK: - State

    @State private var showEditProfile = false
    @State private var showImagePicker = false
    @State private var showDeleteAlert = false
    @State private var showOpenClawControl = false

    // MARK: - Body

    var body: some View {
        NavigationView {
            ZStack {
                // Background
                Color(.systemGroupedBackground)
                    .ignoresSafeArea()

                // Content
                if viewModel.isLoading {
                    loadingView
                } else {
                    contentView
                }
            }
            .navigationTitle("个人资料")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                toolbarContent
            }
            .sheet(isPresented: $showEditProfile) {
                EditProfileSheet(viewModel: viewModel)
            }
            .sheet(isPresented: $showOpenClawControl) {
                Text("OpenClaw Control")
            }
            .alert("错误", isPresented: .constant(viewModel.errorMessage != nil)) {
                Button("确定") {
                    viewModel.clearMessages()
                }
            } message: {
                if let error = viewModel.errorMessage {
                    Text(error)
                }
            }
            .task {
                await viewModel.loadProfile()
            }
        }
    }

    // MARK: - Toolbar

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .navigationBarTrailing) {
            Menu {
                Button(action: { showEditProfile = true }) {
                    Label("编辑资料", systemImage: "pencil")
                }

                Button(action: { /* Settings */ }) {
                    Label("设置", systemImage: "gear")
                }

                Divider()

                Button(role: .destructive, action: { showDeleteAlert = true }) {
                    Label("删除账户", systemImage: "trash")
                }
            } label: {
                Image(systemName: "ellipsis.circle")
                    .font(.title3)
                    .foregroundColor(.purple)
            }
        }
    }

    // MARK: - View Components

    private var contentView: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Profile info card
                ProfileInfoCard(
                    user: viewModel.user,
                    avatarURL: viewModel.avatarURL,
                    displayName: viewModel.displayName,
                    email: viewModel.email,
                    bio: viewModel.bio,
                    isStudying: viewModel.isStudying,
                    onAvatarTap: { showImagePicker = true },
                    onEditTap: { showEditProfile = true }
                )
                .padding(.horizontal)

                // Points card
                pointsCard
                    .padding(.horizontal)

                // Stats section
                if let stats = viewModel.userStats {
                    statsSection(stats: stats)
                        .padding(.horizontal)
                }

                // Additional actions
                additionalActions
                    .padding(.horizontal)

                // Version info
                versionInfo
                    .padding(.top, 20)
            }
            .padding(.top, 20)
            .padding(.bottom, 100)
        }
        .refreshable {
            await viewModel.refresh()
        }
    }

    private var pointsCard: some View {
        VStack(spacing: 16) {
            // Header
            HStack {
                Image(systemName: "star.circle.fill")
                    .font(.title2)
                    .foregroundStyle(.yellow)

                VStack(alignment: .leading, spacing: 2) {
                    Text("积分余额")
                        .font(.headline)
                        .fontWeight(.semibold)

                    Text("等级 \(viewModel.level)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()
            }

            // Points display
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text("\(viewModel.totalPoints)")
                    .font(.system(size: 36, weight: .bold))
                    .foregroundStyle(.yellow)

                Text("积分")
                    .font(.headline)
                    .foregroundColor(.secondary)
            }

            // Progress bar
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("距离等级 \(viewModel.level + 1)")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    Spacer()

                    Text("\(viewModel.level * 1000 - viewModel.totalPoints) 积分")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color(.systemGray5))

                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color.yellow)
                            .frame(
                                width: geometry.size.width *
                                    Double((viewModel.totalPoints % 1000)) / 1000.0
                            )
                    }
                    .frame(height: 8)
                }
            }
        }
        .padding()
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func statsSection(stats: UserStats) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("学习统计")
                .font(.headline)
                .padding(.horizontal, 4)

            HStack(spacing: 12) {
                StatCard(
                    title: "今日学习",
                    value: formatDuration(stats.todayDuration),
                    icon: "clock.fill",
                    color: .blue
                )

                StatCard(
                    title: "连续天数",
                    value: "\(stats.streakDays)",
                    icon: "flame.fill",
                    color: .orange
                )

                StatCard(
                    title: "学习次数",
                    value: "\(stats.sessionCount)",
                    icon: "book.fill",
                    color: .green
                )
            }
        }
    }

    private var additionalActions: some View {
        List {
            Section {
                Button {
                    // Points history
                } label: {
                    Label("积分历史", systemImage: "star.fill")
                }

                Button {
                    // Settings
                } label: {
                    Label("设置", systemImage: "gear")
                }

                Button {
                    // Privacy
                } label: {
                    Label("隐私与安全", systemImage: "hand.raised.fill")
                }
            }

            Section {
                Button {
                    // Achievements
                } label: {
                    Label("成就", systemImage: "trophy.fill")
                }

                Button {
                    // Study History
                } label: {
                    Label("学习历史", systemImage: "clock.fill")
                }

                Button {
                    showOpenClawControl = true
                } label: {
                    Label("OpenClaw 控制面板", systemImage: "robot.fill")
                }
            }

            Section {
                Button {
                    // About
                } label: {
                    Label("关于", systemImage: "info.circle.fill")
                }
            }
        }
        .listStyle(.insetGrouped)
    }

    private var versionInfo: some View {
        VStack(spacing: 4) {
            Text("TRIX 3D Companion")
                .font(.caption)
                .foregroundColor(.secondary)

            Text("版本 1.0.0")
                .font(.caption2)
                .foregroundColor(Color(.tertiaryLabel))
        }
    }

    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
                .scaleEffect(1.5)

            Text("加载中...")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
    }

    // MARK: - Helper Methods

    private func formatDuration(_ duration: Int) -> String {
        let hours = duration / 3600
        let minutes = duration / 60 % 60
        if hours > 0 {
            return "\(hours)h \(minutes)m"
        }
        return "\(minutes)m"
    }
}

// MARK: - Edit Profile Sheet

struct EditProfileSheet: View {
    @Environment(\.dismiss) private var dismiss
    let viewModel: ProfileViewModel

    @State private var displayName: String = ""
    @State private var bio: String = ""

    var body: some View {
        NavigationView {
            Form {
                Section("显示名称") {
                    TextField("您的显示名称", text: $displayName)
                }

                Section("简介") {
                    TextEditor(text: $bio)
                        .frame(minHeight: 100)
                }
            }
            .navigationTitle("编辑资料")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("取消") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("保存") {
                        Task {
                            await viewModel.updateDisplayName(displayName)
                            await viewModel.updateBio(bio)
                            dismiss()
                        }
                    }
                    .fontWeight(.semibold)
                    .foregroundColor(.purple)
                }
            }
        }
        .onAppear {
            displayName = viewModel.displayName
            bio = viewModel.bio ?? ""
        }
    }
}

// MARK: - Preview

#Preview("Profile View") {
    NewProfileView()
        .environmentObject(AppState.shared)
}
