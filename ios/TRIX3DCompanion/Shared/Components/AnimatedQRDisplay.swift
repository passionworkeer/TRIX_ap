//
//  AnimatedQRDisplay.swift
//  TRIX3DCompanion
//
//  Beautiful animated QR code display with glow effects
//

import SwiftUI
import CoreImage.CIFilterBuiltins

// MARK: - Animated QR Display

/// A beautifully animated QR code display with glow and pulse effects
struct AnimatedQRDisplay: View {
    let content: String
    var size: CGFloat = 200
    var foregroundColor: Color = .black
    var backgroundColor: Color = .white
    var glowColor: Color = .purple
    var showGlow: Bool = true
    var showPulse: Bool = true

    @State private var isAnimating = false
    @State private var glowOpacity: Double = 0.3

    var body: some View {
        ZStack {
            // Glow effect
            if showGlow {
                RoundedRectangle(cornerRadius: 20)
                    .fill(glowColor)
                    .frame(width: size + 40, height: size + 40)
                    .blur(radius: 30)
                    .opacity(glowOpacity)
                    .onAppear {
                        withAnimation(
                            .easeInOut(duration: 2)
                            .repeatForever(autoreverses: true)
                        ) {
                            glowOpacity = 0.6
                        }
                    }
            }

            // QR Code container
            VStack(spacing: 16) {
                // QR Code
                if let qrImage = generateQRCode(from: content) {
                    Image(uiImage: qrImage)
                        .interpolation(.none)
                        .resizable()
                        .frame(width: size, height: size)
                        .background(backgroundColor)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                        .overlay(
                            RoundedRectangle(cornerRadius: 16)
                                .stroke(
                                    LinearGradient(
                                        colors: [.white.opacity(0.5), .clear],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    ),
                                    lineWidth: 2
                                )
                        )
                        .shadow(color: .black.opacity(0.15), radius: 20, y: 10)
                        .scaleEffect(isAnimating && showPulse ? 1.02 : 1.0)
                        .onAppear {
                            withAnimation(
                                .easeInOut(duration: 1.5)
                                .repeatForever(autoreverses: true)
                            ) {
                                isAnimating = true
                            }
                        }
                }

                // Code text display
                Text(content.uppercased())
                    .font(.system(.title3, design: .monospaced))
                    .fontWeight(.bold)
                    .foregroundStyle(
                        LinearGradient(
                            colors: [glowColor, glowColor.opacity(0.7)],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .padding(.horizontal, 20)
                    .padding(.vertical, 10)
                    .background(
                        Capsule()
                            .fill(.ultraThinMaterial)
                    )
                    .overlay(
                        Capsule()
                            .stroke(glowColor.opacity(0.3), lineWidth: 1)
                    )
            }
            .padding(24)
            .background(
                RoundedRectangle(cornerRadius: 24)
                    .fill(.ultraThinMaterial)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 24)
                    .stroke(
                        LinearGradient(
                            colors: [glowColor.opacity(0.3), .clear],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 1.5
                    )
            )
        }
    }

    // MARK: - QR Code Generation

    private func generateQRCode(from string: String) -> UIImage? {
        let context = CIContext()
        let filter = CIFilter.qrCodeGenerator()

        guard let data = string.data(using: .utf8) else { return nil }
        filter.setValue(data, forKey: "inputMessage")
        filter.setValue("H", forKey: "inputCorrectionLevel")

        guard let outputImage = filter.outputImage else { return nil }

        // Scale up the image for better quality
        let transform = CGAffineTransform(scaleX: 10, y: 10)
        let scaledImage = outputImage.transformed(by: transform)

        // Convert to UIImage
        guard let cgImage = context.createCGImage(scaledImage, from: scaledImage.extent) else {
            return nil
        }

        return UIImage(cgImage: cgImage)
    }
}

// MARK: - QR Code Card

/// A complete QR code card with title and description
struct QRCodeCard: View {
    let title: String
    let description: String
    let qrContent: String
    var glowColor: Color = .purple

    var body: some View {
        VStack(spacing: 20) {
            // Header
            VStack(spacing: 8) {
                Image(systemName: "qrcode")
                    .font(.system(size: 32))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [glowColor, glowColor.opacity(0.6)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )

                Text(title)
                    .font(.title3)
                    .fontWeight(.bold)

                Text(description)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }

            // QR Code
            AnimatedQRDisplay(
                content: qrContent,
                size: 180,
                glowColor: glowColor
            )
        }
        .padding(24)
        .glassPanel(cornerRadius: 24)
    }
}

// MARK: - Scan QR Button

/// A button to trigger QR scanning with animation
struct ScanQRButton: View {
    let action: () -> Void

    @State private var isAnimating = false

    var body: some View {
        Button(action: action) {
            ZStack {
                // Animated rings
                ForEach(0..<3) { index in
                    Circle()
                        .stroke(
                            LinearGradient(
                                colors: [.purple.opacity(0.5), .pink.opacity(0.5)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 2
                        )
                        .frame(width: 80 + CGFloat(index * 20), height: 80 + CGFloat(index * 20))
                        .scaleEffect(isAnimating ? 1.1 : 1.0)
                        .opacity(isAnimating ? 0.3 : 0.6)
                        .animation(
                            .easeInOut(duration: 1.5)
                            .repeatForever(autoreverses: true)
                            .delay(Double(index) * 0.2),
                            value: isAnimating
                        )
                }

                // Button content
                VStack(spacing: 8) {
                    Image(systemName: "camera.viewfinder")
                        .font(.system(size: 32))
                        .foregroundStyle(
                            LinearGradient(
                                colors: [.purple, .pink],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )

                    Text("Scan QR Code")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(.primary)
                }
                .frame(width: 100, height: 100)
                .background(.ultraThinMaterial)
                .clipShape(Circle())
            }
        }
        .onAppear {
            isAnimating = true
        }
    }
}

// MARK: - Previews

#Preview("Animated QR Display") {
    ScrollView {
        VStack(spacing: 40) {
            // Basic QR Display
            AnimatedQRDisplay(
                content: "PAIR-CODE-123456",
                glowColor: .purple
            )

            // Different colors
            AnimatedQRDisplay(
                content: "CODE-ABC-XYZ",
                glowColor: .blue,
                showPulse: false
            )

            // QR Code Card
            QRCodeCard(
                title: "Pairing Code",
                description: "Scan this QR code with another device to pair",
                qrContent: "PAIR-TRIX-3D-2024",
                glowColor: .purple
            )

            // Scan Button
            ScanQRButton {
                print("Scan tapped")
            }
        }
        .padding()
    }
    .background(
        LinearGradient(
            colors: [.purple.opacity(0.1), .pink.opacity(0.1)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    )
}
