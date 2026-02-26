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

    // MARK: - Sample Data

    private let activeRooms = [
        StudyRoom(
            id: "1",
            name: "Calculus Study",
            participants: 12,
            maxParticipants: 20,
            subject: "Mathematics",
            duration: "2h",
            isActive: true,
            host: "Sarah"
        ),
        StudyRoom(
            id: "2",
            name: "Physics Problems",
            participants: 8,
            maxParticipants: 15,
            subject: "Physics",
            duration: "1.5h",
            isActive: true,
            host: "Mike"
        ),
        StudyRoom(
            id: "3",
            name: "Chemistry Lab Prep",
            participants: 5,
            maxParticipants: 10,
            subject: "Chemistry",
            duration: "3h",
            isActive: true,
            host: "Emma"
        )
    ]

    private let upcomingSessions = [
        StudySession(
            id: "1",
            title: "Linear Algebra",
            date: "Today, 3:00 PM",
            duration: "1h",
            participants: ["Alex", "Jordan", "Taylor"]
        ),
        StudySession(
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
                    .padding(.bottom, 100) // Extra padding for tab bar
                }
            }
            .background(backgroundGradient)
            .navigationTitle("Study")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { isCreatingRoom = true }) {
                        Image(systemName: "plus.circle.fill")
                            .foregroundColor(.purple)
                            .font(.title2)
                    }
                }
            }
            .sheet(isPresented: $isCreatingRoom) {
                CreateStudyRoomView()
            }
        }
    }

    // MARK: - View Components

    /// Segmented control for filtering
    private var segmentControl: some View {
        Picker("", selection: $selectedSegment) {
            Text("Active Rooms").tag(0)
            Text("My Sessions").tag(1)
        }
        .pickerStyle(.segmented)
    }

    /// Active study rooms section
    private var activeRoomsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Stats header
            statsHeader

            // Rooms list
            VStack(spacing: 12) {
                ForEach(activeRooms) { room in
                    StudyRoomCard(room: room)
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
            Text("Scheduled Sessions")
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
        HStack(spacing: 16) {
            StatBox(
                title: "Active Rooms",
                value: "\(activeRooms.count)",
                icon: "door.left.hand.open",
                color: .purple
            )

            StatBox(
                title: "Total Studying",
                value: "\(activeRooms.reduce(0) { $0 + $1.participants })",
                icon: "person.2.fill",
                color: .blue
            )

            StatBox(
                title: "Your Time",
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

            Text("No upcoming sessions")
                .font(.headline)
                .foregroundColor(.secondary)

            Text("Join a study room or create your own session")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)

            Button(action: { isCreatingRoom = true }) {
                Text("Create Session")
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
        LinearGradient(
            colors: [
                Color.purple.opacity(0.1),
                Color.pink.opacity(0.05),
                Color.clear
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .ignoresSafeArea()
    }

    // MARK: - Actions

    private func joinRoom(_ room: StudyRoom) {
        SecureLogger.shared.debug("Join room: \(room.name)")
    }
}

// MARK: - Study Room Card

/// Card displaying study room information
struct StudyRoomCard: View {
    let room: StudyRoom

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(room.name)
                        .font(.headline)
                        .fontWeight(.semibold)

                    Text(room.subject)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()

                // Status badge
                HStack(spacing: 4) {
                    Circle()
                        .fill(.green)
                        .frame(width: 8, height: 8)

                    Text("Active")
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
                Label("\(room.participants)/\(room.maxParticipants)", systemImage: "person.2")
                    .font(.caption)

                Label(room.duration, systemImage: "clock")

                Spacer()

                Label("by \(room.host)", systemImage: "person.circle")
                    .font(.caption)
            }
            .foregroundColor(.secondary)

            // Progress bar
            ProgressView(value: Double(room.participants), total: Double(room.maxParticipants))
                .tint(.purple)

            // Join button
            Button(action: {}) {
                HStack {
                    Image(systemName: "arrow.right.circle.fill")
                    Text("Join Room")
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
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.05), radius: 10, x: 0, y: 5)
    }
}

// MARK: - Study Session Card

/// Card displaying scheduled study session
struct StudySessionCard: View {
    let session: StudySession

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
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
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
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
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
            .navigationTitle("New Room")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
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
            Text("Create Study Room")
                .font(.title2)
                .fontWeight(.bold)

            Text("Set up a new study room and invite others to join")
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
                label: "Room Name",
                text: $roomName,
                placeholder: "e.g., Calculus Study Group"
            )

            // Subject Picker
            VStack(alignment: .leading, spacing: 8) {
                Text("Subject")
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
                label: "Description (optional)",
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
                Text("Max Participants: \(maxParticipants)")
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
                Text("Session Duration")
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
                    Text("Private Room")
                        .font(.subheadline)
                        .fontWeight(.medium)

                    Text("Only invited users can join")
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
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                } else {
                    Image(systemName: "plus.circle.fill")
                    Text("Create Room")
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
            do {
                // Call API to create room
                // let response: CreateRoomResponse = try await apiClient.request(
                //     .POST,
                //     endpoint: "/study/rooms",
                //     body: CreateRoomRequest(
                //         name: roomName,
                //         subject: subject,
                //         description: description,
                //         maxParticipants: maxParticipants,
                //         duration: duration,
                //         isPrivate: isPrivate
                //     )
                // )

                // Simulate API call
                try await Task.sleep(nanoseconds: 1_000_000_000)

                await MainActor.run {
                    isCreating = false
                    dismiss()
                }
            } catch {
                await MainActor.run {
                    isCreating = false
                    errorMessage = "Failed to create room. Please try again."
                    showError = true
                }
            }
        }
    }
}

// MARK: - Models

struct StudyRoom: Identifiable {
    let id: String
    let name: String
    let participants: Int
    let maxParticipants: Int
    let subject: String
    let duration: String
    let isActive: Bool
    let host: String
}

struct StudySession: Identifiable {
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
            name: "Calculus Study",
            participants: 12,
            maxParticipants: 20,
            subject: "Mathematics",
            duration: "2h",
            isActive: true,
            host: "Sarah"
        ))

        StudySessionCard(session: StudySession(
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
