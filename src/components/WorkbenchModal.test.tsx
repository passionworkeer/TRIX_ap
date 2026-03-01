/**
 * Component tests for WorkbenchModal
 *
 * Tests the workbench modal with feature cards
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock lucide-react
vi.mock('lucide-react', () => ({
  X: () => <span data-testid="icon">X</span>,
}));

// Mock WorkbenchCard
vi.mock('../components/WorkbenchCard', () => ({
  default: ({ label, onClick }: any) => (
    <button onClick={onClick} data-testid="workbench-card">
      {label}
    </button>
  ),
}));

// Mock types
vi.mock('../types/workbench', () => ({
  DEFAULT_WORKBENCH_ITEMS: [
    { id: 'snapshot', label: 'Snapshot', icon: 'Camera', color: 'from-pink-500 to-rose-500' },
    { id: 'location', label: 'Location', icon: 'MapPin', color: 'from-green-500 to-emerald-500' },
    { id: 'schedule', label: 'Schedule', icon: 'Calendar', color: 'from-blue-500 to-cyan-500' },
    { id: 'todo', label: 'Todo', icon: 'CheckSquare', color: 'from-purple-500 to-violet-500' },
  ],
}));

describe('WorkbenchModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console.log to avoid noise
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should render modal when isOpen is true', async () => {
    const WorkbenchModal = (await import('../components/WorkbenchModal')).default;

    render(
      <WorkbenchModal
        isOpen={true}
        onClose={() => {}}
      />
    );

    expect(screen.getByText('工作台')).toBeDefined();
    expect(screen.getByText('快捷功能入口')).toBeDefined();
  });

  it('should not render when isOpen is false', async () => {
    const WorkbenchModal = (await import('../components/WorkbenchModal')).default;

    const { container } = render(
      <WorkbenchModal
        isOpen={false}
        onClose={() => {}}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should call onClose when close button is clicked', async () => {
    const WorkbenchModal = (await import('../components/WorkbenchModal')).default;
    const onClose = vi.fn();

    render(
      <WorkbenchModal
        isOpen={true}
        onClose={onClose}
      />
    );

    const closeButton = screen.getByRole('button', { name: '关闭工作台' });
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('should render default workbench items', async () => {
    const WorkbenchModal = (await import('../components/WorkbenchModal')).default;

    render(
      <WorkbenchModal
        isOpen={true}
        onClose={() => {}}
      />
    );

    expect(screen.getByText('Snapshot')).toBeDefined();
    expect(screen.getByText('Location')).toBeDefined();
    expect(screen.getByText('Schedule')).toBeDefined();
    expect(screen.getByText('Todo')).toBeDefined();
  });

  it('should call onCardClick when card is clicked', async () => {
    const WorkbenchModal = (await import('../components/WorkbenchModal')).default;
    const onCardClick = vi.fn();

    render(
      <WorkbenchModal
        isOpen={true}
        onClose={() => {}}
        onCardClick={onCardClick}
      />
    );

    const snapshotCard = screen.getByText('Snapshot');
    fireEvent.click(snapshotCard);

    expect(onCardClick).toHaveBeenCalledWith('snapshot');
  });

  it('should render custom items when provided', async () => {
    const WorkbenchModal = (await import('../components/WorkbenchModal')).default;
    const customItems = [
      { id: 'custom-1', label: 'Custom 1', icon: 'Star', color: 'from-yellow-500 to-orange-500' },
      { id: 'custom-2', label: 'Custom 2', icon: 'Heart', color: 'from-red-500 to-pink-500' },
    ];

    render(
      <WorkbenchModal
        isOpen={true}
        onClose={() => {}}
        items={customItems}
      />
    );

    expect(screen.getByText('Custom 1')).toBeDefined();
    expect(screen.getByText('Custom 2')).toBeDefined();
  });

  it('should show hint text about scrolling', async () => {
    const WorkbenchModal = (await import('../components/WorkbenchModal')).default;

    render(
      <WorkbenchModal
        isOpen={true}
        onClose={() => {}}
      />
    );

    expect(screen.getByText('左右滑动查看更多')).toBeDefined();
  });

  it('should call onClose when backdrop is clicked', async () => {
    const WorkbenchModal = (await import('../components/WorkbenchModal')).default;
    const onClose = vi.fn();

    const { container } = render(
      <WorkbenchModal
        isOpen={true}
        onClose={onClose}
      />
    );

    // Click on backdrop (the first fixed div)
    const backdrop = container.firstChild as HTMLElement;
    fireEvent.click(backdrop);

    expect(onClose).toHaveBeenCalled();
  });
});
