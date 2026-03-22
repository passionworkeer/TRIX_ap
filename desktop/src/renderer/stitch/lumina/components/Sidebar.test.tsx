/**
 * Unit tests for stitch/lumina/components/Sidebar.tsx
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('lucide-react', () => ({
  MessageSquare: vi.fn(() => <span data-testid="icon-MessageSquare" aria-hidden="true" />),
  BookOpen: vi.fn(() => <span data-testid="icon-BookOpen" aria-hidden="true" />),
  Camera: vi.fn(() => <span data-testid="icon-Camera" aria-hidden="true" />),
  User: vi.fn(() => <span data-testid="icon-User" aria-hidden="true" />),
  LayoutDashboard: vi.fn(() => <span data-testid="icon-LayoutDashboard" aria-hidden="true" />),
  Bot: vi.fn(() => <span data-testid="icon-Bot" aria-hidden="true" />),
  MessageCircle: vi.fn(() => <span data-testid="icon-MessageCircle" aria-hidden="true" />),
  FolderOpen: vi.fn(() => <span data-testid="icon-FolderOpen" aria-hidden="true" />),
  Settings: vi.fn(() => <span data-testid="icon-Settings" aria-hidden="true" />),
  ChevronLeft: vi.fn(() => <span data-testid="icon-ChevronLeft" aria-hidden="true" />),
  ChevronRight: vi.fn(() => <span data-testid="icon-ChevronRight" aria-hidden="true" />),
}));

import { LuminaSidebar } from './Sidebar';

describe('LuminaSidebar', () => {
  const defaultProps = {
    activeRoute: 'chat' as const,
    onNavigate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<LuminaSidebar {...defaultProps} />);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('renders nav item labels', () => {
    render(<LuminaSidebar {...defaultProps} />);
    // All 9 nav items should render their labels
    expect(document.body.innerHTML).toContain('聊天');
    expect(document.body.innerHTML).toContain('学习');
    expect(document.body.innerHTML).toContain('控制台');
    expect(document.body.innerHTML).toContain('系统设置');
  });

  it('renders study nav item', () => {
    render(<LuminaSidebar {...defaultProps} />);
    expect(document.body.innerHTML).toContain('学习');
  });

  it('calls onNavigate with correct route on click', () => {
    render(<LuminaSidebar {...defaultProps} />);
    // Find the 学习 (study) button
    const studyBtn = screen.getByRole('button', { name: /学习/i });
    fireEvent.click(studyBtn);
    expect(defaultProps.onNavigate).toHaveBeenCalledTimes(1);
    expect(defaultProps.onNavigate).toHaveBeenCalledWith('study');
  });

  it('calls onNavigate with snapshot route', () => {
    render(<LuminaSidebar {...defaultProps} />);
    const snapshotBtn = screen.getByRole('button', { name: /快照/i });
    fireEvent.click(snapshotBtn);
    expect(defaultProps.onNavigate).toHaveBeenCalledWith('snapshot');
  });

  it('calls onNavigate with profile route', () => {
    render(<LuminaSidebar {...defaultProps} />);
    const profileBtn = screen.getByRole('button', { name: /个人资料/i });
    fireEvent.click(profileBtn);
    expect(defaultProps.onNavigate).toHaveBeenCalledWith('profile');
  });

  it('renders in collapsed state without crashing', () => {
    render(<LuminaSidebar {...defaultProps} collapsed={true} />);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('calls onNavigate with settings route', () => {
    render(<LuminaSidebar {...defaultProps} />);
    const settingsBtn = screen.getByRole('button', { name: /系统设置/i });
    fireEvent.click(settingsBtn);
    expect(defaultProps.onNavigate).toHaveBeenCalledWith('settings');
  });
});
