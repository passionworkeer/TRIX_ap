//
//  SystemPhotoLibraryPicker.swift
//  TRIX3DCompanion
//
//  Thin SwiftUI wrapper around PHPickerViewController for single-image selection.
//

import SwiftUI
import PhotosUI
import UIKit

struct SystemPhotoLibraryPicker: UIViewControllerRepresentable {
    let onImagePicked: (UIImage) -> Void
    let onCancel: () -> Void
    let onFailure: (Error?) -> Void

    init(
        onImagePicked: @escaping (UIImage) -> Void,
        onCancel: @escaping () -> Void,
        onFailure: @escaping (Error?) -> Void = { _ in }
    ) {
        self.onImagePicked = onImagePicked
        self.onCancel = onCancel
        self.onFailure = onFailure
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(
            onImagePicked: onImagePicked,
            onCancel: onCancel,
            onFailure: onFailure
        )
    }

    func makeUIViewController(context: Context) -> PHPickerViewController {
        var configuration = PHPickerConfiguration(photoLibrary: .shared())
        configuration.filter = .images
        configuration.selectionLimit = 1
        configuration.preferredAssetRepresentationMode = .current

        let picker = PHPickerViewController(configuration: configuration)
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: PHPickerViewController, context: Context) {}
}

extension SystemPhotoLibraryPicker {
    final class Coordinator: NSObject, PHPickerViewControllerDelegate {
        private let onImagePicked: (UIImage) -> Void
        private let onCancel: () -> Void
        private let onFailure: (Error?) -> Void

        init(
            onImagePicked: @escaping (UIImage) -> Void,
            onCancel: @escaping () -> Void,
            onFailure: @escaping (Error?) -> Void
        ) {
            self.onImagePicked = onImagePicked
            self.onCancel = onCancel
            self.onFailure = onFailure
        }

        func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
            guard let result = results.first else {
                DispatchQueue.main.async {
                    self.onCancel()
                }
                return
            }

            guard result.itemProvider.canLoadObject(ofClass: UIImage.self) else {
                DispatchQueue.main.async {
                    self.onFailure(nil)
                }
                return
            }

            result.itemProvider.loadObject(ofClass: UIImage.self) { object, error in
                DispatchQueue.main.async {
                    guard let image = object as? UIImage else {
                        self.onFailure(error)
                        return
                    }

                    self.onImagePicked(image)
                }
            }
        }
    }
}
