/**
 * Component tests for LoadingSpinner
 *
 * Tests the loading spinner component
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock lucide-react
vi.mock('lucide-react', () => ({
  Loader2: () => <span data-testid="spinner">Loading...</span>,
}));

describe.skip('LoadingSpinner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render', async () => {
    const LoadingSpinner = (await import('../components/LoadingSpinner')).default;

    const { container } = render(<LoadingSpinner />);

    expect(container.firstChild).not.toBeNull();
  });

  it('should apply size class', async () => {
    const LoadingSpinner = (await import('../components/LoadingSpinner')).default;

    const { container } = render(<LoadingSpinner size="lg" />);

    expect(container.firstChild).toHaveClass('w-8');
  });
});
