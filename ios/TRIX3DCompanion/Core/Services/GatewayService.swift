//
//  GatewayService.swift
//  TRIX3DCompanion
//
//  Gateway RPC Service
//

import Foundation
import Combine

final class GatewayService: ObservableObject {
    static let shared = GatewayService()

    private let client = GatewayClient.shared
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Published State

    @Published private(set) var connected = false
    @Published private(set) var deviceId: String?

    // MARK: - Initialization

    private init() {
        setupBindings()
    }

    private func setupBindings() {
        client.connectionSubject
            .receive(on: DispatchQueue.main)
            .sink { [weak self] connected in
                self?.connected = connected
            }
            .store(in: &cancellables)
    }

    // MARK: - Connection

    func connect(url: String, token: String? = nil, password: String? = nil) async throws {
        let options = GatewayConnectionOptions(
            url: url,
            token: token,
            password: password,
            deviceId: nil,
            deviceKey: nil,
            reconnect: true,
            reconnectAttempts: 10,
            reconnectDelay: 2000
        )

        try await client.connect(options: options)
        deviceId = client.getDeviceId()
    }

    func disconnect() {
        client.disconnect()
        deviceId = nil
    }

    var isConnected: Bool {
        client.isConnected
    }

    // MARK: - Chat Methods

    func chatSend(sessionKey: String, message: String) async throws {
        let sessionId = sessionKey.split(separator: ":").last.map(String.init) ?? "main"

        try await client.request("chat.send", params: [
            "sessionId": sessionId,
            "message": message
        ])
    }

    func chatHistory(sessionKey: String, limit: Int = 50) async throws -> [ChatMessage] {
        let sessionId = sessionKey.split(separator: ":").last.map(String.init) ?? "main"

        let response: [String: Any] = try await client.request("chat.history", params: [
            "sessionId": sessionId,
            "limit": limit
        ])

        guard let messagesData = response["messages"] as? [[String: Any]] else {
            return []
        }

        return try messagesData.map { dict in
            let data = try JSONSerialization.data(withJSONObject: dict)
            return try JSONDecoder().decode(ChatMessage.self, from: data)
        }
    }

    // MARK: - Session Methods

    func sessionsList() async throws -> [Session] {
        let response: [String: Any] = try await client.request("sessions.list", params: nil)

        guard let sessionsData = response["sessions"] as? [[String: Any]] else {
            return []
        }

        return try sessionsData.map { dict in
            let data = try JSONSerialization.data(withJSONObject: dict)
            return try JSONDecoder().decode(Session.self, from: data)
        }
    }

    func sessionsDelete(key: String) async throws {
        try await client.request("sessions.delete", params: ["key": key])
    }

    func sessionsPatch(key: String, label: String) async throws -> Session {
        let response: [String: Any] = try await client.request("sessions.patch", params: [
            "key": key,
            "label": label
        ])

        let data = try JSONSerialization.data(withJSONObject: response)
        return try JSONDecoder().decode(Session.self, from: data)
    }

    // MARK: - Agent Methods

    func agentsList() async throws -> [Agent] {
        let response: [String: Any] = try await client.request("agents.list", params: nil)

        guard let agentsData = response["agents"] as? [[String: Any]] else {
            return []
        }

        return try agentsData.map { dict in
            let data = try JSONSerialization.data(withJSONObject: dict)
            return try JSONDecoder().decode(Agent.self, from: data)
        }
    }

    // MARK: - Skill Methods

    func skillsList() async throws -> [Skill] {
        let response: [String: Any] = try await client.request("skills.list", params: nil)

        guard let skillsData = response["skills"] as? [[String: Any]] else {
            return []
        }

        return try skillsData.map { dict in
            let data = try JSONSerialization.data(withJSONObject: dict)
            return try JSONDecoder().decode(Skill.self, from: data)
        }
    }

    // MARK: - Cron Methods

