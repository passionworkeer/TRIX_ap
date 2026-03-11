//
//  StudyStatsView.swift
//  TRIX3DCompanion
//
//  学习统计视图
//  显示学习时长、趋势图表、专注度统计等
//

import SwiftUI
import Charts

// MARK: - Study Stats View

/// 学习统计视图
struct StudyStatsView: View {

    // MARK: - State

    @State private var stats: StudyStats?
    @State private var weeklyData: [DailyStudyData] = []
    @State private var selectedTimeRange: TimeRange = .week
    @State private var isLoading = true
    @State private var errorMessage: String?

    // MARK: - Dependencies

    private let studyService: any StudyServiceProtocol

    // MARK: - Initialization

    init(studyService: (any StudyServiceProtocol)? = nil) {
        self.studyService = studyService ?? StudyService.shared
    }

    // MARK: - Body

    var body: some View {
        NavigationView {
            ZStack {
                // Background gradient
                backgroundGradient
                    .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 20) {
                        // Time range selector
                        timeRangeSelector

                        // Summary cards
                        summaryCards

                        // Weekly chart
                        weeklyChartSection

                        // Focus stats
                        focusStatsSection

                        // Achievements
                        achievementsSection
                    }
                    .padding()
                }
            }
            .navigationTitle("Study Statistics")
            .navigationBarTitleDisplayMode(.large)
            .refreshable {
                await loadStats()
            }
            .overlay {
                if isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle())
                }
            }
            .alert("Error", isPresented: .constant(errorMessage != nil)) {
                Button("OK") {
                    errorMessage = nil
                }
            } message: {
                if let errorMessage = errorMessage {
                    Text(errorMessage)
                }
            }
        }
        .task {
            await loadStats()
        }
    }

    // MARK: - View Components

    /// 时间范围选择器
    private var timeRangeSelector: some View {
        Picker("Time Range", selection: $selectedTimeRange) {
            Text("Today").tag(TimeRange.today)
            Text("This Week").tag(TimeRange.week)
            Text("This Month").tag(TimeRange.month)
            Text("All Time").tag(TimeRange.allTime)
        }
        .pickerStyle(.segmented)
        .onChange(of: selectedTimeRange) { _ in
            Task {
                await loadStats()
            }
        }
    }

    /// 概览卡片
    private var summaryCards: some View {
        LazyVGrid(columns: [
            GridItem(.flexible()),
            GridItem(.flexible())
        ], spacing: 16) {
            SummaryCard(
                title: "Today",
                value: formatDuration(stats?.todayDuration ?? 0),
                icon: "calendar",
                color: .brandPurple
            )

            SummaryCard(
                title: "This Week",
                value: formatDuration(stats?.weekDuration ?? 0),
                icon: "calendar.badge.clock",
                color: .brandPink
            )

            SummaryCard(
                title: "Total Time",
                value: formatDuration(stats?.totalDuration ?? 0),
                icon: "clock.fill",
                color: .success
            )

            SummaryCard(
                title: "Sessions",
                value: "\(stats?.sessionCount ?? 0)",
                icon: "checkmark.circle.fill",
                color: .info
            )
        }
    }

    /// 每周图表部分
    private var weeklyChartSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Study Trend")
                .font(.headline)
                .fontWeight(.semibold)

            VStack(spacing: 12) {
                if weeklyData.isEmpty {
                    emptyChartView
                } else {
                    Chart {
                        ForEach(weeklyData) { day in
                            BarMark(
                                x: .value("Day", Self.parseDate(day.date), unit: .day),
                                y: .value("Minutes", day.totalMinutes)
                            )
                            .foregroundStyle(
                                LinearGradient(
                                    colors: [.brandPurple, .brandPink],
                                    startPoint: .top,
                                    endPoint: .bottom
                                )
                            )
                            .cornerRadius(8)
                        }
                    }
                    .frame(height: 200)
                    .chartYAxis {
                        AxisMarks(position: .leading) { value in
                            AxisValueLabel {
                                if let minutes = value.as(Int.self) {
                                    Text("\(minutes)m")
                                        .font(.caption2)
                                }
                            }
                            AxisGridLine()
                                .foregroundStyle(Color.gray.opacity(0.3))
                        }
                    }
                    .chartXAxis {
                        AxisMarks(position: .bottom, values: .automatic(desiredCount: 7)) { value in
                            AxisValueLabel {
                                if let date = value.as(Date.self) {
                                    Text(date, format: .dateTime.weekday(.abbreviated))
                                        .font(.caption2)
                                }
                            }
                            AxisGridLine()
                                .foregroundStyle(Color.gray.opacity(0.3))
                        }
                    }

                    // Legend
                    HStack {
                        Circle()
                            .fill(.brandPurple)
                            .frame(width: 8, height: 8)

                        Text("Study Duration")
                            .font(.caption)
                            .foregroundColor(.textSecondary)

                        Spacer()

                        Text("Total: \(formatDuration(weeklyData.reduce(0) { $0 + $1.totalMinutes }))")
                            .font(.caption)
                            .foregroundColor(.textSecondary)
                    }
                }
            }
            .padding()
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 16))
        }
    }

    /// 空图表视图
    private var emptyChartView: some View {
        VStack(spacing: 12) {
            Image(systemName: "chart.bar.doc.horizontal")
                .font(.system(size: 40))
                .foregroundColor(.textTertiary)

            Text("No data yet")
                .font(.subheadline)
                .foregroundColor(.textSecondary)

            Text("Start studying to see your trends!")
                .font(.caption)
                .foregroundColor(.textTertiary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 30)
    }

    /// 专注度统计部分
    private var focusStatsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Focus Insights")
                .font(.headline)
                .fontWeight(.semibold)

            VStack(spacing: 12) {
                FocusStatRow(
                    title: "Average Session",
                    value: formatDuration(stats?.averageDuration ?? 0),
                    icon: "timer",
                    color: .brandPurple
                )

                FocusStatRow(
                    title: "Current Streak",
                    value: "\(stats?.streakDays ?? 0) days",
                    icon: "flame.fill",
                    color: .warning
                )

                FocusStatRow(
                    title: "Focus Score",
                    value: focusScoreText,
                    icon: "brain.head.profile",
                    color: .success
                )
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    /// 成就部分
    private var achievementsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Recent Achievements")
                .font(.headline)
                .fontWeight(.semibold)

            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 12) {
                AchievementBadge(
                    icon: "star.fill",
                    title: "First Session",
                    earned: true
                )

                AchievementBadge(
                    icon: "flame.fill",
                    title: "3-Day Streak",
                    earned: (stats?.streakDays ?? 0) >= 3
                )

                AchievementBadge(
                    icon: "clock.fill",
                    title: "10 Hours",
                    earned: (stats?.totalDuration ?? 0) >= 600
                )

                AchievementBadge(
                    icon: "brain.head.profile",
                    title: "Deep Focus",
                    earned: false
                )

                AchievementBadge(
                    icon: "moon.fill",
                    title: "Night Owl",
                    earned: false
                )

                AchievementBadge(
                    icon: "sun.max.fill",
                    title: "Early Bird",
                    earned: false
                )
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    /// 背景渐变
    private var backgroundGradient: some View {
        LinearGradient(
            colors: [
                Color.brandPurple.opacity(0.1),
                Color.brandPink.opacity(0.05),
                Color.clear
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    // MARK: - Computed Properties

    /// 专注分数文本
    private var focusScoreText: String {
        let avgDuration = stats?.averageDuration ?? 0
        if avgDuration >= 3600 { // 1 hour+
            return "Excellent"
        } else if avgDuration >= 1800 { // 30 min+
            return "Great"
        } else if avgDuration > 0 {
            return "Good"
        } else {
            return "N/A"
        }
    }

    // MARK: - Actions

    /// 加载统计数据
    private func loadStats() async {
        isLoading = true
        errorMessage = nil

        let result = await studyService.getStudyStats()
        let weeklyResult = await studyService.getWeeklyStudyData()

        await MainActor.run {
            switch result {
            case .success(let statsData):
                stats = statsData
            case .failure(let error):
                errorMessage = error.localizedDescription
            }

            switch weeklyResult {
            case .success(let weeklyDataResult):
                weeklyData = weeklyDataResult
            case .failure(let error):
                errorMessage = error.localizedDescription
            }

            isLoading = false
        }
    }

    /// 格式化时长
    private func formatDuration(_ minutes: Int) -> String {
        let hours = minutes / 60
        let mins = minutes % 60

        if hours > 0 {
            return "\(hours)h \(mins)m"
        } else {
            return "\(mins)m"
        }
    }
}

// MARK: - Summary Card

/// 概览卡片组件
struct SummaryCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(color)
                    .font(.title3)

                Spacer()
            }

            Text(value)
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(.textPrimary)

            Text(title)
                .font(.caption)
                .foregroundColor(.textSecondary)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .shadow, radius: 5, x: 0, y: 2)
    }
}

