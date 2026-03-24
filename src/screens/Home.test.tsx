/**
 * Unit tests for Home screen
 *
 * Minimal tests to verify the Home screen renders without crashing.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n';
import Home from './Home';

// Mock react-router-dom before component import
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock ClawbotChannelContext
vi.mock('../contexts/ClawbotChannelContext', () => ({
  useClawbotChannel: () => ({
    isConnected: false,
    isPaired: false,
    isReady: false,
    botState: 'idle',
    messages: [],
    sendMessage: vi.fn(),
    pairWithCode: vi.fn(),
    pairWithQR: vi.fn(),
    unpair: vi.fn(),
    uploadAttachment: vi.fn(),
    status: 'disconnected',
    botOnline: false,
    lastError: null,
  }),
}));

vi.mock('../hooks/useNotification', () => ({
  useNotification: () => ({
    showWarning: vi.fn(),
    showSuccess: vi.fn(),
    showError: vi.fn(),
  }),
}));

vi.mock('../utils/logger', () => ({
  logger: {
    ui: { debug: vi.fn(), error: vi.fn(), info: vi.fn() },
    pairing: { debug: vi.fn(), error: vi.fn() },
  },
}));

vi.mock('../components/MailPanel', () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="mail-panel">MailPanel</div> : null,
}));
vi.mock('../components/NotificationPanel', () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="notification-panel">NotificationPanel</div> : null,
}));
vi.mock('../components/StudyRoom', () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="study-room">StudyRoom</div> : null,
}));
vi.mock('../components/HomeBotBubble', () => ({
  default: () => <div data-testid="home-bot-bubble">HomeBotBubble</div>,
}));
vi.mock('../components/WorkbenchModal', () => ({
  default: ({ isOpen, onCardClick }: { isOpen: boolean; onCardClick: (id: string) => void }) =>
    isOpen ? (
      <div data-testid="workbench-modal">
        <button data-testid="workbench-snapshot" onClick={() => onCardClick('snapshot')}>Snapshot</button>
        <button data-testid="workbench-location" onClick={() => onCardClick('location')}>Location</button>
        <button data-testid="workbench-schedule" onClick={() => onCardClick('schedule')}>Schedule</button>
        <button data-testid="workbench-todo" onClick={() => onCardClick('todo')}>Todo</button>
      </div>
    ) : null,
}));

vi.mock('../features/todo', () => ({
  TodoList: () => <div data-testid="todo-list">TodoList</div>,
  TodoProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="todo-provider">{children}</div>,
}));
vi.mock('../features/schedule', () => ({
  ScheduleList: () => <div data-testid="schedule-list">ScheduleList</div>,
  ScheduleProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="schedule-provider">{children}</div>,
}));
vi.mock('../features/location', () => ({
  LocationPicker: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="location-picker">
        <button data-testid="location-close" onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MemoryRouter>
    <I18nextProvider i18n={i18n}>
      {children}
    </I18nextProvider>
  </MemoryRouter>
);

describe('Home', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', async () => {
    render(
      <TestWrapper>
        <Home />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('home-bot-bubble')).toBeInTheDocument();
    });
  });

  it('renders workbench modal when isUIVisible is true', async () => {
    render(
      <TestWrapper>
        <Home isUIVisible={true} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('workbench-modal')).toBeInTheDocument();
    });
  });

  it('navigates to pairing when snapshot clicked without pairing', async () => {
    render(
      <TestWrapper>
        <Home isUIVisible={true} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('workbench-modal')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('workbench-snapshot'));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled();
    });
  });

  it('opens location picker when location card clicked', async () => {
    render(
      <TestWrapper>
        <Home isUIVisible={true} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('workbench-modal')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('workbench-location'));

    await waitFor(() => {
      expect(screen.getByTestId('location-picker')).toBeInTheDocument();
    });
  });
});
