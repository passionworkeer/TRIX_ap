/**
 * Component tests for MediaMessage
 *
 * Tests media message renders (image/video types)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    media: {
      debug: vi.fn(),
      error: vi.fn(),
    },
    debug: vi.fn(),
  },
}));

describe('MediaMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render image media correctly', async () => {
    const { MediaMessage } = await import('./MediaMessage');

    render(
      <MediaMessage
        uri="https://example.com/image.jpg"
        type="image"
        alt="Test Image"
      />
    );

    const img = document.querySelector('img');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('alt')).toBe('Test Image');
  });

  it('should render video media correctly', async () => {
    const { MediaMessage } = await import('./MediaMessage');

    render(
      <MediaMessage
        uri="https://example.com/video.mp4"
        type="video"
      />
    );

    const video = document.querySelector('video');
    expect(video).toBeTruthy();
  });

  it('should apply maxSize class correctly', async () => {
    const { MediaMessage } = await import('./MediaMessage');

    const { container: smContainer } = render(
      <MediaMessage uri="test.jpg" type="image" maxSize="sm" />
    );
    expect(smContainer.querySelector('.max-w-\\[120px\\]')).toBeTruthy();

    const { container: lgContainer } = render(
      <MediaMessage uri="test.jpg" type="image" maxSize="lg" />
    );
    expect(lgContainer.querySelector('.max-w-\\[280px\\]')).toBeTruthy();
  });

  it('should apply custom className', async () => {
    const { MediaMessage } = await import('./MediaMessage');

    const { container } = render(
      <MediaMessage uri="test.jpg" type="image" className="custom-class" />
    );

    const wrapper = container.querySelector('.custom-class');
    expect(wrapper).toBeTruthy();
  });

  it('should show loading skeleton for image', async () => {
    const { MediaMessage } = await import('./MediaMessage');

    const { container } = render(
      <MediaMessage uri="https://example.com/image.jpg" type="image" />
    );

    // Should show loading skeleton with ImageIcon
    const skeleton = container.querySelector('.animate-pulse');
    expect(skeleton).toBeTruthy();
  });

  it('should show loading skeleton for video', async () => {
    const { MediaMessage } = await import('./MediaMessage');

    const { container } = render(
      <MediaMessage uri="https://example.com/video.mp4" type="video" />
    );

    // Should show loading skeleton
    const skeleton = container.querySelector('.animate-pulse');
    expect(skeleton).toBeTruthy();
  });

  it('should render MediaMessageInline for image type', async () => {
    const { MediaMessageInline } = await import('./MediaMessage');

    render(
      <MediaMessageInline uri="https://example.com/thumb.jpg" type="image" />
    );

    const img = document.querySelector('img');
    expect(img).toBeTruthy();
  });

  it('should render MediaMessageInline for video type', async () => {
    const { MediaMessageInline } = await import('./MediaMessage');

    render(
      <MediaMessageInline uri="https://example.com/thumb.mp4" type="video" />
    );

    const video = document.querySelector('video');
    expect(video).toBeTruthy();
  });

  it('should call onClick handler on MediaMessageInline image', async () => {
    const onClick = vi.fn();
    const { MediaMessageInline } = await import('./MediaMessage');

    render(
      <MediaMessageInline uri="https://example.com/thumb.jpg" type="image" onClick={onClick} />
    );

    const img = document.querySelector('img');
    if (img) {
      img.click();
      expect(onClick).toHaveBeenCalled();
    }
  });
});
