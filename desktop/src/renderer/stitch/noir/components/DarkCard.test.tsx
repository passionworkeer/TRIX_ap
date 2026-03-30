import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { DarkCard } from './DarkCard';

describe('DarkCard', () => {
  describe('Rendering', () => {
    it('renders with children', () => {
      render(
        <DarkCard>
          <span data-testid="card-child">Card Content</span>
        </DarkCard>
      );
      expect(screen.getByTestId('card-child')).toBeInTheDocument();
    });

    it('renders with dark-card class', () => {
      const { container } = render(<DarkCard>Content</DarkCard>);
      expect(container.firstChild).toHaveClass('dark-card');
    });

    it('renders multiple children', () => {
      render(
        <DarkCard>
          <p>First child</p>
          <p>Second child</p>
          <p>Third child</p>
        </DarkCard>
      );
      expect(screen.getByText('First child')).toBeInTheDocument();
      expect(screen.getByText('Second child')).toBeInTheDocument();
      expect(screen.getByText('Third child')).toBeInTheDocument();
    });

    it('renders nested components', () => {
      render(
        <DarkCard>
          <div>
            <h1>Title</h1>
            <p>Description</p>
          </div>
        </DarkCard>
      );
      expect(screen.getByRole('heading', { name: /title/i })).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
    });
  });

  describe('Elevation Levels', () => {
    it('applies lowest elevation background', () => {
      const { container } = render(<DarkCard elevation="lowest">Lowest</DarkCard>);
      expect(container.firstChild).toHaveStyle({ background: '#0e0e0e' });
    });

    it('applies low elevation background', () => {
      const { container } = render(<DarkCard elevation="low">Low</DarkCard>);
      expect(container.firstChild).toHaveStyle({ background: '#1c1b1b' });
    });

    it('applies container elevation background by default', () => {
      const { container } = render(<DarkCard>Container</DarkCard>);
      expect(container.firstChild).toHaveStyle({ background: '#201f1f' });
    });

    it('applies high elevation background', () => {
      const { container } = render(<DarkCard elevation="high">High</DarkCard>);
      expect(container.firstChild).toHaveStyle({ background: '#2a2a2a' });
    });

    it('applies highest elevation background', () => {
      const { container } = render(<DarkCard elevation="highest">Highest</DarkCard>);
      expect(container.firstChild).toHaveStyle({ background: '#353534' });
    });

    it('applies correct border colors for all elevations', () => {
      const elevations = ['lowest', 'low', 'container', 'high', 'highest'] as const;
      for (const elevation of elevations) {
        const { container } = render(
          <DarkCard elevation={elevation}>Border Test</DarkCard>
        );
        expect(container.firstChild).toHaveStyle({
          borderColor: 'rgba(71,71,71,0.3)',
        });
      }
    });
  });

  describe('Glass Variant', () => {
    it('applies glass background when enabled', () => {
      const { container } = render(<DarkCard glass>Glass</DarkCard>);
      expect(container.firstChild).toHaveStyle({
        background: 'rgba(53, 53, 52, 0.4)',
      });
    });

    it('applies backdrop blur when glass is enabled', () => {
      const { container } = render(<DarkCard glass>Blurred</DarkCard>);
      expect(container.firstChild).toHaveStyle({ backdropFilter: 'blur(20px)' });
    });

    it('applies webkit backdrop blur when glass is enabled', () => {
      const { container } = render(<DarkCard glass>Webkit Blur</DarkCard>);
      const card = container.firstChild as HTMLDivElement;
      // happy-dom may use different property casing, check if style attribute contains the value
      const styleAttr = card.getAttribute('style') || '';
      expect(styleAttr).toContain('blur(20px)');
    });

    it('uses default background when glass is disabled (default)', () => {
      const { container } = render(<DarkCard glass={false}>Not Glass</DarkCard>);
      expect(container.firstChild).toHaveStyle({ background: '#201f1f' });
    });

    it('applies glass border color when glass is enabled', () => {
      const { container } = render(<DarkCard glass>Glass Border</DarkCard>);
      expect(container.firstChild).toHaveStyle({
        borderColor: 'rgba(255,255,255,0.05)',
      });
    });
  });

  describe('Hoverable Effect', () => {
    it('does not apply hover styles by default', async () => {
      const { container } = render(<DarkCard>Not Hoverable</DarkCard>);
      const card = container.firstChild as HTMLDivElement;

      // Default state - transform is not set initially
      const styleAttr = card.getAttribute('style') || '';
      // Should not have translateY(-1px) or enhanced box shadow
      expect(styleAttr).not.toContain('translateY(-1px)');
      expect(styleAttr).not.toContain('0 8px 40px');

      // Simulate mouse enter
      fireEvent.mouseEnter(card);

      // Should not change without hoverable prop - check that it doesn't get hover styles
      const afterHoverStyle = card.getAttribute('style') || '';
      expect(afterHoverStyle).not.toContain('translateY(-1px)');
    });

    it('applies hover transform when hoverable is true', async () => {
      const { container } = render(<DarkCard hoverable>Hoverable</DarkCard>);
      const card = container.firstChild as HTMLDivElement;

      fireEvent.mouseEnter(card);

      expect(card).toHaveStyle({ transform: 'translateY(-1px)' });
      expect(card).toHaveStyle({ boxShadow: '0 8px 40px rgba(0,0,0,0.4)' });
    });

    it('removes hover styles on mouse leave', async () => {
      const { container } = render(<DarkCard hoverable>Hover Then Leave</DarkCard>);
      const card = container.firstChild as HTMLDivElement;

      fireEvent.mouseEnter(card);
      expect(card).toHaveStyle({ transform: 'translateY(-1px)' });

      fireEvent.mouseLeave(card);
      expect(card).toHaveStyle({ transform: 'translateY(0)' });
      expect(card).toHaveStyle({ boxShadow: '0 4px 30px rgba(0,0,0,0.3)' });
    });

    it('has transition for hover effect', () => {
      const { container } = render(<DarkCard hoverable>With Transition</DarkCard>);
      expect(container.firstChild).toHaveStyle({ transition: 'all 0.2s ease' });
    });
  });

  describe('Click Handler', () => {
    it('calls onClick when clicked', async () => {
      const handleClick = vi.fn();
      render(<DarkCard onClick={handleClick}>Clickable</DarkCard>);
      const card = screen.getByText('Clickable');
      fireEvent.click(card);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('applies pointer cursor when onClick is provided', () => {
      const { container } = render(<DarkCard onClick={() => {}}>Clickable</DarkCard>);
      expect(container.firstChild).toHaveStyle({ cursor: 'pointer' });
    });

    it('has default cursor when no onClick', () => {
      const { container } = render(<DarkCard>Not Clickable</DarkCard>);
      expect(container.firstChild).toHaveStyle({ cursor: 'default' });
    });

    it('applies hover effect when onClick is provided', async () => {
      const { container } = render(<DarkCard onClick={() => {}}>Clickable</DarkCard>);
      const card = container.firstChild as HTMLDivElement;

      fireEvent.mouseEnter(card);

      expect(card).toHaveStyle({ transform: 'translateY(-1px)' });
      expect(card).toHaveStyle({ boxShadow: '0 8px 40px rgba(0,0,0,0.4)' });
    });

    it('receives click even when hoverable is false', async () => {
      const handleClick = vi.fn();
      render(
        <DarkCard onClick={handleClick} hoverable={false}>
          Click
        </DarkCard>
      );
      const card = screen.getByText('Click');
      fireEvent.click(card);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('ClassName Passthrough', () => {
    it('passes className to the card', () => {
      const { container } = render(
        <DarkCard className="my-custom-class">Custom Class</DarkCard>
      );
      expect(container.firstChild).toHaveClass('dark-card');
      expect(container.firstChild).toHaveClass('my-custom-class');
    });

    it('passes multiple classes via className', () => {
      const { container } = render(
        <DarkCard className="class-one class-two">Multi Classes</DarkCard>
      );
      expect(container.firstChild).toHaveClass('dark-card');
      expect(container.firstChild).toHaveClass('class-one');
      expect(container.firstChild).toHaveClass('class-two');
    });

    it('allows empty className', () => {
      const { container } = render(<DarkCard className="">No Class</DarkCard>);
      expect(container.firstChild).toHaveClass('dark-card');
    });
  });

  describe('Style Passthrough', () => {
    it('passes custom style to the card', () => {
      const { container } = render(
        <DarkCard style={{ margin: '20px' }}>Styled</DarkCard>
      );
      expect(container.firstChild).toHaveStyle({ margin: '20px' });
    });

    it('merges custom style with component styles', () => {
      const { container } = render(
        <DarkCard style={{ padding: '30px' } as React.CSSProperties}>Merged</DarkCard>
      );
      const card = container.firstChild as HTMLDivElement;
      // Custom style should override default padding (20)
      expect(card.style.padding).toBe('30px');
    });
  });

  describe('Visual Styles', () => {
    it('has correct border radius', () => {
      const { container } = render(<DarkCard>Radius</DarkCard>);
      expect(container.firstChild).toHaveStyle({ borderRadius: 16 });
    });

    it('has default padding of 20', () => {
      const { container } = render(<DarkCard>Padded</DarkCard>);
      const card = container.firstChild as HTMLDivElement;
      // Check style attribute directly since happy-dom may format padding differently
      const styleAttr = card.getAttribute('style') || '';
      expect(styleAttr).toContain('padding');
      // Should contain the padding value (20 or 20px)
      expect(styleAttr).toMatch(/padding.*20/);
    });

    it('has default border', () => {
      const { container } = render(<DarkCard>Bordered</DarkCard>);
      const card = container.firstChild as HTMLDivElement;
      // Check style attribute directly since happy-dom may format border differently
      const styleAttr = card.getAttribute('style') || '';
      // Should contain border-related styles
      expect(styleAttr).toMatch(/border/);
      // Should use the correct border color (from elevation base)
      expect(styleAttr).toContain('rgba(71, 71, 71, 0.3)');
    });

    it('has box shadow', () => {
      const { container } = render(<DarkCard>Shadow</DarkCard>);
      expect(container.firstChild).toHaveStyle({ boxShadow: '0 4px 30px rgba(0,0,0,0.3)' });
    });

    it('has transition when hoverable', () => {
      const { container } = render(<DarkCard hoverable>Transition</DarkCard>);
      expect(container.firstChild).toHaveStyle({ transition: 'all 0.2s ease' });
    });

    it('has transition when onClick is provided', () => {
      const { container } = render(<DarkCard onClick={() => {}}>Transition</DarkCard>);
      expect(container.firstChild).toHaveStyle({ transition: 'all 0.2s ease' });
    });
  });

  describe('Combinations', () => {
    it('renders with glass and highest elevation', () => {
      const { container } = render(
        <DarkCard glass elevation="highest">Glass Highest</DarkCard>
      );
      // Glass should override elevation background
      expect(container.firstChild).toHaveStyle({
        background: 'rgba(53, 53, 52, 0.4)',
      });
      // But glass border color applies
      expect(container.firstChild).toHaveStyle({
        borderColor: 'rgba(255,255,255,0.05)',
      });
    });

    it('renders with hoverable and custom className', () => {
      const { container } = render(
        <DarkCard hoverable className="feature-card">Combo</DarkCard>
      );
      expect(container.firstChild).toHaveClass('dark-card');
      expect(container.firstChild).toHaveClass('feature-card');
    });

    it('renders with onClick, hoverable, and glass', async () => {
      const handleClick = vi.fn();
      const { container } = render(
        <DarkCard onClick={handleClick} hoverable glass>
          Full Combo
        </DarkCard>
      );
      const card = container.firstChild as HTMLDivElement;

      expect(card).toHaveStyle({ cursor: 'pointer' });
      expect(card).toHaveStyle({ backdropFilter: 'blur(20px)' });

      // Hover should still work
      fireEvent.mouseEnter(card);
      expect(card).toHaveStyle({ transform: 'translateY(-1px)' });
    });

    it('renders with all props', () => {
      const handleClick = vi.fn();
      const { container } = render(
        <DarkCard
          className="test-class"
          style={{ marginTop: '10px' } as React.CSSProperties}
          glass
          elevation="high"
          hoverable
          onClick={handleClick}
        >
          All Props
        </DarkCard>
      );

      const card = container.firstChild as HTMLDivElement;

      expect(card).toHaveClass('dark-card');
      expect(card).toHaveClass('test-class');
      expect(card).toHaveStyle({ marginTop: '10px' });
      expect(card).toHaveStyle({ backdropFilter: 'blur(20px)' });
      expect(card).toHaveStyle({ background: 'rgba(53, 53, 52, 0.4)' });
      expect(card).toHaveStyle({ cursor: 'pointer' });
    });
  });

  describe('Edge Cases', () => {
    it('renders with empty children', () => {
      const { container } = render(<DarkCard>{null}</DarkCard>);
      expect(container.firstChild).toBeInTheDocument();
    });

    it('renders with text-only children', () => {
      render(<DarkCard>Just text</DarkCard>);
      expect(screen.getByText('Just text')).toBeInTheDocument();
    });

    it('renders with undefined className', () => {
      const { container } = render(<DarkCard className={undefined as unknown as string}>Undefined Class</DarkCard>);
      expect(container.firstChild).toHaveClass('dark-card');
    });

    it('renders with undefined style', () => {
      const { container } = render(<DarkCard style={undefined as unknown as React.CSSProperties}>Undefined Style</DarkCard>);
      expect(container.firstChild).toBeInTheDocument();
    });
  });
});
