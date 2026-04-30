import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import ChatPopup from '../components/Chat/ChatPopup';
import { usePresence } from '../hooks/usePresence';
import { useMessage } from '../context/MessageContext';
import AppBadgeSync from '../components/Notifications/AppBadgeSync';

export default function MainLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const { openChatWith, openRoomChat } = useMessage();

  usePresence();

  // Xử lý mở chat từ URL (deeplinking từ thông báo)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const chatUserId = params.get('chat');
    const roomId = params.get('room');

    if (chatUserId) {
      openChatWith(chatUserId);
    } else if (roomId) {
      openRoomChat(roomId);
    }
  }, [location.search, openChatWith, openRoomChat]);
  return (
    <div className="flex min-h-[100dvh] bg-[#f1f5f9] dark:bg-[#0b1121] font-sans text-slate-800 dark:text-slate-200 transition-colors overflow-hidden">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 bg-[#f1f5f9] dark:bg-[#0b1121] transition-colors relative">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto w-full">
          <div className="w-full max-w-7xl mx-auto p-0 sm:p-4 md:p-6 lg:p-8 pb-[env(safe-area-inset-bottom)]">
            <Outlet />
          </div>
        </main>
      </div>
      <ChatPopup />
      <AppBadgeSync />
    </div>
  );
}
