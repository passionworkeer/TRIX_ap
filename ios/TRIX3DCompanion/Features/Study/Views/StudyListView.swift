//
//  StudyListView.swift
//  TRIX3DCompanion
//
//  Study list view showing study rooms and focus sessions
//

import SwiftUI

// MARK: - Study List View

/// Study/Focus screen with timer and study rooms
struct StudyListView: View {

    // MARK: - Environment

    @EnvironmentObject private var appState: AppState

    // MARK: - State

    @State private var selectedDuration: Int = 25
    @State private var isStudying = false
    @State private var remainingTime: Int = 0
    @State private var timer: Timer?
    @State private var showStartAnimation = false
    @State private var showSummary = false

    // Duration options
    private let durations = [25, 45, 60]

    // MARK: - Body

    var body: some View {
        ZStack {
            // Background
            backgroundGradient

            VStack(spacing: 0) {
                // Header
                headerSection

                // Study stats
                studyStatsSection

                // Duration selector
                durationSelector

                Spacer()

                // Timer display
                timerDisplay

                Spacer()

                // Start button
                startButton
                    .padding(.bottom, 120)
            }
            .padding(.horizontal, 20)
        }
        .ignoresSafeArea()
        .fullScreenCover(isPresented: $showStartAnimation) {
            FocusStartAnimationView(onComplete: {
                startStudySession()
            })
        }
        .sheet(isPresented: $showSummary) {
            StudySummaryView(
                duration: selectedDuration,
                points: selectedDuration * 2,
                onDismiss: {
                    showSummary = false
                    isStudying = false
                }
            )
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

    // MARK: - Header

    private var headerSection: some View {
        VStack(spacing: 4) {
            Text(NSLocalizedString("study.title", comment: "学习"))
                .font(.title)
                .fontWeight(.bold)
                .foregroundColor(.white)

            Text(NSLocalizedString("study.focus.time", comment: "专注时间"))
                .font(.subheadline)
                .foregroundColor(.white.opacity(0.8))
        }
        .padding(.top, 60)
        .padding(.bottom, 20)
    }

    // MARK: - Study Stats

    private var studyStatsSection: some View {
        HStack(spacing: 20) {
            StatCard(
                title: NSLocalizedString("study.today.time", comment: "今日"),
                value: appState.formattedStudyTime,
                icon: "sun.max.fill",
                color: .orange
            )

            StatCard(
                title: NSLocalizedString("study.streak", comment: "连续"),
                value: "7 \(NSLocalizedString("days", comment: "天"))",
                icon: "flame.fill",
                color: .red
            )

            StatCard(
                title: NSLocalizedString("profile.points", comment: "积分"),
                value: "\(appState.userPoints)",
                icon: "star.fill",
                color: .yellow
            )
        }
        .padding(.vertical, 20)
    }

    // MARK: - Duration Selector

    private var durationSelector: some View {
        VStack(spacing: 12) {
            Text(NSLocalizedString("study.select.duration", comment: "选择时长"))
                .font(.subheadline)
                .foregroundColor(.white.opacity(0.8))

            HStack(spacing: 16) {
                ForEach(durations, id: \.self) { duration in
                    DurationButton(
                        minutes: duration,
                        isSelected: selectedDuration == duration
                    ) {
                        withAnimation(.spring(response: 0.3)) {
                            selectedDuration = duration
                        }
                    }
                }
            }
        }
        .padding(.vertical, 20)
    }

    // MARK: - Timer Display

    private var timerDisplay: some View {
        VStack(spacing: 8) {
            // Timer circle
            ZStack {
                // Background circle
                Circle()
                    .stroke(Color.white.opacity(0.2), lineWidth: 20)
                    .frame(width: 200, height: 200)

                // Progress circle
                Circle()
                    .trim(from: 0, to: CGFloat(remainingTime) / CGFloat(selectedDuration * 60))
                    .stroke(
                        LinearGradient(
                            colors: [Color.brandPurple, Color.brandPink],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        style: StrokeStyle(lineWidth: 20, lineCap: .round)
                    )
                    .frame(width: 200, height: 200)
                    .rotationEffect(.degrees(-90))
                    .animation(.linear(duration: 1), value: remainingTime)

                // Time text
                VStack(spacing: 4) {
                    Text(formatTime(remainingTime))
                        .font(.system(size: 40, weight: .bold, design: .rounded))
                        .foregroundColor(.white)

                    if isStudying {
                        Text(NSLocalizedString("study.focusing", comment: "专注中..."))
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.7))
                    }
                }
            }
        }
    }

    // MARK: - Start Button

    private var startButton: some View {
        Button {
            if isStudying {
                stopStudy()
            } else {
                showStartAnimation = true
            }
        } label: {
            Text(isStudying ? NSLocalizedString("study.stop", comment: "停止") : NSLocalizedString("study.start", comment: "开始学习"))
                .font(.headline)
                .fontWeight(.bold)
                .foregroundColor(.white)
                .frame(width: 200, height: 56)
                .background(
                    LinearGradient(
                        colors: isStudying ? [Color.red, Color.orange] : [Color.brandPurple, Color.brandPink],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .clipShape(Capsule())
                .shadow(color: (isStudying ? Color.red : Color.brandPurple).opacity(0.4), radius: 10, x: 0, y: 5)
        }
    }

    // MARK: - Actions

    private func startStudySession() {
        remainingTime = selectedDuration * 60
        isStudying = true

        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            if remainingTime > 0 {
                remainingTime -= 1
            } else {
                completeStudy()
            }
        }
    }

    private func stopStudy() {
        timer?.invalidate()
        timer = nil
        isStudying = false
        remainingTime = 0
    }

    private func completeStudy() {
        timer?.invalidate()
        timer = nil
        isStudying = false

        // Award points
        appState.userPoints += selectedDuration * 2

        // Show summary
        showSummary = true
    }

    private func formatTime(_ seconds: Int) -> String {
        let minutes = seconds / 60
        let secs = seconds % 60
        return String(format: "%02d:%02d", minutes, secs)
    }
}

// MARK: - Stat Card

struct StatCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(color)

            Text(value)
                .font(.headline)
                .fontWeight(.bold)
                .foregroundColor(.white)

            Text(title)
                .font(.caption)
                .foregroundColor(.white.opacity(0.7))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}

// MARK: - Duration Button

struct DurationButton: View {
    let minutes: Int
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Text("\(minutes)")
                    .font(.title2)
                    .fontWeight(.bold)

