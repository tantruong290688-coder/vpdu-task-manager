import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Send, LayoutList, ClipboardList, History, Settings, X, MessageSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useMessage } from '../context/MessageContext';
import partyLogo from '../assets/bieu-tuong-vp-cap-uy.png';

export default function Sidebar({ isOpen, onClose }) {
  const location = useLocation();
  const { profile } = useAuth();
  const { theme } = useTheme();
  const { unreadCount, toggleDrawer } = useMessage();
  const themeLabel = { light: 'Sáng', dark: 'Tối', system: 'Theo hệ thống' }[theme] || 'Sáng';


  const menus = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Giao nhiệm vụ', path: '/tasks', icon: Send },
    { name: 'Tất cả nhiệm vụ', path: '/all-tasks', icon: LayoutList },
    { name: 'Nhiệm vụ của tôi', path: '/my-tasks', icon: ClipboardList },
    { name: 'Nhật ký thao tác', path: '/logs', icon: History },
    { name: 'Quản trị hệ thống', path: '/admin', icon: Settings, adminOnly: true },
  ].filter(m => !m.adminOnly || profile?.role === 'admin');

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      <div className={`fixed inset-y-0 left-0 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:inset-0 z-50 w-[280px] sm:w-[300px] h-full lg:h-auto min-h-[100dvh] bg-[#f8fafc] dark:bg-[#111827] border-r border-slate-200 dark:border-slate-800 flex flex-col p-4 md:p-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))] shrink-0 shadow-[2px_0_10px_rgba(0,0,0,0.02)] transition-transform duration-300 ease-in-out`}>
        {/* Top red banner */}
        <div className="bg-[#b91c1c] rounded-[24px] p-5 text-white shadow-[0_12px_24px_rgba(185,28,28,0.3)] mb-6 flex items-center gap-4 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white lg:hidden transition-all z-10">
            <X size={16} />
          </button>

          {/* Logo Section - Removed yellow background to match design */}
          <div className="w-[80px] h-[80px] shrink-0 z-10 transition-transform group-hover:scale-105 duration-300 overflow-hidden rounded-full bg-white">
            <img
              src={partyLogo}
              alt="Biểu tượng Văn phòng Cấp ủy"
              className="w-full h-full object-cover scale-[1.1]"
            />
          </div>

          <div className="z-10">
            <h1 className="font-black text-[20px] uppercase leading-[1.1] tracking-tight">
              QUẢN TRỊ<br />NHIỆM VỤ
            </h1>
            <p className="text-[15px] text-red-50/90 font-bold mt-1.5 leading-tight tracking-wide">
              VPĐU xã<br />Trà Bồng
            </p>
          </div>
        </div>

        {/* User profile block */}
        <div className="bg-white dark:bg-slate-800 rounded-[20px] p-5 border border-slate-100 dark:border-slate-700 shadow-sm mb-6 text-center transition-all hover:bg-slate-50/50 dark:hover:bg-slate-800/80 group">
          <h3 className="font-extrabold text-[#b91c1c] dark:text-red-400 text-[16px] leading-tight">
            {profile?.full_name || 'Bùi Tấn Trường'}
          </h3>
          <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1.5 font-medium tracking-tight">
            {profile?.email || 'tantruong290688@gmail.com'}
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1.5">
          {menus.map((menu) => {
            const Icon = menu.icon;
            const isActive = location.pathname === menu.path || (menu.path === '/tasks' && location.pathname.includes('/tasks'));
            return (
              <Link key={menu.path} to={menu.path} onClick={onClose}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all font-semibold text-[14px] ${isActive
                  ? 'bg-gradient-to-r from-[#dc2626] to-[#ef4444] text-white shadow-[0_4px_12px_rgba(239,68,68,0.3)]'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                <span>{menu.name}</span>
              </Link>
            );
          })}
          {/* Messages for Mobile/Tablet */}
          <button
            onClick={() => { toggleDrawer(); onClose(); }}
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-all font-semibold text-[14px] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200 sm:hidden"
          >
            <div className="flex items-center gap-3">
              <MessageSquare size={20} strokeWidth={2} />
              <span>Nhắn tin</span>
            </div>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-[11px] px-2 py-0.5 rounded-full font-bold">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </nav>

        {/* Footer info */}
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-4 border border-amber-100/50 dark:border-amber-900/30 text-[11px] text-amber-900/60 dark:text-amber-400/60 font-semibold mt-auto leading-relaxed transition-colors">
          <p>Phiên bản: 4.1-RBAC</p>
          <p>Creator: Bùi Tấn Trưởng</p>
          <p>Giao diện: {themeLabel}</p>
        </div>
      </div>
    </>
  );
}
