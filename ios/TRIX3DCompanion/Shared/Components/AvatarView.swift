//
//  AvatarView.swift
//  TRIX3DCompanion
//
//  Created by TRIX 3D Companion Team
//

import SwiftUI

/// A reusable avatar component supporting remote images, local images, and initials
/// Includes online status indicator and configurable sizes
struct AvatarView: View {
    // MARK: - Size Preset
    enum AvatarSize {
        case small
        case medium
        case large
        case custom(CGFloat)

        var dimension: CGFloat {
            switch self {
            case .small: return 32
            case .medium: return 48
            case .large: return 64
            case .custom(let size): return size
            }
        }

        var borderWidth: CGFloat {
            switch self {
            case .small: return 1.5
            case .medium: return 2
            case .large: return 3
            case .custom(let size): return size > 50 ? 3 : 2
            }
        }

        var statusIndicatorSize: CGFloat {
            switch self {
            case .small: return 8
            case .medium: return 12
            case .large: return 16
            case .custom(let size): return size * 0.25
            }
        }
    }

    // MARK: - Properties
    let size: AvatarSize
    let imageURL: URL?
    let localImageName: String?
    let username: String
    var isOnline: Bool = false
    var showStatusIndicator: Bool = false
    var borderColor: Color = .purple

    init(
        size: AvatarSize = .medium,
        imageURL: URL? = nil,
        localImageName: String? = nil,
        username: String,
        isOnline: Bool = false,
        showStatusIndicator: Bool = false,
        borderColor: Color = .purple
    ) {
        self.size = size
        self.imageURL = imageURL
        self.localImageName = localImageName
        self.username = username
        self.isOnline = isOnline
        self.showStatusIndicator = showStatusIndicator
        self.borderColor = borderColor
    }

    // MARK: - Computed Properties
    private var initials: String {
        let components = username.components(separatedBy: .whitespacesAndNewlines)
        let filtered = components.filter { !$0.isEmpty }
        return filtered.map { String($0.prefix(1)) }.joined().uppercased()
    }

    private var backgroundColor: Color {
        let hash = username.hashValue
        let colors: [Color] = [.purple, .pink, .blue, .cyan, .indigo, .teal]
        return colors[abs(hash) % colors.count]
    }

    // MARK: - Body
    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            // Avatar content
            Group {
                if let imageURL = imageURL {
                    // Remote image (using AsyncImage)
                    AsyncImage(url: imageURL) { phase in
                        switch phase {
                        case .empty:
                            ProgressView()
                                .frame(width: size.dimension, height: size.dimension)
                        case .success(let image):
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                        case .failure:
                            initialsView
                        @unknown default:
                            initialsView
                        }
                    }
                } else if let localImageName = localImageName {
                    // Local image
                    Image(localImageName)
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                } else {
                    // Initials fallback
                    initialsView
                }
            }
            .frame(width: size.dimension, height: size.dimension)
            .clipShape(Circle())
            .overlay(
                Circle()
                    .stroke(borderColor, lineWidth: size.borderWidth)
            )
            .shadow(color: .black.opacity(0.15), radius: 4, x: 0, y: 2)

            // Online status indicator
            if showStatusIndicator {
                Circle()
                    .fill(isOnline ? Color.green : Color.gray.opacity(0.5))
                    .frame(width: size.statusIndicatorSize, height: size.statusIndicatorSize)
                    .overlay(
                        Circle()
                            .stroke(Color(.systemBackground), lineWidth: 2)
                    )
                    .offset(x: -2, y: 2)
            }
        }
    }

    // MARK: - Initials View
    private var initialsView: some View {
        ZStack {
            backgroundColor

            Text(initials)
                .font(.system(
                    size: size.dimension * 0.4,
                    weight: .semibold,
                    design: .rounded
                ))
                .foregroundColor(.white)
        }
    }
}

// MARK: - Convenience Initializers
extension AvatarView {
    /// Creates an avatar from a remote URL
    static func remote(
        url: URL,
        username: String,
        size: AvatarSize = .medium,
        isOnline: Bool = false,
        showStatus: Bool = false
    ) -> AvatarView {
        AvatarView(
            size: size,
            imageURL: url,
            username: username,
            isOnline: isOnline,
            showStatusIndicator: showStatus
        )
    }

    /// Creates an avatar from a local image name
    static func local(
        imageName: String,
        username: String = "",
        size: AvatarSize = .medium,
        isOnline: Bool = false,
        showStatus: Bool = false
    ) -> AvatarView {
        AvatarView(
            size: size,
            localImageName: imageName,
            username: username,
            isOnline: isOnline,
            showStatusIndicator: showStatus
        )
    }

    /// Creates an avatar with initials only
    static func initials(
        username: String,
        size: AvatarSize = .medium,
        isOnline: Bool = false,
        showStatus: Bool = false
    ) -> AvatarView {
        AvatarView(
            size: size,
            username: username,
            isOnline: isOnline,
            showStatusIndicator: showStatus
        )
    }
}

// MARK: - Previews
#Preview("Avatar sizes") {
    VStack(spacing: 24) {
        HStack(spacing: 16) {
            AvatarView.initials(username: "Alice", size: .small)
            AvatarView.initials(username: "Bob Smith", size: .small, isOnline: true, showStatus: true)
            AvatarView.initials(username: "Charlie", size: .small, isOnline: false, showStatus: true)
        }

        HStack(spacing: 16) {
            AvatarView.initials(username: "David Chen", size: .medium)
            AvatarView.initials(username: "Eve", size: .medium, isOnline: true, showStatus: true)
            AvatarView.initials(username: "Frank Miller", size: .medium, isOnline: false, showStatus: true)
        }

        HStack(spacing: 16) {
            AvatarView.initials(username: "Grace", size: .large)
            AvatarView.initials(username: "Henry", size: .large, isOnline: true, showStatus: true)
            AvatarView.initials(username: "Iris", size: .large, isOnline: false, showStatus: true)
        }
    }
    .padding()
    .background(
        LinearGradient(
            colors: [.purple.opacity(0.2), .pink.opacity(0.2)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    )
}

#Preview("With custom colors") {
    HStack(spacing: 16) {
        AvatarView.initials(username: "Purple User", size: .large, borderColor: .purple)
        AvatarView.initials(username: "Pink User", size: .large, borderColor: .pink)
        AvatarView.initials(username: "Blue User", size: .large, borderColor: .blue)
    }
    .padding()
    .background(
        LinearGradient(
            colors: [.purple.opacity(0.2), .pink.opacity(0.2)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    )
}

#Preview("Dark mode") {
    VStack(spacing: 16) {
        AvatarView.initials(username: "Dark Mode", size: .large, isOnline: true, showStatus: true)
        AvatarView.initials(username: "Offline", size: .medium, isOnline: false, showStatus: true)
    }
    .padding()
    .background(Color.black)
    .preferredColorScheme(.dark)
}
