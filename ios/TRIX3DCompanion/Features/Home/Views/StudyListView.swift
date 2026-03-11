//
//  StudyListView.swift
//  TRIX3DCompanion
//
//  Study tab placeholder view showing study rooms and sessions
//

import SwiftUI

// MARK: - Study List View

/// Main study screen showing available study rooms and active sessions
struct StudyListView: View {

    // MARK: - Environment Objects

    @EnvironmentObject private var appState: AppState

    // MARK: - State

    @State private var selectedSegment = 0
    @State private var isCreatingRoom = false
    @State private var selectedRoom: StudyRoom?
    @State private var selectedRoomState: StudyRoomState?

    // Backend data (loaded from API)
    @State private var activeRooms: [StudyRoom] = []
    @State private var upcomingSessions: [DemoStudySession] = []
    @State private var isLoading = false

    // MARK: - Sample Data (fallback when API unavailable)

    private let sampleRooms: [StudyRoom] = [
        StudyRoom(
            id: "1",
            roomCode: "ABC123",
            name: "Math Study",
            hostUserId: "user1",
            maxMembers: 10,
            members: [
                StudyRoomMember(userId: "user1", displayName: "Alice", avatarUrl: nil, joinedAt: Date(), lastActiveAt: Date(), status: .online),
                StudyRoomMember(userId: "user2", displayName: "Bob", avatarUrl: nil, joinedAt: Date(), lastActiveAt: Date(), status: .online)
            ],
            sessionState: .focusing,
            createdAt: Date(),
            updatedAt: Date()
        ),
        StudyRoom(
            id: "2",
            roomCode: "XYZ789",
            name: "Physics Group",
            hostUserId: "user2",
            maxMembers: 8,
            members: [
                StudyRoomMember(userId: "user3", displayName: "Charlie", avatarUrl: nil, joinedAt: Date(), lastActiveAt: Date(), status: .online)
            ],
            sessionState: .idle,
            createdAt: Date(),
            updatedAt: Date()
        )
    ]

    private let sampleSessions = [
        DemoStudySession(
            id: "1",
            title: "Linear Algebra",
            date: "Today, 3:00 PM",
            duration: "1h",
            participants: ["Alex", "Jordan", "Taylor"]
        ),
        DemoStudySession(
            id: "2",
            title: "Organic Chemistry",
            date: "Tomorrow, 10:00 AM",
            duration: "2h",
            participants: ["Sam", "Casey"]
        )
    ]

    // MARK: - Body

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Segmented control
                segmentControl
                    .padding()

