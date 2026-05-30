import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Login, Register } from './Auth';
import { AppRoutes } from '../types';

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'auth.welcomeBack': '欢迎回来',
        'auth.welcome': '欢迎加入',
        'auth.exploreWorld': '开启你的智能学习之旅',
        'auth.startJourney': '与 TRIX 一起踏上学习之旅',
        'auth.placeholder.email': '邮箱',
        'auth.placeholder.password': '密码',
        'auth.placeholder.username': '用户名',
        'auth.placeholder.passwordMin': '设置密码 (至少 6 位)',
        'auth.login': '登录',
        'auth.loggingIn': '登录中...',
        'auth.registering': '注册中...',
        'auth.registerSuccess': '注册成功',
        'auth.joinNow': '立即注册',
        'auth.signUpNow': '立即注册',
        'auth.noAccount': '还没有账号?',
        'auth.hasAccount': '已有账号?',
        'auth.loginNow': '立即登录',
        'auth.thirdPartyLogin': '或',
        'auth.wechatLogin': '微信登录',
        'auth.appleLogin': 'Apple 登录',
        'auth.email': '邮箱',
        'auth.password': '密码',
        'auth.username': '用户名',
      };
      return translations[key] || key;
    },
  }),
}));

// Mock hooks
const mocks = vi.hoisted(() => ({
  signIn: vi.fn(async () => ({ error: null })),
  signUp: vi.fn(async () => ({ error: null })),
  navigate: vi.fn()
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate
  };
});

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    signIn: mocks.signIn,
    signUp: mocks.signUp
  })
}));

describe('Auth - Login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.signIn.mockResolvedValue({ error: null });
    mocks.navigate.mockClear();
  });

  const renderLogin = () => {
    return render(
      <MemoryRouter initialEntries={[AppRoutes.LOGIN]}>
        <Routes>
          <Route path={AppRoutes.LOGIN} element={<Login />} />
          <Route path={AppRoutes.REGISTER} element={<Register />} />
          <Route path={AppRoutes.HOME} element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('renders login form with email and password inputs', () => {
    renderLogin();

    expect(screen.getByText('欢迎回来')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('邮箱')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('密码')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '登录 →' })).toBeInTheDocument();
  });

  it('shows validation error when submitting empty form', async () => {
    renderLogin();

    fireEvent.click(screen.getByRole('button', { name: '登录 →' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      // Component shows first validation error only (email is checked first)
      expect(screen.getByText('请输入邮箱')).toBeInTheDocument();
    });
  });

  it('shows validation error when email is empty', async () => {
    renderLogin();

    fireEvent.input(screen.getByPlaceholderText('密码'), {
      target: { value: 'password123' }
    });
    fireEvent.click(screen.getByRole('button', { name: '登录 →' }));

    await waitFor(() => {
      expect(screen.getByText('请输入邮箱')).toBeInTheDocument();
    });
  });

  it('shows validation error when password is empty', async () => {
    renderLogin();

    fireEvent.input(screen.getByPlaceholderText('邮箱'), {
      target: { value: 'test@example.com' }
    });
    fireEvent.click(screen.getByRole('button', { name: '登录 →' }));

    await waitFor(() => {
      expect(screen.getByText('请输入密码')).toBeInTheDocument();
    });
  });

  it('calls signIn with correct credentials on submit', async () => {
    renderLogin();

    fireEvent.input(screen.getByPlaceholderText('邮箱'), {
      target: { value: 'test@example.com' }
    });
    fireEvent.input(screen.getByPlaceholderText('密码'), {
      target: { value: 'password123' }
    });
    fireEvent.click(screen.getByRole('button', { name: '登录 →' }));

    await waitFor(() => {
      expect(mocks.signIn).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });

  it('allows seeded demo password length on login', async () => {
    renderLogin();

    fireEvent.input(screen.getByPlaceholderText('邮箱'), {
      target: { value: 'test1@trix.app' }
    });
    fireEvent.input(screen.getByPlaceholderText('密码'), {
      target: { value: '123456' }
    });
    fireEvent.click(screen.getByRole('button', { name: '登录 →' }));

    await waitFor(() => {
      expect(mocks.signIn).toHaveBeenCalledWith('test1@trix.app', '123456');
    });
  });

  it('shows loading state during login', async () => {
    mocks.signIn.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ error: null }), 100))
    );

    renderLogin();

    fireEvent.input(screen.getByPlaceholderText('邮箱'), {
      target: { value: 'test@example.com' }
    });
    fireEvent.input(screen.getByPlaceholderText('密码'), {
      target: { value: 'password123' }
    });
    // Click the submit button
    fireEvent.click(screen.getByRole('button', { name: '登录 →' }));

    expect(screen.getByText('登录中...')).toBeInTheDocument();
    // Button should be disabled during loading
    expect(screen.getByText('登录中...').closest('button')).toBeDisabled();
  });

  it('navigates to home on successful login', async () => {
    renderLogin();

    fireEvent.input(screen.getByPlaceholderText('邮箱'), {
      target: { value: 'test@example.com' }
    });
    fireEvent.input(screen.getByPlaceholderText('密码'), {
      target: { value: 'password123' }
    });
    fireEvent.click(screen.getByRole('button', { name: '登录 →' }));

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith(AppRoutes.HOME);
    });
  });

  it('shows error message on login failure', async () => {
    const mockError = new Error('Invalid login credentials');
    mockError.message = 'Invalid login credentials';
    mocks.signIn.mockResolvedValue({ error: mockError });

    renderLogin();

    fireEvent.input(screen.getByPlaceholderText('邮箱'), {
      target: { value: 'wrong@example.com' }
    });
    fireEvent.input(screen.getByPlaceholderText('密码'), {
      target: { value: 'wrongpassword' }
    });
    fireEvent.click(screen.getByRole('button', { name: '登录 →' }));

    await waitFor(() => {
      expect(screen.getByText('Invalid login credentials')).toBeInTheDocument();
    });
  });

  it('navigates to register page when clicking register link', () => {
    renderLogin();

    fireEvent.click(screen.getByRole('button', { name: '立即注册' }));

    expect(mocks.navigate).toHaveBeenCalledWith(AppRoutes.REGISTER);
  });

  it('handles Enter key to submit login', async () => {
    renderLogin();

    fireEvent.input(screen.getByPlaceholderText('邮箱'), {
      target: { value: 'test@example.com' }
    });
    fireEvent.input(screen.getByPlaceholderText('密码'), {
      target: { value: 'password123' }
    });
    fireEvent.keyDown(screen.getByPlaceholderText('密码'), { key: 'Enter' });

    await waitFor(() => {
      expect(mocks.signIn).toHaveBeenCalled();
    });
  });
});

