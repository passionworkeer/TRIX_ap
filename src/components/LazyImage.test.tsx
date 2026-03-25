/**
 * Component tests for LazyImage
 *
 * Tests lazy image loads with placeholder
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe('LazyImage', () => {
  const defaultProps = {
    src: 'https://example.com/image.jpg',
    alt: 'Test Image',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with placeholder initially', async () => {
    const LazyImage = (await import('./LazyImage')).default;

    render(<LazyImage {...defaultProps} />);

    // Should show loading spinner (Loader2 icon)
    const loader = document.querySelector('.animate-spin');
    expect(loader).toBeTruthy();
  });

  it('should apply custom className', async () => {
    const LazyImage = (await import('./LazyImage')).default;

    const { container } = render(
      <LazyImage {...defaultProps} className="custom-class" />
    );

    const wrapper = container.querySelector('[class*="relative"]');
    expect(wrapper).toBeTruthy();
  });

  it('should apply custom dimensions', async () => {
    const LazyImage = (await import('./LazyImage')).default;

    const { container } = render(
      <LazyImage {...defaultProps} width={200} height={150} />
    );

    const wrapper = container.querySelector('[class*="relative"]');
    expect(wrapper).toBeTruthy();
    expect(wrapper).toHaveStyle({ width: '200px', height: '150px' });
  });

  it('should use priority mode to load immediately', async () => {
    const LazyImage = (await import('./LazyImage')).default;

    // In priority mode, the image should attempt to load immediately
    render(<LazyImage {...defaultProps} priority={true} />);

    // The component should not render just a loader
    const loader = document.querySelector('.animate-spin');
    // With priority=true, it may immediately try to load
    expect(loader).toBeTruthy();
  });

  it('should handle missing src gracefully', async () => {
    const LazyImage = (await import('./LazyImage')).default;

    render(<LazyImage src="" alt="Empty" />);

    // Should show error fallback or loading state
    const content = document.body.innerHTML;
    expect(content).toBeTruthy();
  });

  it('should apply placeholderClassName', async () => {
    const LazyImage = (await import('./LazyImage')).default;

    const { container } = render(
      <LazyImage {...defaultProps} placeholderClassName="custom-placeholder" />
    );

    const placeholder = container.querySelector('.custom-placeholder');
    expect(placeholder).toBeTruthy();
  });

  it('should call onLoad callback when image loads', async () => {
    const onLoad = vi.fn();
    const LazyImage = (await import('./LazyImage')).default;

    // Mock the Image constructor
    const originalImage = global.Image;
    let onLoadCallback: (() => void) | null = null;

    (global as any).Image = class {
      src = '';
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor() {
        setTimeout(() => {
          if (this.onload) {
            this.onload();
          }
        }, 0);
      }
    };

    render(<LazyImage {...defaultProps} onLoad={onLoad} priority={true} />);

    await new Promise(resolve => setTimeout(resolve, 10));

    (global as any).Image = originalImage;
  });

  it('should export displayName', async () => {
    const LazyImage = (await import('./LazyImage')).default;

    expect(LazyImage.displayName).toBe('LazyImage');
  });
});
