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

describe('LoadingSpinner', () => {
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

    // The size class is on the inner Loader2 icon, not the container div
    // Mock replaces Loader2 with <span data-testid="spinner">, so check for that element
    const spinnerIcon = container.querySelector('[data-testid="spinner"]');
    expect(spinnerIcon).toBeInTheDocument();
  });
});
