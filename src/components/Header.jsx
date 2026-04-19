import { useAuth } from '../context/AuthContext';
import { useMessage } from '../context/MessageContext';
import { Search, MessageSquare, Bell, RotateCcw, Menu } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import AccountMenu from './Account/AccountMenu';
import NotificationsDropdown from './NotificationsDropdown';

export default function Header({ onMenuClick }) {
  const { profile } = useAuth();
  const { unreadCount, toggleDrawer } = useMessage();
  const location = useLocation();
  const navigate = useNavigate();

  let title = "Dashboard quản trị";
  if (location.pathname.includes('/tasks')) title = "Giao nhiệm vụ";
  else if (location.pathname.includes('/all-tasks')) title = "Tất cả nhiệm vụ";
  else if (location.pathname.includes('/my-tasks')) title = "Nhiệm vụ của tôi";
  else if (location.pathname.includes('/logs')) title = "Nhật ký thao tác";
  else if (location.pathname.includes('/admin')) title = "Quản trị hệ thống";

  return (
    <header className="bg-white h-[60px] sm:h-[70px] md:h-[80px] flex items-center justify-between px-3 sm:px-4 md:px-8 shrink-0 z-20 relative shadow-[0_2px_10px_rgba(0,0,0,0.02)] gap-2">
      <div className="flex items-center gap-1 sm:gap-2 md:gap-3 flex-1 min-w-0">
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-1.5 sm:p-2 -ml-1 sm:-ml-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
        >
          <Menu size={22} className="sm:w-6 sm:h-6" />
        </button>
        <div className="min-w-0">
          <h2 className="text-[16px] sm:text-[18px] md:text-[22px] font-extrabold text-slate-800 truncate">{title}</h2>
          <p className="text-[12px] md:text-[13px] text-slate-500 font-medium hidden md:block truncate">Web App quản trị nhiệm vụ - {profile?.full_name || 'Bùi Tấn Trường'}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-1 sm:gap-3 md:gap-4 shrink-0">
        {/* Search Bar */}
        <div className="relative hidden lg:block">
          <form onSubmit={(e) => { e.preventDefault(); navigate(`/all-tasks?search=${e.target.search.value}`); }}>
            <input 
              name="search"
              type="text" 
              placeholder="Tìm nhanh mã, tên nhiệm vụ, n..." 
              className="w-72 pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium placeholder-slate-400"
            />
            <button type="submit" className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500">
              <Search size={18} />
            </button>
          </form>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2">
          {/* Message Icon - Visible on all devices */}
          <button 
            onClick={toggleDrawer}
            className="relative flex w-9 h-9 md:w-10 md:h-10 rounded-xl bg-slate-50 hover:bg-slate-100 items-center justify-center text-slate-600 transition-colors"
          >
            <MessageSquare size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-md leading-none">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          
          <NotificationsDropdown />
          
          <button onClick={() => window.location.reload()} className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors">
            <RotateCcw size={18} />
          </button>
        </div>

        {/* User Menu */}
        <div className="relative">
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
