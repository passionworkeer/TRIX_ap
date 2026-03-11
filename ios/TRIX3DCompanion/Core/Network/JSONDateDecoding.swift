//
//  JSONDateDecoding.swift
//  TRIX3DCompanion
//

import Foundation

/// Shared JSON date decoding strategy for API payloads.
enum JSONDateDecoding {
    private static let iso8601Formatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    private static let iso8601FractionalFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    static func configure(_ decoder: JSONDecoder) {
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()

            if let unixTimestamp = try? container.decode(Double.self) {
                return Date(timeIntervalSince1970: unixTimestamp)
            }
            if let unixTimestamp = try? container.decode(Int.self) {
                return Date(timeIntervalSince1970: TimeInterval(unixTimestamp))
            }

            let stringValue = try container.decode(String.self)

            if let parsedDate = parseISO8601(stringValue) {
                return parsedDate
            }

            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Unsupported date format: \(stringValue)"
            )
        }
    }

    private static func parseISO8601(_ value: String) -> Date? {
        if let date = iso8601FractionalFormatter.date(from: value) {
            return date
        }
        if let date = iso8601Formatter.date(from: value) {
            return date
        }

        // Supabase may return timestamps with fractional seconds beyond parser tolerance.
        if let stripped = strippingFractionalSeconds(from: value) {
            return iso8601Formatter.date(from: stripped)
        }

        return nil
    }

    private static func strippingFractionalSeconds(from value: String) -> String? {
        guard let dotIndex = value.firstIndex(of: ".") else {
            return nil
        }

        let tail = value[value.index(after: dotIndex)...]
        guard let timezoneStart = tail.firstIndex(where: { $0 == "Z" || $0 == "+" || $0 == "-" }) else {
            return nil
        }

        return String(value[..<dotIndex]) + String(value[timezoneStart...])
    }
}
