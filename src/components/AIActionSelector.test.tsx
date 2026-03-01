/**
 * Component tests for AIActionSelector
 *
 * Tests the horizontal scrollable AI action selector
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

describe('AIActionSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export the component', async () => {
    const module = await import('../components/AIActionSelector');
    expect(module.default).toBeDefined();
  });
});
