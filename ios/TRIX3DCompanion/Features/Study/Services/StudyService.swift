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
        do {
            let _: EmptyResponse = try await apiClient.request(
                .POST,
                endpoint: "/study/rooms/\(roomCode)/join"
            )
        } catch let error as NetworkError {
            throw mapNetworkError(error)
        } catch {
            throw StudyError.unknown(underlying: error)
        }
    }

    /// 离开学习房间
    func leaveRoom(_ roomCode: String) async throws {
        do {
            let _: EmptyResponse = try await apiClient.request(
                .POST,
                endpoint: "/study/rooms/\(roomCode)/leave"
            )
        } catch let error as NetworkError {
            throw mapNetworkError(error)
        } catch {
            throw StudyError.unknown(underlying: error)
        }
    }

    // MARK: - Session Management

    /// 开始专注会话
    func startFocusSession(roomCode: String, duration: Int) async throws {
        do {
            let request = StartSessionRequest(duration: duration)
            let _: EmptyResponse = try await apiClient.request(
                .POST,
                endpoint: "/study/rooms/\(roomCode)/sessions/start",
                body: request
            )
        } catch let error as NetworkError {
            throw mapNetworkError(error)
        } catch {
            throw StudyError.unknown(underlying: error)
        }
    }

    /// 暂停会话
    func pauseSession(roomCode: String) async throws {
        do {
            let _: EmptyResponse = try await apiClient.request(
                .POST,
                endpoint: "/study/rooms/\(roomCode)/sessions/pause"
            )
        } catch let error as NetworkError {
            throw mapNetworkError(error)
        } catch {
            throw StudyError.unknown(underlying: error)
        }
    }

    /// 恢复会话
    func resumeSession(roomCode: String) async throws {
        do {
            let _: EmptyResponse = try await apiClient.request(
                .POST,
                endpoint: "/study/rooms/\(roomCode)/sessions/resume"
            )
        } catch let error as NetworkError {
            throw mapNetworkError(error)
        } catch {
            throw StudyError.unknown(underlying: error)
        }
    }

    /// 结束会话
    func endSession(roomCode: String) async throws {
        do {
            let _: EmptyResponse = try await apiClient.request(
                .POST,
                endpoint: "/study/rooms/\(roomCode)/sessions/end"
            )
        } catch let error as NetworkError {
            throw mapNetworkError(error)
        } catch {
            throw StudyError.unknown(underlying: error)
        }
    }

    // MARK: - Statistics

    /// 获取学习统计
    func getStudyStats(timeRange: TimeRange) async throws -> StudyStats {
        do {
            let response: StudyStatsResponse = try await apiClient.request(
                .GET,
                endpoint: "/study/stats?range=\(timeRange.apiParameterValue)"
            )
            return StudyStats(
                totalDuration: response.totalDuration,
                sessionCount: response.sessionCount,
                averageDuration: response.averageDuration,
                streakDays: response.streakDays,
                todayDuration: response.todayDuration,
                weekDuration: response.weekDuration
            )
        } catch let error as NetworkError {
            throw mapNetworkError(error)
        } catch {
            throw StudyError.unknown(underlying: error)
        }
    }

    /// 获取每周学习数据
    func getWeeklyStudyData() async throws -> [DailyStudyData] {
        do {
            let response: WeeklyStudyResponse = try await apiClient.request(
                .GET,
                endpoint: "/study/stats/weekly"
            )
            return response.dailyData
        } catch let error as NetworkError {
            throw mapNetworkError(error)
        } catch {
            throw StudyError.unknown(underlying: error)
        }
    }

    // MARK: - Error Mapping

    private func mapNetworkError(_ error: NetworkError) -> StudyError {
        switch error {
        case .notFound:
            return .roomNotFound
        case .unauthorized:
            return .notAuthorized
        case .custom(let message) where message.contains("full"):
            return .roomFull
        case .custom(let message) where message.contains("invalid"):
            return .invalidRoomCode
        default:
            return .networkError(underlying: error)
        }
    }
}

// MARK: - Request/Response Models

private struct StartSessionRequest: Encodable {
    let duration: Int
}

private struct EmptyResponse: Decodable {}

private struct StudyStatsResponse: Decodable {
    let totalDuration: Int
    let sessionCount: Int
    let averageDuration: Int
    let streakDays: Int
    let todayDuration: Int
    let weekDuration: Int
}

private struct WeeklyStudyResponse: Decodable {
    let dailyData: [DailyStudyData]
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
