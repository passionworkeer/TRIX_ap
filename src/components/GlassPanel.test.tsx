/**
 * Component tests for GlassPanel
 *
 * Tests the glassmorphism panel component
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

describe('GlassPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render children', async () => {
    const GlassPanel = (await import('../components/GlassPanel')).default;

    render(
      <GlassPanel>
        <div>Test Content</div>
      </GlassPanel>
    );

    expect(screen.getByText('Test Content')).toBeDefined();
  });

  it('should apply custom className', async () => {
    const GlassPanel = (await import('../components/GlassPanel')).default;

    const { container } = render(
      <GlassPanel className="custom-class">
        <div>Test</div>
      </GlassPanel>
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });
});