// MARK: - Focus Stat Row

/// 专注度统计行组件
struct FocusStatRow: View {
    let title: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundColor(color)
                .font(.title3)
                .frame(width: 30)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline)
                    .foregroundColor(.textPrimary)

                Text(value)
                    .font(.caption)
                    .foregroundColor(.textSecondary)
            }

            Spacer()
        }
        .padding(.vertical, 8)
    }
}

// MARK: - Achievement Badge

/// 成就徽章组件
struct AchievementBadge: View {
    let icon: String
    let title: String
    let earned: Bool

    var body: some View {
        VStack(spacing: 8) {
            ZStack {
                Circle()
                    .fill(earned ? Color.brandPurple.opacity(0.2) : Color.textTertiary.opacity(0.1))
                    .frame(width: 50, height: 50)

                Image(systemName: icon)
                    .font(.title3)
                    .foregroundColor(earned ? .brandPurple : .textTertiary)
            }

            Text(title)
                .font(.caption2)
                .foregroundColor(earned ? .textPrimary : .textTertiary)
                .lineLimit(2)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(
            earned ? AnyShapeStyle(.ultraThinMaterial) : AnyShapeStyle(Color.clear)
        )
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - Supporting Types

/// 时间范围枚举
enum TimeRange: String, CaseIterable {
    case today
    case week
    case month
    case allTime
}

/// 每日学习数据
struct StudyDailyData: Identifiable {
    let id = UUID()
    let date: Date
    let durationMinutes: Int
}

// MARK: - Helper Methods

extension StudyStatsView {
    /// Parse date string to Date
    static func parseDate(_ dateString: String) -> Date {
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"
        return dateFormatter.date(from: dateString) ?? Date()
    }
}

// MARK: - Preview

#Preview("Study Stats View") {
    StudyStatsView()
}
