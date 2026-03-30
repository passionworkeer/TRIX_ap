/**
 * Component tests for HeroBackground
 *
 * Tests the hero background component
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

describe('HeroBackground', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  });

  it('should export component', async () => {
    const module = await import('../components/HeroBackground');
    expect(module.default).toBeDefined();
  });

  it('should avoid preloading the hidden video layer on first render', async () => {
    const module = await import('../components/HeroBackground');
    const HeroBackground = module.default;

    const { container } = render(<HeroBackground botState="IDLE" force3D={false} />);

    const activeLayer = container.querySelector<HTMLVideoElement>('[data-hero-video-layer="0"]');
    const hiddenLayer = container.querySelector<HTMLVideoElement>('[data-hero-video-layer="1"]');

    expect(activeLayer?.getAttribute('src')).toContain('/videos/role1/idle.mp4');
    expect(activeLayer?.getAttribute('preload')).toBe('auto');
    expect(hiddenLayer?.getAttribute('src')).toBeNull();
    expect(hiddenLayer?.getAttribute('preload')).toBe('none');
  });
});
