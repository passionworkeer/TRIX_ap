/**
 * Component tests for PlacePopupContent
 *
 * Tests PlacePopupContent renders place info
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

describe('PlacePopupContent', () => {
  const defaultProps = {
    place: {
      name: 'Test Restaurant',
      type: 'dining' as const,
      emoji: '🍜',
      description: 'A great restaurant',
      openHours: '9:00 - 22:00',
    },
    onNavigate: vi.fn(),
    onFavorite: vi.fn(),
    isFavorite: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render place name', async () => {
    const PlacePopupContent = (await import('./PlacePopupContent')).default;

    render(<PlacePopupContent {...defaultProps} />);

    expect(screen.getByText('Test Restaurant')).toBeInTheDocument();
  });

  it('should render emoji', async () => {
    const PlacePopupContent = (await import('./PlacePopupContent')).default;

    render(<PlacePopupContent {...defaultProps} />);

    expect(screen.getByText('🍜')).toBeInTheDocument();
  });

  it('should render description', async () => {
    const PlacePopupContent = (await import('./PlacePopupContent')).default;

    render(<PlacePopupContent {...defaultProps} />);

    expect(screen.getByText('A great restaurant')).toBeInTheDocument();
  });

  it('should render type label for dining', async () => {
    const PlacePopupContent = (await import('./PlacePopupContent')).default;

    render(<PlacePopupContent {...defaultProps} />);

    expect(screen.getByText('🍽️ 餐饮')).toBeInTheDocument();
  });

  it('should render type label for entertainment', async () => {
    const PlacePopupContent = (await import('./PlacePopupContent')).default;

    render(
      <PlacePopupContent
        {...defaultProps}
        place={{ ...defaultProps.place, type: 'entertainment' as const, emoji: '🎬' }}
      />
    );

    expect(screen.getByText('🎬 娱乐')).toBeInTheDocument();
  });

  it('should render type label for study', async () => {
    const PlacePopupContent = (await import('./PlacePopupContent')).default;

    render(
      <PlacePopupContent
        {...defaultProps}
        place={{ ...defaultProps.place, type: 'study' as const, emoji: '📚' }}
      />
    );

    expect(screen.getByText('📚 学习')).toBeInTheDocument();
  });

  it('should render open hours', async () => {
    const PlacePopupContent = (await import('./PlacePopupContent')).default;

    render(<PlacePopupContent {...defaultProps} />);

    expect(screen.getByText('9:00 - 22:00')).toBeInTheDocument();
  });

  it('should render navigate button when onNavigate is provided', async () => {
    const PlacePopupContent = (await import('./PlacePopupContent')).default;

    render(<PlacePopupContent {...defaultProps} />);

    const navButton = screen.getByRole('button', { name: /导航/ });
    expect(navButton).toBeInTheDocument();
  });

  it('should call onNavigate when navigate button is clicked', async () => {
    const PlacePopupContent = (await import('./PlacePopupContent')).default;

    render(<PlacePopupContent {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /导航/ }));

    expect(defaultProps.onNavigate).toHaveBeenCalled();
  });

  it('should render favorite button when onFavorite is provided', async () => {
    const PlacePopupContent = (await import('./PlacePopupContent')).default;

    render(<PlacePopupContent {...defaultProps} />);

    const favButton = screen.getByRole('button', { name: /收藏/ });
    expect(favButton).toBeInTheDocument();
  });

  it('should call onFavorite when favorite button is clicked', async () => {
    const PlacePopupContent = (await import('./PlacePopupContent')).default;

    render(<PlacePopupContent {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /收藏/ }));

    expect(defaultProps.onFavorite).toHaveBeenCalled();
  });

  it('should show "已收藏" when isFavorite is true', async () => {
    const PlacePopupContent = (await import('./PlacePopupContent')).default;

    render(<PlacePopupContent {...defaultProps} isFavorite={true} />);

    expect(screen.getByText('已收藏')).toBeInTheDocument();
  });

  it('should render star rating', async () => {
    const PlacePopupContent = (await import('./PlacePopupContent')).default;

    render(<PlacePopupContent {...defaultProps} />);

    expect(screen.getByText('4.5')).toBeInTheDocument();
  });

  it('should render distance', async () => {
    const PlacePopupContent = (await import('./PlacePopupContent')).default;

    render(<PlacePopupContent {...defaultProps} />);

    expect(screen.getByText('0.8km')).toBeInTheDocument();
  });
});
