/**
 * 🔄 LoadingSpinner Component
 * ============================================
 * Unified loading spinner component for async operations
 * Features:
 * - Consistent visual design across the app
 * - Multiple size options
 * - Optional text label
 * - Customizable colors
 */

import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
  color?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8'
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  text,
  className = '',
  color = 'text-violet-500'
}) => {
  return (
    <div className={`flex items-center justify-center gap-2 ${className}`}>
      <Loader2 className={`${sizeClasses[size]} ${color} animate-spin`} />
      {text && <span className="text-sm text-slate-600 dark:text-slate-400">{text}</span>}
    </div>
  );
};

/**
 * 🔄 ButtonLoadingSpinner Component
 * ============================================
 * Inline loading spinner for buttons
 * Shows spinner with optional "Loading..." text
 */
interface ButtonLoadingSpinnerProps {
  text?: string;
  className?: string;
}

export const ButtonLoadingSpinner: React.FC<ButtonLoadingSpinnerProps> = ({
  text = '加载中...',
  className = ''
}) => {
  return (
    <div className={`flex items-center justify-center gap-2 ${className}`}>
      <Loader2 className="w-4 h-4 animate-spin" />
      <span>{text}</span>
    </div>
  );
};

/**
 * 🔄 FullPageLoading Component
 * ============================================
 * Full-screen loading overlay
 * Use for initial app loading or major operations
 */
interface FullPageLoadingProps {
  text?: string;
}

export const FullPageLoading: React.FC<FullPageLoadingProps> = ({
  text = '加载中...'
}) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-full border-4 border-violet-200 dark:border-violet-800 border-t-violet-600 animate-spin" />
        <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">{text}</span>
      </div>
    </div>
  );
};

export default LoadingSpinner;
