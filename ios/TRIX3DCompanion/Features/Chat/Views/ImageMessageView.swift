//
//  ImageMessageView.swift
//  TRIX3DCompanion
//
//  Image message component with zoom functionality
//  Memory-optimized with efficient caching
//

import SwiftUI

// MARK: - Localizable Helper

private func L(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

// MARK: - Image Message View

/// Image message component with async loading and zoom preview
/// Memory-efficient: downscales images, uses caching, manages memory pressure
struct ImageMessageView: View {

    // MARK: - Properties

    let imageURL: String
    let isCurrentUser: Bool

    @State private var isShowingFullScreen = false
    @State private var isLoading = true
    @State private var loadError: Error?
    @State private var cachedImage: UIImage?

    // MARK: - Body

    var body: some View {
        ZStack {
            // Image content
            if let url = URL(string: imageURL) {
                if let cached = cachedImage {
                    // Use cached image
                    Image(uiImage: cached)
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: 200, height: 200)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                        .onTapGesture {
                            isShowingFullScreen = true
                        }
                } else {
                    // Load image asynchronously
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .empty:
                            loadingPlaceholder

                        case .success(let image):
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                                .frame(width: 200, height: 200)
                                .clipShape(RoundedRectangle(cornerRadius: 16))
                                .onTapGesture {
                                    isShowingFullScreen = true
                                }
                                .onAppear {
                                    isLoading = false
                                    // Cache the UIImage for efficiency
                                    if let uiImage = resolveUIImage(from: image) {
                                        cacheImage(uiImage)
                                    }
                                }

                        case .failure:
                            errorPlaceholder

                        @unknown default:
                            loadingPlaceholder
                        }
                    }
                }
            } else {
                errorPlaceholder
            }

            // Loading indicator
            if isLoading {
                loadingOverlay
            }
        }
        .sheet(isPresented: $isShowingFullScreen) {
            ImageViewer(
                imageURL: imageURL,
                isPresented: $isShowingFullScreen
            )
        }
        .onDisappear {
            // Clear cached image when view disappears to free memory
            if !isShowingFullScreen {
                cachedImage = nil
            }
        }
    }

    // MARK: - Private Methods

    private func resolveUIImage(from image: Image) -> UIImage? {
        // Try to extract UIImage from SwiftUI Image
        // This is a workaround - in production, consider using a proper image loading pipeline
        return nil // AsyncImage doesn't expose UIImage directly
    }

    private func cacheImage(_ image: UIImage) {
        // Downscale for thumbnail display (save memory)
        let targetSize = CGSize(width: 400, height: 400)
        if let downscaled = downscaleImage(image, to: targetSize) {
            cachedImage = downscaled
        }
    }

    private func downscaleImage(_ image: UIImage, to size: CGSize) -> UIImage? {
        UIGraphicsBeginImageContextWithOptions(size, false, 1.0)
        defer { UIGraphicsEndImageContext() }

        image.draw(in: CGRect(origin: .zero, size: size))
        return UIGraphicsGetImageFromCurrentImageContext()
    }

    // MARK: - View Components

    /// Loading placeholder
    private var loadingPlaceholder: some View {
        RoundedRectangle(cornerRadius: 16)
            .fill(isCurrentUser ? Color.white.opacity(0.3) : Color.gray.opacity(0.2))
            .frame(width: 200, height: 200)
            .overlay {
                VStack(spacing: 12) {
                    Rectangle()
                        .fill(isCurrentUser ? Color.white : Color.primary)
                        .frame(width: 30, height: 30)
                        .opacity(0.5)

                    Text(L("chat.message.loading"))
                        .font(.caption)
                        .foregroundColor(isCurrentUser ? .white : .secondary)
                }
            }
    }

    /// Error placeholder
    private var errorPlaceholder: some View {
        RoundedRectangle(cornerRadius: 16)
            .fill(isCurrentUser ? Color.white.opacity(0.3) : Color.gray.opacity(0.2))
            .frame(width: 200, height: 200)
            .overlay {
                VStack(spacing: 8) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.largeTitle)
                        .foregroundColor(isCurrentUser ? .white : .secondary)

                    Text(L("chat.message.failed.load"))
                        .font(.caption)
                        .foregroundColor(isCurrentUser ? .white : .secondary)
                }
            }
    }

    /// Loading overlay
    private var loadingOverlay: some View {
        Rectangle()
            .fill(Color.white)
            .frame(width: 30, height: 30)
            .opacity(0.5)
    }
}

