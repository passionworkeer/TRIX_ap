/**
 * Component tests for PerformanceDashboard
 *
 * Tests performance dashboard renders metrics
 * NOTE: PerformanceDashboard only renders in DEV mode (import.meta.env.DEV === true)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';

beforeEach(() => {
  vi.clearAllMocks();
});

// Mock import.meta.env.DEV before importing the component
Object.defineProperty(import.meta, 'env', {
  value: { ...import.meta.env, DEV: true },
  writable: true,
});

// Mock perfMonitor
vi.mock('../utils/performance', () => ({
  perfMonitor: {
    getAllStats: vi.fn(() => new Map()),
    getMetricNames: vi.fn(() => []),
    clear: vi.fn(),
  },
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

import { renderHook } from '@testing-library/react';
import PerformanceDashboard from './PerformanceDashboard';

describe('PerformanceDashboard', () => {
  it('renders collapsed indicator in DEV mode', async () => {
    const { container } = render(<PerformanceDashboard />);
    expect(container.firstChild).not.toBeNull();
  });

  it('shows perf indicator with metrics count', async () => {
    const { container } = render(<PerformanceDashboard />);
    expect(container.textContent).toContain('Perf:');
  });
});
