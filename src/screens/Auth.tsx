import React, { useState } from 'react';
import { User, Lock, Smartphone, Loader2, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import GlassPanel from '../components/GlassPanel';
import { AppRoutes } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { AUTH_VALIDATION, validateString, getValidationErrorMessage } from '../lib/validation';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError('');

    // Validate email
    const emailError = validateString(email, AUTH_VALIDATION.email, 'email');
    if (emailError) {
      setError(getValidationErrorMessage(emailError));
      return;
    }

    // Validate password
    const passwordError = validateString(password, AUTH_VALIDATION.password, 'password');
    if (passwordError) {
      setError(getValidationErrorMessage(passwordError));
      return;
    }

    setLoading(true);

    const { error: signInError } = await signIn(email, password);

    if (signInError) {
      // AuthError 总是有 message 属性
      setError(signInError.message);
      setLoading(false);
    } else {
      navigate(AppRoutes.HOME);
    }
  };

  return (
    <div className="h-screen w-full bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 dark:from-slate-900 dark:via-purple-950 dark:to-slate-900 relative overflow-hidden flex flex-col justify-between px-8 py-10">
      {/* Background Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Floating shapes */}
        <div className="absolute -top-[10%] -right-[10%] w-[500px] h-[500px] bg-purple-300/20 rounded-full blur-[100px] animate-pulse"></div>
        <div className="absolute top-[20%] -left-[20%] w-[400px] h-[400px] bg-pink-300/30 rounded-full blur-[90px] animate-pulse delay-700"></div>
        <div className="absolute bottom-[10%] -right-[10%] w-[300px] h-[300px] bg-indigo-300/20 rounded-full blur-[80px] animate-pulse delay-500"></div>

        {/* Decorative dots */}
        <div className="absolute top-1/4 left-10 w-2 h-2 bg-purple-400/40 rounded-full animate-ping"></div>
        <div className="absolute top-1/3 right-16 w-3 h-3 bg-pink-400/30 rounded-full animate-ping delay-300"></div>
        <div className="absolute bottom-1/3 left-1/4 w-2 h-2 bg-indigo-400/40 rounded-full animate-ping delay-700"></div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative -mt-10">
         <div className="text-center relative z-20">
            {/* Logo Icon */}
            <div className="mb-6 relative">
               <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-purple-500/40 animate-float">
                  <Sparkles className="w-10 h-10 text-white" />
               </div>
               <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center shadow-lg animate-pulse">
                  <span className="text-xs">✨</span>
               </div>
            </div>

            <h1 className="text-4xl font-extrabold text-slate-800 dark:text-white tracking-tight mb-3">
               欢迎回来
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-base font-medium tracking-wide">探索无限 3D 世界</p>
         </div>
      </div>

      <div className="w-full space-y-6 relative z-20 mb-6">
         {error && (
           <div role="alert" aria-live="assertive" className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-2xl text-sm animate-shake">
             <div className="flex items-center gap-2">
               <span className="text-lg">⚠️</span>
               {error}
             </div>
           </div>
         )}

         <div className="space-y-4">
            <GlassPanel className="flex items-center px-5 py-4 !bg-white/60 dark:!bg-white/10 !rounded-2xl transition-all duration-300 focus-within:!bg-white/80 dark:focus-within:!bg-white/20 focus-within:!ring-2 focus-within:!ring-purple-500/50 group !border-white/50 dark:!border-white/10">
               <User className="text-slate-400 group-focus-within:text-purple-600 dark:group-focus-within:text-purple-400 transition-colors" size={22} />
               <label htmlFor="email-input" className="sr-only">邮箱</label>
               <input
                 id="email-input"
                 type="email"
                 placeholder="邮箱地址"
                 value={email}
                 onChange={(e) => setEmail(e.target.value)}
                 maxLength={AUTH_VALIDATION.email.max}
                 className="w-full bg-transparent border-none p-0 pl-4 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-0 text-[17px] font-medium"
               />
            </GlassPanel>
            <GlassPanel className="flex items-center px-5 py-4 !bg-white/60 dark:!bg-white/10 !rounded-2xl transition-all duration-300 focus-within:!bg-white/80 dark:focus-within:!bg-white/20 focus-within:!ring-2 focus-within:!ring-purple-500/50 group !border-white/50 dark:!border-white/10">
               <Lock className="text-slate-400 group-focus-within:text-purple-600 dark:group-focus-within:text-purple-400 transition-colors" size={22} />
               <label htmlFor="password-input" className="sr-only">密码</label>
               <input
                 id="password-input"
                 type="password"
                 placeholder="密码"
                 value={password}
                 onChange={(e) => setPassword(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                 maxLength={AUTH_VALIDATION.password.max}
                 className="w-full bg-transparent border-none p-0 pl-4 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-0 text-[17px] font-medium"
               />
            </GlassPanel>
         </div>

         <button
           onClick={handleLogin}
           disabled={loading}
           className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 text-white font-bold text-lg tracking-wider shadow-xl shadow-purple-500/40 hover:shadow-purple-500/60 hover:-translate-y-1 active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-2 group"
         >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                登录中...
              </>
            ) : (
              <>
                <span>登录</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </>
            )}
         </button>

         <div className="flex flex-col items-center space-y-6 pt-2">
            <div className="flex items-center w-full gap-4 opacity-50">
               <div className="h-px bg-slate-300 dark:bg-slate-600 flex-1"></div>
               <span className="text-xs font-bold text-slate-400">第三方登录</span>
               <div className="h-px bg-slate-300 dark:bg-slate-600 flex-1"></div>
            </div>
            <div className="flex gap-5">
               <button
                 className="w-12 h-12 rounded-2xl bg-white/80 dark:bg-white/10 flex items-center justify-center text-green-600 shadow-md border border-white/50 hover:scale-110 hover:shadow-lg hover:shadow-green-500/20 transition-all duration-300"
                 aria-label="微信登录"
               >
                  <span className="font-bold text-xl">W</span>
               </button>
               <button
                 className="w-12 h-12 rounded-2xl bg-white/80 dark:bg-white/10 flex items-center justify-center text-slate-800 dark:text-white shadow-md border border-white/50 hover:scale-110 hover:shadow-lg hover:shadow-black/10 transition-all duration-300"
                 aria-label="Apple 登录"
               >
                  <span className="font-bold text-xl">A</span>
               </button>
            </div>
            <div className="text-[13px] text-slate-500 dark:text-slate-400 font-medium">
               还没有账号？ <button onClick={() => navigate(AppRoutes.REGISTER)} className="text-purple-600 dark:text-purple-400 font-bold hover:text-purple-500 dark:hover:text-purple-300 transition-colors">立即注册</button>
            </div>
         </div>
      </div>
    </div>
  );
};

