import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
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
import { AuthProvider } from './contexts/AuthContext';
import { WebSocketProvider } from './contexts/WebSocketContext';

function AppContent() {
  const location = useLocation();
  const [showDockOnHome, setShowDockOnHome] = useState(false);
  
  // 判断是否在首页
  const isHomePage = location.pathname === '/' || location.pathname === '';
  
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
    // 1. 最外层容器: 全屏, 禁止滚动, 浅灰背景
    <div className="fixed inset-0 w-full h-full bg-[#f2f4f6] text-gray-900 overflow-hidden font-sans">
      
      {/* 2. 背景层 (Layer 0) - 只在首页显示 */}
      {isHomePage && <HeroBackground />}

      {/* 3. 滚动内容层 (Layer 1) - 只有这里会动 */}
      <div 
        data-home-scroll="true"
        // 只在首页点击空白处切换导航栏
        onClick={isHomePage ? toggleDock : undefined}
        className={`relative w-full h-full overflow-y-auto overflow-x-hidden scroll-smooth touch-pan-y ${isHomePage ? 'home-transparent-scroll' : ''}`}
        style={{ 
          zIndex: 10,
          // 首页透明(为了看人物)，其他页面浅灰(为了看内容)
          backgroundColor: isHomePage ? 'transparent' : '#f2f4f6'
        }}
      >
        
        {/* 路由出口 */}
        <div className="min-h-full">
           <Routes location={location} key={location.pathname}>
             {/* Home 不需要再传 prop 了，因为点击事件在上层处理了 */}
             <Route path={AppRoutes.HOME} element={<Home />} />
             
             <Route path={AppRoutes.LOGIN} element={<Login />} />
             <Route path={AppRoutes.REGISTER} element={<Register />} />
             <Route path={AppRoutes.SNAPSHOT} element={<Snapshot />} />
             <Route path={AppRoutes.SNAPSHOT_RESULT} element={<Snapshot />} />
             <Route path={AppRoutes.STUDY} element={<Study />} />
             <Route path={AppRoutes.TIMER} element={<Study />} />
             <Route path={AppRoutes.CHAT} element={<Chat />} />
             <Route path={AppRoutes.CHAT_DETAIL} element={<ChatDetail />} />
             <Route path={AppRoutes.PROFILE} element={<Profile />} />
             <Route path={AppRoutes.PAIRING} element={<Pairing />} />
             <Route path={AppRoutes.MAP} element={<MapScreen />} />
             <Route path={AppRoutes.DIAGNOSTIC} element={<Diagnostic />} />
             <Route path={AppRoutes.DIAGNOSTIC_ADV} element={<DiagnosticAdvanced />} />
           </Routes>
        </div>
        
        {/* 物理占位符：给底部 Dock 撑开空间，防止内容被遮挡 */}
        <div 
          className="w-full flex-shrink-0 pointer-events-none" 
          style={{ 
            // 🏝️ 适配悬浮岛样式：更大的底部空间
            height: "calc(120px + env(safe-area-inset-bottom, 20px))" 
          }}
        />
      </div>

      {/* 4. 悬浮 UI 层 (Layer 2) - 永远在最上面 */}
      <AnimatePresence mode="wait">
        {(!isHomePage || showDockOnHome) && (
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