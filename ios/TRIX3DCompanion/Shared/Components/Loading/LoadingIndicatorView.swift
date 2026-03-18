//
//  LoadingIndicatorView.swift
//  TRIX3DCompanion
//
//  Enhanced loading indicators using ActivityIndicatorView library
//

import SwiftUI
import ActivityIndicatorView

// MARK: - Activity Indicator Presets

/// Available loading indicator styles
enum LoadingIndicatorStyle {
    case chat          // For chat messages - smaller, subtle (size: 25)
    case button        // For button loading states
    case standard      // Standard loading - medium size
    case initialLoad   // Initial app load - larger, more prominent (size: 50)
    case uploading     // File upload - with optional progress
    case custom(color: Color, size: CGFloat)
}

/// TrixLoadingIndicator - Enhanced loading indicator using ActivityIndicatorView
struct TrixLoadingIndicator: View {
    let style: LoadingIndicatorStyle
    var message: String? = nil

    @State private var isAnimating = true

    var body: some View {
        VStack(spacing: 12) {
            indicatorView

            if let message = message {
                Text(message)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
        }
    }

    @ViewBuilder
    private var indicatorView: some View {
        switch style {
        case .chat:
            ActivityIndicatorView(
                isVisible: $isAnimating,
                type: .growingCircle
            )
            .tint(.brandPurple)

        case .button:
            ActivityIndicatorView(
                isVisible: $isAnimating,
                type: .growingCircle
            )
            .tint(.white)

        case .standard:
            ActivityIndicatorView(
                isVisible: $isAnimating,
                type: .flickeringDots(count: 4)
            )
            .tint(.brandPurple)
            .frame(width: 30, height: 30)

        case .initialLoad:
            ActivityIndicatorView(
                isVisible: $isAnimating,
                type: .growingCircle
            )
            .tint(.brandPurple)

        case .uploading:
            ActivityIndicatorView(
                isVisible: $isAnimating,
                type: .growingCircle
            )
            .tint(.white)
            .frame(width: 36, height: 36)

        case .custom(let color, let size):
            ActivityIndicatorView(
                isVisible: $isAnimating,
                type: .flickeringDots(count: 3)
            )
            .tint(color)
            .frame(width: size, height: size)
        }
    }
}

// MARK: - Convenience Initializers

extension TrixLoadingIndicator {
    /// Chat loading indicator (MaterialDesign size: 25)
    static func chat(message: String? = nil) -> some View {
        TrixLoadingIndicator(style: .chat, message: message)
    }

    /// Button loading indicator (circleStrokeSpin)
    static func button(message: String? = nil) -> some View {
        TrixLoadingIndicator(style: .button, message: message)
    }

    /// Standard loading indicator
    static func standard(message: String? = nil) -> some View {
        TrixLoadingIndicator(style: .standard, message: message)
    }

    /// Initial load indicator (full screen) (MaterialDesign size: 50)
    static func initialLoad(message: String? = "Loading...") -> some View {
        TrixLoadingIndicator(style: .initialLoad, message: message)
    }

    /// Uploading indicator
    static func uploading(message: String? = "Uploading...") -> some View {
        TrixLoadingIndicator(style: .uploading, message: message)
    }

    /// Custom color and size
    static func custom(color: Color, size: CGFloat, message: String? = nil) -> some View {
        TrixLoadingIndicator(style: .custom(color: color, size: size), message: message)
    }
}

// MARK: - Full Screen Loading Overlay

/// Full screen loading overlay with background
struct FullScreenLoadingView: View {
    var message: String? = "Loading..."
    var showBackground: Bool = true

    var body: some View {
        ZStack {
            if showBackground {
                Color.black.opacity(0.3)
                    .ignoresSafeArea()
            }

            VStack(spacing: 16) {
                TrixLoadingIndicator(style: .initialLoad)

                if let message = message {
                    Text(message)
                        .font(.subheadline)
                        .foregroundColor(.white)
                }
            }
            .padding(32)
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 16))
        }
    }
}

// MARK: - Inline Loading View

/// Inline loading view for lists and content areas
struct InlineLoadingView: View {
    var tintColor: Color = .brandPurple

    var body: some View {
        HStack(spacing: 8) {
            ActivityIndicatorView(
                isVisible: .constant(true),
                type: .flickeringDots(count: 3)
            )
            .tint(tintColor)
            .frame(width: 20, height: 20)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
    }
}

// MARK: - Button Loading View

/// Loading indicator for buttons
struct ButtonLoadingView: View {
    var tintColor: Color = .white

    var body: some View {
        ActivityIndicatorView(
            isVisible: .constant(true),
            type: .growingCircle
        )
        .tint(tintColor)
        .frame(width: 20, height: 20)
    }
}

// MARK: - Chat Loading Bubble

/// Special loading indicator for chat messages
struct ChatLoadingBubble: View {
    @State private var isAnimating = true

    var body: some View {
        HStack {
            Spacer()

            HStack(spacing: 4) {
                ForEach(0..<3) { index in
                    Circle()
                        .fill(Color.gray.opacity(0.6))
                        .frame(width: 8, height: 8)
                        .scaleEffect(isAnimating ? 1.0 : 0.5)
                        .animation(
                            .easeInOut(duration: 0.6)
                            .repeatForever()
                            .delay(Double(index) * 0.2),
                            value: isAnimating
                        )
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(Color(.systemGray6))
            .clipShape(RoundedRectangle(cornerRadius: 18))

            Spacer()
        }
        .onAppear {
            isAnimating = true
        }
    }
}

// MARK: - Image Loading Placeholder

/// Loading placeholder for images
struct ImageLoadingPlaceholder: View {
    var size: CGFloat = 100

    var body: some View {
        ZStack {
            Color(.systemGray6)

            ActivityIndicatorView(
                isVisible: .constant(true),
                type: .growingCircle
            )
            .tint(.brandPurple)
            .frame(width: size * 0.3, height: size * 0.3)
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - Previews

#Preview("Loading Indicators") {
    VStack(spacing: 40) {
        // Chat loading
        VStack(spacing: 8) {
            Text("Chat Loading")
                .font(.headline)
            TrixLoadingIndicator.chat(message: "Loading messages...")
        }

        // Standard loading
        VStack(spacing: 8) {
            Text("Standard Loading")
                .font(.headline)
            TrixLoadingIndicator.standard(message: "Please wait...")
        }

        // Initial load
        VStack(spacing: 8) {
            Text("Initial Load")
                .font(.headline)
            TrixLoadingIndicator.initialLoad(message: "Getting things ready...")
        }

        // Uploading
        VStack(spacing: 8) {
            Text("Uploading")
                .font(.headline)
            TrixLoadingIndicator.uploading(message: "Uploading file...")
        }
    }
    .padding()
}

#Preview("Full Screen Loading") {
    FullScreenLoadingView(message: "Loading your data...")
}

#Preview("Inline Loading") {
    VStack {
        Text("Content above")
        InlineLoadingView()
        Text("Content below")
    }
}

#Preview("Chat Loading Bubble") {
    VStack {
        Text("Chat Messages")
        ChatLoadingBubble()
    }
}

#Preview("Image Placeholder") {
    HStack(spacing: 20) {
        ImageLoadingPlaceholder(size: 80)
        ImageLoadingPlaceholder(size: 120)
        ImageLoadingPlaceholder(size: 60)
    }
}