                // Content based on selection
                ScrollView {
                    VStack(spacing: 20) {
                        if selectedSegment == 0 {
                            activeRoomsSection
                        } else {
                            upcomingSessionsSection
                        }
                    }
                    .padding()
                }
            }
            .background(backgroundGradient)
            .safeAreaInset(edge: .bottom) {
                Color.clear
                    .frame(height: 100)
            }
            .navigationTitle("Study")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { isCreatingRoom = true }) {
                        Image(systemName: "plus.circle.fill")
                            .foregroundColor(.brandPurple)
                            .font(.title2)
                    }
                }
            }
            .sheet(isPresented: $isCreatingRoom) {
                CreateStudyRoomView()
            }
            .sheet(item: $selectedRoomState) { roomState in
                StudyRoomView(roomState: roomState)
            }
            .task {
                await loadData()
            }
        }
    }

    // MARK: - Data Loading

    private func loadData() async {
        isLoading = true

        // Fetch study rooms from backend
        let result = await StudyService.shared.fetchStudyRooms()
        switch result {
        case .success(let rooms):
            activeRooms = rooms
        case .failure:
            // Fallback to sample data
            activeRooms = sampleRooms
        }

        // Fetch study sessions from backend
        do {
            let sessions: [StudySession] = try await APIClient.shared.get(.studySessions)
            upcomingSessions = sessions.map { session in
                DemoStudySession(
                    id: session.id,
                    title: session.subject ?? "Study Session",
                    date: formatDate(session.startedAt),
                    duration: formatDuration(session.duration),
                    participants: []
                )
            }
        } catch {
            // Fallback to sample data
            upcomingSessions = sampleSessions
        }

        isLoading = false
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d, h:mm a"
        return formatter.string(from: date)
    }

    private func formatDuration(_ duration: Int) -> String {
        let hours = duration / 3600
        let minutes = (duration % 3600) / 60
        if hours > 0 {
            return "\(hours)h"
        } else {
            return "\(minutes)m"
        }
    }

    // MARK: - View Components

    /// Segmented control for filtering
    private var segmentControl: some View {
        Picker("", selection: $selectedSegment) {
            Text("study.active.rooms".localized).tag(0)
            Text("study.my.sessions".localized).tag(1)
        }
        .pickerStyle(.segmented)
        .padding(4)
        .trixSurfaceCard(cornerRadius: 12, borderOpacity: 0.2, shadowOpacity: 0.05, shadowRadius: 6)
    }

    /// Active study rooms section
    private var activeRoomsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Stats header
            statsHeader

            Text("正在进行中的自习房")
                .font(.headline)
                .fontWeight(.semibold)
                .foregroundColor(.primary)

            // Rooms list
            VStack(spacing: 12) {
                ForEach(activeRooms) { room in
                    StudyRoomCard(room: room, onJoin: { joinRoom(room) })
                        .buttonStyle(.plain)
                        .onTapGesture {
                            joinRoom(room)
                        }
                }
            }
        }
    }

    /// Upcoming sessions section
    private var upcomingSessionsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("study.scheduled.sessions".localized)
                .font(.headline)
                .fontWeight(.semibold)

            if upcomingSessions.isEmpty {
                emptySessionsState
            } else {
                VStack(spacing: 12) {
                    ForEach(upcomingSessions) { session in
                        StudySessionCard(session: session)
                    }
                }
            }
        }
    }

    /// Statistics header
    private var statsHeader: some View {
        HStack(spacing: 12) {
            StatBox(
                title: "study.active.rooms".localized,
                value: "\(activeRooms.count)",
                icon: "door.left.hand.open",
                color: .purple
            )

            StatBox(
                title: "study.total.studying".localized,
                value: "\(activeRooms.reduce(0) { $0 + $1.members.count })",
                icon: "person.2.fill",
                color: .blue
            )

            StatBox(
                title: "study.your.time".localized,
                value: appState.formattedStudyTime,
                icon: "clock.fill",
                color: .green
            )
        }
    }

    /// Empty state for sessions
    private var emptySessionsState: some View {
        VStack(spacing: 16) {
            Image(systemName: "calendar.badge.plus")
                .font(.system(size: 50))
                .foregroundColor(.purple.opacity(0.3))

            Text("study.no.upcoming".localized)
                .font(.headline)
                .foregroundColor(.secondary)

            Text("Join a study room or create your own session")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)

            Button(action: { isCreatingRoom = true }) {
                Text("study.create.session".localized)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 10)
                    .background(.purple)
                    .clipShape(Capsule())
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }

    /// Background gradient
    private var backgroundGradient: some View {
        Color.clear.trixPageBackground(
            colors: [
                Color.brandPurple.opacity(0.16),
                Color.brandPink.opacity(0.1),
                Color.cyan.opacity(0.08),
                Color.clear
            ]
        )
    }

    // MARK: - Actions

    private func joinRoom(_ room: StudyRoom) {
        SecureLogger.shared.debug("Join room: \(room.name)")

        // Convert StudyRoom to StudyRoomState for navigation
        let roomState = StudyRoomState(
            roomCode: room.roomCode,
            hostUserId: room.hostUserId,
            sessionState: StudyRoomSessionState(rawValue: room.sessionState.rawValue) ?? .idle,
            members: room.members,
            maxMembers: room.maxMembers,
            version: 1,
            createdAt: room.createdAt,
            updatedAt: room.updatedAt,
            timer: nil
        )
        selectedRoomState = roomState
    }
}

// MARK: - Study Room Card

/// Card displaying study room information
struct StudyRoomCard: View {
    let room: StudyRoom
    let onJoin: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(room.name)
                        .font(.headline)
                        .fontWeight(.semibold)

