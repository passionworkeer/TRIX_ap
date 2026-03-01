/**
 * Component tests for GlassDock
 *
 * Tests the glassmorphism dock component
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

describe('GlassDock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export component', async () => {
    const module = await import('../components/GlassDock');
    expect(module.default).toBeDefined();
  });
});
