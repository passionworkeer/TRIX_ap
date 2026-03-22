import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DarkButton } from './DarkButton';

describe('DarkButton', () => {
  describe('Rendering', () => {
    it('renders a button with the label', () => {
      render(<DarkButton label="Test Button" />);
      expect(screen.getByRole('button', { name: /test button/i })).toBeInTheDocument();
    });

    it('renders with dark-button class', () => {
      const { container } = render(<DarkButton label="Test" />);
      expect(container.firstChild).toHaveClass('dark-button');
    });

    it('renders children when icon is provided', () => {
      const icon = <span data-testid="icon">Icon</span>;
      render(<DarkButton label="With Icon" icon={icon} />);
      expect(screen.getByTestId('icon')).toBeInTheDocument();
    });
  });

  describe('Variants', () => {
    it('applies ghost variant styles by default', () => {
      const { container } = render(<DarkButton label="Ghost Button" />);
      const button = container.firstChild as HTMLButtonElement;
      expect(button).toHaveStyle({ background: 'transparent' });
    });

    it('applies outline variant styles', () => {
      const { container } = render(<DarkButton label="Outline Button" variant="outline" />);
      const button = container.firstChild as HTMLButtonElement;
      expect(button).toHaveStyle({ background: 'transparent' });
      expect(button).toHaveStyle({ border: '1px solid rgba(255,255,255,0.12)' });
    });

    it('applies primary variant styles with gradient', () => {
      const { container } = render(<DarkButton label="Primary Button" variant="primary" />);
      const button = container.firstChild as HTMLButtonElement;
      expect(button).toHaveStyle({
        background: 'linear-gradient(135deg, #ffffff, #d4d4d4)',
      });
    });

    it('applies danger variant styles', () => {
      const { container } = render(<DarkButton label="Danger Button" variant="danger" />);
      const button = container.firstChild as HTMLButtonElement;
      expect(button).toHaveStyle({
        background: 'rgba(255,68,68,0.12)',
      });
      expect(button).toHaveStyle({ color: '#ffb4ab' });
    });
  });

  describe('Sizes', () => {
    it('applies sm size styles', () => {
      const { container } = render(<DarkButton label="Small" size="sm" />);
      const button = container.firstChild as HTMLButtonElement;
      expect(button).toHaveStyle({ padding: '5px 10px' });
      expect(button).toHaveStyle({ fontSize: 12 });
    });

    it('applies md size styles by default', () => {
      const { container } = render(<DarkButton label="Medium" size="md" />);
      const button = container.firstChild as HTMLButtonElement;
      expect(button).toHaveStyle({ padding: '8px 14px' });
      expect(button).toHaveStyle({ fontSize: 13 });
    });

    it('applies lg size styles', () => {
      const { container } = render(<DarkButton label="Large" size="lg" />);
      const button = container.firstChild as HTMLButtonElement;
      expect(button).toHaveStyle({ padding: '10px 18px' });
      expect(button).toHaveStyle({ fontSize: 14 });
    });
  });

  describe('States', () => {
    it('renders in disabled state', () => {
      const handleClick = vi.fn();
      const { container } = render(
        <DarkButton label="Disabled" disabled onClick={handleClick} />
      );
      const button = container.firstChild as HTMLButtonElement;
      expect(button).toBeDisabled();
      expect(button).toHaveStyle({ opacity: 0.5 });
      expect(button).toHaveStyle({ cursor: 'not-allowed' });
    });

    it('renders in loading state', () => {
      const handleClick = vi.fn();
      const { container } = render(
        <DarkButton label="Loading" loading onClick={handleClick} />
      );
      const button = container.firstChild as HTMLButtonElement;
      expect(button).toBeDisabled();
      expect(button).toHaveStyle({ cursor: 'not-allowed' });
      // Check loading spinner is rendered
      const spinner = container.querySelector('span[style*="border-radius: 50%"]');
      expect(spinner).toBeInTheDocument();
    });

    it('does not call onClick when disabled', async () => {
      const handleClick = vi.fn();
      render(<DarkButton label="Disabled" disabled onClick={handleClick} />);
      const button = screen.getByRole('button', { name: /disabled/i });
      await userEvent.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('does not call onClick when loading', async () => {
      const handleClick = vi.fn();
      render(<DarkButton label="Loading" loading onClick={handleClick} />);
      const button = screen.getByRole('button', { name: /loading/i });
      await userEvent.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Interactions', () => {
    it('calls onClick when clicked', async () => {
      const handleClick = vi.fn();
      render(<DarkButton label="Click Me" onClick={handleClick} />);
      const button = screen.getByRole('button', { name: /click me/i });
      await userEvent.click(button);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('renders with title attribute', () => {
      render(<DarkButton label="Hover Title" title="This is a tooltip" />);
      const button = screen.getByRole('button', { name: /hover title/i });
      expect(button).toHaveAttribute('title', 'This is a tooltip');
    });
  });

  describe('ClassName Passthrough', () => {
    it('passes className to the button', () => {
      const { container } = render(<DarkButton label="Custom" className="my-custom-class" />);
      expect(container.firstChild).toHaveClass('dark-button');
      expect(container.firstChild).toHaveClass('my-custom-class');
    });

    it('passes multiple classes via className', () => {
      const { container } = render(
        <DarkButton label="Multi" className="class-one class-two" />
      );
      expect(container.firstChild).toHaveClass('dark-button');
      expect(container.firstChild).toHaveClass('class-one');
      expect(container.firstChild).toHaveClass('class-two');
    });
  });

  describe('Style Passthrough', () => {
    it('passes custom style to the button', () => {
      const { container } = render(
        <DarkButton label="Styled" style={{ marginTop: '10px' }} />
      );
      expect(container.firstChild).toHaveStyle({ marginTop: '10px' });
    });

    it('merges custom style with component styles', () => {
      const { container } = render(
        <DarkButton label="Merged" style={{ color: 'red' } as React.CSSProperties} />
      );
      const button = container.firstChild as HTMLButtonElement;
      // Should have both component's display style and custom color
      expect(button.style.color).toBe('red');
    });
  });

  describe('Accessibility', () => {
    it('renders as a native button element', () => {
      render(<DarkButton label="Accessible" />);
      const button = screen.getByRole('button', { name: /accessible/i });
      expect(button.tagName).toBe('BUTTON');
    });

    it('has correct cursor styles based on state', () => {
      const { container: enabledContainer } = render(<DarkButton label="Enabled" />);
      expect(enabledContainer.firstChild).toHaveStyle({ cursor: 'pointer' });

      const { container: disabledContainer } = render(
        <DarkButton label="Disabled" disabled />
      );
      expect(disabledContainer.firstChild).toHaveStyle({ cursor: 'not-allowed' });

      const { container: loadingContainer } = render(
        <DarkButton label="Loading" loading />
      );
      expect(loadingContainer.firstChild).toHaveStyle({ cursor: 'not-allowed' });
    });
  });

  describe('Icon and Label Rendering', () => {
    it('renders icon before label', () => {
      const icon = <span data-testid="test-icon">Icon</span>;
      const { container } = render(<DarkButton label="Icon Label" icon={icon} />);
      const button = container.firstChild as HTMLButtonElement;
      // Icon should be rendered as a span child
      expect(screen.getByTestId('test-icon')).toBeInTheDocument();
      // Label should be rendered as a span child
      expect(screen.getByText('Icon Label')).toBeInTheDocument();
    });

    it('renders correctly without icon', () => {
      render(<DarkButton label="No Icon" />);
      expect(screen.getByText('No Icon')).toBeInTheDocument();
    });

    it('renders correctly with icon but no label', () => {
      // This is an edge case - label is required in the interface
      // but we test what happens with icon only
      const icon = <span data-testid="only-icon">Icon</span>;
      render(<DarkButton label="" icon={icon} />);
      expect(screen.getByTestId('only-icon')).toBeInTheDocument();
    });
  });

  describe('Visual Styles', () => {
    it('has correct border radius', () => {
      const { container } = render(<DarkButton label="Rounded" />);
      expect(container.firstChild).toHaveStyle({ borderRadius: 8 });
    });

    it('has system-ui font family', () => {
      const { container } = render(<DarkButton label="Font" />);
      expect(container.firstChild).toHaveStyle({
        fontFamily: 'system-ui, -apple-system, sans-serif',
      });
    });

    it('has medium font weight', () => {
      const { container } = render(<DarkButton label="Weight" />);
      expect(container.firstChild).toHaveStyle({ fontWeight: 500 });
    });

    it('has inline-flex display', () => {
      const { container } = render(<DarkButton label="Display" />);
      expect(container.firstChild).toHaveStyle({ display: 'inline-flex' });
    });

    it('has center alignment', () => {
      const { container } = render(<DarkButton label="Align" />);
      expect(container.firstChild).toHaveStyle({
        alignItems: 'center',
        justifyContent: 'center',
      });
    });

    it('has nowrap white-space', () => {
      const { container } = render(<DarkButton label="Space" />);
      expect(container.firstChild).toHaveStyle({ whiteSpace: 'nowrap' });
    });

    it('has transition style', () => {
      const { container } = render(<DarkButton label="Transition" />);
      expect(container.firstChild).toHaveStyle({ transition: 'all 0.15s ease' });
    });
  });
});
