//
//  ChatMediaAttachmentViewModel.swift
//  TRIX3DCompanion
//
//  Handles image uploads for chat attachment flows without pushing upload logic into views.
//

import UIKit
import Combine

@MainActor
final class ChatMediaAttachmentViewModel: ObservableObject {
    @Published private(set) var isUploading = false
    @Published private(set) var uploadProgress: Double = 0.0
    @Published var errorMessage: String?

    private let imageUploadService: any ImageUploadServiceProtocol
    private var cancellables = Set<AnyCancellable>()

    init(imageUploadService: (any ImageUploadServiceProtocol)? = nil) {
        self.imageUploadService = imageUploadService ?? ImageUploadService.shared
        bindUploadState()
    }

    @discardableResult
    func upload(image: UIImage, quality: CGFloat = 0.8) async -> String? {
        errorMessage = nil

        let result = await imageUploadService.uploadImage(image, quality: quality)
        switch result {
        case .success(let url):
            return url
        case .failure(let error):
            errorMessage = error.errorDescription
            return nil
        }
    }

    func clearError() {
        errorMessage = nil
    }

    private func bindUploadState() {
        imageUploadService.isUploadingPublisher
            .receive(on: DispatchQueue.main)
            .assign(to: &$isUploading)

        imageUploadService.uploadProgressPublisher
            .receive(on: DispatchQueue.main)
            .assign(to: &$uploadProgress)
    }
}
