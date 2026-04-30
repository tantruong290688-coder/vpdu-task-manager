import { useEffect } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { useMessage } from '../context/MessageContext';

export default function AppBadgeSync() {
  const { unreadCount: notifUnread } = useNotifications();
  const { unreadCount: msgUnread } = useMessage();

  useEffect(() => {
    const total = (notifUnread || 0) + (msgUnread || 0);
    
    if ('setAppBadge' in navigator) {
      if (total > 0) {
        navigator.setAppBadge(total).catch(() => {});
      } else {
        navigator.clearAppBadge().catch(() => {});
      }
    }

    // Cập nhật Tab Title
    const baseTitle = 'VPĐU Task Manager';
    if (total > 0) {
      document.title = `(${total}) ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }
  }, [notifUnread, msgUnread]);

  return null;
}
