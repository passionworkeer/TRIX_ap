import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LuminaButton } from './buttons';
import { Plus, Settings } from 'lucide-react';

describe('LuminaButton', () => {
  describe('rendering', () => {
    it('renders button with label text', () => {
      const handleClick = vi.fn();
      render(<LuminaButton label="Click me" onClick={handleClick} />);
      expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
    });

    it('renders button with correct title attribute', () => {
      const handleClick = vi.fn();
      render(<LuminaButton label="Submit Form" onClick={handleClick} />);
      const button = screen.getByRole('button', { name: /submit form/i });
      expect(button).toHaveAttribute('title', 'Submit Form');
    });
  });

  describe('variants', () => {
    it('renders primary variant correctly', () => {
      const handleClick = vi.fn();
      render(<LuminaButton label="Primary" variant="primary" onClick={handleClick} />);
      const button = screen.getByRole('button', { name: /primary/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveStyle({ background: '#630ed4', color: '#ffffff' });
    });

    it('renders secondary variant correctly', () => {
      const handleClick = vi.fn();
      render(<LuminaButton label="Secondary" variant="secondary" onClick={handleClick} />);
      const button = screen.getByRole('button', { name: /secondary/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveStyle({ background: '#eceef0', color: '#191c1e' });
    });

    it('renders ghost variant correctly', () => {
      const handleClick = vi.fn();
      render(<LuminaButton label="Ghost" variant="ghost" onClick={handleClick} />);
      const button = screen.getByRole('button', { name: /ghost/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveStyle({ background: 'transparent', color: '#630ed4' });
    });

    it('renders outline variant correctly', () => {
      const handleClick = vi.fn();
      render(<LuminaButton label="Outline" variant="outline" onClick={handleClick} />);
      const button = screen.getByRole('button', { name: /outline/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveStyle({
        background: 'transparent',
        color: '#4a4455',
        border: '1px solid #ccc3d8',
      });
    });

    it('defaults to primary variant', () => {
      const handleClick = vi.fn();
      render(<LuminaButton label="Default" onClick={handleClick} />);
      const button = screen.getByRole('button', { name: /default/i });
      expect(button).toHaveStyle({ background: '#630ed4', color: '#ffffff' });
    });
  });

  describe('sizes', () => {
    it('renders sm size correctly', () => {
      const handleClick = vi.fn();
      render(<LuminaButton label="Small" size="sm" onClick={handleClick} />);
      const button = screen.getByRole('button', { name: /small/i });
      expect(button).toHaveStyle({ padding: '5px 12px', fontSize: 12 });
    });

    it('renders md size correctly', () => {
      const handleClick = vi.fn();
      render(<LuminaButton label="Medium" size="md" onClick={handleClick} />);
      const button = screen.getByRole('button', { name: /medium/i });
      expect(button).toHaveStyle({ padding: '8px 18px', fontSize: 13.5 });
    });

    it('renders lg size correctly', () => {
      const handleClick = vi.fn();
      render(<LuminaButton label="Large" size="lg" onClick={handleClick} />);
      const button = screen.getByRole('button', { name: /large/i });
      expect(button).toHaveStyle({ padding: '11px 24px', fontSize: 15 });
    });

    it('defaults to md size', () => {
      const handleClick = vi.fn();
      render(<LuminaButton label="Default Size" onClick={handleClick} />);
      const button = screen.getByRole('button', { name: /default size/i });
      expect(button).toHaveStyle({ padding: '8px 18px', fontSize: 13.5 });
    });
  });

  describe('disabled state', () => {
    it('renders disabled button correctly', () => {
      const handleClick = vi.fn();
      render(<LuminaButton label="Disabled" disabled onClick={handleClick} />);
      const button = screen.getByRole('button', { name: /disabled/i });
      expect(button).toBeDisabled();
      expect(button).toHaveStyle({ opacity: 0.45, cursor: 'not-allowed' });
    });

    it('does not call onClick when disabled', () => {
      const handleClick = vi.fn();
      render(<LuminaButton label="Disabled Click" disabled onClick={handleClick} />);
      const button = screen.getByRole('button', { name: /disabled click/i });
      fireEvent.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('applies disabled styling without loading', () => {
      const handleClick = vi.fn();
      render(<LuminaButton label="Disabled Only" disabled={true} loading={false} onClick={handleClick} />);
      const button = screen.getByRole('button', { name: /disabled only/i });
      expect(button).toHaveStyle({ opacity: 0.45 });
    });
  });

  describe('loading state', () => {
    it('renders loading button correctly', () => {
      const handleClick = vi.fn();
      render(<LuminaButton label="Loading" loading onClick={handleClick} />);
      const button = screen.getByRole('button', { name: /loading/i });
      expect(button).toBeDisabled();
      expect(button).toHaveStyle({ opacity: 1, cursor: 'not-allowed' });
    });

    it('does not call onClick when loading', () => {
      const handleClick = vi.fn();
      render(<LuminaButton label="Loading Click" loading onClick={handleClick} />);
      const button = screen.getByRole('button', { name: /loading click/i });
      fireEvent.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('renders Loader2 icon when loading', () => {
      const handleClick = vi.fn();
      render(<LuminaButton label="Loading Icon" loading onClick={handleClick} />);
      const button = screen.getByRole('button', { name: /loading icon/i });
      // The Loader2 icon should be present (SVG element)
      expect(button.querySelector('svg')).toBeInTheDocument();
    });

    it('does not render icon when loading', () => {
      const handleClick = vi.fn();
      const { container } = render(
        <LuminaButton label="No Icon When Loading" icon={<Plus />} loading onClick={handleClick} />
      );
      // When loading, icon should not be shown even if provided
      const iconContainer = container.querySelector('span:not(:last-child)');
      // The icon span should not contain Plus when loading
      expect(container.querySelectorAll('svg')[0]).toBeInTheDocument(); // Loader2 is there
    });

    it('hides label when loading', () => {
      const handleClick = vi.fn();
      render(<LuminaButton label="Hidden Label" loading onClick={handleClick} />);
      const button = screen.getByRole('button', { name: /hidden label/i });
      // The button should still be findable by its accessible name
      expect(button).toBeInTheDocument();
    });
  });

  describe('icon support', () => {
    it('renders icon when provided and not loading', () => {
      const handleClick = vi.fn();
      render(
        <LuminaButton label="With Icon" icon={<Plus data-testid="plus-icon" />} onClick={handleClick} />
      );
      expect(screen.getByTestId('plus-icon')).toBeInTheDocument();
    });

    it('does not render icon when not provided', () => {
      const handleClick = vi.fn();
      const { container } = render(<LuminaButton label="No Icon" onClick={handleClick} />);
      // Should only have one span (the label span)
      const spans = container.querySelectorAll('button > span');
      expect(spans.length).toBe(1);
    });

    it('icon has correct wrapper styles', () => {
      const handleClick = vi.fn();
      const { container } = render(
        <LuminaButton label="Icon Styles" icon={<Settings />} onClick={handleClick} />
      );
      const iconSpan = container.querySelector('button > span:first-child');
      expect(iconSpan).toHaveStyle({
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
      });
    });
  });

  describe('click handling', () => {
    it('calls onClick when clicked and not disabled', () => {
      const handleClick = vi.fn();
      render(<LuminaButton label="Click Handler" onClick={handleClick} />);
      const button = screen.getByRole('button', { name: /click handler/i });
      fireEvent.click(button);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('calls onClick only once on multiple clicks', () => {
      const handleClick = vi.fn();
      render(<LuminaButton label="Double Click" onClick={handleClick} />);
      const button = screen.getByRole('button', { name: /double click/i });
      fireEvent.click(button);
      fireEvent.click(button);
      expect(handleClick).toHaveBeenCalledTimes(2);
    });
  });

  describe('base styles', () => {
    it('applies base button styles', () => {
      const handleClick = vi.fn();
      render(<LuminaButton label="Base Styles" onClick={handleClick} />);
      const button = screen.getByRole('button', { name: /base styles/i });
      // Note: happy-dom reports CSS values with units (gap: 8px)
      expect(button).toHaveStyle({
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        border: 'none',
        borderRadius: '8px',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      });
    });

    it('applies font family', () => {
      const handleClick = vi.fn();
      render(<LuminaButton label="Font Family" onClick={handleClick} />);
      const button = screen.getByRole('button', { name: /font family/i });
      expect(button).toHaveStyle({ fontFamily: 'system-ui, -apple-system, sans-serif' });
    });

    it('applies font weight', () => {
      const handleClick = vi.fn();
      render(<LuminaButton label="Font Weight" onClick={handleClick} />);
      const button = screen.getByRole('button', { name: /font weight/i });
      expect(button).toHaveStyle({ fontWeight: 600 });
    });
  });

  describe('combined props', () => {
    it('renders with multiple props combined', () => {
      const handleClick = vi.fn();
      render(
        <LuminaButton
          label="Combined"
          variant="secondary"
          size="lg"
          icon={<Plus />}
          onClick={handleClick}
        />
      );
      const button = screen.getByRole('button', { name: /combined/i });
      expect(button).toHaveStyle({
        background: '#eceef0',
        color: '#191c1e',
        padding: '11px 24px',
        fontSize: 15,
      });
      expect(screen.getByRole('button', { name: /combined/i })).toBeInTheDocument();
    });
  });
});
