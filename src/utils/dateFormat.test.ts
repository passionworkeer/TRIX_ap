/**
 * Unit tests for date formatting utilities
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatTime,
  formatRelative,
  isToday,
  formatSmart,
} from '../../src/utils/dateFormat';

describe('dateFormat utilities', () => {
  describe('formatTime', () => {
    it('should format ISO string to HH:MM format', () => {
      const isoString = '2026-02-22T14:30:00.000Z';
      const result = formatTime(isoString);

      // Result depends on timezone, but should contain hour and minute
      expect(result).toMatch(/\d{2}:\d{2}/);
    });

    it('should format Date object to HH:MM format', () => {
      const date = new Date('2026-02-22T09:05:00.000Z');
      const result = formatTime(date);

      expect(result).toMatch(/\d{2}:\d{2}/);
    });

    it('should handle different time values', () => {
      const midnight = new Date('2026-02-22T00:00:00.000Z');
      const noon = new Date('2026-02-22T12:00:00.000Z');
      const evening = new Date('2026-02-22T23:59:00.000Z');

      expect(formatTime(midnight)).toMatch(/\d{2}:\d{2}/);
      expect(formatTime(noon)).toMatch(/\d{2}:\d{2}/);
      expect(formatTime(evening)).toMatch(/\d{2}:\d{2}/);
    });
  });

  describe('formatRelative', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-22T12:00:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return "now" for messages less than 1 minute old', () => {
      const timestamp = '2026-02-22T11:59:30.000Z';
      expect(formatRelative(timestamp)).toBe('now');
    });

    it('should return "Xm" for messages less than 1 hour old', () => {
      const timestamp = '2026-02-22T11:30:00.000Z';
      expect(formatRelative(timestamp)).toBe('30m');
    });

    it('should return "Xh" for messages less than 24 hours old', () => {
      const timestamp = '2026-02-22T08:00:00.000Z';
      expect(formatRelative(timestamp)).toBe('4h');
    });

    it('should return "Xd" for messages less than 7 days old', () => {
      const timestamp = '2026-02-20T12:00:00.000Z';
      expect(formatRelative(timestamp)).toBe('2d');
    });

    it('should return "Xw" for messages 7+ days old', () => {
      const timestamp = '2026-02-10T12:00:00.000Z';
      expect(formatRelative(timestamp)).toBe('1w');
    });

    it('should return empty string for null timestamp', () => {
      expect(formatRelative(null)).toBe('');
    });

    it('should handle Date objects', () => {
      const date = new Date('2026-02-22T11:45:00.000Z');
      expect(formatRelative(date)).toBe('15m');
    });

    it('should handle future timestamps gracefully', () => {
      const future = '2026-02-22T13:00:00.000Z';
      // Future timestamps result in negative diffs, still returns something
      const result = formatRelative(future);
      expect(typeof result).toBe('string');
    });
  });

  describe('isToday', () => {
    it('should return true for current time', () => {
      const now = new Date();
      expect(isToday(now)).toBe(true);
    });

    it('should return false for yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(isToday(yesterday)).toBe(false);
    });

    it('should return false for tomorrow', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(isToday(tomorrow)).toBe(false);
    });

    it('should accept ISO string input', () => {
      const now = new Date();
      const todayStr = now.toISOString();
      expect(isToday(todayStr)).toBe(true);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(isToday(yesterday.toISOString())).toBe(false);
    });
  });

  describe('formatSmart', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-22T12:00:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should show time for today', () => {
      const today = '2026-02-22T09:30:00.000Z';
      expect(formatSmart(today)).toMatch(/\d{2}:\d{2}/);
    });

    it('should show "昨天" for yesterday', () => {
      const yesterday = '2026-02-21T12:00:00.000Z';
      expect(formatSmart(yesterday)).toBe('昨天');
    });

    it('should show weekday for dates within a week', () => {
      // 2026-02-22 is Sunday, 2026-02-18 was Wednesday
      const wednesday = '2026-02-18T12:00:00.000Z';
      const result = formatSmart(wednesday);
      expect(['周一', '周二', '周三', '周四', '周五', '周六', '周日']).toContain(result);
    });

    it('should show date for dates older than a week', () => {
      const oldDate = '2026-02-10T12:00:00.000Z';
      const result = formatSmart(oldDate);
      // Should be in M/D format
      expect(result).toMatch(/\d{1,2}\/\d{1,2}/);
    });

    it('should accept Date objects', () => {
      const date = new Date('2026-02-21T12:00:00.000Z');
      expect(formatSmart(date)).toBe('昨天');
    });
  });
});
