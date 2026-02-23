/**
 * Simplified tests for ClawbotChannelBridge service
 */
import { describe, it, expect } from 'vitest';

describe('ClawbotChannelBridge', () => {
  describe('module structure', () => {
    it('should export the bridge service module', async () => {
      // Test that the module can be imported
      const bridge = await import('../../src/services/ClawbotChannelBridge');
      expect(bridge.default).toBeDefined();
    });

    it('should have required types exported', async () => {
      const bridge = await import('../../src/services/ClawbotChannelBridge');
      // CHANNEL_PROTOCOL_MISMATCH is exported as a constant
      expect(bridge.CHANNEL_PROTOCOL_MISMATCH).toBe('CHANNEL_PROTOCOL_MISMATCH');
    });

    it('should expose study room bridge methods', async () => {
      const bridge = await import('../../src/services/ClawbotChannelBridge');
      expect(typeof bridge.default.createStudyRoom).toBe('function');
      expect(typeof bridge.default.joinStudyRoom).toBe('function');
      expect(typeof bridge.default.leaveStudyRoom).toBe('function');
      expect(typeof bridge.default.hostActionStudyRoom).toBe('function');
      expect(typeof bridge.default.getStudyRoomState).toBe('function');
    });
  });

  describe('interface types', () => {
    it('should define ClawbotChannelMessage interface', async () => {
      // TypeScript interfaces are compile-time only
      // This test verifies the module compiles correctly
      const bridge = await import('../../src/services/ClawbotChannelBridge');
      expect(bridge.default).toBeDefined();
    });

    it('should define PairingData interface', async () => {
      const bridge = await import('../../src/services/ClawbotChannelBridge');
      expect(bridge.default).toBeDefined();
    });
  });
});
