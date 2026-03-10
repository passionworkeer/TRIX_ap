/**
 * GatewayRPC Service
 *
 * RPC methods for Gateway communication
 * Wraps GatewayClient with typed methods for:
 * - Chat (send, history)
 * - Sessions (list, delete, patch)
 * - Agents (list)
 * - Skills (list)
 * - Crons (list, add, enable, disable, remove, run)
 * - Control (modelsStatus, skillsCheck, doctor, logs, etc.)
 */

import gatewayClient from './GatewayClient';
import { logger } from '../utils/logger';
import type {
  Session,
  SessionListResponse,
  Agent,
  AgentListResponse,
  Skill,
  SkillListResponse,
  CronJob,
  CronListResponse,
  ModelsStatus,
  CheckResult,
  DoctorResult,
  ChatMessage,
} from '../types/gateway';

class GatewayRPC {
  // ============================================
  // Chat Methods
  // ============================================

  /**
   * Send chat message
   */
  async chatSend(sessionKey: string, message: string): Promise<void> {
    const sessionId = sessionKey.split(':').pop() || 'main';

    try {
      await gatewayClient.request('chat.send', {
        sessionId,
        message,
      });
    } catch (error) {
      logger.gateway.error('[GatewayRPC] chat.send failed:', error);
      throw error;
    }
  }

  /**
   * Get chat history
   */
  async chatHistory(sessionKey: string, limit = 50): Promise<ChatMessage[]> {
    const sessionId = sessionKey.split(':').pop() || 'main';

    try {
      const response = await gatewayClient.request<{ messages: ChatMessage[] }>('chat.history', {
        sessionId,
        limit,
      });
      return response?.messages || [];
    } catch (error) {
      logger.gateway.error('[GatewayRPC] chat.history failed:', error);
      throw error;
    }
  }

  // ============================================
  // Session Methods
  // ============================================

  /**
   * List all sessions
   */
  async sessionsList(): Promise<Session[]> {
    try {
      const response = await gatewayClient.request<SessionListResponse>('sessions.list');
      return response?.sessions || [];
    } catch (error) {
      logger.gateway.error('[GatewayRPC] sessions.list failed:', error);
      throw error;
    }
  }

  /**
   * Delete a session
   */
  async sessionsDelete(key: string): Promise<void> {
    try {
      await gatewayClient.request('sessions.delete', { key });
    } catch (error) {
      logger.gateway.error('[GatewayRPC] sessions.delete failed:', error);
      throw error;
    }
  }

  /**
   * Update session label
   */
  async sessionsPatch(key: string, label: string): Promise<Session> {
    try {
      const response = await gatewayClient.request<Session>('sessions.patch', { key, label });
      return response;
    } catch (error) {
      logger.gateway.error('[GatewayRPC] sessions.patch failed:', error);
      throw error;
    }
  }

  // ============================================
  // Agent Methods
  // ============================================

  /**
   * List all agents
   */
  async agentsList(): Promise<Agent[]> {
    try {
      const response = await gatewayClient.request<AgentListResponse>('agents.list');
      return response?.agents || [];
    } catch (error) {
      logger.gateway.error('[GatewayRPC] agents.list failed:', error);
      throw error;
    }
  }

  // ============================================
  // Skill Methods
  // ============================================

  /**
   * List all skills
   */
  async skillsList(): Promise<Skill[]> {
    try {
      const response = await gatewayClient.request<SkillListResponse>('skills.list');
      return response?.skills || [];
    } catch (error) {
      logger.gateway.error('[GatewayRPC] skills.list failed:', error);
      throw error;
    }
  }

  // ============================================
  // Cron Methods
  // ============================================

  /**
   * List all cron jobs
   */
  async cronsList(): Promise<CronJob[]> {
    try {
      const response = await gatewayClient.request<CronListResponse>('crons.list');
      return response?.jobs || [];
    } catch (error) {
      logger.gateway.error('[GatewayRPC] crons.list failed:', error);
      throw error;
    }
  }

  /**
   * Add a cron job
   */
  async cronsAdd(name: string, schedule: string, content: string): Promise<void> {
    try {
      await gatewayClient.request('crons.add', { name, schedule, content });
    } catch (error) {
      logger.gateway.error('[GatewayRPC] crons.add failed:', error);
      throw error;
    }
  }

  /**
   * Enable a cron job
   */
  async cronsEnable(jobId: string): Promise<void> {
    try {
      await gatewayClient.request('crons.enable', { jobId });
    } catch (error) {
      logger.gateway.error('[GatewayRPC] crons.enable failed:', error);
      throw error;
    }
  }

  /**
   * Disable a cron job
   */
  async cronsDisable(jobId: string): Promise<void> {
    try {
      await gatewayClient.request('crons.disable', { jobId });
    } catch (error) {
      logger.gateway.error('[GatewayRPC] crons.disable failed:', error);
      throw error;
    }
  }

