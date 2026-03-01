/**
 * Component tests for MailPanel
 *
 * Tests the email panel for viewing messages
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

describe('MailPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export the component', async () => {
    const module = await import('../components/MailPanel');
    expect(module.default).toBeDefined();
  });
});
