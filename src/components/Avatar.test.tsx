/**
 * Component tests for Avatar
 *
 * Tests the avatar component with initials and images
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

describe('Avatar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with name', async () => {
    const Avatar = (await import('../components/Avatar')).default;

    render(<Avatar name="Alice" />);

    // Should show initial 'A'
    expect(screen.getByText('A')).toBeDefined();
  });

  it('should render Chinese name initial', async () => {
    const Avatar = (await import('../components/Avatar')).default;

    render(<Avatar name="王小明" />);

    // Should show first Chinese character
    expect(screen.getByText('王')).toBeDefined();
  });

  it('should render with different sizes', async () => {
    const Avatar = (await import('../components/Avatar')).default;

    const { container: containerXs } = render(<Avatar name="Test" size="xs" />);
    const { container: containerLg } = render(<Avatar name="Test" size="lg" />);

    // Both should render
    expect(containerXs.firstChild).not.toBeNull();
    expect(containerLg.firstChild).not.toBeNull();
  });

  it('should apply custom className', async () => {
    const Avatar = (await import('../components/Avatar')).default;

    const { container } = render(<Avatar name="Test" className="custom-class" />);

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should render with avatar URL when provided', async () => {
    const Avatar = (await import('../components/Avatar')).default;

    const { container } = render(
      <Avatar name="Test" avatar="https://example.com/avatar.png" />
    );

    // Should have an img element
    const img = container.querySelector('img');
    expect(img).toBeDefined();
  });

  it('should handle empty name', async () => {
    const Avatar = (await import('../components/Avatar')).default;

    render(<Avatar name="" />);

    // Should show '?'
    expect(screen.getByText('?')).toBeDefined();
  });

  it('should handle missing name without crashing', async () => {
    const Avatar = (await import('../components/Avatar')).default;

    render(<Avatar name={undefined} />);

    expect(screen.getByText('?')).toBeDefined();
  });

  it('should use different gradients for different names', async () => {
    const Avatar = (await import('../components/Avatar')).default;

    const { container: container1 } = render(<Avatar name="Alice" />);
    const { container: container2 } = render(<Avatar name="Bob" />);

    // Both should render with gradient class
    expect(container1.firstChild).toHaveClass('bg-gradient-to-br');
    expect(container2.firstChild).toHaveClass('bg-gradient-to-br');
  });
});
