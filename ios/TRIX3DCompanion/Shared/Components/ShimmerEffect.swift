//
//  ShimmerEffect.swift
//  TRIX3DCompanion
//
//  Beautiful shimmer loading effect for skeleton views
//

import SwiftUI

// MARK: - Shimmer Effect Modifier

/// A shimmer effect for loading states
struct ShimmerEffect: ViewModifier {
    var gradient: Gradient = Gradient(colors: [
        .gray.opacity(0.3),
        .gray.opacity(0.1),
        .gray.opacity(0.3)
    ])
    var cornerRadius: CGFloat = 8
    var duration: Double = 1.5

    @State private var phase: CGFloat = 0

    func body(content: Content) -> some View {
        content
            .overlay(
                GeometryReader { geometry in
                    let width = geometry.size.width
                    let height = geometry.size.height

                    Rectangle()
                        .fill(
                            LinearGradient(
                                gradient: gradient,
                                startPoint: .init(x: phase - 0.5, y: 0),
                                endPoint: .init(x: phase + 0.5, y: 0)
                            )
                        )
                        .frame(width: width, height: height)
                        .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
                }
            )
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
            .onAppear {
                withAnimation(
                    .linear(duration: duration)
                    .repeatForever(autoreverses: false)
                ) {
                    phase = 1
                }
            }
    }
}

// MARK: - View Extension

extension View {
    /// Apply shimmer effect for loading state
    func shimmer(
        gradient: Gradient = Gradient(colors: [
            .gray.opacity(0.3),
            .gray.opacity(0.1),
            .gray.opacity(0.3)
        ]),
        cornerRadius: CGFloat = 8,
        duration: Double = 1.5
    ) -> some View {
        self.modifier(ShimmerEffect(
            gradient: gradient,
            cornerRadius: cornerRadius,
            duration: duration
        ))
    }
}

// MARK: - Skeleton Views

/// Skeleton view for text lines
struct SkeletonText: View {
    var lines: Int = 3
    var lineSpacing: CGFloat = 8
    var lineHeight: CGFloat = 16

    var body: some View {
        VStack(alignment: .leading, spacing: lineSpacing) {
            ForEach(0..<lines, id: \.self) { index in
                RoundedRectangle(cornerRadius: 8)
                    .fill(.gray.opacity(0.2))
                    .frame(height: lineHeight)
                    .frame(maxWidth: index == lines - 1 ? 150 : .infinity)
                    .shimmer()
            }
        }
    }
}

/// Skeleton view for avatar
struct SkeletonAvatar: View {
    var size: CGFloat = 50

    var body: some View {
        Circle()
            .fill(.gray.opacity(0.2))
            .frame(width: size, height: size)
            .shimmer(cornerRadius: size / 2)
    }
}

/// Skeleton view for card
struct SkeletonCard: View {
    var height: CGFloat = 150
    var showHeader: Bool = true
    var contentLines: Int = 3

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            if showHeader {
                HStack(spacing: 12) {
                    SkeletonAvatar(size: 40)
                    VStack(alignment: .leading, spacing: 6) {
                        RoundedRectangle(cornerRadius: 6)
                            .fill(.gray.opacity(0.2))
                            .frame(width: 120, height: 14)
                            .shimmer(cornerRadius: 6)
                        RoundedRectangle(cornerRadius: 6)
                            .fill(.gray.opacity(0.2))
                            .frame(width: 80, height: 12)
                            .shimmer(cornerRadius: 6)
                    }
                    Spacer()
                }
            }

            SkeletonText(lines: contentLines)
        }
        .padding(16)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(.white.opacity(0.1), lineWidth: 1)
        )
    }
}

/// Skeleton view for list item
struct SkeletonListItem: View {
    var body: some View {
        HStack(spacing: 12) {
            SkeletonAvatar()

            VStack(alignment: .leading, spacing: 6) {
                RoundedRectangle(cornerRadius: 6)
                    .fill(.gray.opacity(0.2))
                    .frame(width: 140, height: 14)
                    .shimmer(cornerRadius: 6)

                RoundedRectangle(cornerRadius: 6)
                    .fill(.gray.opacity(0.2))
                    .frame(width: 200, height: 12)
                    .shimmer(cornerRadius: 6)
            }

            Spacer()

            RoundedRectangle(cornerRadius: 4)
                .fill(.gray.opacity(0.2))
                .frame(width: 40, height: 12)
                .shimmer(cornerRadius: 4)
        }
        .padding(.vertical, 12)
        .padding(.horizontal, 16)
    }
}

// MARK: - Loading State View

/// A complete loading state view with shimmer animations
struct LoadingStateView: View {
    var message: String = "Loading..."
    var showSkeleton: Bool = true

    var body: some View {
        VStack(spacing: 24) {
            if showSkeleton {
                VStack(spacing: 16) {
                    SkeletonCard()
                    SkeletonCard(showHeader: false, contentLines: 2)
                }
            } else {
                ProgressView(value: 0)
                    .tint(.purple)
                    .scaleEffect(1.2)

                Text(message)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
    }
}

// MARK: - Previews

#Preview("Shimmer Effects") {
    ScrollView {
        VStack(spacing: 30) {
            // Skeleton Text
            VStack(alignment: .leading, spacing: 12) {
                Text("Skeleton Text")
                    .font(.headline)

                SkeletonText(lines: 4)
            }
            .padding()
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 16))

            // Skeleton Avatar
            VStack(spacing: 12) {
                Text("Skeleton Avatar")
                    .font(.headline)

                HStack(spacing: 16) {
                    SkeletonAvatar(size: 60)
                    SkeletonAvatar(size: 50)
                    SkeletonAvatar(size: 40)
                    SkeletonAvatar(size: 30)
                }
            }
            .padding()
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 16))

            // Skeleton Card
            VStack(spacing: 12) {
                Text("Skeleton Card")
                    .font(.headline)

                SkeletonCard()
                SkeletonCard(showHeader: false, contentLines: 2)
            }

            // Skeleton List
            VStack(alignment: .leading, spacing: 12) {
                Text("Skeleton List")
                    .font(.headline)

                VStack(spacing: 0) {
                    SkeletonListItem()
                    Divider()
                    SkeletonListItem()
                    Divider()
                    SkeletonListItem()
                }
                .background(.ultraThinMaterial)
                .clipShape(RoundedRectangle(cornerRadius: 16))
            }

            // Loading State View
            VStack(spacing: 12) {
                Text("Loading State View")
                    .font(.headline)

                LoadingStateView(message: "Loading content...")
            }
        }
        .padding()
    }
    .background(Color(.systemGroupedBackground))
}
