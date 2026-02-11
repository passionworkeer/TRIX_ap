import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import GlassDock from './components/GlassDock';
import HeroBackground from './components/HeroBackground';
import Home from './screens/Home';
import Snapshot from './screens/Snapshot';
import Study from './screens/Study';
import Chat from './screens/Chat';
import ChatDetail from './screens/ChatDetail';
import Profile from './screens/Profile';
import Diagnostic from './screens/Diagnostic';
import DiagnosticAdvanced from './screens/DiagnosticAdvanced';
import { Login, Register } from './screens/Auth';
import Pairing from './screens/Pairing';
import MapScreen from './screens/Map';
import { AppRoutes } from './types';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { WebSocketProvider } from './contexts/WebSocketContext';

// 路由保护组件 - 未登录用户重定向到登录页
const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#f0f9ff]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">加载中...</p>
        </div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to={AppRoutes.LOGIN} replace />;
  }
  
  return children;
};

function AppContent() {
  const location = useLocation();
  const { user } = useAuth();
  const [showDockOnHome, setShowDockOnHome] = useState(false);
  
  // 判断是否在首页
  const isHomePage = location.pathname === '/' || location.pathname === '';
  
  // 判断是否在聊天详情页 (不显示底部导航)
  const isChatDetailPage = location.pathname === AppRoutes.CHAT_DETAIL;
  
  // 判断是否在计时器页面 (不显示底部导航，保持专注)
  const isTimerPage = location.pathname === AppRoutes.TIMER;
  
  // 判断是否在认证页面 (登录/注册)
  const isAuthPage = location.pathname === AppRoutes.LOGIN || location.pathname === AppRoutes.REGISTER;
  
  // 切换导航栏显示状态
  const toggleDock = () => {
    if (isHomePage) {
      setShowDockOnHome(prev => !prev);
    }
  };
  
  // 离开首页时重置状态
  useEffect(() => {
    if (!isHomePage) {
      setShowDockOnHome(false);
    }
  }, [isHomePage]);

  return (
    // 🚨 Layer 0: 最外层容器 - 必须透明！
    <div 
      className="fixed inset-0 w-full h-full text-gray-900 overflow-hidden font-sans"
      style={{ background: 'transparent' }}
    >
      
      {/* 🎨 Layer 0: 背景层 - 只在首页显示 */}
      {isHomePage && <HeroBackground />}

      {/* 📜 Layer 10: 滚动内容层 */}
      <div 
        data-home-scroll="true"
        onClick={isHomePage ? toggleDock : undefined}
        className={`relative w-full h-full overflow-y-auto overflow-x-hidden scroll-smooth touch-pan-y ${isHomePage ? 'home-transparent-scroll' : ''}`}
        style={{ 
          zIndex: 10,
          // 首页完全透明，其他页面浅灰
          backgroundColor: isHomePage ? 'transparent' : '#f2f4f6'
        }}
      >
        
        {/* 路由出口 */}
        <div className="min-h-full">
           <Routes location={location} key={location.pathname}>
             {/* 公开路由 - 不需要登录 */}
             <Route path={AppRoutes.LOGIN} element={<Login />} />
             <Route path={AppRoutes.REGISTER} element={<Register />} />
             
             {/* 受保护路由 - 需要登录 */}
             <Route path={AppRoutes.HOME} element={<ProtectedRoute><Home /></ProtectedRoute>} />
             <Route path={AppRoutes.SNAPSHOT} element={<ProtectedRoute><Snapshot /></ProtectedRoute>} />
             <Route path={AppRoutes.SNAPSHOT_RESULT} element={<ProtectedRoute><Snapshot /></ProtectedRoute>} />
             <Route path={AppRoutes.STUDY} element={<ProtectedRoute><Study /></ProtectedRoute>} />
             <Route path={AppRoutes.TIMER} element={<ProtectedRoute><Study /></ProtectedRoute>} />
             <Route path={AppRoutes.CHAT} element={<ProtectedRoute><Chat /></ProtectedRoute>} />
             <Route path={AppRoutes.CHAT_DETAIL} element={<ProtectedRoute><ChatDetail /></ProtectedRoute>} />
             <Route path={AppRoutes.PROFILE} element={<ProtectedRoute><Profile /></ProtectedRoute>} />
             <Route path={AppRoutes.PAIRING} element={<ProtectedRoute><Pairing /></ProtectedRoute>} />
             <Route path={AppRoutes.MAP} element={<ProtectedRoute><MapScreen /></ProtectedRoute>} />
             <Route path={AppRoutes.DIAGNOSTIC} element={<ProtectedRoute><Diagnostic /></ProtectedRoute>} />
             <Route path={AppRoutes.DIAGNOSTIC_ADV} element={<ProtectedRoute><DiagnosticAdvanced /></ProtectedRoute>} />
           </Routes>
        </div>
        
        {/* 物理占位符：给底部 Dock 撑开空间，防止内容被遮挡 */}
        {/* 聊天详情页、计时器页面和认证页面不需要占位符,因为没有底部导航 */}
        {!isChatDetailPage && !isTimerPage && !isAuthPage && user && (
          <div 
            className="w-full flex-shrink-0 pointer-events-none" 
            style={{ 
              height: "calc(120px + env(safe-area-inset-bottom, 20px))",
              background: 'transparent'
            }}
          />
        )}
      </div>

      {/* 🎯 Layer 50: 悬浮交互层 - 永远在最上面 */}
      {/* 只在登录状态下且不在认证页面、聊天详情页、计时器页面时显示底部导航 */}
      <AnimatePresence mode="wait">
        {user && (!isHomePage || showDockOnHome) && !isChatDetailPage && !isTimerPage && !isAuthPage && (
           <GlassDock key="dock" />
        )}
      </AnimatePresence>
      
    </div>
  );
}

const App: React.FC = () => {
  return (
    <AuthProvider>
      <WebSocketProvider>
        <HashRouter>
          <AppContent />
        </HashRouter>
      </WebSocketProvider>
    </AuthProvider>
  );
};

export default App;