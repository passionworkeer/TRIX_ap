import React from 'react';

export enum AppRoutes {
  HOME = '/',
  LOGIN = '/login',
  REGISTER = '/register',
  SNAPSHOT = '/snapshot',
  SNAPSHOT_RESULT = '/snapshot/result',
  STUDY = '/study',
  CHAT = '/chat',
  CHAT_DETAIL = '/chat/detail',
  CHAT_WITH_FRIEND = '/chat/:friendId',  // 动态路由：与特定好友聊天
  PROFILE = '/profile',
  PROFILE_VIEW = '/profile/:userId',      // 动态路由：查看其他用户主页
  SETTINGS = '/profile/settings',
  PAIRING = '/pairing',
  NANOBOT_PAIRING = '/nanobot-pairing',
  QR_PAIRING = '/qr-pairing',  // 🔗 二维码配对页面
  DIAGNOSTIC = '/diagnostic',  // 🔧 诊断页面
  DIAGNOSTIC_ADV = '/diagnostic-advanced',  // 🔧 高级诊断
  MAP = '/map',
  TOKEN_MONITOR = '/token-monitor'  // 📊 Token 监控页面
}

export interface NavItem {
  icon: React.ReactNode;
  label: string;
  path: AppRoutes;
  isActive?: boolean;
}