                Text("min")
                    .font(.caption)
            }
            .foregroundColor(isSelected ? .white : .white.opacity(0.7))
            .frame(width: 70, height: 70)
            .background(
                Circle()
                    .fill(isSelected ? Color.brandPurple : Color.white.opacity(0.1))
            )
            .overlay(
                Circle()
                    .stroke(isSelected ? Color.clear : Color.white.opacity(0.3), lineWidth: 2)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Study Summary View

struct StudySummaryView: View {
    let duration: Int
    let points: Int
    let onDismiss: () -> Void

    var body: some View {
        ZStack {
            Color.black.opacity(0.5)
                .ignoresSafeArea()
                .onTapGesture {
                    onDismiss()
                }

            VStack(spacing: 24) {
                // Celebration icon
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 60))
                    .foregroundColor(.green)

                Text(NSLocalizedString("study.session.complete", comment: "学习完成！"))
                    .font(.title2)
                    .fontWeight(.bold)

                VStack(spacing: 8) {
                    Text("\(duration) \(NSLocalizedString("minutes", comment: "分钟"))")
                        .font(.headline)
                        .foregroundColor(.secondary)

                    HStack(spacing: 4) {
                        Image(systemName: "star.fill")
                            .foregroundColor(.yellow)
                        Text("+\(points)")
                            .font(.title3)
                            .fontWeight(.bold)
                        Text(NSLocalizedString("points.earned", comment: "积分"))
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                }

                Button(NSLocalizedString("action.confirm", comment: "确认")) {
                    onDismiss()
                }
                .buttonStyle(.borderedProminent)
            }
            .padding(30)
            .background(
                RoundedRectangle(cornerRadius: 20)
                    .fill(.ultraThinMaterial)
            )
            .padding(.horizontal, 30)
        }
    }
}

// MARK: - Preview

#Preview("Study List") {
    StudyListView()
        .environmentObject(AppState.shared)
}
