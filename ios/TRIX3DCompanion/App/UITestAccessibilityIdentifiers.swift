import SwiftUI

private struct UITestMarker: View {
    let identifier: String

    var body: some View {
        Color.clear
            .frame(width: 1, height: 1)
            .accessibilityElement()
            .accessibilityLabel(identifier)
            .accessibilityIdentifier(identifier)
    }
}

enum MainNavigationAccessibilityIdentifiers {
    static let mainTabView = "main.tab.view"
    static let homeTab = "nav.tab.home"
    static let mapTab = "nav.tab.map"
    static let studyTab = "nav.tab.study"
    static let chatTab = "nav.tab.chat"
    static let profileTab = "nav.tab.profile"
    static let selectedHomeTab = "nav.selected.home"
    static let selectedMapTab = "nav.selected.map"
    static let selectedStudyTab = "nav.selected.study"
    static let selectedChatTab = "nav.selected.chat"
    static let selectedProfileTab = "nav.selected.profile"

    static func dockTab(for tab: MainTab) -> String {
        switch tab {
        case .home, .core:
            return homeTab
        case .map:
            return mapTab
        case .study:
            return studyTab
        case .chat:
            return chatTab
        case .profile:
            return profileTab
        }
    }

    static func selectedTab(for tab: MainTab) -> String {
        switch tab {
        case .home, .core:
            return selectedHomeTab
        case .map:
            return selectedMapTab
        case .study:
            return selectedStudyTab
        case .chat:
            return selectedChatTab
        case .profile:
            return selectedProfileTab
        }
    }
}

enum HomeAccessibilityIdentifiers {
    static let screen = "home.screen"
    static let botBubble = "home.bot.bubble"
    static let botExpandedCard = "home.bot.expanded"
    static let botInputField = "home.bot.input"
    static let botSendButton = "home.bot.send"
    static let workbenchOverlay = "home.workbench.overlay"
    static let workbenchSnapshotCard = "home.workbench.snapshot.card"
    static let workbenchLocationCard = "home.workbench.location.card"
    static let workbenchScheduleCard = "home.workbench.schedule.card"
    static let workbenchTodoCard = "home.workbench.todo.card"
}

enum StudyAccessibilityIdentifiers {
    static let screen = "study.screen"
}

enum ProfileAccessibilityIdentifiers {
    static let screen = "profile.screen"
    static let darkModeToggle = "profile.darkmode.toggle"
    static let notificationsToggle = "profile.notifications.toggle"
    static let moreSettingsButton = "profile.settings.more.button"
    static let aboutButton = "profile.about.button"
    static let logoutButton = "profile.logout.button"
    static let settingsSheet = "profile.settings.sheet"
    static let aboutSheet = "profile.about.sheet"
    static let settingsSyncButton = "profile.settings.sync.button"
    static let settingsSyncMessage = "profile.settings.sync.message"
    static let settingsDeleteAccountButton = "profile.settings.delete-account.button"
    static let settingsDeleteAccountError = "profile.settings.delete-account.error"
    static let settingsDoneButton = "profile.settings.done.button"
    static let aboutDoneButton = "profile.about.done.button"
}

enum PairingAccessibilityIdentifiers {
    static let screen = "pairing.screen"
    static let cameraButton = "pairing.camera.button"
    static let manualInputButton = "pairing.manual.button"
    static let codeField = "pairing.code.field"
    static let verifyButton = "pairing.verify.button"
    static let startChatButton = "pairing.start-chat.button"
}

enum TrixBotAccessibilityIdentifiers {
    static let screen = "trixbot.screen"
    static let pairedBanner = "trixbot.banner.paired"
    static let unpairedBanner = "trixbot.banner.unpaired"
    static let inputField = "trixbot.input.field"
    static let sendButton = "trixbot.send.button"
    static let closeButton = "trixbot.close.button"
    static let attachmentPreview = "trixbot.attachment.preview"
    static let botMessagePrefix = "trixbot.message.bot"
    static let userMessagePrefix = "trixbot.message.user"
}

extension View {
    @ViewBuilder
    func uiTestIdentifier(_ identifier: String?) -> some View {
        if let identifier, !identifier.isEmpty {
            accessibilityIdentifier(identifier)
                .accessibilityElement(children: .combine)
        } else {
            self
        }
    }

    @ViewBuilder
    func uiTestMarker(_ identifier: String?) -> some View {
        if let identifier, !identifier.isEmpty {
            overlay(alignment: .topLeading) {
                UITestMarker(identifier: identifier)
                    .allowsHitTesting(false)
            }
        } else {
            self
        }
    }
}