    func cronsList() async throws -> [CronJob] {
        let response: [String: Any] = try await client.request("crons.list", params: nil)

        guard let jobsData = response["jobs"] as? [[String: Any]] else {
            return []
        }

        return try jobsData.map { dict in
            let data = try JSONSerialization.data(withJSONObject: dict)
            return try JSONDecoder().decode(CronJob.self, from: data)
        }
    }

    func cronsAdd(name: String, schedule: String, content: String) async throws {
        try await client.request("crons.add", params: [
            "name": name,
            "schedule": schedule,
            "content": content
        ])
    }

    func cronsEnable(jobId: String) async throws {
        try await client.request("crons.enable", params: ["jobId": jobId])
    }

    func cronsDisable(jobId: String) async throws {
        try await client.request("crons.disable", params: ["jobId": jobId])
    }

    func cronsRemove(jobId: String) async throws {
        try await client.request("crons.remove", params: ["jobId": jobId])
    }

    func cronsRun(jobId: String) async throws {
        try await client.request("crons.run", params: ["jobId": jobId])
    }

    // MARK: - Control Methods

    func controlModelsStatus() async throws -> [ModelsStatus] {
        let response: [String: Any] = try await client.request("control.modelsStatus", params: nil)

        guard let modelsData = response["models"] as? [[String: Any]] else {
            return []
        }

        return try modelsData.map { dict in
            let data = try JSONSerialization.data(withJSONObject: dict)
            return try JSONDecoder().decode(ModelsStatus.self, from: data)
        }
    }

    func controlSkillsCheck() async throws -> [CheckResult] {
        let response: [String: Any] = try await client.request("control.skillsCheck", params: nil)

        guard let resultsData = response["results"] as? [[String: Any]] else {
            return []
        }

        return try resultsData.map { dict in
            let data = try JSONSerialization.data(withJSONObject: dict)
            return try JSONDecoder().decode(CheckResult.self, from: data)
        }
    }

    func controlDoctor() async throws -> DoctorResult {
        let response: [String: Any] = try await client.request("control.doctor", params: nil)

        let data = try JSONSerialization.data(withJSONObject: response)
        return try JSONDecoder().decode(DoctorResult.self, from: data)
    }

    func controlDoctorRepair() async throws {
        try await client.request("control.doctorRepair", params: nil)
    }

    func controlLogs(limit: Int = 100) async throws -> String {
        let response: [String: Any] = try await client.request("control.logs", params: ["limit": limit])
        return response["logs"] as? String ?? ""
    }

    func controlConfigBackup() async throws {
        try await client.request("control.configBackup", params: nil)
    }

    func controlConfigRollback() async throws {
        try await client.request("control.configRollback", params: nil)
    }

    // MARK: - Event Subscriptions

    func onChatDelta(_ handler: @escaping (ChatDeltaEvent) -> Void) {
        client.on("chat.delta") { data in
            guard let dict = data as? [String: Any],
                  let jsonData = try? JSONSerialization.data(withJSONObject: dict),
                  let event = try? JSONDecoder().decode(ChatDeltaEvent.self, from: jsonData) else { return }
            handler(event)
        }
    }

    func onChatFinal(_ handler: @escaping (String, String) -> Void) {
        client.on("chat.final") { data in
            guard let dict = data as? [String: Any],
                  let sessionId = dict["sessionId"] as? String,
                  let message = dict["message"] as? String else { return }
            handler(sessionId, message)
        }
    }

    func onAgentTyping(_ handler: @escaping (String) -> Void) {
        client.on("agent_typing") { data in
            guard let dict = data as? [String: Any],
                  let sessionId = dict["sessionId"] as? String else { return }
            handler(sessionId)
        }
    }

    func offChatDelta(_ handler: @escaping (ChatDeltaEvent) -> Void) {
        client.off("chat.delta", handler: handler as! EventHandler)
    }

    func offChatFinal(_ handler: @escaping (String, String) -> Void) {
        client.off("chat.final", handler: handler as! EventHandler)
    }
}
