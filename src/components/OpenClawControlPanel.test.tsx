/**
 * Component tests for OpenClawControlPanel
 *
 * Tests OpenClaw control panel
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Mock ThemeContext
vi.mock('../contexts/ThemeContext', () => ({
  useTheme: () => ({ isDark: false }),
}));

// Mock ClawbotChannelContext
vi.mock('../contexts/ClawbotChannelContext', () => ({
  useClawbotChannel: () => ({
    status: 'CONNECTED',
    isConnected: true,
    isPaired: true,
    botOnline: true,
    pairingStatus: 'paired',
    pairingCode: 'ABC123',
    deviceId: 'device-1',
    messages: [],
    connect: vi.fn(),
    disconnect: vi.fn(),
    unpair: vi.fn(),
    lastError: null,
  }),
}));

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock getClawbotEndpoints
vi.mock('../config/clawbotEndpoints', () => ({
  getClawbotEndpoints: () => ({
    nativePublicUrl: 'https://example.com',
    nativeServerUrl: 'https://server.example.com',
  }),
}));

// Mock useConfirmModal
vi.mock('../hooks/useConfirmModal', () => ({
  useConfirmModal: () => ({
    requestConfirm: vi.fn().mockResolvedValue(true),
    ConfirmModalRenderer: () => null,
  }),
}));

describe('OpenClawControlPanel', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render nothing when isOpen is false', async () => {
    const OpenClawControlPanel = (await import('./OpenClawControlPanel')).OpenClawControlPanel;

    const { container } = render(<OpenClawControlPanel {...defaultProps} isOpen={false} />);

    expect(container.firstChild).toBeNull();
  });

  it('should render panel when isOpen is true', async () => {
    const OpenClawControlPanel = (await import('./OpenClawControlPanel')).OpenClawControlPanel;

    render(<OpenClawControlPanel {...defaultProps} />);

    expect(screen.getByText('Trix Native 状态面板')).toBeInTheDocument();
  });

  it('should render close button', async () => {
    const OpenClawControlPanel = (await import('./OpenClawControlPanel')).OpenClawControlPanel;

    render(<OpenClawControlPanel {...defaultProps} />);

    const closeButton = document.querySelector('button');
    expect(closeButton).toBeTruthy();
  });

  it('should call onClose when close button is clicked', async () => {
    const OpenClawControlPanel = (await import('./OpenClawControlPanel')).OpenClawControlPanel;

    render(<OpenClawControlPanel {...defaultProps} />);

    const closeButton = document.querySelector('button');
    if (closeButton) {
      fireEvent.click(closeButton);
      expect(defaultProps.onClose).toHaveBeenCalled();
    }
  });

  it('should render status items', async () => {
    const OpenClawControlPanel = (await import('./OpenClawControlPanel')).OpenClawControlPanel;

    render(<OpenClawControlPanel {...defaultProps} />);

    expect(screen.getByText('服务地址')).toBeInTheDocument();
    expect(screen.getByText('连接状态')).toBeInTheDocument();
    expect(screen.getByText('配对状态')).toBeInTheDocument();
    expect(screen.getByText('设备 ID')).toBeInTheDocument();
  });

  it('should render action buttons', async () => {
    const OpenClawControlPanel = (await import('./OpenClawControlPanel')).OpenClawControlPanel;

    render(<OpenClawControlPanel {...defaultProps} />);

    expect(screen.getByText('重新连接')).toBeInTheDocument();
    expect(screen.getByText('断开')).toBeInTheDocument();
    expect(screen.getByText('复制服务地址')).toBeInTheDocument();
    expect(screen.getByText('解绑设备')).toBeInTheDocument();
  });

  it('should render migration explanation section', async () => {
    const OpenClawControlPanel = (await import('./OpenClawControlPanel')).OpenClawControlPanel;

    render(<OpenClawControlPanel {...defaultProps} />);

    expect(screen.getByText('迁移说明')).toBeInTheDocument();
  });

  it('should render session overview section', async () => {
    const OpenClawControlPanel = (await import('./OpenClawControlPanel')).OpenClawControlPanel;

    render(<OpenClawControlPanel {...defaultProps} />);

    expect(screen.getByText('会话概览')).toBeInTheDocument();
    expect(screen.getByText('配对码：ABC123')).toBeInTheDocument();
  });
});
