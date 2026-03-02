//
//  ProfileInfoCard.swift
//  TRIX3DCompanion
//
//  Profile information card component with glassmorphism design
//

import SwiftUI

// MARK: - Profile Info Card

/// Profile information card displaying user avatar, name, and status
struct ProfileInfoCard: View {

    // MARK: - Properties

    let user: User?
    let avatarURL: URL?
    let displayName: String
    let email: String?
    let bio: String?
    let isStudying: Bool
    let onAvatarTap: (() -> Void)?
    let onEditTap: (() -> Void)?

    // MARK: - Initialization

    init(
        user: User?,
        avatarURL: URL?,
        displayName: String,
        email: String?,
        bio: String?,
        isStudying: Bool,
        onAvatarTap: (() -> Void)? = nil,
        onEditTap: (() -> Void)? = nil
    ) {
        self.user = user
        self.avatarURL = avatarURL
        self.displayName = displayName
        self.email = email
        self.bio = bio
        self.isStudying = isStudying
        self.onAvatarTap = onAvatarTap
        self.onEditTap = onEditTap
    }

    // MARK: - Body

    var body: some View {
        VStack(spacing: 20) {
            // Avatar
            avatarSection

            // User info
            userInfoSection

            // Status badge
            statusBadge
        }
        .padding(24)
        .background(cardBackground)
    }

    // MARK: - View Components

    private var avatarSection: some View {
        ZStack(alignment: .bottomTrailing) {
            // Avatar image
            AsyncImage(url: avatarURL) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                case .failure(_):
                    avatarPlaceholder
                case .empty:
                    avatarPlaceholder
                @unknown default:
                    avatarPlaceholder
                }
            }
            .frame(width: 100, height: 100)
            .clipShape(Circle())
            .overlay(
                Circle()
                    .stroke(
                        LinearGradient(
                            colors: [.brandPurple, .brandPink],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 3
                    )
            )
            .shadow(color: .brandPurple.opacity(0.3), radius: 20, x: 0, y: 10)
            .onTapGesture {
                onAvatarTap?()
            }

            // Edit button
            if onEditTap != nil {
                Button(action: { onEditTap?() }) {
                    Image(systemName: "camera.fill")
                        .font(.caption)
                        .foregroundColor(.white)
                        .frame(width: 32, height: 32)
                        .background(
                            Circle()
                                .fill(
                                    LinearGradient(
                                        colors: [.brandPurple, .brandPink],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    )
                                )
                        )
                        .overlay(
                            Circle()
                                .stroke(Color.white, lineWidth: 2)
                        )
                }
                .buttonStyle(.plain)
                .offset(x: 4, y: 4)
            }
        }
    }

    private var avatarPlaceholder: some View {
        ZStack {
            Circle()
                .fill(
                    LinearGradient(
                        colors: [.brandPurple, .brandPink],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )

            Text(String(displayName.prefix(1)).uppercased())
                .font(.system(size: 40, weight: .bold))
                .foregroundColor(.white)
        }
    }

    private var userInfoSection: some View {
        VStack(spacing: 8) {
            // Display name
            Text(displayName)
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(.textPrimary)

            // Email
            if let email = email {
                HStack(spacing: 4) {
                    Image(systemName: "envelope.fill")
                        .font(.caption)
                        .foregroundColor(.textSecondary)

                    Text(email)
                        .font(.subheadline)
                        .foregroundColor(.textSecondary)
                }
            }

            // Bio
            if let bio = bio, !bio.isEmpty {
                Text(bio)
                    .font(.body)
                    .foregroundColor(.textSecondary)
                    .multilineTextAlignment(.center)
                    .lineLimit(3)
                    .padding(.top, 4)
            }
        }
    }

    private var statusBadge: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(isStudying ? .green : .gray)
                .frame(width: 8, height: 8)
                .overlay(
                    Circle()
                        .stroke(Color.white, lineWidth: 1)
                )

            Text(isStudying ? "Currently Studying" : "Idle")
                .font(.caption)
                .fontWeight(.medium)
        }
        .foregroundColor(isStudying ? .green : .textSecondary)
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(
            Capsule()
                .fill((isStudying ? Color.green : Color.gray).opacity(0.1))
        )
        .overlay(
            Capsule()
                .stroke((isStudying ? Color.green : Color.gray).opacity(0.3), lineWidth: 1)
        )
    }

    private var cardBackground: some View {
        RoundedRectangle(cornerRadius: 24)
            .fill(.ultraThinMaterial)
            .shadow(color: .shadow, radius: 20, x: 0, y: 10)
    }
}

// MARK: - Preview

#Preview("Profile Info Card - With Data") {
    VStack {
        ProfileInfoCard(
            user: User(
                id: "1",
                username: "trix_student",
                email: "student@trix3d.com",
                avatarUrl: nil,
                fullName: "Trix Student",
                displayName: "Trix Student",
                bio: "Learning 3D modeling and animation",
                points: 2450,
                isStudying: true,
                companionId: "comp_001",
                totalStudyTime: 1230,
                school: "Trix High School",
                grade: "Grade 10",
                createdAt: Date(),
                updatedAt: Date()
            ),
            avatarURL: nil,
            displayName: "Trix Student",
            email: "student@trix3d.com",
            bio: "Learning 3D modeling and animation",
            isStudying: true,
            onAvatarTap: { SecureLogger.shared.debug("Avatar tapped") },
            onEditTap: { SecureLogger.shared.debug("Edit tapped") }
        )
        .padding()

        ProfileInfoCard(
            user: nil,
            avatarURL: nil,
            displayName: "User",
            email: nil,
            bio: nil,
            isStudying: false
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
