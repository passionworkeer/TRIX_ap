/**
 * Component tests for FilePicker
 *
 * Tests the file selection and preview UI component
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

describe('FilePicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export the component', async () => {
    const module = await import('../components/FilePicker');
    expect(module.default).toBeDefined();
  });
});
