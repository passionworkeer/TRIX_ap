import React, { useState } from 'react';
import { Lock, Loader2, Sparkles, User, Wand2, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import GlassPanel from '../components/GlassPanel';
import { AppRoutes } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { AUTH_VALIDATION, getValidationErrorMessage, validateString } from '../lib/validation';
import i18n from '../i18n';

const AuthShell: React.FC<{
  title: string;
  subtitle: string;
  children: React.ReactNode;
}> = ({ title, subtitle, children }) => (
  <div className="relative flex min-h-screen w-full flex-col justify-between overflow-hidden bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 px-8 py-10 dark:from-slate-900 dark:via-purple-950 dark:to-slate-900">
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -right-[10%] -top-[10%] h-[500px] w-[500px] animate-pulse rounded-full bg-purple-300/20 blur-[100px]" />
      <div className="absolute -left-[20%] top-[20%] h-[400px] w-[400px] animate-pulse rounded-full bg-pink-300/30 blur-[90px] delay-700" />
      <div className="absolute -right-[10%] bottom-[10%] h-[300px] w-[300px] animate-pulse rounded-full bg-indigo-300/20 blur-[80px] delay-500" />
      <div className="absolute left-10 top-1/4 h-2 w-2 animate-ping rounded-full bg-purple-400/40" />
      <div className="absolute right-16 top-1/3 h-3 w-3 animate-ping rounded-full bg-pink-400/30 delay-300" />
      <div className="absolute bottom-1/3 left-1/4 h-2 w-2 animate-ping rounded-full bg-indigo-400/40 delay-700" />
    </div>

    <div className="relative z-10 flex flex-1 flex-col items-center justify-center -mt-10">
      <div className="text-center">
        <div className="relative mb-6">
          <div className="animate-float mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-2xl shadow-purple-500/40">
            <Sparkles className="h-10 w-10 text-white" />
          </div>
          <div className="absolute -bottom-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-xs shadow-lg animate-pulse">
            ✨
          </div>
        </div>

        <h1 className="mb-3 text-4xl font-extrabold tracking-tight text-slate-800 dark:text-white">{title}</h1>
        <p className="text-base font-medium tracking-wide text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>
    </div>

    <div className="relative z-10 mb-6 w-full">{children}</div>
  </div>
);

const MessageBanner: React.FC<{
  tone: 'error' | 'success';
  text: string;
}> = ({ tone, text }) => {
  const isError = tone === 'error';

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${
        isError
          ? 'border-red-200/70 bg-red-50/90 text-red-600 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400'
          : 'border-green-200/70 bg-green-50/90 text-green-600 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg">{isError ? '⚠️' : '🎉'}</span>
        <span>{text}</span>
      </div>
    </div>
  );
};

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { enterDemoMode, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const handleLogin = async () => {
    setError('');

    const emailError = validateString(email, AUTH_VALIDATION.email, 'email');
    if (emailError) {
      setError(getValidationErrorMessage(emailError));
      return;
    }

    const passwordError = validateString(password, AUTH_VALIDATION.password, 'password');
    if (passwordError) {
      setError(getValidationErrorMessage(passwordError));
      return;
    }

    setLoading(true);
    const { error: signInError } = await signIn(email, password);

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    navigate(AppRoutes.HOME);
  };

  const handleEnterDemo = async () => {
    setError('');
    setDemoLoading(true);
    localStorage.setItem('language', 'en');
    localStorage.setItem('i18nextLng', 'en');
    await i18n.changeLanguage('en');
    await enterDemoMode();
    navigate(AppRoutes.HOME);
  };

  return (
    <AuthShell title="欢迎回来" subtitle="继续探索 TRIX 3D Companion">
      {error && <MessageBanner tone="error" text={error} />}

      <div className="space-y-4">
        <GlassPanel className="group flex items-center rounded-2xl !border-white/50 px-5 py-4 transition-all duration-300 focus-within:!bg-white/80 focus-within:!ring-2 focus-within:!ring-purple-500/50 dark:!border-white/10 dark:focus-within:!bg-white/20">
          <Mail className="text-slate-400 transition-colors group-focus-within:text-purple-600 dark:group-focus-within:text-purple-400" size={22} />
          <label htmlFor="email-input" className="sr-only">邮箱</label>
          <input
            id="email-input"
            type="email"
            placeholder="邮箱地址"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            maxLength={AUTH_VALIDATION.email.max}
            className="h-6 w-full border-none bg-transparent p-0 pl-3 text-base font-medium text-slate-700 placeholder:text-slate-400 focus:ring-0 dark:text-slate-200 dark:placeholder:text-slate-500"
          />
        </GlassPanel>

        <GlassPanel className="group flex items-center rounded-2xl !border-white/50 px-5 py-4 transition-all duration-300 focus-within:!bg-white/80 focus-within:!ring-2 focus-within:!ring-purple-500/50 dark:!border-white/10 dark:focus-within:!bg-white/20">
          <Lock className="text-slate-400 transition-colors group-focus-within:text-purple-600 dark:group-focus-within:text-purple-400" size={22} />
          <label htmlFor="password-input" className="sr-only">密码</label>
          <input
            id="password-input"
            type="password"
            placeholder="密码"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void handleLogin();
              }
            }}
            maxLength={AUTH_VALIDATION.password.max}
            className="h-6 w-full border-none bg-transparent p-0 pl-3 text-base font-medium text-slate-700 placeholder:text-slate-400 focus:ring-0 dark:text-slate-200 dark:placeholder:text-slate-500"
          />
        </GlassPanel>
      </div>

      <div className="mt-6 space-y-3">
        <button
          type="button"
          onClick={() => void handleLogin()}
          disabled={loading || demoLoading}
          className="ios-pressable ios-primary-button flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-lg font-bold text-white shadow-lg shadow-violet-500/40 transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>登录中...</span>
            </>
          ) : (
            <>
              <span>登录</span>
              <span>→</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => void handleEnterDemo()}
          disabled={loading || demoLoading}
          className="ios-pressable flex w-full items-center justify-center gap-2 rounded-2xl border border-violet-200 bg-white/75 py-4 text-base font-semibold text-violet-700 shadow-lg shadow-violet-200/40 transition-all duration-300 hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50 dark:border-violet-500/30 dark:bg-slate-900/40 dark:text-violet-300"
        >
          {demoLoading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>正在进入 Demo...</span>
            </>
          ) : (
            <>
              <Wand2 className="h-5 w-5" />
              <span>进入 Demo（Mock 数据）</span>
            </>
          )}
        </button>

        <p className="px-2 text-center text-xs text-slate-500 dark:text-slate-400">
          用于离线展示：自动注入演示账号、聊天、积分和商城数据。
        </p>
      </div>

      <div className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        还没有账号？
        <button
          type="button"
          onClick={() => navigate(AppRoutes.REGISTER)}
          className="ios-pressable rounded-full px-2 py-1 font-bold text-violet-600 transition-colors hover:text-violet-500 dark:text-violet-400 dark:hover:text-violet-300"
        >
          立即注册
        </button>
      </div>
    </AuthShell>
  );
};

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setError('');

    const usernameError = validateString(username, AUTH_VALIDATION.username, 'username');
    if (usernameError) {
      setError(getValidationErrorMessage(usernameError));
      return;
    }

    const emailError = validateString(email, AUTH_VALIDATION.email, 'email');
    if (emailError) {
      setError(getValidationErrorMessage(emailError));
      return;
    }

    const passwordError = validateString(password, AUTH_VALIDATION.password, 'password');
    if (passwordError) {
      setError(getValidationErrorMessage(passwordError));
      return;
    }

    setLoading(true);
    const { error: signUpError } = await signUp(email, password, username);

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
    window.setTimeout(() => navigate(AppRoutes.LOGIN), 1200);
  };

  return (
    <AuthShell title="创建账号" subtitle="快速开启你的 TRIX 陪伴式学习体验">
      {error && <MessageBanner tone="error" text={error} />}
      {success && <MessageBanner tone="success" text="注册成功，正在跳转到登录页..." />}

      <div className="space-y-4">
        <GlassPanel className="group flex items-center rounded-2xl !border-white/50 px-4 py-3.5 transition-all duration-300 focus-within:!bg-white/80 focus-within:!ring-2 focus-within:!ring-violet-500/50 dark:!border-white/10 dark:focus-within:!bg-white/20">
          <User className="text-slate-400 transition-colors group-focus-within:text-violet-600 dark:group-focus-within:text-violet-400" size={20} />
          <label htmlFor="username-input" className="sr-only">用户名</label>
          <input
            id="username-input"
            type="text"
            placeholder="用户名"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            maxLength={AUTH_VALIDATION.username.max}
            className="h-6 w-full border-none bg-transparent p-0 pl-3 text-base font-medium text-slate-700 placeholder:text-slate-400 focus:ring-0 dark:text-slate-200 dark:placeholder:text-slate-500"
          />
        </GlassPanel>

        <GlassPanel className="group flex items-center rounded-2xl !border-white/50 px-4 py-3.5 transition-all duration-300 focus-within:!bg-white/80 focus-within:!ring-2 focus-within:!ring-violet-500/50 dark:!border-white/10 dark:focus-within:!bg-white/20">
          <Mail className="text-slate-400 transition-colors group-focus-within:text-violet-600 dark:group-focus-within:text-violet-400" size={20} />
          <label htmlFor="email-input" className="sr-only">邮箱地址</label>
          <input
            id="email-input"
            type="email"
            placeholder="邮箱地址"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            maxLength={AUTH_VALIDATION.email.max}
            className="h-6 w-full border-none bg-transparent p-0 pl-3 text-base font-medium text-slate-700 placeholder:text-slate-400 focus:ring-0 dark:text-slate-200 dark:placeholder:text-slate-500"
          />
        </GlassPanel>

        <GlassPanel className="group flex items-center rounded-2xl !border-white/50 px-4 py-3.5 transition-all duration-300 focus-within:!bg-white/80 focus-within:!ring-2 focus-within:!ring-violet-500/50 dark:!border-white/10 dark:focus-within:!bg-white/20">
          <Lock className="text-slate-400 transition-colors group-focus-within:text-violet-600 dark:group-focus-within:text-violet-400" size={20} />
          <label htmlFor="password-input" className="sr-only">设置密码</label>
          <input
            id="password-input"
            type="password"
            placeholder="设置密码 (至少 6 位)"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void handleRegister();
              }
            }}
            maxLength={AUTH_VALIDATION.password.max}
            className="h-6 w-full border-none bg-transparent p-0 pl-3 text-base font-medium text-slate-700 placeholder:text-slate-400 focus:ring-0 dark:text-slate-200 dark:placeholder:text-slate-500"
          />
        </GlassPanel>
      </div>

      <button
        type="button"
        onClick={() => void handleRegister()}
        disabled={loading || success}
        className="ios-pressable ios-primary-button mt-6 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-lg font-bold text-white shadow-lg shadow-violet-500/40 transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>注册中...</span>
          </>
        ) : success ? (
          <>
            <span>✓</span>
            <span>注册成功</span>
          </>
        ) : (
          <>
            <span>立即注册</span>
            <span>→</span>
          </>
        )}
      </button>

      <div className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        已有账号？
        <button
          type="button"
          onClick={() => navigate(AppRoutes.LOGIN)}
          className="ios-pressable rounded-full px-2 py-1 font-bold text-violet-600 transition-colors hover:text-violet-500 dark:text-violet-400 dark:hover:text-violet-300"
        >
          立即登录
        </button>
      </div>
    </AuthShell>
  );
};
