import React, { useState } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import GlassDock from './components/GlassDock'; // 新的 GlassDock
// import UserSwitcher from './components/UserSwitcher'; // 🔕 多用户功能暂时注?
import Home from './screens/Home';
import Snapshot from './screens/Snapshot';
import Study from './screens/Study';
import Chat from './screens/Chat';
import ChatDetail from './screens/ChatDetail';
import Profile from './screens/Profile';
import Diagnostic from './screens/Diagnostic'; // 🔧 诊断页面
import DiagnosticAdvanced from './screens/DiagnosticAdvanced'; // 🔧 高级诊断
import { Login, Register } from './screens/Auth';
import Pairing from './screens/Pairing';
import MapScreen from './screens/Map';
import { AppRoutes } from './types';
import { AuthProvider } from './contexts/AuthContext';
import { WebSocketProvider } from './contexts/WebSocketContext';

// Layout component to conditionally wrap content with BottomNav
const Layout: React.FC = () => {
  // 🔕 多用户功能暂时注�?
  // const [currentUserId, setCurrentUserId] = useState<string>(
  //   localStorage.getItem('current_user_id') || '00000000-0000-0000-0000-000000000001'
  // );

  // const handleUserChange = (userId: string, userName: string) => {
  //   setCurrentUserId(userId);
  //   console.log('切换用户:', userName, userId);
  // };

  return (
    <>
      <Routes>
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
        <Route path={AppRoutes.DIAGNOSTIC} element={<Diagnostic />} /> {/* 🔧 诊断页面 */}
        <Route path={AppRoutes.DIAGNOSTIC_ADV} element={<DiagnosticAdvanced />} /> {/* 🔧 高级诊断 */}
      </Routes>
      <GlassDock />
      {/* 🔕 多用户功能暂时注?*/}
      {/* <UserSwitcher onUserChange={handleUserChange} /> */}
    </>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <WebSocketProvider>
        <HashRouter>
          <Layout />
        </HashRouter>
      </WebSocketProvider>
    </AuthProvider>
  );
};

export default App;
