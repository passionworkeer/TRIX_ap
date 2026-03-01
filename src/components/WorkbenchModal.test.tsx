/**
 * Component tests for WorkbenchModal
 *
 * Tests the workbench modal with feature cards
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

describe('WorkbenchModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export the component', async () => {
    const module = await import('../components/WorkbenchModal');
    expect(module.default).toBeDefined();
  });
});
