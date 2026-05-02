import { useEffect } from 'react';
import { useNotifications } from '../../hooks/useNotifications';
import { useMessage } from '../../context/MessageContext';

export default function AppBadgeSync() {
  const { unreadCount: notifUnread } = useNotifications();
  const { unreadCount: msgUnread } = useMessage();

  useEffect(() => {
    const total = (notifUnread || 0) + (msgUnread || 0);
    
    // 1. Native App Badge (Windows/Mac Taskbar)
    if ('setAppBadge' in navigator) {
      if (total > 0) {
        navigator.setAppBadge(total).catch(() => {});
      } else {
        navigator.clearAppBadge().catch(() => {});
      }
    }

    // 2. Dynamic Favicon Badge (Để hiện màu đỏ rực rỡ)
    updateFaviconBadge(total);

    // 3. Cập nhật Tab Title
    const baseTitle = 'VPĐU Task Manager';
    if (total > 0) {
      document.title = `(${total}) ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }
  }, [notifUnread, msgUnread]);

  // Hàm vẽ biểu tượng có số thông báo màu đỏ
  function updateFaviconBadge(count) {
    const favicon = document.getElementById('favicon');
    if (!favicon) return;

    if (count <= 0) {
      favicon.href = '/logo.png'; // Trở về logo gốc
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    const img = new Image();
    img.src = '/logo.png';
    img.onload = () => {
      // Vẽ logo gốc
      ctx.drawImage(img, 0, 0, 64, 64);

      // Vẽ vòng tròn đỏ rực rỡ
      ctx.beginPath();
      ctx.arc(45, 18, 18, 0, 2 * Math.PI);
      ctx.fillStyle = '#ef4444'; // Màu đỏ (Red-500)
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Vẽ con số màu trắng
      ctx.fillStyle = 'white';
      ctx.font = 'bold 22px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(count > 99 ? '99+' : count, 45, 19);

      favicon.href = canvas.toDataURL('image/png');
    };
  }

  return null;
}
