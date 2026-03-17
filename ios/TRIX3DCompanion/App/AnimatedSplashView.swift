//
//  AnimatedSplashView.swift
//  TRIX3DCompanion
//
//  Animated splash screen for better user experience
//

import SwiftUI

/// Animated splash screen shown during app launch
struct AnimatedSplashView: View {
    let onAnimationComplete: () -> Void

    @State private var scale: CGFloat = 0.5
    @State private var opacity: Double = 0

    var body: some View {
        ZStack {
            // Background gradient
            LinearGradient(
                colors: [
                    Color(hex: "09090F"),
                    Color(hex: "15152A"),
                    Color(hex: "1B1630")
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            // Logo and app name
            VStack(spacing: 20) {
                // App icon placeholder
                ZStack {
                    Circle()
                        .fill(Color.brandGradient)
                        .frame(width: 100, height: 100)

                    Image(systemName: "sparkles")
                        .font(.system(size: 40, weight: .bold))
                        .foregroundColor(.white)
                }
                .scaleEffect(scale)

                Text("TRIX 3D")
                    .font(.system(size: 32, weight: .bold, design: .rounded))
                    .foregroundColor(.white)
                    .opacity(opacity)
            }
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.8)) {
                scale = 1.0
                opacity = 1.0
            }

            // Auto-dismiss after animation
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                onAnimationComplete()
            }
        }
    }
}
