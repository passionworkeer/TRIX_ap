import React from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import Home from './screens/Home';
import Snapshot from './screens/Snapshot';
import Study from './screens/Study';
import Chat from './screens/Chat';
import ChatDetail from './screens/ChatDetail';
import Profile from './screens/Profile';
import { Login, Register } from './screens/Auth';
import Pairing from './screens/Pairing';
import { AppRoutes } from './types';
import { AuthProvider } from './contexts/AuthContext';

// Layout component to conditionally wrap content with BottomNav
const Layout: React.FC = () => {
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
      </Routes>
      <BottomNav />
    </>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <HashRouter>
        <Layout />
      </HashRouter>
    </AuthProvider>
  );
};

export default App;