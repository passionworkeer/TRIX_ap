import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigateMock = vi.fn();
let mockPathname = '/';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useLocation: () => ({ pathname: mockPathname }),
  };
});

describe('GlassDock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = '/';
  });

  it('renders the dock and highlights the active route', async () => {
    const { default: GlassDock } = await import('../components/GlassDock');

    render(<GlassDock />);

    expect(screen.getByRole('navigation', { name: '主导航' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '首页' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'chat' })).not.toHaveAttribute('aria-current');
  });

  it('navigates when a dock button is clicked', async () => {
    const { default: GlassDock } = await import('../components/GlassDock');

    render(<GlassDock />);

    fireEvent.click(screen.getByRole('button', { name: 'chat' }));

    expect(navigateMock).toHaveBeenCalledWith('/chat');
  });
});
