//
//  TTSControlView.swift
//  TRIX3DCompanion
//
//  Text-to-speech control panel UI with language and speed settings
//

import SwiftUI

// MARK: - Localization Helper
private func L(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

// MARK: - TTS Control View

/// A view displaying TTS controls with language selection and speed adjustment
struct TTSControlView: View {

    // MARK: - State Objects

    @StateObject private var viewModel: TTSViewModel
    @Environment(\.colorScheme) var colorScheme
    @FocusState private var isInputFocused: Bool

    // MARK: - Initialization

    /// Initialize TTS control view
    /// - Parameter viewModel: Optional TTS view model dependency
    init(viewModel: TTSViewModel? = nil) {
        self._viewModel = StateObject(wrappedValue: viewModel ?? TTSViewModel())
    }

    // MARK: - Body

    var body: some View {
        VStack(spacing: 20) {
            // Header with toggle
            header

            // Text input area
            textInputArea

            // Quick actions
            quickActions

            // Settings panel
            if viewModel.showSettings {
                settingsPanel
            }
        }
        .padding(16)
        .glassPanel(cornerRadius: 20)
    }

    // MARK: - Header

    private var header: some View {
        HStack {
            // TTS icon and title
            HStack(spacing: 12) {
                ZStack {
                    Circle()
                        .fill(
                            LinearGradient(
                                colors: [Color.purple.opacity(0.2), Color.pink.opacity(0.2)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 44, height: 44)

                    Image(systemName: "speaker.wave.3.fill")
                        .font(.title3)
                        .foregroundStyle(
                            LinearGradient(
                                colors: [.purple, .pink],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(L("tts.title"))
                        .font(.headline)
                        .foregroundColor(.primary)

                    Text(viewModel.isSpeaking ? L("tts.speaking") : L("tts.tap.to.speak"))
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()
            }

            // Toggle switch
            Toggle("", isOn: $viewModel.isEnabled)
                .labelsHidden()
                .accessibilityLabel("Enable text-to-speech")
        }
    }

    // MARK: - Text Input Area

    private var textInputArea: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Label
            HStack {
                Text(L("tts.input.label"))
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                Spacer()

                if !viewModel.textToSpeak.isEmpty {
                    Text("\(viewModel.textToSpeak.count) \(L("tts.characters"))")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            // Text field
            ZStack(alignment: .topLeading) {
                if viewModel.textToSpeak.isEmpty {
                    Text(L("tts.input.placeholder"))
                        .font(.body)
                        .foregroundColor(Color.secondary.opacity(0.5))
                        .padding(.vertical, 12)
                        .padding(.horizontal, 16)
                }

                TextEditor(text: $viewModel.textToSpeak)
                    .font(.body)
                    .focused($isInputFocused)
                    .frame(minHeight: 100)
                    .scrollContentBackground(.hidden)
                    .background(Color.clear)
                    .padding(.vertical, 8)
                    .padding(.horizontal, 12)
            }
            .background(Color(.systemGray6))
            .clipShape(RoundedRectangle(cornerRadius: 12))

            // Action buttons
            HStack(spacing: 12) {
                // Speak button
                Button(action: {
                    Task {
                        await viewModel.speakCurrentText()
                    }
                    isInputFocused = false
                }) {
                    HStack(spacing: 8) {
                        Image(systemName: viewModel.isSpeakingText ? "speaker.wave.3.fill" : "play.fill")
                        Text(viewModel.isSpeakingText ? L("tts.speaking.in.progress") : L("tts.start.speaking"))
                    }
                    .font(.system(.body, design: .rounded).weight(.semibold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(
                        viewModel.isSpeakingText
                            ? LinearGradient(
                                colors: [Color.purple.opacity(0.6), Color.pink.opacity(0.6)],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                            : LinearGradient(
                                colors: [Color.purple, Color.pink],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .buttonStyle(.plain)
                .disabled(viewModel.textToSpeak.isEmpty || !viewModel.isEnabled)

                // Stop button
                if viewModel.isSpeakingText {
                    Button(action: {
                        Task {
                            await viewModel.stop()
                        }
                    }) {
                        Image(systemName: "stop.fill")
                            .font(.title3)
                            .foregroundColor(.white)
                            .frame(width: 48, height: 48)
                            .background(
                                LinearGradient(
                                    colors: [.red.opacity(0.8), .orange.opacity(0.8)],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: - Quick Actions

    private var quickActions: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Section header
            HStack {
                Text(L("tts.quick.actions"))
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                Spacer()

                Button(action: {
                    viewModel.toggleSettings()
                }) {
                    HStack(spacing: 4) {
                        Text(L("tts.settings"))
                        Image(systemName: "chevron.right")
                            .font(.caption)
                    }
                    .font(.caption)
                    .foregroundColor(.purple)
                }
                .buttonStyle(.plain)
            }

            // Quick action buttons
            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 12) {
                TTSQuickActionButton(
                    icon: "timer",
                    title: L("tts.pomodoro.start"),
                    color: .blue
                ) {
                    Task {
                        await viewModel.speakPomodoroStart()
                    }
                }

                TTSQuickActionButton(
                    icon: "checkmark.circle.fill",
                    title: L("tts.pomodoro.complete"),
                    color: .green
                ) {
                    Task {
                        await viewModel.speakPomodoroComplete()
                    }
                }

                TTSQuickActionButton(
                    icon: "bell.fill",
                    title: L("tts.rest.complete"),
                    color: .orange
                ) {
                    Task {
                        await viewModel.speakRestComplete()
                    }
                }

                TTSQuickActionButton(
                    icon: "exclamationmark.bubble.fill",
                    title: L("tts.goal.reminder"),
                    color: .purple
                ) {
                    Task {
                        await viewModel.speakDailyGoalReminder()
                    }
                }
            }
        }
    }

    // MARK: - Settings Panel

    private var settingsPanel: some View {
        VStack(spacing: 16) {
            // Section header
            HStack {
                Text(L("tts.settings.title"))
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                Spacer()

                Button(L("tts.close")) {
                    viewModel.toggleSettings()
                }
                .font(.caption)
                .foregroundColor(.purple)
                .buttonStyle(.plain)
            }

            // Language selector
            VStack(alignment: .leading, spacing: 8) {
                Text(L("tts.language"))
                    .font(.caption)
                    .foregroundColor(.secondary)

                Menu {
                    ForEach(viewModel.availableLanguages, id: \.self) { language in
                        Button(language.displayName) {
                            Task {
                                await viewModel.setLanguage(language)
                            }
                        }
                        .fontWeight(viewModel.selectedLanguage == language ? .bold : .regular)
                    }
                } label: {
                    HStack {
                        Text(viewModel.selectedLanguage.displayName)
                            .foregroundColor(.primary)

                        Spacer()

                        Image(systemName: "chevron.down")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .background(.ultraThinMaterial)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }
            }

            // Speech rate slider
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(L("tts.speed"))
                        .font(.caption)
                        .foregroundColor(.secondary)

                    Spacer()

                    Text("\(String(format: "%.1f", viewModel.speechRate))x")
                        .font(.caption)
                        .foregroundColor(.purple)
                        .fontWeight(.semibold)
                }

                Slider(
                    value: $viewModel.speechRate,
                    in: 0.0...1.0,
                    step: 0.1
                )
                .tint(.purple)
                .accessibilityLabel("Speech rate")
            }

            // Speech pitch slider
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(L("tts.pitch"))
                        .font(.caption)
                        .foregroundColor(.secondary)

                    Spacer()

                    Text("\(String(format: "%.1f", viewModel.speechPitch))x")
                        .font(.caption)
                        .foregroundColor(.purple)
                        .fontWeight(.semibold)
                }

                Slider(
                    value: $viewModel.speechPitch,
                    in: 0.5...2.0,
                    step: 0.1
                )
                .tint(.pink)
                .accessibilityLabel("Voice pitch")
            }

            // Reset button
            Button(action: {
                Task {
                    await viewModel.resetToDefaults()
                }
            }) {
                Text(L("tts.reset.defaults"))
                    .font(.caption)
                    .foregroundColor(.purple)
                    .padding(.vertical, 8)
                    .frame(maxWidth: .infinity)
                    .background(.purple.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }
            .buttonStyle(.plain)
        }
        .padding(.vertical, 8)
    }
}

// MARK: - Quick Action Button

/// A button for quick TTS actions
struct TTSQuickActionButton: View {
    let icon: String
    let title: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                ZStack {
                    Circle()
                        .fill(color.opacity(0.15))
                        .frame(width: 44, height: 44)

                    Image(systemName: icon)
                        .font(.title3)
                        .foregroundColor(color)
                }

                Text(title)
                    .font(.caption)
                    .foregroundColor(.primary)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Compact TTS Control

/// A compact version of TTS controls for inline use
struct CompactTTSControlView: View {

    // MARK: - State Objects

    @StateObject private var viewModel: TTSViewModel

    // MARK: - Initialization

    init(viewModel: TTSViewModel? = nil) {
        self._viewModel = StateObject(wrappedValue: viewModel ?? TTSViewModel())
    }

    // MARK: - Body

    var body: some View {
        HStack(spacing: 12) {
            // Toggle
            Toggle("", isOn: $viewModel.isEnabled)
                .labelsHidden()

            VStack(alignment: .leading, spacing: 2) {
                Text(L("tts.title"))
                    .font(.subheadline)
                    .fontWeight(.medium)

                Text(viewModel.selectedLanguage.displayName)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }

            Spacer()

            // Speed indicator
            if viewModel.isEnabled {
                Menu {
                    ForEach(viewModel.availableRateOptions, id: \.id) { option in
                        Button(option.displayName) {
                            Task {
                                await viewModel.setRate(option.value)
                            }
                        }
                    }
                } label: {
                    Text("\(String(format: "%.1f", viewModel.speechRate))x")
                        .font(.system(.caption, design: .rounded).bold())
                        .foregroundColor(.purple)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(.purple.opacity(0.1))
                        .clipShape(Capsule())
                }
            }
        }
        .padding(12)
        .glassPanel(cornerRadius: 12, padding: 8)
    }
}

// MARK: - Mini TTS Button

/// A minimal TTS toggle button
struct MiniTTSButton: View {
    @StateObject private var viewModel = TTSViewModel()

    var body: some View {
        Button(action: {
            viewModel.isEnabled.toggle()
        }) {
            ZStack {
                Circle()
                    .fill(.ultraThinMaterial)
                    .frame(width: 44, height: 44)

                Image(systemName: viewModel.isEnabled ? "speaker.wave.3.fill" : "speaker.slash.fill")
                    .font(.title3)
                    .foregroundColor(viewModel.isEnabled ? .purple : .secondary)
            }
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Preview

#Preview("TTS Control View") {
    VStack {
        TTSControlView()

        Spacer()
    }
    .padding()
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color(.systemGroupedBackground))
}

#Preview("Compact TTS Control") {
    VStack(spacing: 16) {
        CompactTTSControlView()

        CompactTTSControlView(
            viewModel: TTSViewModel.previewSpeaking
        )
    }
    .padding()
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color(.systemGroupedBackground))
}

#Preview("Mini TTS Button") {
    HStack(spacing: 24) {
        MiniTTSButton()

        MiniTTSButton()
    }
    .padding()
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(
        LinearGradient(
            colors: [.purple.opacity(0.2), .pink.opacity(0.2)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    )
}

#Preview("Dark Mode") {
    VStack(spacing: 24) {
        TTSControlView()

        CompactTTSControlView()
    }
    .padding()
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.black)
    .preferredColorScheme(.dark)
}
