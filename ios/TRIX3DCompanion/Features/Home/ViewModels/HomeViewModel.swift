//
//  HomeViewModel.swift
//  TRIX3DCompanion
//
//  ViewModel for Home screen
//  Manages navigation state, workbench presentation, and quick actions
//

import Foundation
import SwiftUI
import PhotosUI
import Combine

// MARK: - Home Navigation Route

/// Represents the destination when navigating from home screen
enum HomeNavigationDestination: Equatable {
    case none
    case snapshot
    case location
    case schedule
    case todo
    case mail
    case notifications
    case studyRoom
    case camera
    case photoPicker
    case album
}

// MARK: - Home View Model

/// ViewModel for HomeView
/// Manages all state and actions for the home screen
@Observable
@MainActor
final class HomeViewModel {

    // MARK: - Workbench State

    /// Whether workbench overlay is presented
    var isWorkbenchPresented: Bool = false

    /// Whether robot background is enabled
    var useRobotBackground: Bool = true

    // MARK: - Panel State

    /// Mail panel visibility
    var showMailPanel: Bool = false

    /// Notification panel visibility
    var showNotificationPanel: Bool = false

    /// Study room visibility
    var showStudyRoom: Bool = false

    // MARK: - Snapshot State

    /// Quick snap options sheet visibility
    var showQuickSnapOptions: Bool = false

    /// Camera capture fullscreen visibility
    var showCameraCapture: Bool = false

    /// Photo picker visibility
    var showPhotoPicker: Bool = false

    /// Snapshot album visibility
    var showSnapshot: Bool = false

    /// TRIX Bot chat from snapshot visibility
    var showTrixBotFromSnapshot: Bool = false

    /// Pending snapshot image data
    var pendingSnapshotImage: UIImage?

    /// Pending snapshot uploaded URL
    var pendingSnapshotImageURL: String?

    /// Selected photo item from picker
    var selectedPhotoItem: PhotosPickerItem?

    // MARK: - Workbench Item State

    /// Location picker sheet visibility
    var showLocation: Bool = false

    /// Schedule list sheet visibility
    var showSchedule: Bool = false

    /// Todo list sheet visibility
    var showTodo: Bool = false

    // MARK: - Navigation State

    /// Current navigation destination
    var navigationDestination: HomeNavigationDestination = .none

    // MARK: - Methods

    /// Handle workbench card click
    /// - Parameter itemId: The ID of the clicked workbench item
    func handleWorkbenchCardClick(_ itemId: String) {
        isWorkbenchPresented = false

        switch itemId {
        case WorkbenchItem.snapshot.id:
            showQuickSnapOptions = true
        case WorkbenchItem.location.id:
            showLocation = true
        case WorkbenchItem.schedule.id:
            showSchedule = true
        case WorkbenchItem.todo.id:
            showTodo = true
        default:
            break
        }
    }

    /// Handle photo selection from picker
    /// - Parameter item: The selected photo item
    func handlePhotoSelected(_ item: PhotosPickerItem?) {
        guard let item else { return }

        Task {
            let imageData = try? await item.loadTransferable(type: Data.self)
            let selectedImage = imageData.flatMap { UIImage(data: $0) }

            await MainActor.run {
                pendingSnapshotImage = selectedImage
                pendingSnapshotImageURL = nil
                showTrixBotFromSnapshot = selectedImage != nil
                self.selectedPhotoItem = nil
            }
        }
    }

    /// Present camera for snapshot
    func presentCamera() {
        showQuickSnapOptions = false
        showCameraCapture = true
    }

    /// Present photo picker
    func presentPhotoPicker() {
        showQuickSnapOptions = false
        showPhotoPicker = true
    }

    /// Present snapshot album
    func presentAlbum() {
        showQuickSnapOptions = false
        showSnapshot = true
    }

    /// Handle camera capture completion
    func handleCameraCapture(image: UIImage?, uploadedImageURL: String?) {
        pendingSnapshotImage = image
        pendingSnapshotImageURL = uploadedImageURL
        showCameraCapture = false

        if image != nil {
            showTrixBotFromSnapshot = true
        }
    }

    /// Present pending snapshot chat if needed
    func presentPendingSnapshotChatIfNeeded() {
        guard pendingSnapshotImage != nil else { return }
        showTrixBotFromSnapshot = true
    }

    /// Clear pending snapshot selection
    func clearPendingSnapshotSelection() {
        pendingSnapshotImage = nil
        pendingSnapshotImageURL = nil
        showTrixBotFromSnapshot = false
    }

    /// Handle workbench presented state change
    func handleWorkbenchPresentedChange(_ isPresented: Bool) {
        isWorkbenchPresented = isPresented
    }

    /// Log workbench toggle event
    func logWorkbenchToggle() {
        UITestEventLogger.log("Home isWorkbenchPresented -> \(isWorkbenchPresented)")
    }

    /// Log background tap event
    func logBackgroundTap() {
        UITestEventLogger.log("Home background tapped -> workbench")
    }

    /// Toggle workbench presentation
    func toggleWorkbench() {
        logBackgroundTap()
        withAnimation(.spring(response: 0.35, dampingFraction: 0.82)) {
            isWorkbenchPresented.toggle()
        }
    }
}

// MARK: - Workbench Item

/// Represents a workbench item
struct WorkbenchItem: Identifiable, Equatable {
    let id: String
    let title: String
    let icon: String
    let color: Color

    static let snapshot = WorkbenchItem(
        id: "snapshot",
        title: NSLocalizedString("workbench.snapshot", comment: ""),
        icon: "camera.fill",
        color: .blue
    )

    static let location = WorkbenchItem(
        id: "location",
        title: NSLocalizedString("workbench.location", comment: ""),
        icon: "location.fill",
        color: .green
    )

    static let schedule = WorkbenchItem(
        id: "schedule",
        title: NSLocalizedString("workbench.schedule", comment: ""),
        icon: "calendar",
        color: .orange
    )

    static let todo = WorkbenchItem(
        id: "todo",
        title: NSLocalizedString("workbench.todo", comment: ""),
        icon: "checklist",
        color: .purple
    )

    static let allItems: [WorkbenchItem] = [.snapshot, .location, .schedule, .todo]
}
