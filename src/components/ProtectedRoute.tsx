import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../hooks/useNotification';
import { AppRoutes } from '../types';

const LoadingSpinner: React.FC<{ message?: string }> = ({ message = '加载中...' }) => (
  <div
    className="h-screen w-full flex items-center justify-center"
    style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}
  >
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="font-medium">{message}</p>
    </div>
  </div>
);

const RedirectToLogin: React.FC = () => (
  <div
    className="h-screen w-full flex items-center justify-center"
    style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}
  >
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="font-medium">跳转到登录页...</p>
    </div>
  </div>
);

export interface ProtectedRouteProps {
  children: React.ReactElement;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const { showWarning } = useNotification();
  const [shouldRedirect, setShouldRedirect] = useState(false);

  useEffect(() => {
    if (!loading && !user && !shouldRedirect) {
      showWarning('请先登录以访问此页面');

      const timer = setTimeout(() => {
        setShouldRedirect(true);
      }, 500);

      return () => clearTimeout(timer);
    }

    return undefined;
  }, [loading, user, shouldRedirect, showWarning]);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    if (shouldRedirect) {
      return <Navigate to={AppRoutes.LOGIN} replace />;
    }
    return <RedirectToLogin />;
  }

  return children;
};

export default ProtectedRoute;