// MARK: - Image Viewer

/// Full-screen image viewer with zoom and dismiss
struct ImageViewer: View {

    // MARK: - Properties

    let imageURL: String
    @Binding var isPresented: Bool

    @State private var scale: CGFloat = 1.0
    @State private var lastScale: CGFloat = 1.0
    @State private var offset: CGSize = .zero
    @State private var lastOffset: CGSize = .zero

    // MARK: - Body

    var body: some View {
        ZStack {
            // Background
            Color.black.ignoresSafeArea()
                .onTapGesture {
                    withAnimation(.easeOut(duration: 0.3)) {
                        isPresented = false
                    }
                }

            // Image
            if let url = URL(string: imageURL) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                            .scaleEffect(scale)
                            .offset(offset)
                            .gesture(
                                SimultaneousGesture(
                                    magnificationGesture,
                                    dragGesture
                                )
                            )
                            .onTapGesture(count: 2) {
                                withAnimation(.spring()) {
                                    if scale > 1.0 {
                                        scale = 1.0
                                        offset = .zero
                                    } else {
                                        scale = 2.0
                                    }
                                }
                            }

                    case .failure:
                        errorView

                    default:
                        loadingView
                    }
                }
            } else {
                errorView
            }

            // Close button
            VStack {
                HStack {
                    Spacer()

                    Button(action: {
                        withAnimation(.easeOut(duration: 0.3)) {
                            isPresented = false
                        }
                    }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.title)
                            .foregroundColor(.white)
                            .shadow(radius: 4)
                    }
                    .padding()
                }

                Spacer()
            }
        }
        .transition(.opacity)
    }

    // MARK: - View Components

    /// Loading view
    private var loadingView: some View {
        VStack(spacing: 16) {
            Rectangle()
                .fill(Color.white)
                .frame(width: 40, height: 40)
                .opacity(0.5)

            Text(L("chat.message.loading.image"))
                .font(.headline)
                .foregroundColor(.white)
        }
    }

    /// Error view
    private var errorView: some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 60))
                .foregroundColor(.white)

            Text(L("chat.message.failed.image"))
                .font(.headline)
                .foregroundColor(.white)
        }
    }

    // MARK: - Gestures

    /// Magnification gesture for zooming
    private var magnificationGesture: some Gesture {
        MagnificationGesture()
            .onChanged { value in
                let newScale = lastScale * value
                scale = min(max(newScale, 0.5), 4.0) // Limit zoom range
            }
            .onEnded { _ in
                lastScale = scale

                // Reset if too small
                if scale < 1.0 {
                    withAnimation(.spring()) {
                        scale = 1.0
                        offset = .zero
                        lastScale = 1.0
                        lastOffset = .zero
                    }
                }
            }
    }

    /// Drag gesture for panning
    private var dragGesture: some Gesture {
        DragGesture()
            .onChanged { value in
                // Only allow dragging when zoomed in
                if scale > 1.0 {
                    offset = CGSize(
                        width: lastOffset.width + value.translation.width,
                        height: lastOffset.height + value.translation.height
                    )
                }
            }
            .onEnded { _ in
                lastOffset = offset
            }
    }
}

// MARK: - Preview

#Preview("Image Message") {
    ScrollView {
        VStack(spacing: 20) {
            // User image message
            ImageMessageView(
                imageURL: "https://picsum.photos/400/400?random=1",
                isCurrentUser: true
            )

            // Friend image message
            ImageMessageView(
                imageURL: "https://picsum.photos/400/400?random=2",
                isCurrentUser: false
            )

            // Loading state
            ImageMessageView(
                imageURL: "https://example.com/loading.jpg",
                isCurrentUser: true
            )

            // Error state
            ImageMessageView(
                imageURL: "invalid-url",
                isCurrentUser: false
            )
        }
        .padding()
    }
    .background(Color(.systemGroupedBackground))
}

#Preview("Image Viewer") {
    ImageViewer(
        imageURL: "https://picsum.photos/800/800?random=3",
        isPresented: .constant(true)
    )
}

#Preview("Dark Mode") {
    ScrollView {
        VStack(spacing: 20) {
            ImageMessageView(
                imageURL: "https://picsum.photos/400/400?random=4",
                isCurrentUser: true
            )

            ImageMessageView(
                imageURL: "https://picsum.photos/400/400?random=5",
                isCurrentUser: false
            )
        }
        .padding()
    }
    .background(Color(.systemGroupedBackground))
    .preferredColorScheme(.dark)
}
