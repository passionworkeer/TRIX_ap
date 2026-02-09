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
  
  // 判断是否在首页 - 修复HashRouter路径判断
  const isHomePage = location.pathname === '/' || location.pathname === '';
  
  // 切换导航栏显示状态(仅在首页有效)
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
    // 1. 最外层容器:全屏,禁止滚动,浅灰背景
    <div className="fixed inset-0 w-full h-full bg-[#f2f4f6] text-gray-900 overflow-hidden font-sans">
      
      {/* 2. 背景层 - 直接渲染,不要包裹层 */}
      <HeroBackground />

      {/* 3. 滚动内容层 (Layer 1) - 只有这里会动 */}
      {/* 首页时透明,其他页面有背景色 */}
      <div 
        data-home-scroll="true"
        className={`relative w-full h-full overflow-y-auto overflow-x-hidden scroll-smooth ${isHomePage ? 'home-transparent-scroll' : ''}`}
        style={{ 
          zIndex: 10,
          backgroundColor: isHomePage ? 'transparent' : '#f2f4f6'
        }}
      >
        
        {/* 路由出口 */}
        <div className="min-h-full">
           <Routes location={location} key={location.pathname}>
             <Route path={AppRoutes.HOME} element={<Home onBackgroundClick={toggleDock} />} />
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
        
        {/* ⚠️ 物理占位符：给底部 Dock 撑开空间，防止遮挡，适配安全区域 */}
        <div 
          className="w-full flex-shrink-0" 
          style={{ 
            height: "calc(128px + env(safe-area-inset-bottom, 0px))" 
          }}
        />
      </div>

      {/* 4. 悬浮 UI 层 (Layer 2) - 永远在最上面，永远不动 */}
      {/* 使用 AnimatePresence 实现 iOS 风格的弹性进出动画 */}
      <AnimatePresence>
        {(!isHomePage || showDockOnHome) && <GlassDock key="dock" />}
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
