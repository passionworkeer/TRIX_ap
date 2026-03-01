/**
 * Unit tests for pairing toast utilities
 */
import { describe, it, expect } from 'vitest';
import {
  PAIRING_REQUIRED_TOAST_ID,
  PAIRING_REQUIRED_TOAST_MESSAGE,
  PAIRING_REQUIRED_TOAST_OPTIONS,
} from '../../src/utils/pairingToast';

describe('pairingToast utilities', () => {
  describe('PAIRING_REQUIRED_TOAST_ID', () => {
    it('should export a string constant', () => {
      expect(typeof PAIRING_REQUIRED_TOAST_ID).toBe('string');
    });

    it('should have the correct value', () => {
      expect(PAIRING_REQUIRED_TOAST_ID).toBe('pairing-required');
    });
  });

  describe('PAIRING_REQUIRED_TOAST_MESSAGE', () => {
    it('should export a string constant', () => {
      expect(typeof PAIRING_REQUIRED_TOAST_MESSAGE).toBe('string');
    });

    it('should have the correct value', () => {
      expect(PAIRING_REQUIRED_TOAST_MESSAGE).toBe('请先完成 TRIX Bot 配对');
    });

    it('should not be empty', () => {
      expect(PAIRING_REQUIRED_TOAST_MESSAGE.length).toBeGreaterThan(0);
    });
  });

  describe('PAIRING_REQUIRED_TOAST_OPTIONS', () => {
    it('should export an object', () => {
      expect(typeof PAIRING_REQUIRED_TOAST_OPTIONS).toBe('object');
    });

    it('should have the correct id property', () => {
      expect(PAIRING_REQUIRED_TOAST_OPTIONS.id).toBe(PAIRING_REQUIRED_TOAST_ID);
    });

    it('should have the correct duration property', () => {
      expect(PAIRING_REQUIRED_TOAST_OPTIONS.duration).toBe(1600);
    });

    it('should have numeric duration', () => {
      expect(PAIRING_REQUIRED_TOAST_OPTIONS.duration).toBeTypeOf('number');
    });

    it('should have id as string', () => {
      expect(PAIRING_REQUIRED_TOAST_OPTIONS.id).toBeTypeOf('string');
    });

    it('should have expected structure matching ToastOptions', () => {
      const options = PAIRING_REQUIRED_TOAST_OPTIONS;
      expect(options).toHaveProperty('id');
      expect(options).toHaveProperty('duration');
      expect(Object.keys(options).length).toBe(2);
    });
  });
});
