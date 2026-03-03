//
//  StudyHistoryService.swift
//  TRIX3DCompanion
//
//  Study history service for historical study data
//

import Foundation
import Combine

// MARK: - Study History Service Error

enum StudyHistoryServiceError: Error, LocalizedError {
    case fetchFailed(underlying: Error)
    case unknown(underlying: Error?)

    var errorDescription: String? {
        switch self {
        case .fetchFailed(let error):
            return "Failed to fetch study history: \(error.localizedDescription)"
        case .unknown(let error):
            return error?.localizedDescription ?? "Unknown error"
        }
    }
}

// MARK: - Study History Service Protocol

protocol StudyHistoryServiceProtocol {
    var dailySummaries: [DailyStudySummary] { get }
    var weeklySummary: WeeklyStudySummary? { get }
    var monthlySummary: MonthlyStudySummary? { get }
    var isLoading: Bool { get }

    func fetchDailySummary(days: Int) async throws -> [DailyStudySummary]
    func fetchWeeklySummary() async throws -> WeeklyStudySummary
    func fetchMonthlySummary() async throws -> MonthlyStudySummary
}

// MARK: - Study History Service

@MainActor
final class StudyHistoryService: ObservableObject, StudyHistoryServiceProtocol {

    static let shared = StudyHistoryService()

    // MARK: - Published Properties

    @Published private(set) var dailySummaries: [DailyStudySummary] = []
    @Published private(set) var weeklySummary: WeeklyStudySummary?
    @Published private(set) var monthlySummary: MonthlyStudySummary?
    @Published private(set) var isLoading: Bool = false
    @Published private(set) var lastError: StudyHistoryServiceError?

    // MARK: - Dependencies

    private let apiClient: APIClient

    // MARK: - Initialization

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    // MARK: - Public Methods

    /// Fetch daily study summaries
    func fetchDailySummary(days: Int = 7) async throws -> [DailyStudySummary] {
        isLoading = true
        lastError = nil

        do {
            let params: [String: Any] = ["days": days]
            let response: [DailyStudySummary] = try await apiClient.get(.studyHistoryDaily, parameters: params)
            self.dailySummaries = response
            isLoading = false
            return response
        } catch {
            let serviceError = StudyHistoryServiceError.fetchFailed(underlying: error)
            lastError = serviceError
            isLoading = false
            throw serviceError
        }
    }

    /// Fetch weekly study summary
    func fetchWeeklySummary() async throws -> WeeklyStudySummary {
        isLoading = true
        lastError = nil

        do {
            let response: WeeklyStudySummary = try await apiClient.get(.studyHistoryWeekly)
            self.weeklySummary = response
            isLoading = false
            return response
        } catch {
            let serviceError = StudyHistoryServiceError.fetchFailed(underlying: error)
            lastError = serviceError
            isLoading = false
            throw serviceError
        }
    }

    /// Fetch monthly study summary
    func fetchMonthlySummary() async throws -> MonthlyStudySummary {
        isLoading = true
        lastError = nil

        do {
            let response: MonthlyStudySummary = try await apiClient.get(.studyHistoryMonthly)
            self.monthlySummary = response
            isLoading = false
            return response
        } catch {
            let serviceError = StudyHistoryServiceError.fetchFailed(underlying: error)
            lastError = serviceError
            isLoading = false
            throw serviceError
        }
    }

    // MARK: - Helper Methods

    /// Get total study minutes for the week
    var weeklyTotalMinutes: Int {
        return weeklySummary?.totalMinutes ?? 0
    }

    /// Get total study minutes for the month
    var monthlyTotalMinutes: Int {
        return monthlySummary?.totalMinutes ?? 0
    }

    /// Get current streak
    var currentStreak: Int {
        return weeklySummary?.streakDays ?? 0
    }
}
