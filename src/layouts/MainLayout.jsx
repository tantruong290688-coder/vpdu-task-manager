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
    <div className="flex h-screen bg-[#f1f5f9] dark:bg-[#0b1121] font-sans text-slate-800 dark:text-slate-200 transition-colors">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f1f5f9] dark:bg-[#0b1121] transition-colors relative">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
      <MessagesDrawer />
    </div>
  );
}
