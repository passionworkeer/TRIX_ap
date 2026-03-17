import { describe, it, expect } from 'vitest';
import { escapeHtml, escapeUrl } from '../utils/escapeHtml';

describe('escapeHtml', () => {
  it('should escape HTML special characters', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    expect(escapeHtml('&amp;')).toBe('&amp;amp;');
    // Note: textContent/innerHTML does not escape double quotes
    expect(escapeHtml('"quotes"')).toBe('"quotes"');
    expect(escapeHtml("'single'")).toBe("'single'");
  });

  it('should not escape normal text', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
    expect(escapeHtml('你好')).toBe('你好');
  });

  it('should handle empty string', () => {
    expect(escapeHtml('')).toBe('');
  });
});

describe('escapeUrl', () => {
  it('should encode URL special characters', () => {
    expect(escapeUrl('hello world')).toBe('hello%20world');
    expect(escapeUrl('a=b&c=d')).toBe('a%3Db%26c%3Dd');
  });

  it('should handle empty string', () => {
    expect(escapeUrl('')).toBe('');
  });
});
