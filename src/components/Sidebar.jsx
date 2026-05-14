import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Send, LayoutList, ClipboardList, History, Settings, X, MessageSquare, ListTodo, Bell, Calendar, TrendingUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useMessage } from '../context/MessageContext';
import { useNotification } from '../context/NotificationContext';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import partyLogo from '../assets/bieu-tuong-vp-cap-uy.png';
import leaderAvatar from '../assets/avatar_leader.jpg';
import adminAvatar from '../assets/avatar_admin.jpg';
import manager1Avatar from '../assets/avatar_manager1.jpg';
import manager2Avatar from '../assets/avatar_manager2.jpg';
import staff1Avatar from '../assets/avatar_staff1.jpg';
import staff2Avatar from '../assets/avatar_staff2.jpg';
import staff3Avatar from '../assets/avatar_staff3.jpg';
import staff4Avatar from '../assets/avatar_staff4.jpg';

export default function Sidebar({ isOpen, onClose }) {
  const location = useLocation();
  const { profile, user } = useAuth();
  const { theme } = useTheme();
  const { unreadCount, toggleDrawer } = useMessage();
  const { unreadCount: notifUnread } = useNotification();
  const themeLabel = { light: 'Sáng', dark: 'Tối', system: 'Theo hệ thống' }[theme] || 'Sáng';

  const menus = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Lịch công tác', path: '/schedules', icon: Calendar },
    { name: 'Giao nhiệm vụ', path: '/tasks', icon: Send, hiddenFor: ['viewer', 'staff', 'specialist'] },
    { name: 'Tất cả nhiệm vụ', path: '/all-tasks', icon: LayoutList, restricted: true },
    { name: 'Nhiệm vụ của tôi', path: '/my-tasks', icon: ClipboardList, hiddenFor: ['viewer'] },
    { name: 'To-do cá nhân', path: '/todo', icon: ListTodo },
    { name: 'Thông báo', path: '/notifications', icon: Bell, badge: notifUnread, hiddenFor: ['viewer'] },
    { name: 'Phân tích Hiệu suất', path: '/performance', icon: TrendingUp, restricted: true },
    { name: 'Nhật ký thao tác', path: '/logs', icon: History, restricted: true },
    { name: 'Quản trị hệ thống', path: '/admin', icon: Settings, adminOnly: true },
  ].filter(m => {
    const role = profile?.role;
    if (m.adminOnly && role !== 'admin') return false;
    if (m.hiddenFor?.includes(role)) return false;
    if (m.restricted && !['admin', 'manager', 'viewer'].includes(role)) return false;
    return true;
  });

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      <div className={`fixed inset-y-0 left-0 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:inset-0 z-50 w-[280px] sm:w-[300px] h-full lg:h-auto min-h-[100dvh] bg-[#f8fafc] dark:bg-[#0f172a] border-r border-slate-200 dark:border-slate-800 flex flex-col p-4 md:p-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))] shrink-0 shadow-[2px_0_10px_rgba(0,0,0,0.02)] transition-transform duration-300 ease-in-out`}>
        {/* Top red banner */}
        <div className="bg-[#b91c1c] rounded-[22px] p-4 md:p-5 text-white shadow-[0_10px_20px_rgba(185,28,28,0.2)] mb-4 md:mb-6 flex items-center gap-3 md:gap-4 relative overflow-hidden group shrink-0">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          <button onClick={onClose} className="absolute top-2 right-2 p-1 rounded-full bg-white/10 hover:bg-white/20 text-white lg:hidden transition-all z-10">
            <X size={14} />
          </button>

          {/* Logo Section */}
          <div className="w-[60px] h-[60px] md:w-[80px] md:h-[80px] shrink-0 z-10 transition-transform group-hover:scale-105 duration-300 overflow-hidden rounded-full bg-white">
            <img
              src={partyLogo}
              alt="Biểu tượng Văn phòng Cấp ủy"
              className="w-full h-full object-cover scale-[1.1]"
            />
          </div>

          <div className="z-10">
            <h1 className="font-black text-[16px] md:text-[20px] uppercase leading-[1.1] tracking-tight">
              QUẢN TRỊ<br />NHIỆM VỤ
            </h1>
            <p className="text-[12px] md:text-[15px] text-red-50/90 font-bold mt-1 leading-tight tracking-wide">
              VPĐU xã<br />Trà Bồng
            </p>
          </div>
        </div>

        {/* User profile block */}
        <div className="bg-white dark:bg-[#1e293b] rounded-[22px] p-4 md:p-5 border border-slate-100 dark:border-slate-700/50 shadow-sm mb-4 md:mb-6 flex flex-col items-center transition-all hover:shadow-md group shrink-0">
          {/* Avatar Container */}
          <div className="relative mb-3 group-hover:scale-105 transition-transform duration-300">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-slate-100 dark:border-slate-800 p-1 bg-white dark:bg-[#0f172a] overflow-hidden shadow-inner">
              <img 
                src={
                  profile?.avatar_url ? profile.avatar_url : (
                    profile?.full_name === 'Nguyễn Đức Lợi' ? manager1Avatar :
                    profile?.full_name === 'Lê Công Hào' ? manager2Avatar :
                    profile?.full_name === 'Phạm Học Thuyết' ? staff1Avatar :
                    profile?.full_name === 'Nguyễn Thị Hoài Thu' ? staff2Avatar :
                    profile?.full_name === 'Nguyễn Thị Thanh Pháp' ? staff3Avatar :
                    profile?.full_name === 'Phan Thị Linh' ? staff4Avatar :
                    profile?.role === 'viewer' ? leaderAvatar : 
                    (profile?.role === 'admin' ? adminAvatar : `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.full_name || 'User')}&background=b91c1c&color=fff&size=128`)
                  )
                } 
                alt="Avatar"
                className="w-full h-full object-cover rounded-full"
                onError={(e) => { 
                  // Nếu avatar_url lỗi, hiển thị lại avatar mặc định hoặc UI Avatars
                  const specialUsers = ['Nguyễn Đức Lợi', 'Lê Công Hào', 'Phạm Học Thuyết', 'Nguyễn Thị Hoài Thu', 'Nguyễn Thị Thanh Pháp', 'Phan Thị Linh'];
                  if (profile?.role !== 'viewer' && profile?.role !== 'admin' && !specialUsers.includes(profile?.full_name)) {
                    e.target.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(profile?.full_name || 'User') + '&background=b91c1c&color=fff&size=128'; 
                  }
                }}
              />
            </div>
            <div className="absolute bottom-0 right-1 w-5 h-5 bg-green-500 border-4 border-white dark:border-slate-800 rounded-full" title="Đang trực tuyến"></div>
          </div>

          <h3 className="font-black text-[#b91c1c] dark:text-slate-100 text-[15px] md:text-[17px] leading-tight text-center">
            {profile?.full_name || 'Bùi Tấn Trường'}
          </h3>
          {profile?.position && (
            <p className="text-[11px] md:text-[12px] text-slate-500 dark:text-slate-300 mt-1.5 font-bold uppercase tracking-wider text-center max-w-[200px]">
              {profile.position}
            </p>
          )}
          <p className="text-[10px] text-slate-400 dark:text-slate-400 mt-1 font-medium italic truncate w-full text-center">
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
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white'
                  }`}>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                <span className="flex-1">{menu.name}</span>
                {menu.badge > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-sm ${isActive ? 'bg-white/30 text-white' : 'bg-red-600 text-white'}`}>
                    {menu.badge > 99 ? '99+' : menu.badge}
                  </span>
                )}
              </Link>
            );
          })}
          {/* Messages for Mobile/Tablet */}
          <button
            onClick={() => { toggleDrawer(); onClose(); }}
            className="relative w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-all font-semibold text-[14px] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200 sm:hidden"
          >
            <div className="flex items-center gap-3">
              <MessageSquare size={20} strokeWidth={2} />
              <span>Nhắn tin</span>
            </div>
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-red-600 border-2 border-white rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-lg leading-none animate-in zoom-in duration-300">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </nav>

        {/* Footer info */}
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-4 border border-amber-100/50 dark:border-amber-900/30 text-[11px] text-amber-900/60 dark:text-amber-400/60 font-semibold mt-auto leading-relaxed transition-colors">
          <p>Phiên bản: 6.1</p>
          <p>Creator: Bùi Tấn Trưởng</p>
          <p>Giao diện: {themeLabel}</p>
        </div>
      </div>
    </>
  );
}