  /**
   * Remove a cron job
   */
  async cronsRemove(jobId: string): Promise<void> {
    try {
      await gatewayClient.request('crons.remove', { jobId });
    } catch (error) {
      logger.gateway.error('[GatewayRPC] crons.remove failed:', error);
      throw error;
    }
  }

  /**
   * Run a cron job immediately
   */
  async cronsRun(jobId: string): Promise<void> {
    try {
      await gatewayClient.request('crons.run', { jobId });
    } catch (error) {
      logger.gateway.error('[GatewayRPC] crons.run failed:', error);
      throw error;
    }
  }

  // ============================================
  // Control Methods
  // ============================================

  /**
   * Get models status
   */
  async controlModelsStatus(): Promise<ModelsStatus[]> {
    try {
      const response = await gatewayClient.request<{ models: ModelsStatus[] }>('control.modelsStatus');
      return response?.models || [];
    } catch (error) {
      logger.gateway.error('[GatewayRPC] control.modelsStatus failed:', error);
      throw error;
    }
  }

  /**
   * Check skills
   */
  async controlSkillsCheck(): Promise<CheckResult[]> {
    try {
      const response = await gatewayClient.request<{ results: CheckResult[] }>('control.skillsCheck');
      return response?.results || [];
    } catch (error) {
      logger.gateway.error('[GatewayRPC] control.skillsCheck failed:', error);
      throw error;
    }
  }

  /**
   * Run doctor diagnostics
   */
  async controlDoctor(): Promise<DoctorResult> {
    try {
      const response = await gatewayClient.request<DoctorResult>('control.doctor');
      return response;
    } catch (error) {
      logger.gateway.error('[GatewayRPC] control.doctor failed:', error);
      throw error;
    }
  }

  /**
   * Run doctor repair
   */
  async controlDoctorRepair(): Promise<void> {
    try {
      await gatewayClient.request('control.doctorRepair');
    } catch (error) {
      logger.gateway.error('[GatewayRPC] control.doctorRepair failed:', error);
      throw error;
    }
  }

  /**
   * Get logs
   */
  async controlLogs(limit = 100): Promise<string> {
    try {
      const response = await gatewayClient.request<{ logs: string }>('control.logs', { limit });
      return response?.logs || '';
    } catch (error) {
      logger.gateway.error('[GatewayRPC] control.logs failed:', error);
      throw error;
    }
  }

  /**
   * Backup config
   */
  async controlConfigBackup(): Promise<void> {
    try {
      await gatewayClient.request('control.configBackup');
    } catch (error) {
      logger.gateway.error('[GatewayRPC] control.configBackup failed:', error);
      throw error;
    }
  }

  /**
   * Rollback config
   */
  async controlConfigRollback(): Promise<void> {
    try {
      await gatewayClient.request('control.configRollback');
    } catch (error) {
      logger.gateway.error('[GatewayRPC] control.configRollback failed:', error);
      throw error;
    }
  }

  // ============================================
  // Provider Methods
  // ============================================

  /**
   * List providers
   */
  async providersList(): Promise<{ id: string; name: string; hasApiKey: boolean; defaultModel?: string }[]> {
    try {
      const response = await gatewayClient.request<{ providers: { id: string; name: string; hasApiKey: boolean; defaultModel?: string }[] }>('provider.list');
      return response?.providers || [];
    } catch (error) {
      logger.gateway.error('[GatewayRPC] provider.list failed:', error);
      throw error;
    }
  }

  /**
   * Validate provider key
   */
  async providersValidateKey(providerId: string, apiKey: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const response = await gatewayClient.request<{ valid: boolean; error?: string }>('provider.validateKey', { providerId, apiKey });
      return response || { valid: false, error: 'Unknown error' };
    } catch (error) {
      logger.gateway.error('[GatewayRPC] provider.validateKey failed:', error);
      throw error;
    }
  }

  // ============================================
  // Event Subscriptions
  // ============================================

  /**
   * Subscribe to chat delta events
   */
  onChatDelta(handler: (data: { sessionId: string; delta: string; final?: boolean }) => void): void {
    gatewayClient.on('chat.delta', handler);
  }

  /**
   * Subscribe to chat final events
   */
  onChatFinal(handler: (data: { sessionId: string; message: string }) => void): void {
    gatewayClient.on('chat.final', handler);
  }

  /**
   * Subscribe to agent typing events
   */
  onAgentTyping(handler: (data: { sessionId: string }) => void): void {
    gatewayClient.on('agent_typing', handler);
  }

  /**
   * Subscribe to tick events
   */
  onTick(handler: (data: { timestamp: number }) => void): void {
    gatewayClient.on('tick', handler);
  }

  /**
   * Unsubscribe from chat events
   */
  offChatDelta(handler: (data: { sessionId: string; delta: string; final?: boolean }) => void): void {
    gatewayClient.off('chat.delta', handler);
  }

  /**
   * Unsubscribe from chat final events
   */
  offChatFinal(handler: (data: { sessionId: string; message: string }) => void): void {
    gatewayClient.off('chat.final', handler);
  }
}

// Export singleton instance
export const gatewayRPC = new GatewayRPC();
export default gatewayRPC;
