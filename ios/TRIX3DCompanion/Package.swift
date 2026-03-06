// swift-tools-version: 5.9
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "TRIX3DCompanion",
    platforms: [
        .iOS(.v16)
    ],
    products: [
        .library(
            name: "TRIX3DCompanion",
            targets: ["TRIX3DCompanion"]
        )
    ],
    dependencies: [
        // Supabase - Authentication + Database + Realtime
        .package(url: "https://github.com/supabase-community/supabase-swift.git", from: "1.0.0"),

        // Networking
        .package(url: "https://github.com/Alamofire/Alamofire.git", from: "5.8.0"),
        .package(url: "https://github.com/daltoniam/Starscream.git", from: "4.0.0"),

        // Image Loading & Caching
        .package(url: "https://github.com/onevcat/Kingfisher.git", from: "7.10.0"),

        // Secure Storage
        .package(url: "https://github.com/kishikawakatsumi/KeychainAccess.git", from: "4.2.0"),

        // Local Database
        .package(url: "https://github.com/stephencelis/SQLite.swift.git", from: "0.14.0"),

        // QR Code Scanner
        .package(url: "https://github.com/twostraws/CodeScanner.git", from: "2.0.0"),

        // Socket.IO for real-time communication
        .package(url: "https://github.com/socketio/socket.io-swift.git", from: "16.0.0"),
    ],
    targets: [
        .target(
            name: "TRIX3DCompanion",
            dependencies: [
                .product(name: "Supabase", package: "supabase-swift"),
                .product(name: "Alamofire", package: "Alamofire"),
                .product(name: "Starscream", package: "Starscream"),
                .product(name: "Kingfisher", package: "Kingfisher"),
                .product(name: "KeychainAccess", package: "KeychainAccess"),
                .product(name: "SQLite", package: "SQLite.swift"),
                .product(name: "CodeScanner", package: "CodeScanner"),
                .product(name: "SocketIO", package: "socket.io-swift"),
            ]
        ),
        .testTarget(
            name: "TRIX3DCompanionTests",
            dependencies: ["TRIX3DCompanion"]
        )
    ]
)
