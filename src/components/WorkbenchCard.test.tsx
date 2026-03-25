/**
 * Component tests for WorkbenchCard
 *
 * Tests workbench card renders title and content
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
}));

// Mock iosMotion
vi.mock('../utils/iosMotion', () => ({
  iosPressableMotion: {},
}));

describe('WorkbenchCard', () => {
  const defaultProps = {
    icon: 'Camera',
    label: '快拍',
    color: 'from-pink-500 to-rose-500',
    onClick: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with label', async () => {
    const WorkbenchCard = (await import('./WorkbenchCard')).default;

    render(<WorkbenchCard {...defaultProps} />);

    expect(screen.getByText('快拍')).toBeInTheDocument();
  });

  it('should render as a button', async () => {
    const WorkbenchCard = (await import('./WorkbenchCard')).default;

    render(<WorkbenchCard {...defaultProps} />);

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('should call onClick when clicked', async () => {
    const WorkbenchCard = (await import('./WorkbenchCard')).default;

    render(<WorkbenchCard {...defaultProps} />);

    fireEvent.click(screen.getByRole('button'));

    expect(defaultProps.onClick).toHaveBeenCalled();
  });

  it('should use aria-label when provided', async () => {
    const WorkbenchCard = (await import('./WorkbenchCard')).default;

    render(<WorkbenchCard {...defaultProps} ariaLabel="自定义标签" />);

    const button = screen.getByRole('button', { name: '自定义标签' });
    expect(button).toBeInTheDocument();
  });

  it('should use label as default aria-label', async () => {
    const WorkbenchCard = (await import('./WorkbenchCard')).default;

    render(<WorkbenchCard {...defaultProps} />);

    const button = screen.getByRole('button', { name: '快拍' });
    expect(button).toBeInTheDocument();
  });

  it('should render with different icons', async () => {
    const WorkbenchCard = (await import('./WorkbenchCard')).default;

    const { container: container1 } = render(
      <WorkbenchCard {...defaultProps} icon="Camera" />
    );
    const { container: container2 } = render(
      <WorkbenchCard {...defaultProps} icon="MapPin" />
    );
    const { container: container3 } = render(
      <WorkbenchCard {...defaultProps} icon="Calendar" />
    );

    expect(container1.firstChild).not.toBeNull();
    expect(container2.firstChild).not.toBeNull();
    expect(container3.firstChild).not.toBeNull();
  });

  it('should apply color gradient class', async () => {
    const WorkbenchCard = (await import('./WorkbenchCard')).default;

    const { container } = render(
      <WorkbenchCard {...defaultProps} color="from-blue-500 to-purple-500" />
    );

    const iconContainer = container.querySelector('[class*="from-blue-500"]');
    expect(iconContainer).toBeTruthy();
  });

  it('should render with different colors', async () => {
    const WorkbenchCard = (await import('./WorkbenchCard')).default;

    const colors = [
      'from-pink-500 to-rose-500',
      'from-green-500 to-emerald-500',
      'from-blue-500 to-cyan-500',
    ];

    for (const color of colors) {
      const { container } = render(
        <WorkbenchCard {...defaultProps} color={color} />
      );
      expect(container.firstChild).not.toBeNull();
    }
  });

  it('should handle unknown icon gracefully', async () => {
    const WorkbenchCard = (await import('./WorkbenchCard')).default;

    const { container } = render(
      <WorkbenchCard {...defaultProps} icon="UnknownIcon" />
    );

    // Should render with fallback Sparkles icon
    expect(container.firstChild).not.toBeNull();
  });
});
