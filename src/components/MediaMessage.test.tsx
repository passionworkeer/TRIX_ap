/**
 * Component tests for MediaMessage
 *
 * Tests media message renders (image/video types)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

const createObjectURLMock = vi.fn(() => 'blob:video-fallback');
const revokeObjectURLMock = vi.fn();

describe('MediaMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      value: createObjectURLMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      value: revokeObjectURLMock,
    });
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
    expect(img?.getAttribute('loading')).toBe('eager');
    expect(img?.getAttribute('fetchpriority')).toBe('high');
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

  it('should abort video fallback fetch on unmount', async () => {
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {}));
    const { MediaMessage } = await import('./MediaMessage');

    const { container, unmount } = render(
      <MediaMessage uri="https://example.com/video.mp4" type="video" />
    );

    const video = container.querySelector('video');
    expect(video).toBeTruthy();

    fireEvent.error(video!);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    const [, options] = vi.mocked(fetch).mock.calls[0]!;
    const signal = options?.signal as AbortSignal;
    expect(signal.aborted).toBe(false);

    unmount();

    expect(signal.aborted).toBe(true);
  });

  it('should switch video source to blob fallback after fetch succeeds', async () => {
    const blob = new Blob(['video-bytes'], { type: 'video/mp4' });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(blob),
    } as any);

    const { MediaMessage } = await import('./MediaMessage');
    const { container } = render(
      <MediaMessage uri="https://example.com/video.mp4" type="video" thumbnail="https://example.com/thumb.jpg" />
    );

    const video = container.querySelector('video');
    expect(video).toBeTruthy();
    expect(video?.getAttribute('poster')).toBe('https://example.com/thumb.jpg');

    fireEvent.error(video!);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('https://example.com/video.mp4', expect.objectContaining({
        signal: expect.any(AbortSignal),
      }));
      expect(createObjectURLMock).toHaveBeenCalledWith(blob);
      expect(container.querySelector('video')?.getAttribute('src')).toContain('blob:video-fallback');
    });

    expect(screen.queryByText('加载失败')).not.toBeInTheDocument();
  });

  it('should show error UI when video fallback fetch fails', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      blob: vi.fn(),
    } as any);

    const { MediaMessage } = await import('./MediaMessage');
    const { container } = render(
      <MediaMessage uri="https://example.com/video.mp4" type="video" />
    );

    const video = container.querySelector('video');
    expect(video).toBeTruthy();

    fireEvent.error(video!);

    await waitFor(() => {
      expect(screen.getByText('加载失败')).toBeInTheDocument();
    });

    expect(createObjectURLMock).not.toHaveBeenCalled();
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
