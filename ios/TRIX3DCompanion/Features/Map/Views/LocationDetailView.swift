//
//  LocationDetailView.swift
//  TRIX3DCompanion
//
//  Location detail sheet showing location info and actions
//

import SwiftUI
import MapKit

// MARK: - Localization Helper
private func L(_ key: String) -> String {
    key.localized
}

private func L(_ key: String, _ value: String) -> String {
    key.localized(value)
}

// MARK: - Location Detail View

/// Location detail sheet with actions
struct LocationDetailView: View {

    // MARK: - Environment

    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppState

    // MARK: - Properties

    let location: Location
    let onNavigate: () -> Void
    let onShare: () -> Void

    // MARK: - State

    @State private var showShareConfirmation = false
    @State private var showCheckInConfirmation = false
    @StateObject private var checkInViewModel = LocationCheckInViewModel()

    // MARK: - Body

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Header with icon
                headerSection

                // Location info
                locationInfoSection

                // Action buttons
                actionButtonsSection

                // Map preview
                mapPreviewSection
            }
            .padding()
        }
        .background(backgroundGradient)
        .safeAreaInset(edge: .top) {
            HStack {
                Spacer()
                Button {
                    dismiss()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.title2)
                        .foregroundColor(.secondary)
                }
                .padding(.trailing, 16)
                .padding(.top, 8)
            }
        }
        .alert(L("location.share"), isPresented: $showShareConfirmation) {
            Button(L("action.share")) {
                onShare()
                dismiss()
            }
            Button(L("action.cancel"), role: .cancel) {}
        } message: {
            Text(L("location.share.question"))
        }
        .alert(L("location.check.in"), isPresented: $showCheckInConfirmation) {
            Button(L("location.check.in")) {
                performCheckIn()
            }
            Button(L("action.cancel"), role: .cancel) {}
        } message: {
            Text(L("location.check.in.question", location.name))
        }
        .alert(L("location.check.in.failed.title"), isPresented: Binding(
            get: { checkInViewModel.errorMessage != nil },
            set: { if !$0 { checkInViewModel.clearError() } }
        )) {
            Button(L("action.retry")) {
                performCheckIn()
            }
            Button(L("action.cancel"), role: .cancel) {
                checkInViewModel.clearError()
            }
        } message: {
            Text(checkInViewModel.errorMessage ?? L("location.check.in.failed.message"))
        }
    }

    // MARK: - View Components

    /// Header section with icon
    private var headerSection: some View {
        VStack(spacing: 16) {
            // Category icon
            ZStack {
                Circle()
                    .fill(Color.brandGradient)
                    .frame(width: 80, height: 80)

                Image(systemName: location.category?.iconName ?? "mappin.circle.fill")
                    .font(.system(size: 36, weight: .semibold))
                    .foregroundColor(.white)
            }

            // Location name
            Text(location.name)
                .font(.title2)
                .fontWeight(.bold)
                .multilineTextAlignment(.center)

            // Category badge
            if let category = location.category {
                HStack(spacing: 6) {
                    Image(systemName: category.iconName)
                        .font(.caption)

                    Text(category.displayName)
                        .font(.subheadline)
                        .fontWeight(.medium)
                }
                .foregroundColor(.brandPurple)
                .padding(.horizontal, 14)
                .padding(.vertical, 6)
                .background(Color.brandPurple.opacity(0.15))
                .clipShape(Capsule())
            }
        }
        .padding(.top, 8)
    }

    /// Location info section
    private var locationInfoSection: some View {
        VStack(spacing: 16) {
            // Address
            if let address = location.address {
                LocationInfoRow(
                    icon: "location.fill",
                    label: L("location.info.address"),
                    value: address
                )
            }

            // Description
            if let description = location.description {
                LocationInfoRow(
                    icon: "text.alignleft",
                    label: L("location.info.description"),
                    value: description
                )
            }

            // Coordinates
            LocationInfoRow(
                icon: "globe",
                label: L("location.info.coordinates"),
                value: String(format: "%.4f, %.4f", location.latitude, location.longitude)
            )

            // Created date
            LocationInfoRow(
                icon: "calendar",
                label: L("location.info.added"),
                value: location.createdAt.formatted(date: .abbreviated, time: .shortened)
            )
        }
        .padding()
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    /// Action buttons section
    private var actionButtonsSection: some View {
        VStack(spacing: 12) {
            // Navigate button
            Button(action: onNavigate) {
                Label(L("location.navigate.maps"), systemImage: "map.fill")
                    .font(.headline)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(Color.blue)
                    .clipShape(RoundedRectangle(cornerRadius: 16))
            }

            // Share with companion button
            Button(action: { showShareConfirmation = true }) {
                Label(L("location.share.companion"), systemImage: "heart.fill")
                    .font(.headline)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(Color.brandGradient)
                    .clipShape(RoundedRectangle(cornerRadius: 16))
            }
            .disabled(appState.currentUser?.companionId == nil)

            // Check in button
            Button(action: { showCheckInConfirmation = true }) {
                HStack {
                    if checkInViewModel.isCheckingIn {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .brandPurple))
                    } else {
                        Image(systemName: "checkmark.circle.fill")
                    }

                    Text(L("location.check.in.here"))
                        .fontWeight(.semibold)
                }
                .font(.subheadline)
                .foregroundColor(.brandPurple)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Color.brandPurple.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .disabled(checkInViewModel.isCheckingIn)
        }
    }

    /// Map preview section
    private var mapPreviewSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(L("location.preview"))
                .font(.headline)
                .fontWeight(.semibold)

            // Static map preview
            MapPreview(coordinate: location.coordinate)
                .frame(height: 150)
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color.separator.opacity(0.5), lineWidth: 1)
                )
        }
    }

    /// Background gradient
    private var backgroundGradient: some View {
        LinearGradient(
            colors: [
                Color.brandPurple.opacity(0.1),
                Color.brandPink.opacity(0.05),
                Color.clear
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .ignoresSafeArea()
    }

    // MARK: - Actions

    /// Perform check-in
    private func performCheckIn() {
        Task {
            let succeeded = await checkInViewModel.checkIn(placeId: location.id)
            if succeeded {
                dismiss()
            }
        }
    }
}

// MARK: - Info Row

/// Info row component
struct LocationInfoRow: View {
    let icon: String
    let label: String
    let value: String

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(.brandPurple)
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 4) {
                Text(label)
                    .font(.caption)
                    .foregroundColor(.textSecondary)

                Text(value)
                    .font(.body)
                    .foregroundColor(.textPrimary)
            }
        }
    }
}

