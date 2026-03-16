//
//  StatsSection.swift
//  TRIX3DCompanion
//
//  Statistics section component showing user stats
//

import SwiftUI

// MARK: - Localization Helper
private func L(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

// MARK: - Stats Section

/// Statistics section displaying user metrics
struct StatsSection: View {

    // MARK: - Properties

    let totalPoints: Int
    let level: Int
    let totalStudyTime: Int
    let todayStudyTime: Int
    let streakDays: Int
    let sessionCount: Int

    // MARK: - Initialization

    init(
        totalPoints: Int,
        level: Int,
        totalStudyTime: Int,
        todayStudyTime: Int = 0,
        streakDays: Int = 0,
        sessionCount: Int = 0
    ) {
        self.totalPoints = totalPoints
        self.level = level
        self.totalStudyTime = totalStudyTime
        self.todayStudyTime = todayStudyTime
        self.streakDays = streakDays
        self.sessionCount = sessionCount
    }

    // MARK: - Body

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Section header
            sectionHeader

            // Stats grid
            statsGrid
        }
    }

    // MARK: - View Components

    private var sectionHeader: some View {
        HStack {
            Image(systemName: "chart.bar.fill")
                .foregroundStyle(
                    LinearGradient(
                        colors: [.brandPurple, .brandPink],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )

            Text(L("profile.stats"))
                .font(.headline)
                .fontWeight(.semibold)

            Spacer()
        }
        .padding(.horizontal, 4)
    }

    private var statsGrid: some View {
        VStack(spacing: 12) {
            // First row
            HStack(spacing: 12) {
                StatCard(
                    title: L("profile.points.total"),
                    value: "\(totalPoints)",
                    icon: "star.fill",
                    color: .yellow,
                    subtitle: "\(L("profile.level")) \(level)"
                )

                StatCard(
                    title: L("profile.study.time"),
                    value: formattedStudyTime,
                    icon: "clock.fill",
                    color: .blue,
                    subtitle: L("profile.stats.total")
                )
            }

            // Second row
            HStack(spacing: 12) {
                StatCard(
                    title: L("profile.stats.today"),
                    value: formatMinutes(todayStudyTime),
                    icon: "sun.max.fill",
                    color: .orange,
                    subtitle: L("profile.stats.minutes")
                )

                StatCard(
                    title: L("profile.stats.streak"),
                    value: "\(streakDays)",
                    icon: "flame.fill",
                    color: .red,
                    subtitle: L("profile.stats.days")
                )
            }

            // Third row (optional)
            if sessionCount > 0 {
                StatCard(
                    title: L("profile.stats.sessions"),
                    value: "\(sessionCount)",
                    icon: "book.fill",
                    color: .purple,
                    subtitle: L("profile.stats.total")
                )
                .frame(maxWidth: .infinity)
            }
        }
    }

    // MARK: - Helpers

    private var formattedStudyTime: String {
        let hours = totalStudyTime / 60
        let minutes = totalStudyTime % 60

        if hours > 0 {
            return "\(hours)h \(minutes)m"
        } else {
            return "\(minutes)m"
        }
    }

    private func formatMinutes(_ minutes: Int) -> String {
        if minutes >= 60 {
            let hours = minutes / 60
            let mins = minutes % 60
            return "\(hours)h \(mins)m"
        } else {
            return "\(minutes)"
        }
    }
}

// MARK: - Stat Card

/// Individual stat card component
struct StatCard: View {

    let title: String
    let value: String
    let icon: String
    let color: Color
    let subtitle: String?

    init(
        title: String,
        value: String,
        icon: String,
        color: Color,
        subtitle: String? = nil
    ) {
        self.title = title
        self.value = value
        self.icon = icon
        self.color = color
        self.subtitle = subtitle
    }

    var body: some View {
        VStack(spacing: 10) {
            // Icon
            ZStack {
                Circle()
                    .fill(color.opacity(0.15))
                    .frame(width: 44, height: 44)

                Image(systemName: icon)
                    .font(.title3)
                    .foregroundColor(color)
            }

            // Value
            Text(value)
                .font(.headline)
                .fontWeight(.bold)
                .foregroundColor(.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.6)

            // Title
            VStack(spacing: 2) {
                Text(title)
                    .font(.caption2)
                    .foregroundColor(.textSecondary)
                    .lineLimit(1)

                if let subtitle = subtitle {
                    Text(subtitle)
                        .font(.caption2)
                        .foregroundColor(.textTertiary)
                }
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
        .padding(.horizontal, 12)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(.ultraThinMaterial)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(
                    LinearGradient(
                        colors: [.white.opacity(0.1), .clear],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 1
                )
        )
        .shadow(color: .shadow, radius: 8, x: 0, y: 4)
    }
}

// MARK: - Preview

#Preview("Stats Section") {
    VStack(spacing: 24) {
        StatsSection(
            totalPoints: 2450,
            level: 3,
            totalStudyTime: 1230,
            todayStudyTime: 120,
            streakDays: 7,
            sessionCount: 42
        )
        .padding()

        StatsSection(
            totalPoints: 500,
            level: 1,
            totalStudyTime: 60,
            todayStudyTime: 30,
            streakDays: 1,
            sessionCount: 5
        )
        .padding()
    }
    .background(
        LinearGradient(
            colors: [.brandPurple.opacity(0.1), .brandPink.opacity(0.05)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    )
}

#Preview("Stat Card") {
    HStack(spacing: 12) {
        StatCard(
            title: "Total Points",
            value: "2450",
            icon: "star.fill",
            color: .yellow,
            subtitle: "Level 3"
        )

        StatCard(
            title: "Study Time",
            value: "20h 30m",
            icon: "clock.fill",
            color: .blue,
            subtitle: "Total"
        )
    }
    .padding()
    .background(
        LinearGradient(
            colors: [.brandPurple.opacity(0.1), .brandPink.opacity(0.05)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    )
}
