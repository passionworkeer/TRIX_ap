//
//  SnapshotAnalysisView.swift
//  TRIX3DCompanion
//
//  Snapshot AI Analysis View
//  快照分析视图 - AI 驱动的图片分析和提示词生成
//

import SwiftUI

#if canImport(UIKit)
import UIKit
#endif

// MARK: - Snapshot Action

/// 快照分析动作类型
enum SnapshotActionKey: String, CaseIterable {
    case identify = "identify"
    case extractText = "extract_text"
    case studyPoints = "study_points"
    case nextSteps = "next_steps"

    var label: String {
        switch self {
        case .identify: return "识别画面内容"
        case .extractText: return "提取图片文字"
        case .studyPoints: return "生成学习要点"
        case .nextSteps: return "给出下一步建议"
        }
    }

    var prompt: String {
        switch self {
        case .identify:
            return "请详细识别这张图片里的主体内容、关键物体和可能场景。"
        case .extractText:
            return "请提取这张图片中的全部可读文字，并按结构整理。"
        case .studyPoints:
            return "请基于图片内容提炼学习要点，给出3-5条重点。"
        case .nextSteps:
            return "请结合图片内容，给出可执行的下一步行动建议。"
        }
    }

    var icon: String {
        switch self {
        case .identify: return "eye.fill"
        case .extractText: return "doc.text.fill"
        case .studyPoints: return "sparkles"
        case .nextSteps: return "arrow.right.circle.fill"
        }
    }
}

// MARK: - Snapshot Analysis View

/// 快照分析视图
struct SnapshotAnalysisView: View {

    // MARK: - Environment

    @Environment(\.dismiss) private var dismiss

    // MARK: - State

    @State private var selectedAction: SnapshotActionKey?
    @State private var promptText: String = ""
    @State private var isUploading = false
    @State private var showSuccessToast = false

    // MARK: - Properties

    let capturedPhoto: UIImage?
    let onRetake: () -> Void
    let onSendToChat: (UIImage, String) -> Void

    // MARK: - Body

    var body: some View {
        ZStack {
            // Background
            Color.black
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Header
                header

                // Content
                ScrollView {
                    VStack(spacing: 20) {
                        // Photo preview
                        photoPreview

                        // Action hint
                        actionHint

                        // Action buttons grid
                        actionButtonsGrid

                        // Prompt text area
                        promptSection

                        // Action buttons
                        actionButtons
                    }
                    .padding()
                }
            }

            // Success toast
            if showSuccessToast {
                successToast
            }

            // Uploading overlay
            if isUploading {
                uploadingOverlay
            }
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack {
            Button(action: onRetake) {
                Circle()
                    .fill(Color.white.opacity(0.15))
                    .frame(width: 44, height: 44)
                    .overlay {
                        Image(systemName: "arrow.left")
                            .foregroundColor(.white)
                            .font(.system(size: 18, weight: .semibold))
                    }
            }
            .accessibilityLabel("返回")

            Text("快照分析")
                .font(.title3)
                .fontWeight(.semibold)
                .foregroundColor(.white)

            Spacer()
                .frame(width: 40)
        }
        .padding(.horizontal, 16)
        .padding(.top, 50)
        .padding(.bottom, 16)
        .background(
            Color.black.opacity(0.3)
                .background(.ultraThinMaterial)
        )
    }

    // MARK: - Photo Preview

    private var photoPreview: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("拍摄的照片")
                .font(.caption)
                .foregroundColor(.textSecondary)

