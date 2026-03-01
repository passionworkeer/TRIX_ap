/**
 * Component tests for OutfitCard
 *
 * Tests the outfit equipment card component
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock constants
vi.mock('../constants', () => ({
  IMAGES: {
    CLOTHES_HAT: '/fallback/hat.png',
    CLOTHES_CAPE: '/fallback/cape.png',
    CLOTHES_WAND: '/fallback/wand.png',
  },
}));

describe('OutfitCard', () => {
  const mockOutfit = {
    id: 'outfit-1',
    name: 'Test Outfit',
    category: 'hat' as const,
    image: '/outfit/image.png',
    previewImage: '/outfit/preview.png',
    price: 100,
    isOwned: true,
    isEquipped: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render outfit name', async () => {
    const OutfitCard = (await import('../components/OutfitCard')).default;

    render(
      <OutfitCard
        outfit={mockOutfit}
        onEquipToggle={() => {}}
      />
    );

    expect(screen.getByText('Test Outfit')).toBeDefined();
  });

  it('should show "装备" button when not equipped', async () => {
    const OutfitCard = (await import('../components/OutfitCard')).default;

    render(
      <OutfitCard
        outfit={mockOutfit}
        onEquipToggle={() => {}}
      />
    );

    expect(screen.getByText('装备')).toBeDefined();
  });

  it('should show "卸下" button when equipped', async () => {
    const OutfitCard = (await import('../components/OutfitCard')).default;

    const equippedOutfit = { ...mockOutfit, isEquipped: true };

    render(
      <OutfitCard
        outfit={equippedOutfit}
        onEquipToggle={() => {}}
      />
    );

    expect(screen.getByText('卸下')).toBeDefined();
  });

  it('should show "未拥有" badge when not owned', async () => {
    const OutfitCard = (await import('../components/OutfitCard')).default;

    const unownedOutfit = { ...mockOutfit, isOwned: false };

    render(
      <OutfitCard
        outfit={unownedOutfit}
        onEquipToggle={() => {}}
      />
    );

    expect(screen.getByText('未拥有')).toBeDefined();
  });

  it('should show "已装备" badge when equipped', async () => {
    const OutfitCard = (await import('../components/OutfitCard')).default;

    const equippedOutfit = { ...mockOutfit, isEquipped: true };

    render(
      <OutfitCard
        outfit={equippedOutfit}
        onEquipToggle={() => {}}
      />
    );

    expect(screen.getByText('已装备')).toBeDefined();
  });

  it('should call onEquipToggle when button is clicked', async () => {
    const OutfitCard = (await import('../components/OutfitCard')).default;
    const onEquipToggle = vi.fn();

    render(
      <OutfitCard
        outfit={mockOutfit}
        onEquipToggle={onEquipToggle}
      />
    );

    const equipButton = screen.getByText('装备');
    fireEvent.click(equipButton);

    expect(onEquipToggle).toHaveBeenCalled();
  });

  it('should show loading state when loading', async () => {
    const OutfitCard = (await import('../components/OutfitCard')).default;

    render(
      <OutfitCard
        outfit={mockOutfit}
        onEquipToggle={() => {}}
        loading={true}
      />
    );

    expect(screen.getByText('处理中')).toBeDefined();
  });

  it('should disable button when not owned', async () => {
    const OutfitCard = (await import('../components/OutfitCard')).default;
    const onEquipToggle = vi.fn();

    const unownedOutfit = { ...mockOutfit, isOwned: false };

    render(
      <OutfitCard
        outfit={unownedOutfit}
        onEquipToggle={onEquipToggle}
      />
    );

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should apply ring style when equipped', async () => {
    const OutfitCard = (await import('../components/OutfitCard')).default;

    const equippedOutfit = { ...mockOutfit, isEquipped: true };

    const { container } = render(
      <OutfitCard
        outfit={equippedOutfit}
        onEquipToggle={() => {}}
      />
    );

    expect(container.firstChild).toHaveClass('ring-2');
  });
});
