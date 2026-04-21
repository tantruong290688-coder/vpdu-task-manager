import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import MessagesDrawer from '../components/MessagesDrawer';
import { usePresence } from '../hooks/usePresence';

export default function MainLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  usePresence();
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
      <MessagesDrawer />
    </div>
  );
}