            Group {
                if let image = capturedPhoto {
                    Image(uiImage: image)
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(height: 200)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                } else {
                    Rectangle()
                        .fill(Color.secondary.opacity(0.3))
                        .frame(height: 200)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                        .overlay {
                            VStack(spacing: 8) {
                                Image(systemName: "photo")
                                    .font(.title)
                                    .foregroundColor(.textSecondary)
                                Text("暂无图片")
                                    .font(.caption)
                                    .foregroundColor(.textTertiary)
                            }
                        }
                }
            }
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(Color.white.opacity(0.1), lineWidth: 1)
            )
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 20)
                .fill(Color.white.opacity(0.05))
                .overlay(
                    RoundedRectangle(cornerRadius: 20)
                        .stroke(Color.white.opacity(0.1), lineWidth: 1)
                )
        )
        .background(.ultraThinMaterial)
    }

    // MARK: - Action Hint

    private var actionHint: some View {
        HStack(spacing: 8) {
            Image(systemName: "sparkles")
                .font(.caption)
                .foregroundColor(.cyan)

            Text("点击下方按钮会自动生成对应提示词")
                .font(.caption)
                .foregroundColor(.cyan)
        }
    }

    // MARK: - Action Buttons Grid

    private var actionButtonsGrid: some View {
        LazyVGrid(
            columns: [
                GridItem(.flexible(), spacing: 12),
                GridItem(.flexible(), spacing: 12)
            ],
            spacing: 12
        ) {
            ForEach(SnapshotActionKey.allCases.filter { $0 != .extractText }, id: \.self) { action in
                actionButton(for: action)
            }
        }
    }

    private func actionButton(for action: SnapshotActionKey) -> some View {
        let isSelected = selectedAction == action

        return Button {
            withAnimation(.spring(response: 0.3)) {
                selectedAction = action
                promptText = action.prompt
            }

            // Haptic feedback
            let generator = UIImpactFeedbackGenerator(style: .light)
            generator.impactOccurred()
        } label: {
            HStack(spacing: 8) {
                Image(systemName: action.icon)
                    .font(.caption)

                Text(action.label)
                    .font(.subheadline)
                    .fontWeight(.medium)
            }
            .foregroundColor(isSelected ? .white : .white.opacity(0.8))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(isSelected ? Color.cyan : Color.white.opacity(0.1))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(
                        isSelected ? Color.cyan : Color.white.opacity(0.2),
                        lineWidth: 1
                    )
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Prompt Section

    private var promptSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("提示词")
                .font(.caption)
                .foregroundColor(.textSecondary)

            promptTextEditor
        }
        .padding()
        .background(promptSectionBackground)
    }

    @ViewBuilder
    private var promptTextEditor: some View {
        TextEditor(text: $promptText)
            .font(.body)
            .foregroundColor(.white)
            .frame(minHeight: 100)
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.black.opacity(0.3))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.white.opacity(0.15), lineWidth: 1)
            )
            .overlay(alignment: .topLeading) {
                if promptText.isEmpty {
                    emptyPromptPlaceholder
                }
            }
    }

    private var emptyPromptPlaceholder: some View {
        VStack(alignment: .leading) {
            Text("点击上方按钮后，这里会出现对应提示词")
                .font(.caption)
                .foregroundColor(.textTertiary)
                .padding(.top, 12)
            Spacer()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.leading, 16)
    }

    private var promptSectionBackground: some View {
        RoundedRectangle(cornerRadius: 20)
            .fill(Color.white.opacity(0.05))
            .overlay(
                RoundedRectangle(cornerRadius: 20)
                    .stroke(Color.white.opacity(0.1), lineWidth: 1)
            )
            .background(.ultraThinMaterial)
    }

    // MARK: - Action Buttons

    private var actionButtons: some View {
        HStack(spacing: 12) {
            Button(action: onRetake) {
                HStack(spacing: 8) {
                    Image(systemName: "arrow.counterclockwise")
                    Text("重拍")
                }
                .font(.headline)
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(Color.white.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color.white.opacity(0.2), lineWidth: 1)
                )
            }
            .buttonStyle(.plain)

            Button(action: sendToChat) {
                HStack(spacing: 8) {
                    if isUploading {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            .scaleEffect(0.8)
                    } else {
                        Image(systemName: "paperplane.fill")
                    }
                    Text("发送给 TRIX Bot")
                }
                .font(.headline)
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(
                    LinearGradient(
                        colors: promptText.isEmpty ? [Color.gray, Color.gray] : [Color.cyan, Color.cyan.opacity(0.8)],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .clipShape(RoundedRectangle(cornerRadius: 16))
            }
            .disabled(promptText.isEmpty || isUploading)
            .buttonStyle(.plain)
        }
        .padding(.bottom, 8)
    }

    // MARK: - Success Toast

    private var successToast: some View {
        VStack {
            HStack {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(.green)
                    .font(.title3)

                Text("已发送到聊天")
                    .font(.subheadline)
                    .foregroundColor(.white)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
            .background(
                Capsule()
                    .fill(.ultraThinMaterial)
            )
            .shadow(radius: 10)
            .padding(.top, 20)

            Spacer()
        }
    }

    // MARK: - Uploading Overlay

    private var uploadingOverlay: some View {
        ZStack {
            Color.black.opacity(0.7)
                .ignoresSafeArea()

            VStack(spacing: 20) {
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: .cyan))
                    .scaleEffect(1.5)

                Text("正在上传...")
                    .font(.subheadline)
                    .foregroundColor(.white)
            }
            .padding(30)
            .background(
                RoundedRectangle(cornerRadius: 20)
                    .fill(.ultraThinMaterial)
            )
        }
    }

    // MARK: - Actions

    private func sendToChat() {
        guard let image = capturedPhoto else { return }
        guard !promptText.isEmpty else { return }

        isUploading = true

        // Simulate upload delay
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            isUploading = false
            showSuccessToast = true

            // Call completion handler
            onSendToChat(image, promptText)

            // Dismiss after showing success
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                dismiss()
            }
        }
    }
}

// MARK: - Preview

#Preview("Snapshot Analysis") {
    SnapshotAnalysisView(
        capturedPhoto: nil,
        onRetake: {},
        onSendToChat: { _, _ in }
    )
}
