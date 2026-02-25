//
//  StudyService.swift
//  TRIX3DCompanion
//
//  学习服务
//  管理学习房间、会话、统计等业务逻辑
//

import Foundation

// MARK: - Study Error

/// 学习相关错误
enum StudyError: Error, LocalizedError {
    case roomNotFound
    case roomFull
    case notAuthorized
    case invalidRoomCode
    case sessionNotActive
    case networkError(underlying: Error)
    case unknown(underlying: Error?)

    var errorDescription: String? {
        switch self {
        case .roomNotFound:
            return "Room not found"
        case .roomFull:
            return "Room is full"
        case .notAuthorized:
            return "You're not authorized to perform this action"
        case .invalidRoomCode:
            return "Invalid room code"
        case .sessionNotActive:
            return "No active session"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .unknown(let error):
            return error?.localizedDescription ?? "An unknown error occurred"
        }
    }
}

// MARK: - Study Service Protocol

/// 学习服务协议
protocol StudyServiceProtocol {
    /// 加入学习房间
    func joinRoom(_ roomCode: String) async throws

    /// 离开学习房间
    func leaveRoom(_ roomCode: String) async throws

    /// 开始专注会话
    func startFocusSession(roomCode: String, duration: Int) async throws

    /// 暂停会话
    func pauseSession(roomCode: String) async throws

    /// 恢复会话
    func resumeSession(roomCode: String) async throws

    /// 结束会话
    func endSession(roomCode: String) async throws

    /// 获取学习统计
    func getStudyStats(timeRange: TimeRange) async throws -> StudyStats

    /// 获取每周学习数据
    func getWeeklyStudyData() async throws -> [DailyStudyData]
}

// MARK: - Study Service

/// 学习服务实现
@MainActor
final class StudyService: StudyServiceProtocol {

    // MARK: - Singleton

    static let shared = StudyService()

    // MARK: - Dependencies

    private let apiClient: APIClient

    // MARK: - Initialization

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    // MARK: - Room Management

    /// 加入学习房间
    func joinRoom(_ roomCode: String) async throws {
        // TODO: Implement API call
        // For now, simulate success
        try await Task.sleep(nanoseconds: 500_000_000) // 0.5 seconds
    }

    /// 离开学习房间
    func leaveRoom(_ roomCode: String) async throws {
        // TODO: Implement API call
        try await Task.sleep(nanoseconds: 500_000_000)
    }

    // MARK: - Session Management

    /// 开始专注会话
    func startFocusSession(roomCode: String, duration: Int) async throws {
        // TODO: Implement API call
        try await Task.sleep(nanoseconds: 500_000_000)
    }

    /// 暂停会话
    func pauseSession(roomCode: String) async throws {
        // TODO: Implement API call
        try await Task.sleep(nanoseconds: 500_000_000)
    }

    /// 恢复会话
    func resumeSession(roomCode: String) async throws {
        // TODO: Implement API call
        try await Task.sleep(nanoseconds: 500_000_000)
    }

    /// 结束会话
    func endSession(roomCode: String) async throws {
        // TODO: Implement API call
        try await Task.sleep(nanoseconds: 500_000_000)
    }

    // MARK: - Statistics

    /// 获取学习统计
    func getStudyStats(timeRange: TimeRange) async throws -> StudyStats {
        // TODO: Implement API call
        // For now, return mock data
        try await Task.sleep(nanoseconds: 500_000_000)

        return StudyStats(
            totalDuration: 720, // 12 hours
            sessionCount: 24,
            averageDuration: 30, // 30 minutes
            streakDays: 5,
            todayDuration: 120, // 2 hours
            weekDuration: 480 // 8 hours
        )
    }

    /// 获取每周学习数据
    func getWeeklyStudyData() async throws -> [DailyStudyData] {
        // TODO: Implement API call
        // For now, return mock data
        try await Task.sleep(nanoseconds: 500_000_000)

        let calendar = Calendar.current
        let today = Date()
        var data: [DailyStudyData] = []

        for i in 0..<7 {
            if let date = calendar.date(byAdding: .day, value: -i, to: today) {
                let duration = Int.random(in: 30...120) // Random 30-120 minutes
                data.append(DailyStudyData(date: date, durationMinutes: duration))
            }
        }

        return data.reversed()
    }
}

// MARK: - TimeRange Mapping

extension TimeRange {
    /// 转换为API参数
    var apiParameterValue: String {
        switch self {
        case .today:
            return "today"
        case .week:
            return "week"
        case .month:
            return "month"
        case .allTime:
            return "all"
        }
    }
}
