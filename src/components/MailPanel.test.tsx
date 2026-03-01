/**
 * Component tests for MailPanel
 *
 * Tests the email panel for viewing messages
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Mock database service
vi.mock('../services/databaseService', () => ({
  getMails: vi.fn(),
  markMailAsRead: vi.fn(),
  deleteMail: vi.fn(),
}));

// Mock Avatar component
vi.mock('../components/Avatar', () => ({
  default: ({ name, avatar, size }: any) => (
    <div data-testid="avatar" data-name={name} data-size={size}>
      {name.charAt(0)}
    </div>
  ),
}));

// Mock lucide-react
vi.mock('lucide-react', () => ({
  X: () => <span data-testid="icon">X</span>,
  Mail: () => <span data-testid="icon">Mail</span>,
  Trash2: () => <span data-testid="icon">Trash2</span>,
}));

describe('MailPanel', () => {
  const mockMails = [
    {
      id: 'mail-1',
      from_name: 'Alice',
      from_avatar: '',
      subject: 'Test Subject 1',
      preview: 'This is a test preview...',
      content: {},
      is_read: false,
      created_at: new Date().toISOString(),
    },
    {
      id: 'mail-2',
      from_name: 'Bob',
      from_avatar: '',
      subject: 'Test Subject 2',
      preview: 'Another test preview...',
      content: {},
      is_read: true,
      created_at: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render modal when isOpen is true', async () => {
    const { getMails } = await import('../services/databaseService');
    getMails.mockResolvedValue([]);

    const MailPanel = (await import('../components/MailPanel')).default;

    render(
      <MailPanel
        isOpen={true}
        onClose={() => {}}
      />
    );

    expect(screen.getByText('邮件')).toBeDefined();
  });

  it('should not render when isOpen is false', async () => {
    const MailPanel = (await import('../components/MailPanel')).default;

    const { container } = render(
      <MailPanel
        isOpen={false}
        onClose={() => {}}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should call onClose when close button is clicked', async () => {
    const { getMails } = await import('../services/databaseService');
    getMails.mockResolvedValue([]);

    const MailPanel = (await import('../components/MailPanel')).default;
    const onClose = vi.fn();

    render(
      <MailPanel
        isOpen={true}
        onClose={onClose}
      />
    );

    const closeButton = screen.getByRole('button', { name: '关闭邮件面板' });
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('should display mail list', async () => {
    const { getMails } = await import('../services/databaseService');
    getMails.mockResolvedValue(mockMails);

    const MailPanel = (await import('../components/MailPanel')).default;

    render(
      <MailPanel
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Test Subject 1')).toBeDefined();
      expect(screen.getByText('Test Subject 2')).toBeDefined();
    });
  });

  it('should show unread count', async () => {
    const { getMails } = await import('../services/databaseService');
    getMails.mockResolvedValue(mockMails);

    const MailPanel = (await import('../components/MailPanel')).default;

    render(
      <MailPanel
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('1 封未读')).toBeDefined();
    });
  });

  it('should show empty state when no mails', async () => {
    const { getMails } = await import('../services/databaseService');
    getMails.mockResolvedValue([]);

    const MailPanel = (await import('../components/MailPanel')).default;

    render(
      <MailPanel
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('没有邮件')).toBeDefined();
    });
  });

  it('should call markMailAsRead when clicking unread mail', async () => {
    const { getMails, markMailAsRead } = await import('../services/databaseService');
    getMails.mockResolvedValue(mockMails);
    markMailAsRead.mockResolvedValue(undefined);

    const MailPanel = (await import('../components/MailPanel')).default;

    render(
      <MailPanel
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      const mailItem = screen.getByText('Test Subject 1');
      fireEvent.click(mailItem);
    });

    expect(markMailAsRead).toHaveBeenCalledWith('mail-1');
  });

  it('should show mail detail when mail is selected', async () => {
    const { getMails } = await import('../services/databaseService');
    getMails.mockResolvedValue(mockMails);

    const MailPanel = (await import('../components/MailPanel')).default;

    render(
      <MailPanel
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      const mailItem = screen.getByText('Test Subject 1');
      fireEvent.click(mailItem);
    });

    // Should show mail content in detail view
    expect(screen.getByText('Alice')).toBeDefined();
  });

  it('should delete mail when delete button is clicked', async () => {
    const { getMails, deleteMail } = await import('../services/databaseService');
    getMails.mockResolvedValue(mockMails);
    deleteMail.mockResolvedValue(undefined);

    const MailPanel = (await import('../components/MailPanel')).default;

    render(
      <MailPanel
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      fireEvent.click(screen.getByText('Test Subject 1'));
    });

    // Find and click delete button (we need to find it by icon or text)
    const deleteButton = screen.getByRole('button');
    fireEvent.click(deleteButton);

    expect(deleteMail).toHaveBeenCalledWith('mail-1');
  });
});
