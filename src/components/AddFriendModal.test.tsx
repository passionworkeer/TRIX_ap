/**
 * Component tests for AddFriendModal
 *
 * Tests the modal for sending friend requests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

describe('AddFriendModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export the component', async () => {
    const module = await import('../components/AddFriendModal');
    expect(module.default).toBeDefined();
  });
});
