import React, { createContext, useContext, useMemo } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { useAuth } from './AuthContext';

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  
  // Sử dụng hook useNotifications để quản lý state và realtime
  // Chỉ gọi khi có user
  const notifState = useNotifications({ limit: 20 });

  const value = useMemo(() => ({
    ...notifState
  }), [notifState]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}
