import React from 'react';

export enum AppRoutes {
  HOME = '/',
  LOGIN = '/login',
  REGISTER = '/register',
  SNAPSHOT = '/snapshot',
  SNAPSHOT_RESULT = '/snapshot/result',
  STUDY = '/study',
  TIMER = '/study/timer',
  CHAT = '/chat',
  CHAT_DETAIL = '/chat/detail',
  PROFILE = '/profile',
  SETTINGS = '/profile/settings',
  PAIRING = '/pairing',
  QR_PAIRING = '/qr-pairing',  // 🔗 二维码配对页面
  DIAGNOSTIC = '/diagnostic',  // 🔧 诊断页面
  DIAGNOSTIC_ADV = '/diagnostic-advanced',  // 🔧 高级诊断
  MAP = '/map'
}

export interface NavItem {
  icon: React.ReactNode;
  label: string;
  path: AppRoutes;
  isActive?: boolean;
}