                    Text("Study Room")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()

                // Status badge
                HStack(spacing: 4) {
                    Circle()
                        .fill(.green)
                        .frame(width: 8, height: 8)

                    Text("study.room.active".localized)
                        .font(.caption2)
                        .fontWeight(.semibold)
                }
                .foregroundColor(.green)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(.green.opacity(0.1))
                .clipShape(Capsule())
            }

            // Info row
            HStack(spacing: 16) {
                Label("\(room.members.count)/\(room.maxMembers)", systemImage: "person.2")
                    .font(.caption)

                Spacer()

                Label("by \(room.hostUserId)", systemImage: "person.circle")
                    .font(.caption)
            }
            .foregroundColor(.secondary)

            // Progress bar
            ProgressView(value: Double(room.members.count), total: Double(room.maxMembers))
                .tint(.purple)

            // Join button
            Button(action: onJoin) {
                HStack {
                    Image(systemName: "arrow.right.circle.fill")
                    Text("study.join.room".localized)
                }
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(
                    LinearGradient(
                        colors: [.purple, .pink],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .clipShape(RoundedRectangle(cornerRadius: 10))
            }
            .buttonStyle(.plain)
        }
        .padding()
        .background(
            LinearGradient(
                colors: [
                    Color.brandPurple.opacity(0.12),
                    Color.brandPink.opacity(0.08),
                    Color.white.opacity(0.08)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .trixSurfaceCard(cornerRadius: 16, borderOpacity: 0.22, shadowOpacity: 0.06, shadowRadius: 10)
    }
}

// MARK: - Study Session Card

/// Card displaying scheduled study session
struct StudySessionCard: View {
    let session: DemoStudySession

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(session.title)
                        .font(.headline)
                        .fontWeight(.semibold)

                    Text(session.date)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()

                Label(session.duration, systemImage: "clock")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Divider()

            HStack(spacing: 8) {
                ForEach(session.participants.prefix(3), id: \.self) { participant in
                    Text(participant)
                        .font(.caption2)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(.purple.opacity(0.1))
                        .clipShape(Capsule())
                }

                if session.participants.count > 3 {
                    Text("+\(session.participants.count - 3)")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }

                Spacer()
            }
        }
        .padding()
        .trixSurfaceCard(cornerRadius: 12, borderOpacity: 0.18, shadowOpacity: 0.04, shadowRadius: 6)
    }
}

// MARK: - Stat Box

