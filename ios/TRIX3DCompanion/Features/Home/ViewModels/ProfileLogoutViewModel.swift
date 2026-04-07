//
//  ProfileLogoutViewModel.swift
//  TRIX3DCompanion
//
//  Small state holder for logout confirmation/loading flow.
//

import Foundation

protocol SessionManaging: AnyObject {
    func logout() async
}

extension AppState: SessionManaging {}

@MainActor
final class ProfileLogoutViewModel: ObservableObject {
    @Published var isConfirmationPresented = false
    @Published private(set) var isLoggingOut = false

    func requestLogout() {
        guard !isLoggingOut else { return }
        isConfirmationPresented = true
    }

    func cancelLogout() {
        isConfirmationPresented = false
    }

    func confirmLogout(using sessionManager: SessionManaging) async {
        guard !isLoggingOut else { return }

        isConfirmationPresented = false
        isLoggingOut = true
        defer { isLoggingOut = false }

        await sessionManager.logout()
    }
}
