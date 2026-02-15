import React, { useState } from 'react';
import { User, Lock, Smartphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import GlassPanel from '../components/GlassPanel';
import { AppRoutes } from '../types';
import { useAuth } from '../contexts/AuthContext';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('请输入邮箱和密码');
      return;
    }

    setLoading(true);
    setError('');

    const { error: signInError } = await signIn(email, password);
    
    if (signInError) {
      setError(signInError.message || '登录失败，请检查邮箱和密码');
      setLoading(false);
    } else {
      navigate(AppRoutes.HOME);
    }
  };
  
  return (
    <div className="h-screen w-full bg-[#f0f9ff] relative overflow-hidden flex flex-col justify-between px-8 py-10">
      {/* Background Blobs */}
      <div className="absolute inset-0 pointer-events-none">
         <div className="absolute -top-[10%] -right-[10%] w-[500px] h-[500px] bg-cyan-300/30 rounded-full blur-[100px] mix-blend-multiply"></div>
         <div className="absolute top-[20%] -left-[20%] w-[400px] h-[400px] bg-yellow-200/50 rounded-full blur-[90px] mix-blend-multiply"></div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative -mt-10">
         <div className="text-center relative z-20">
            <h1 className="text-4xl font-extrabold text-slate-800 tracking-tight mb-3">欢迎回来</h1>
            <p className="text-slate-500 text-base font-medium tracking-wide">TRIX  探索无限 3D 世界</p>
         </div>
      </div>

      <div className="w-full space-y-6 relative z-20 mb-6">
         {error && (
           <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-2xl text-sm">
             {error}
           </div>
         )}
         
         <div className="space-y-4">
            <GlassPanel className="flex items-center px-5 py-4 !bg-white/40 !rounded-2xl transition-all focus-within:!bg-white/60 focus-within:!border-white/90 group">
               <User className="text-gray-400 group-focus-within:text-indigo-600 transition-colors" size={24} />
               <input 
                 type="email" 
                 placeholder="邮箱" 
                 value={email}
                 onChange={(e) => setEmail(e.target.value)}
                 className="w-full bg-transparent border-none p-0 pl-4 text-slate-700 placeholder:text-slate-400 focus:ring-0 text-[17px] font-medium" 
               />
            </GlassPanel>
            <GlassPanel className="flex items-center px-5 py-4 !bg-white/40 !rounded-2xl transition-all focus-within:!bg-white/60 focus-within:!border-white/90 group">
               <Lock className="text-gray-400 group-focus-within:text-indigo-600 transition-colors" size={24} />
               <input 
                 type="password" 
                 placeholder="密码" 
                 value={password}
                 onChange={(e) => setPassword(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                 className="w-full bg-transparent border-none p-0 pl-4 text-slate-700 placeholder:text-slate-400 focus:ring-0 text-[17px] font-medium" 
               />
            </GlassPanel>
         </div>

         <button 
           onClick={handleLogin} 
           disabled={loading}
           className="w-full py-4 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white font-bold text-lg tracking-widest shadow-xl shadow-indigo-500/30 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
         >
            {loading ? '登录中...' : '登录'}
         </button>

         <div className="flex flex-col items-center space-y-6 pt-2">
            <div className="flex items-center w-full gap-4 opacity-50">
               <div className="h-px bg-slate-300 flex-1"></div>
               <span className="text-xs font-bold text-slate-400">第三方登录</span>
               <div className="h-px bg-slate-300 flex-1"></div>
            </div>
            <div className="flex gap-6">
               <button className="w-12 h-12 rounded-full bg-white/60 flex items-center justify-center text-green-600 shadow-sm border border-white hover:scale-105 transition-transform">
                  <span className="font-bold text-xl">W</span>
               </button>
               <button className="w-12 h-12 rounded-full bg-white/60 flex items-center justify-center text-slate-800 shadow-sm border border-white hover:scale-105 transition-transform">
                  <span className="font-bold text-xl">A</span>
               </button>
            </div>
            <div className="text-[13px] text-slate-500 font-medium">
               还没有账号？ <button onClick={() => navigate(AppRoutes.REGISTER)} className="text-indigo-600 font-bold hover:text-indigo-500">立即注册</button>
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
     if (!email || !password || !username) {
       setError('请填写所有字段');
       return;
     }

     if (password.length < 6) {
       setError('密码至少需要 6 个字符');
       return;
     }

     setLoading(true);
     setError('');

     const { error: signUpError } = await signUp(email, password, username);
     
     if (signUpError) {
       setError(signUpError.message || '注册失败，请重试');
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
     <div className="h-screen w-full bg-[#f0f9ff] relative overflow-hidden flex flex-col justify-between px-8 py-10">
       <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-[10%] -right-[10%] w-[500px] h-[500px] bg-cyan-300/20 rounded-full blur-[100px] mix-blend-multiply"></div>
          <div className="absolute top-[30%] -left-[20%] w-[400px] h-[400px] bg-yellow-200/40 rounded-full blur-[80px] mix-blend-multiply"></div>
       </div>
 
       <div className="flex-1 flex flex-col items-center justify-center relative -mt-4">
          <div className="text-center space-y-1">
             <h1 className="text-3xl font-bold text-slate-800">欢迎加入</h1>
             <p className="text-slate-500 text-base font-medium">开启你的 3D 探索之旅</p>
          </div>
       </div>
 
       <div className="w-full space-y-6 mb-4 relative z-20">
          {error && (
            <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-2xl text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-100 border border-green-300 text-green-700 px-4 py-3 rounded-2xl text-sm">
              注册成功！正在跳转...
            </div>
          )}
          
          <div className="space-y-4">
             <GlassPanel className="flex items-center px-4 py-3.5 !bg-white/40 !rounded-2xl transition-all focus-within:!bg-white/60 group">
                <User className="text-gray-400 group-focus-within:text-cyan-500 transition-colors" size={22} />
                <input 
                  type="text" 
                  placeholder="用户名" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-transparent border-none p-0 pl-3 text-slate-700 placeholder:text-slate-400 focus:ring-0 text-base font-medium h-6" 
                />
             </GlassPanel>
             <GlassPanel className="flex items-center px-4 py-3.5 !bg-white/40 !rounded-2xl transition-all focus-within:!bg-white/60 group">
                <Smartphone className="text-gray-400 group-focus-within:text-cyan-500 transition-colors" size={22} />
                <input 
                  type="email" 
                  placeholder="邮箱" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent border-none p-0 pl-3 text-slate-700 placeholder:text-slate-400 focus:ring-0 text-base font-medium h-6" 
                />
             </GlassPanel>
             <GlassPanel className="flex items-center px-4 py-3.5 !bg-white/40 !rounded-2xl transition-all focus-within:!bg-white/60 group">
                <Lock className="text-gray-400 group-focus-within:text-cyan-500 transition-colors" size={22} />
                <input 
                  type="password" 
                  placeholder="设置密码 (至少 6 位)" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
                  className="w-full bg-transparent border-none p-0 pl-3 text-slate-700 placeholder:text-slate-400 focus:ring-0 text-base font-medium h-6" 
                />
             </GlassPanel>
          </div>
 
          <button 
            onClick={handleRegister} 
            disabled={loading || success}
            className="w-full py-4 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 text-white font-bold text-lg shadow-lg shadow-cyan-400/30 active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
          >
             {loading ? '注册中...' : success ? '注册成功' : '立即注册'}
          </button>
          
          <div className="text-center text-sm text-slate-500">
             已有账号？<button onClick={() => navigate(AppRoutes.LOGIN)} className="text-cyan-600 font-bold hover:text-cyan-500">立即登录</button>
          </div>
       </div>
     </div>
   );
 };
