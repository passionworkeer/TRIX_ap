/**
 * Component tests for OutfitPreview
 *
 * Tests the 3D outfit preview component
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock canvas elements (since this is a 3D component)
describe('OutfitPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export component', async () => {
    const module = await import('../components/OutfitPreview');
    expect(module.default).toBeDefined();
  });
});
