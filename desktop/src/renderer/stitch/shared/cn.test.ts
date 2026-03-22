/**
 * Unit tests for stitch/shared/cn.ts — className utilities
 */
import { describe, expect, it } from 'vitest';
import { cn, mergeClasses } from './cn';

describe('cn()', () => {
  it('returns empty string for no args', () => {
    expect(cn()).toBe('');
  });

  it('filters out null and undefined', () => {
    expect(cn('foo', undefined, 'bar', null)).toBe('foo bar');
  });

  it('filters out false and 0 and empty string', () => {
    expect(cn('foo', false, 'bar', 0, '')).toBe('foo bar');
  });

  it('keeps all truthy strings', () => {
    expect(cn('foo', 'bar', 'baz')).toBe('foo bar baz');
  });

  it('handles single string', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('joins strings as-is without trimming inner spaces', () => {
    // cn() just joins with single space, no trimming
    expect(cn('  foo  ', 'bar')).toBe('  foo   bar');
  });

  it('can be used for conditional Tailwind classes', () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn('btn', isActive && 'btn-active', isDisabled && 'btn-disabled'))
      .toBe('btn btn-active');
  });
});

describe('mergeClasses()', () => {
  it('returns empty string for no args', () => {
    expect(mergeClasses()).toBe('');
  });

  it('filters out falsy values', () => {
    expect(mergeClasses('foo', undefined, 'bar', null)).toBe('foo bar');
  });

  it('deduplicates classes using Set', () => {
    expect(mergeClasses('foo bar', 'bar baz', 'foo')).toBe('foo bar baz');
  });

  it('preserves order of first occurrence', () => {
    const result = mergeClasses('a b c', 'c b a');
    expect(result).toBe('a b c');
  });

  it('deduplicates but keeps first occurrence', () => {
    // Set preserves insertion order: flex, gap-2, gap-4, p-4, flex, p-0
    // Set dedup = flex, gap-2, gap-4, p-4, p-0
    expect(mergeClasses('flex gap-2', 'gap-4 p-4', 'flex p-0'))
      .toBe('flex gap-2 gap-4 p-4 p-0');
  });

  it('filters empty strings from split', () => {
    expect(mergeClasses('  foo   bar  ')).toBe('foo bar');
  });
});
