import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { usePresence } from '../hooks/usePresence';

export default function MainLayout() {
  usePresence();
  return (
    <div className="flex h-screen bg-[#f1f5f9] dark:bg-[#0b1121] font-sans text-slate-800 dark:text-slate-200 transition-colors">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden bg-[#f1f5f9] dark:bg-[#0b1121] transition-colors">
        <Header />
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-6 md:p-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
