import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Login, Register } from './Auth';
import { AppRoutes } from '../types';

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

    expect(screen.getByText('欢迎回来')).toBeDefined();
    expect(screen.getByPlaceholderText('邮箱')).toBeDefined();
    expect(screen.getByPlaceholderText('密码')).toBeDefined();
    expect(screen.getByRole('button', { name: '登录' })).toBeDefined();
  });

  it('shows validation error when submitting empty form', async () => {
    renderLogin();

    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
      expect(screen.getByText('请输入邮箱和密码')).toBeDefined();
    });
  });

  it('shows validation error when email is empty', async () => {
    renderLogin();

    fireEvent.input(screen.getByPlaceholderText('密码'), {
      target: { value: 'password123' }
    });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => {
      expect(screen.getByText('请输入邮箱和密码')).toBeDefined();
    });
  });

  it('shows validation error when password is empty', async () => {
    renderLogin();

    fireEvent.input(screen.getByPlaceholderText('邮箱'), {
      target: { value: 'test@example.com' }
    });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => {
      expect(screen.getByText('请输入邮箱和密码')).toBeDefined();
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
    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => {
      expect(mocks.signIn).toHaveBeenCalledWith('test@example.com', 'password123');
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
    // Click the submit button using exact text match
    const buttons = screen.getAllByRole('button');
    const loginButton = buttons.find(btn => btn.textContent === '登录');
    fireEvent.click(loginButton!);

    expect(screen.getByText('登录中...')).toBeDefined();
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
    fireEvent.click(screen.getByRole('button', { name: '登录' }));

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
    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => {
      expect(screen.getByText('Invalid login credentials')).toBeDefined();
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

    expect(screen.getByText('欢迎加入')).toBeDefined();
    expect(screen.getByPlaceholderText('用户名')).toBeDefined();
    expect(screen.getByPlaceholderText('邮箱')).toBeDefined();
    expect(screen.getByPlaceholderText('设置密码 (至少 6 位)')).toBeDefined();
    expect(screen.getByRole('button', { name: '立即注册' })).toBeDefined();
  });

  it('shows validation error when submitting empty form', async () => {
    renderRegister();

    fireEvent.click(screen.getByRole('button', { name: '立即注册' }));

    await waitFor(() => {
      expect(screen.getByText('请填写所有字段')).toBeDefined();
    });
  });

  it('shows validation error when username is empty', async () => {
    renderRegister();

    fireEvent.input(screen.getByPlaceholderText('邮箱'), {
      target: { value: 'test@example.com' }
    });
    fireEvent.input(screen.getByPlaceholderText('设置密码 (至少 6 位)'), {
      target: { value: 'password123' }
    });
    fireEvent.click(screen.getByRole('button', { name: '立即注册' }));

    await waitFor(() => {
      expect(screen.getByText('请填写所有字段')).toBeDefined();
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
    fireEvent.input(screen.getByPlaceholderText('设置密码 (至少 6 位)'), {
      target: { value: '12345' }
    });
    fireEvent.click(screen.getByRole('button', { name: '立即注册' }));

    await waitFor(() => {
      expect(screen.getByText('密码至少需要 6 个字符')).toBeDefined();
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
    fireEvent.input(screen.getByPlaceholderText('设置密码 (至少 6 位)'), {
      target: { value: 'password123' }
    });
    fireEvent.click(screen.getByRole('button', { name: '立即注册' }));

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
    fireEvent.input(screen.getByPlaceholderText('设置密码 (至少 6 位)'), {
      target: { value: 'password123' }
    });

    // Find and click the submit button
    const buttons = screen.getAllByRole('button');
    const submitButton = buttons.find(btn => btn.textContent === '立即注册');
    fireEvent.click(submitButton!);

    expect(screen.getByText('注册中...')).toBeDefined();
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
    fireEvent.input(screen.getByPlaceholderText('设置密码 (至少 6 位)'), {
      target: { value: 'password123' }
    });
    fireEvent.click(screen.getByRole('button', { name: '立即注册' }));

    await waitFor(() => {
      expect(screen.getByText('注册成功！正在跳转...')).toBeDefined();
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
    fireEvent.input(screen.getByPlaceholderText('设置密码 (至少 6 位)'), {
      target: { value: 'password123' }
    });
    fireEvent.click(screen.getByRole('button', { name: '立即注册' }));

    await waitFor(() => {
      expect(screen.getByText('Email already registered')).toBeDefined();
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
    fireEvent.input(screen.getByPlaceholderText('设置密码 (至少 6 位)'), {
      target: { value: 'password123' }
    });
    fireEvent.keyDown(screen.getByPlaceholderText('设置密码 (至少 6 位)'), { key: 'Enter' });

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
    fireEvent.input(screen.getByPlaceholderText('设置密码 (至少 6 位)'), {
      target: { value: 'password123' }
    });
    fireEvent.click(screen.getByRole('button', { name: '立即注册' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '注册成功' })).toBeDefined();
    });
  });
});
