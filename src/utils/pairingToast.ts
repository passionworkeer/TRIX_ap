import type { ToastOptions } from 'react-hot-toast';

export const PAIRING_REQUIRED_TOAST_ID = 'pairing-required';
export const PAIRING_REQUIRED_TOAST_MESSAGE = '请先完成 TRIX Bot 配对';
export const PAIRING_REQUIRED_TOAST_OPTIONS: ToastOptions = {
  id: PAIRING_REQUIRED_TOAST_ID,
  duration: 1600,
};