// MARK: - Map Preview

/// Static map preview using MapKit snapshot
struct MapPreview: View {
    let coordinate: CLLocationCoordinate2D

    var body: some View {
        Map {
            Annotation("", coordinate: coordinate) {
                Image(systemName: "mappin.circle.fill")
                    .font(.title)
                    .foregroundColor(.brandPurple)
            }
        }
        .mapStyle(.standard)
        .disabled(true)
    }
}

/// Preview annotation helper
struct PreviewAnnotation: Identifiable {
    let id = UUID()
    let coordinate: CLLocationCoordinate2D
}

// MARK: - Preview

#Preview("Location Detail") {
    LocationDetailView(
        location: Location(
            id: "1",
            userId: "user1",
            name: "Central Library",
            description: "Main city library with study rooms and free WiFi",
            latitude: 39.9042,
            longitude: 116.4074,
            address: "123 Library Street, Beijing",
            category: .library,
            createdAt: Date(),
            updatedAt: Date()
        ),
        onNavigate: {},
        onShare: {}
    )
    .environmentObject(AppState.shared)
}

#Preview("Cafe Location") {
    LocationDetailView(
        location: Location(
            id: "2",
            userId: "user1",
            name: "Coffee Corner",
            description: "Cozy cafe perfect for studying",
            latitude: 39.9100,
            longitude: 116.4100,
            address: "456 Coffee Lane",
            category: .cafe,
            createdAt: Date(),
            updatedAt: Date()
        ),
        onNavigate: {},
        onShare: {}
    )
    .environmentObject(AppState.shared)
}

#Preview("Dark Mode") {
    LocationDetailView(
        location: Location(
            id: "1",
            userId: "user1",
            name: "Central Library",
            description: "Main city library",
            latitude: 39.9042,
            longitude: 116.4074,
            address: "123 Library Street",
            category: .library,
            createdAt: Date(),
            updatedAt: Date()
        ),
        onNavigate: {},
        onShare: {}
    )
    .environmentObject(AppState.shared)
    .preferredColorScheme(.dark)
}