/// Small stat box
struct StatBox: View {
    let title: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: icon)
                .foregroundColor(color)
                .font(.title3)

            Text(value)
                .font(.headline)
                .fontWeight(.bold)

            Text(title)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(
            LinearGradient(
                colors: [color.opacity(0.18), Color.white.opacity(0.12)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .trixSurfaceCard(cornerRadius: 12, borderOpacity: 0.18, shadowOpacity: 0.04, shadowRadius: 6)
    }
}

// MARK: - Create Study Room View

/// Modal view for creating a new study room
struct CreateStudyRoomView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppState

    @State private var roomName: String = ""
    @State private var subject: String = ""
    @State private var description: String = ""
    @State private var maxParticipants: Int = 10
    @State private var duration: Int = 60
    @State private var isPrivate: Bool = false
    @State private var isCreating = false
    @State private var showError = false
    @State private var errorMessage = ""

    private let subjects = ["Mathematics", "Physics", "Chemistry", "Biology", "English", "History", "Computer Science", "Other"]
    private let durations = [30, 45, 60, 90, 120, 180]

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    // Header
                    headerSection

                    // Form fields
                    formSection

                    // Settings section
                    settingsSection

                    // Create button
                    createButton
                }
                .padding()
            }
            .navigationTitle("study.create.room".localized)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("action.cancel".localized) {
                        dismiss()
                    }
                }
            }
            .alert("Error", isPresented: $showError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorMessage)
            }
        }
    }

    // MARK: - Header Section

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("study.create.room".localized)
                .font(.title2)
                .fontWeight(.bold)

            Text("study.create.room.description".localized)
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Form Section

    private var formSection: some View {
        VStack(spacing: 16) {
            // Room Name
            FormField(
                label: "study.room.name".localized,
                text: $roomName,
                placeholder: "e.g., Calculus Study Group"
            )

            // Subject Picker
            VStack(alignment: .leading, spacing: 8) {
                Text("study.subject".localized)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(.secondary)

                Picker("Subject", selection: $subject) {
                    ForEach(subjects, id: \.self) { subject in
                        Text(subject).tag(subject)
                    }
                }
                .pickerStyle(.menu)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding()
                .background(Color(.systemGray6))
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color(.systemGray4), lineWidth: 1)
                )
            }

            // Description
            FormField(
                label: "study.description".localized + " (\("action.cancel".localized.lowercased()))",
                text: $description,
                placeholder: "What will you be studying?",
                isMultiline: true
            )
        }
    }

    // MARK: - Settings Section

    private var settingsSection: some View {
        VStack(spacing: 16) {
            // Max Participants
            VStack(alignment: .leading, spacing: 8) {
                Text("study.max.participants".localized + ": \(maxParticipants)")
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(.secondary)

                Slider(value: Binding(
                    get: { Double(maxParticipants) },
                    set: { maxParticipants = Int($0) }
                ), in: 2...50, step: 1)
                .tint(.purple)
            }

            // Duration Picker
            VStack(alignment: .leading, spacing: 8) {
                Text("study.session.duration".localized)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(.secondary)

                Picker("Duration", selection: $duration) {
                    ForEach(durations, id: \.self) { dur in
                        Text("\(dur) min").tag(dur)
                    }
                }
                .pickerStyle(.segmented)
            }

            // Private Room Toggle
            Toggle(isOn: $isPrivate) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("study.private.room".localized)
                        .font(.subheadline)
                        .fontWeight(.medium)

                    Text("study.private.room.description".localized)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .tint(.purple)
            .padding()
            .background(Color(.systemGray6))
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
    }

    // MARK: - Actions

    private var createButton: some View {
        Button(action: createRoom) {
            HStack {
                if isCreating {
                    ProgressView()
                        .tint(.white)
                } else {
                    Image(systemName: "plus.circle.fill")
                    Text("study.create.button".localized)
                }
            }
            .font(.headline)
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding()
            .background(
                LinearGradient(
                    colors: [.purple, .pink],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .disabled(isCreating || !isFormValid)
        .opacity(isFormValid ? 1 : 0.6)
    }

    private var isFormValid: Bool {
        !roomName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !subject.isEmpty
    }

    private func createRoom() {
        guard isFormValid else { return }

        isCreating = true

        Task {
            // Use StudyService to create the room
            let result = await StudyService.shared.createStudyRoom(
                name: roomName,
                maxMembers: maxParticipants
            )

            await MainActor.run {
                isCreating = false

                switch result {
                case .success(let room):
                    // Room created successfully, navigate to it
                    SecureLogger.shared.info("Room created successfully: \(room.name)")
                    dismiss()
                case .failure(let error):
                    errorMessage = error.localizedDescription
                    showError = true
                }
            }
        }
    }
}

// MARK: - Models

/// Demo version of StudySession for UI preview purposes
/// Uses simplified structure different from APIEndpoints.StudySession
struct DemoStudySession: Identifiable {
    let id: String
    let title: String
    let date: String
    let duration: String
    let participants: [String]
}

// MARK: - Preview

#Preview("Study List - Rooms") {
    StudyListView()
        .environmentObject(AppState.shared)
}

#Preview("Study Room Card") {
    VStack(spacing: 12) {
        StudyRoomCard(room: StudyRoom(
            id: "1",
            roomCode: "ABC123",
            name: "Calculus Study",
            hostUserId: "user1",
            maxMembers: 20,
            members: [],
            sessionState: .focusing,
            createdAt: Date(),
            updatedAt: Date()
        ), onJoin: {})

        StudySessionCard(session: DemoStudySession(
            id: "1",
            title: "Linear Algebra",
            date: "Today, 3:00 PM",
            duration: "1h",
            participants: ["Alex", "Jordan", "Taylor"]
        ))
    }
    .padding()
    .background(Color.gray.opacity(0.1))
}