export const Register: React.FC = () => {
   const navigate = useNavigate();
   const { signUp } = useAuth();
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const [username, setUsername] = useState('');
   const [error, setError] = useState('');
   const [loading, setLoading] = useState(false);
   const [success, setSuccess] = useState(false);

   const handleRegister = async () => {
     setError('');

     // Validate username
     const usernameError = validateString(username, AUTH_VALIDATION.username, 'username');
     if (usernameError) {
       setError(getValidationErrorMessage(usernameError));
       return;
     }

     // Validate email
     const emailError = validateString(email, AUTH_VALIDATION.email, 'email');
     if (emailError) {
       setError(getValidationErrorMessage(emailError));
       return;
     }

     // Validate password
     const passwordError = validateString(password, AUTH_VALIDATION.password, 'password');
     if (passwordError) {
       setError(getValidationErrorMessage(passwordError));
       return;
     }

     setLoading(true);

     const { error: signUpError } = await signUp(email, password, username);

     if (signUpError) {
       // AuthError 总是有 message 属性
       setError(signUpError.message);
       setLoading(false);
     } else {
       setSuccess(true);
       setLoading(false);
       setTimeout(() => {
         navigate(AppRoutes.HOME);
       }, 2000);
     }
   };

   return (
     <div className="h-screen w-full bg-gradient-to-br from-violet-100 via-purple-50 to-indigo-100 dark:from-slate-900 dark:via-purple-950 dark:to-slate-900 relative overflow-hidden flex flex-col justify-between px-8 py-10">
       {/* Background Elements */}
       <div className="absolute inset-0 pointer-events-none overflow-hidden">
         <div className="absolute -top-[10%] -right-[10%] w-[500px] h-[500px] bg-purple-300/20 rounded-full blur-[100px] animate-pulse"></div>
         <div className="absolute top-[30%] -left-[20%] w-[400px] h-[400px] bg-violet-300/30 rounded-full blur-[80px] animate-pulse delay-500"></div>
         <div className="absolute bottom-[20%] right-[10%] w-[250px] h-[250px] bg-indigo-300/20 rounded-full blur-[60px] animate-pulse delay-300"></div>

         {/* Decorative stars */}
         <div className="absolute top-1/4 right-1/4 w-2 h-2 bg-yellow-400/50 rounded-full animate-ping"></div>
         <div className="absolute bottom-1/4 left-1/3 w-1 h-1 bg-pink-400/50 rounded-full animate-ping delay-500"></div>
       </div>

       <div className="flex-1 flex flex-col items-center justify-center relative -mt-4">
          <div className="text-center space-y-2">
             {/* Logo Icon */}
             <div className="mb-4 relative">
               <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-xl shadow-purple-500/30 animate-float">
                  <Sparkles className="w-8 h-8 text-white" />
               </div>
             </div>

             <h1 className="text-3xl font-bold text-slate-800 dark:text-white">欢迎加入</h1>
             <p className="text-slate-500 dark:text-slate-400 text-base font-medium">开启你的 3D 探索之旅</p>
          </div>
       </div>

       <div className="w-full space-y-6 mb-4 relative z-20">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-2xl text-sm animate-shake">
              <div className="flex items-center gap-2">
                <span className="text-lg">⚠️</span>
                {error}
              </div>
            </div>
          )}
          {success && (
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded-2xl text-sm animate-bounce-scale">
              <div className="flex items-center gap-2">
                <span className="text-lg">🎉</span>
                注册成功！正在跳转...
              </div>
            </div>
          )}

          <div className="space-y-4">
             <GlassPanel className="flex items-center px-4 py-3.5 !bg-white/60 dark:!bg-white/10 !rounded-2xl transition-all duration-300 focus-within:!bg-white/80 dark:focus-within:!bg-white/20 focus-within:!ring-2 focus-within:!ring-violet-500/50 group !border-white/50 dark:!border-white/10">
                <User className="text-slate-400 group-focus-within:text-violet-600 dark:group-focus-within:text-violet-400 transition-colors" size={20} />
                <input
                  type="text"
                  placeholder="用户名"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  maxLength={AUTH_VALIDATION.username.max}
                  className="w-full bg-transparent border-none p-0 pl-3 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-0 text-base font-medium h-6"
                />
             </GlassPanel>
             <GlassPanel className="flex items-center px-4 py-3.5 !bg-white/60 dark:!bg-white/10 !rounded-2xl transition-all duration-300 focus-within:!bg-white/80 dark:focus-within:!bg-white/20 focus-within:!ring-2 focus-within:!ring-violet-500/50 group !border-white/50 dark:!border-white/10">
                <Smartphone className="text-slate-400 group-focus-within:text-violet-600 dark:group-focus-within:text-violet-400 transition-colors" size={20} />
                <input
                  type="email"
                  placeholder="邮箱地址"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={AUTH_VALIDATION.email.max}
                  className="w-full bg-transparent border-none p-0 pl-3 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-0 text-base font-medium h-6"
                />
             </GlassPanel>
             <GlassPanel className="flex items-center px-4 py-3.5 !bg-white/60 dark:!bg-white/10 !rounded-2xl transition-all duration-300 focus-within:!bg-white/80 dark:focus-within:!bg-white/20 focus-within:!ring-2 focus-within:!ring-violet-500/50 group !border-white/50 dark:!border-white/10">
                <Lock className="text-slate-400 group-focus-within:text-violet-600 dark:group-focus-within:text-violet-400 transition-colors" size={20} />
                <input
                  type="password"
                  placeholder="设置密码 (至少 6 位)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
                  maxLength={AUTH_VALIDATION.password.max}
                  className="w-full bg-transparent border-none p-0 pl-3 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-0 text-base font-medium h-6"
                />
             </GlassPanel>
          </div>

          <button
            onClick={handleRegister}
            disabled={loading || success}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 text-white font-bold text-lg shadow-lg shadow-violet-500/40 hover:shadow-violet-500/60 hover:-translate-y-1 active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-2 group"
          >
             {loading ? (
               <>
                 <Loader2 className="w-5 h-5 animate-spin" />
                 注册中...
               </>
             ) : success ? (
               <>
                 <span>✓</span>
                 注册成功
               </>
             ) : (
               <>
                 <span>立即注册</span>
                 <span className="group-hover:translate-x-1 transition-transform">→</span>
               </>
             )}
          </button>

          <div className="text-center text-sm text-slate-500 dark:text-slate-400">
             已有账号？<button onClick={() => navigate(AppRoutes.LOGIN)} className="text-violet-600 dark:text-violet-400 font-bold hover:text-violet-500 dark:hover:text-violet-300 transition-colors">立即登录</button>
          </div>
       </div>
     </div>
   );
};