describe('Auth - Register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.signUp.mockResolvedValue({ error: null });
    mocks.navigate.mockClear();
  });

  const renderRegister = () => {
    return render(
      <MemoryRouter initialEntries={[AppRoutes.REGISTER]}>
        <Routes>
          <Route path={AppRoutes.LOGIN} element={<Login />} />
          <Route path={AppRoutes.REGISTER} element={<Register />} />
          <Route path={AppRoutes.HOME} element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('renders register form with username, email and password inputs', () => {
    renderRegister();

    expect(screen.getByText('欢迎加入')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('用户名')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('邮箱')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('密码')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '立即注册 →' })).toBeInTheDocument();
  });

  it('shows validation error when submitting empty form', async () => {
    renderRegister();

    fireEvent.click(screen.getByRole('button', { name: '立即注册 →' }));

    await waitFor(() => {
      // Component shows first validation error only (username is checked first)
      expect(screen.getByText('请输入用户名')).toBeInTheDocument();
    });
  });

  it('shows validation error when username is empty', async () => {
    renderRegister();

    fireEvent.input(screen.getByPlaceholderText('邮箱'), {
      target: { value: 'test@example.com' }
    });
    fireEvent.input(screen.getByPlaceholderText('密码'), {
      target: { value: 'password123' }
    });
    fireEvent.click(screen.getByRole('button', { name: '立即注册 →' }));

    await waitFor(() => {
      expect(screen.getByText('请输入用户名')).toBeInTheDocument();
    });
  });

  it('shows validation error when password is too short', async () => {
    renderRegister();

    fireEvent.input(screen.getByPlaceholderText('用户名'), {
      target: { value: 'testuser' }
    });
    fireEvent.input(screen.getByPlaceholderText('邮箱'), {
      target: { value: 'test@example.com' }
    });
    fireEvent.input(screen.getByPlaceholderText('密码'), {
      target: { value: '12345' }
    });
    fireEvent.click(screen.getByRole('button', { name: '立即注册 →' }));

    await waitFor(() => {
      // AUTH_VALIDATION.password.min is 8, so the error says 8 characters
      expect(screen.getByText('密码至少需要8个字符')).toBeInTheDocument();
    });
  });

  it('calls signUp with correct data on submit', async () => {
    renderRegister();

    fireEvent.input(screen.getByPlaceholderText('用户名'), {
      target: { value: 'testuser' }
    });
    fireEvent.input(screen.getByPlaceholderText('邮箱'), {
      target: { value: 'test@example.com' }
    });
    fireEvent.input(screen.getByPlaceholderText('密码'), {
      target: { value: 'password123' }
    });
    fireEvent.click(screen.getByRole('button', { name: '立即注册 →' }));

    await waitFor(() => {
      expect(mocks.signUp).toHaveBeenCalledWith('test@example.com', 'password123', 'testuser');
    });
  });

  it('shows loading state during registration', async () => {
    mocks.signUp.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ error: null }), 100))
    );

    renderRegister();

    fireEvent.input(screen.getByPlaceholderText('用户名'), {
      target: { value: 'testuser' }
    });
    fireEvent.input(screen.getByPlaceholderText('邮箱'), {
      target: { value: 'test@example.com' }
    });
    fireEvent.input(screen.getByPlaceholderText('密码'), {
      target: { value: 'password123' }
    });

    // Find and click the submit button
    fireEvent.click(screen.getByRole('button', { name: '立即注册 →' }));

    expect(screen.getByText('注册中...')).toBeInTheDocument();
    // The button should be disabled during loading
    expect(screen.getByText('注册中...').closest('button')).toBeDisabled();
  });

  it('shows success message on successful registration', async () => {
    renderRegister();

    fireEvent.input(screen.getByPlaceholderText('用户名'), {
      target: { value: 'testuser' }
    });
    fireEvent.input(screen.getByPlaceholderText('邮箱'), {
      target: { value: 'test@example.com' }
    });
    fireEvent.input(screen.getByPlaceholderText('密码'), {
      target: { value: 'password123' }
    });
    fireEvent.click(screen.getByRole('button', { name: '立即注册 →' }));

    await waitFor(() => {
      // Success message appears in both the alert div and the button
      // Use getAllByText to find all occurrences
      const successElements = screen.getAllByText(/注册成功/);
      expect(successElements.length).toBeGreaterThan(0);
    });
  });

  it('shows error message on registration failure', async () => {
    const mockError = new Error('Email already registered');
    mockError.message = 'Email already registered';
    mocks.signUp.mockResolvedValue({ error: mockError });

    renderRegister();

    fireEvent.input(screen.getByPlaceholderText('用户名'), {
      target: { value: 'testuser' }
    });
    fireEvent.input(screen.getByPlaceholderText('邮箱'), {
      target: { value: 'existing@example.com' }
    });
    fireEvent.input(screen.getByPlaceholderText('密码'), {
      target: { value: 'password123' }
    });
    fireEvent.click(screen.getByRole('button', { name: '立即注册 →' }));

    await waitFor(() => {
      expect(screen.getByText('Email already registered')).toBeInTheDocument();
    });
  });

  it('navigates to login page when clicking login link', () => {
    renderRegister();

    fireEvent.click(screen.getByRole('button', { name: '立即登录' }));

    expect(mocks.navigate).toHaveBeenCalledWith(AppRoutes.LOGIN);
  });

  it('handles Enter key to submit registration', async () => {
    renderRegister();

    fireEvent.input(screen.getByPlaceholderText('用户名'), {
      target: { value: 'testuser' }
    });
    fireEvent.input(screen.getByPlaceholderText('邮箱'), {
      target: { value: 'test@example.com' }
    });
    fireEvent.input(screen.getByPlaceholderText('密码'), {
      target: { value: 'password123' }
    });
    fireEvent.keyDown(screen.getByPlaceholderText('密码'), { key: 'Enter' });

    await waitFor(() => {
      expect(mocks.signUp).toHaveBeenCalled();
    });
  });

  it('button shows 注册成功 after successful registration', async () => {
    mocks.signUp.mockResolvedValue({ error: null });

    renderRegister();

    fireEvent.input(screen.getByPlaceholderText('用户名'), {
      target: { value: 'testuser' }
    });
    fireEvent.input(screen.getByPlaceholderText('邮箱'), {
      target: { value: 'test@example.com' }
    });
    fireEvent.input(screen.getByPlaceholderText('密码'), {
      target: { value: 'password123' }
    });
    fireEvent.click(screen.getByRole('button', { name: '立即注册 →' }));

    await waitFor(() => {
      // Button changes to success state showing '✓ 注册成功'
      expect(screen.getByRole('button', { name: /注册成功/ })).toBeInTheDocument();
    });
  });
});
