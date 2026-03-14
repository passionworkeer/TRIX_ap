//
//  Device.swift
//  TRIX Native
//

import Foundation

struct Device: Codable, Identifiable {
    let id: String
    let name: String
    let type: DeviceType
    var status: DeviceStatus
    var lastSeen: Date

    enum DeviceType: String, Codable {
        case phone
        case plugin
    }

    enum DeviceStatus: String, Codable {
        case active
        case inactive
        case blocked
    }
}

struct DeviceInfo {
    static var deviceId: String {
        if let id = UserDefaults.standard.string(forKey: "trix_device_id") {
            return id
        }
        let newId = "device_\(UUID().uuidString.replacingOccurrences(of: "-", with: "").prefix(16))"
        UserDefaults.standard.set(newId, forKey: "trix_device_id")
        return newId
    }

    static var deviceName: String {
        return UIDevice.current.name
    }
}
