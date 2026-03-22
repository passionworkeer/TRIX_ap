import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SurfaceCard } from './cards';

describe('SurfaceCard', () => {
  describe('rendering', () => {
    it('renders children correctly', () => {
      render(
        <SurfaceCard>
          <p>Card content</p>
        </SurfaceCard>
      );
      expect(screen.getByText('Card content')).toBeInTheDocument();
    });

    it('renders multiple children', () => {
      render(
        <SurfaceCard>
          <h1>Title</h1>
          <p>Description</p>
          <button>Action</button>
        </SurfaceCard>
      );
      expect(screen.getByRole('heading', { name: /title/i })).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /action/i })).toBeInTheDocument();
    });
  });

  describe('elevations', () => {
    it('renders low elevation correctly', () => {
      const { container } = render(<SurfaceCard elevation="low">Low Card</SurfaceCard>);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveStyle({
        background: '#f2f4f6',
        borderRadius: 12,
        border: '1px solid #e6e8ea',
      });
    });

    it('renders mid elevation correctly', () => {
      const { container } = render(<SurfaceCard elevation="mid">Mid Card</SurfaceCard>);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveStyle({
        background: '#eceef0',
        borderRadius: 12,
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      });
    });

    it('renders high elevation correctly', () => {
      const { container } = render(<SurfaceCard elevation="high">High Card</SurfaceCard>);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveStyle({
        background: '#eceef0',
        borderRadius: 12,
        border: '1px solid #e6e8ea',
        boxShadow: '0 4px 16px rgba(0,0,0,0.09)',
      });
    });

    it('defaults to low elevation', () => {
      const { container } = render(<SurfaceCard>Default Card</SurfaceCard>);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveStyle({
        background: '#f2f4f6',
        border: '1px solid #e6e8ea',
      });
    });
  });

  describe('padding', () => {
    it('applies 16px padding by default', () => {
      const { container } = render(<SurfaceCard>Padded Card</SurfaceCard>);
      const card = container.firstChild as HTMLElement;
      // Check padding via getAttribute since happy-dom may handle numeric shorthand differently
      const inlineStyle = card.getAttribute('style') || '';
      expect(inlineStyle).toContain('padding: 16px');
    });

    it('padding is consistent across all elevations', () => {
      const lowCard = render(<SurfaceCard elevation="low">Low</SurfaceCard>);
      const midCard = render(<SurfaceCard elevation="mid">Mid</SurfaceCard>);
      const highCard = render(<SurfaceCard elevation="high">High</SurfaceCard>);

      expect((lowCard.container.firstChild as HTMLElement).getAttribute('style') || '').toContain('padding: 16px');
      expect((midCard.container.firstChild as HTMLElement).getAttribute('style') || '').toContain('padding: 16px');
      expect((highCard.container.firstChild as HTMLElement).getAttribute('style') || '').toContain('padding: 16px');
    });
  });

  describe('border radius', () => {
    it('applies 12px border radius to low elevation', () => {
      const { container } = render(<SurfaceCard elevation="low">Low Border Radius</SurfaceCard>);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveStyle({ borderRadius: 12 });
    });

    it('applies 12px border radius to mid elevation', () => {
      const { container } = render(<SurfaceCard elevation="mid">Mid Border Radius</SurfaceCard>);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveStyle({ borderRadius: 12 });
    });

    it('applies 12px border radius to high elevation', () => {
      const { container } = render(<SurfaceCard elevation="high">High Border Radius</SurfaceCard>);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveStyle({ borderRadius: 12 });
    });
  });

  describe('boxSizing', () => {
    it('applies border-box boxSizing', () => {
      const { container } = render(<SurfaceCard>Box Sizing Card</SurfaceCard>);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveStyle({ boxSizing: 'border-box' });
    });
  });

  describe('className passthrough', () => {
    it('passes className to the underlying div', () => {
      const { container } = render(
        <SurfaceCard className="custom-class">Custom Class Card</SurfaceCard>
      );
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('custom-class');
    });

    it('allows multiple classNames', () => {
      const { container } = render(
        <SurfaceCard className="class1 class2">Multiple Classes</SurfaceCard>
      );
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('class1');
      expect(card).toHaveClass('class2');
    });

    it('works with empty className', () => {
      const { container } = render(
        <SurfaceCard className="">Empty Class Card</SurfaceCard>
      );
      const card = container.firstChild as HTMLElement;
      expect(card).toBeInTheDocument();
    });

    it('works without className prop', () => {
      const { container } = render(<SurfaceCard>No Class Card</SurfaceCard>);
      const card = container.firstChild as HTMLElement;
      expect(card).toBeInTheDocument();
      expect(card.className).toBe('');
    });
  });

  describe('style passthrough', () => {
    it('applies additional custom styles', () => {
      const { container } = render(
        <SurfaceCard style={{ marginTop: 20, maxWidth: 400 }}>
          Custom Styles Card
        </SurfaceCard>
      );
      const card = container.firstChild as HTMLElement;
      const inlineStyle = card.getAttribute('style') || '';
      expect(inlineStyle).toContain('margin-top: 20px');
      expect(inlineStyle).toContain('max-width: 400px');
    });

    it('allows overriding elevation styles with custom styles', () => {
      const { container } = render(
        <SurfaceCard elevation="low" style={{ background: '#ff0000' }}>
          Override Background
        </SurfaceCard>
      );
      const card = container.firstChild as HTMLElement;
      // Custom style should override the elevation background
      expect(card).toHaveStyle({ background: '#ff0000' });
    });

    it('allows overriding padding with custom styles', () => {
      const { container } = render(
        <SurfaceCard style={{ padding: 32 }}>Custom Padding</SurfaceCard>
      );
      const card = container.firstChild as HTMLElement;
      // Custom style overrides default 16px padding
      const inlineStyle = card.getAttribute('style') || '';
      expect(inlineStyle).toContain('padding: 32px');
    });

    it('allows overriding borderRadius with custom styles', () => {
      const { container } = render(
        <SurfaceCard style={{ borderRadius: 20 }}>Custom Border Radius</SurfaceCard>
      );
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveStyle({ borderRadius: 20 });
    });

    it('works with undefined style', () => {
      const { container } = render(<SurfaceCard style={undefined}>Undefined Style</SurfaceCard>);
      const card = container.firstChild as HTMLElement;
      expect(card).toBeInTheDocument();
    });

    it('works without style prop', () => {
      const { container } = render(<SurfaceCard>No Style Prop</SurfaceCard>);
      const card = container.firstChild as HTMLElement;
      expect(card).toBeInTheDocument();
    });
  });

  describe('element structure', () => {
    it('renders as a div element', () => {
      const { container } = render(<SurfaceCard>Div Element</SurfaceCard>);
      expect(container.querySelector('div')).toBeInTheDocument();
    });

    it('renders as a single root element', () => {
      const { container } = render(<SurfaceCard>Single Root</SurfaceCard>);
      expect(container.childNodes.length).toBe(1);
    });

    it('children are rendered inside the card', () => {
      const { container } = render(
        <SurfaceCard>
          <span data-testid="inner-child">Inner Child</span>
        </SurfaceCard>
      );
      const card = container.firstChild as HTMLElement;
      expect(card).toContainElement(screen.getByTestId('inner-child'));
    });
  });

  describe('combined props', () => {
    it('renders with all props combined', () => {
      const { container } = render(
        <SurfaceCard elevation="high" className="my-card" style={{ margin: 10 }}>
          <div>Combined Card</div>
        </SurfaceCard>
      );
      const card = container.firstChild as HTMLElement;

      // Check className
      expect(card).toHaveClass('my-card');

      // Check custom style
      const inlineStyle = card.getAttribute('style') || '';
      expect(inlineStyle).toContain('margin: 10px');

      // Check elevation styles
      expect(card).toHaveStyle({
        background: '#eceef0',
        boxShadow: '0 4px 16px rgba(0,0,0,0.09)',
        borderRadius: 12,
      });

      // Check children
      expect(screen.getByText('Combined Card')).toBeInTheDocument();
    });
  });
});
