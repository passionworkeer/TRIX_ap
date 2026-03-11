//
//  ScheduleService.swift
//  TRIX3DCompanion
//
//  Schedule service for calendar/schedule management
//

import Foundation
import Combine

// MARK: - Schedule Service Error

enum ScheduleServiceError: Error, LocalizedError {
    case fetchFailed(underlying: Error)
    case createFailed(underlying: Error)
    case updateFailed(underlying: Error)
    case deleteFailed(underlying: Error)
    case unknown(underlying: Error?)

    var errorDescription: String? {
        switch self {
        case .fetchFailed(let error):
            return "Failed to fetch schedules: \(error.localizedDescription)"
        case .createFailed(let error):
            return "Failed to create schedule: \(error.localizedDescription)"
        case .updateFailed(let error):
            return "Failed to update schedule: \(error.localizedDescription)"
        case .deleteFailed(let error):
            return "Failed to delete schedule: \(error.localizedDescription)"
        case .unknown(let error):
            return error?.localizedDescription ?? "Unknown error"
        }
    }
}

// MARK: - Schedule Service Protocol

@MainActor
protocol ScheduleServiceProtocol {
    var schedules: [Schedule] { get }
    var isLoading: Bool { get }

    func fetchSchedules() async throws -> [Schedule]
    func fetchSchedulesByDateRange(start: Date, end: Date) async throws -> [Schedule]
    func fetchUpcomingSchedules(minutes: Int) async throws -> [Schedule]
    func createSchedule(_ request: CreateScheduleRequest) async throws -> Schedule
    func updateSchedule(id: String, request: CreateScheduleRequest) async throws -> Schedule
    func deleteSchedule(id: String) async throws
}

// MARK: - Schedule Service

@MainActor
final class ScheduleService: ObservableObject, ScheduleServiceProtocol {

    static let shared = ScheduleService()

    // MARK: - Published Properties

    @Published private(set) var schedules: [Schedule] = []
    @Published private(set) var isLoading: Bool = false
    @Published private(set) var lastError: ScheduleServiceError?

    // MARK: - Dependencies

    private let apiClient: APIClient

    // MARK: - Initialization

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    // MARK: - Public Methods

    /// Fetch all schedules
    func fetchSchedules() async throws -> [Schedule] {
        isLoading = true
        lastError = nil

        do {
            let response: [Schedule] = try await apiClient.get(.scheduleList)
            self.schedules = response
            isLoading = false
            return response
        } catch {
            let serviceError = ScheduleServiceError.fetchFailed(underlying: error)
            lastError = serviceError
            isLoading = false
            throw serviceError
        }
    }

    /// Fetch schedules by date range
    func fetchSchedulesByDateRange(start: Date, end: Date) async throws -> [Schedule] {
        isLoading = true
        lastError = nil

        do {
            let params: [String: Any] = [
                "start": ISO8601DateFormatter().string(from: start),
                "end": ISO8601DateFormatter().string(from: end)
            ]
            let response: [Schedule] = try await apiClient.get(.scheduleByDateRange, parameters: params)
            isLoading = false
            return response
        } catch {
            let serviceError = ScheduleServiceError.fetchFailed(underlying: error)
            lastError = serviceError
            isLoading = false
            throw serviceError
        }
    }

    /// Fetch upcoming schedules
    func fetchUpcomingSchedules(minutes: Int = 30) async throws -> [Schedule] {
        isLoading = true
        lastError = nil

        do {
            let params: [String: Any] = ["minutes": minutes]
            let response: [Schedule] = try await apiClient.get(.scheduleUpcoming, parameters: params)
            isLoading = false
            return response
        } catch {
            let serviceError = ScheduleServiceError.fetchFailed(underlying: error)
            lastError = serviceError
            isLoading = false
            throw serviceError
        }
    }

    /// Create a new schedule
    func createSchedule(_ request: CreateScheduleRequest) async throws -> Schedule {
        isLoading = true
        lastError = nil

        do {
            let response: Schedule = try await apiClient.post(.scheduleCreate, body: request)
            self.schedules.append(response)
            isLoading = false
            return response
        } catch {
            let serviceError = ScheduleServiceError.createFailed(underlying: error)
            lastError = serviceError
            isLoading = false
            throw serviceError
        }
    }

    /// Update an existing schedule
    func updateSchedule(id: String, request: CreateScheduleRequest) async throws -> Schedule {
        isLoading = true
        lastError = nil

        do {
            let response: Schedule = try await apiClient.put(.scheduleUpdate(id: id), body: request)
            if let uuid = UUID(uuidString: id),
               let index = self.schedules.firstIndex(where: { $0.id == uuid }) {
                self.schedules[index] = response
            }
            isLoading = false
            return response
        } catch {
            let serviceError = ScheduleServiceError.updateFailed(underlying: error)
            lastError = serviceError
            isLoading = false
            throw serviceError
        }
    }

    /// Delete a schedule
    func deleteSchedule(id: String) async throws {
        isLoading = true
        lastError = nil

        do {
            let _: EmptyResponse = try await apiClient.delete(.scheduleDelete(id: id))
            if let uuid = UUID(uuidString: id) {
                self.schedules.removeAll { $0.id == uuid }
            }
            isLoading = false
        } catch {
            let serviceError = ScheduleServiceError.deleteFailed(underlying: error)
            lastError = serviceError
            isLoading = false
            throw serviceError
        }
    }

    // MARK: - Helper Methods

    /// Get schedule by ID
    func schedule(byId id: String) -> Schedule? {
        guard let uuid = UUID(uuidString: id) else { return nil }
        return schedules.first { $0.id == uuid }
    }

    /// Get today's schedules
    func todaysSchedules() -> [Schedule] {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        return schedules.filter { schedule in
            calendar.isDate(schedule.startTime, inSameDayAs: today)
        }
    }
}
