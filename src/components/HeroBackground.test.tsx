/**
 * Component tests for HeroBackground
 *
 * Tests the hero background component
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

describe('HeroBackground', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export component', async () => {
    const module = await import('../components/HeroBackground');
    expect(module.default).toBeDefined();
  });
});
