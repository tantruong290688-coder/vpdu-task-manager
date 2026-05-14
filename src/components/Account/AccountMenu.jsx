import { useState, useRef, useEffect } from 'react';
import { UserCircle, Palette, Key, ShieldAlert, LogOut } from 'lucide-react';
import ChangeThemeModal from './ChangeThemeModal';
import ChangePasswordModal from './ChangePasswordModal';
import ForgotPasswordModal from './ForgotPasswordModal';
import LogoutConfirmDialog from './LogoutConfirmDialog';
import ChangeAvatarModal from './ChangeAvatarModal';
import { Camera, BookOpen } from 'lucide-react';
import UserManualModal from './UserManualModal';

export default function AccountMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'theme', 'avatar', 'password', 'forgot', 'logout', 'manual', null
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) && !buttonRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const openModal = (type) => {
    setActiveModal(type);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button 
        ref={buttonRef}
        onPointerDown={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className={`flex items-center gap-1.5 sm:gap-2 p-2 sm:px-4 sm:py-2 border rounded-full transition-colors bg-white shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500
          ${isOpen ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 hover:bg-slate-50 text-slate-700'}`}
      >
        <UserCircle size={20} className={isOpen ? 'text-blue-600' : 'text-slate-600'} />
        <span className="hidden sm:inline text-[14px] font-bold">Tài khoản</span>
      </button>

      {isOpen && (
        <>
          {/* Mobile Backdrop */}
          <div className="fixed inset-0 z-[90] sm:hidden bg-black/5" onPointerDown={() => setIsOpen(false)} />
          
          <div 
            ref={menuRef}
            role="menu"
            className="
              fixed top-[calc(60px+env(safe-area-inset-top))] left-0 right-0 mx-4
              sm:absolute sm:top-[calc(100%+12px)] sm:right-0 sm:left-auto sm:mx-0 sm:w-64
              bg-white dark:bg-[#0f172a] rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.15)] 
              border border-slate-100 dark:border-slate-800 py-2 z-[100] 
              transform origin-top-right transition-all animate-in fade-in slide-in-from-top-2
            "
          >
            <MenuItem icon={Camera} iconColor="text-blue-500" label="Đổi ảnh đại diện" onClick={() => openModal('avatar')} />
            <MenuItem icon={Palette} iconColor="text-orange-500" label="Đổi giao diện" onClick={() => openModal('theme')} />
            <MenuItem icon={Key} iconColor="text-orange-500" label="Đổi mật khẩu" onClick={() => openModal('password')} />
            <MenuItem icon={ShieldAlert} iconColor="text-blue-600" label="Quên mật khẩu / đặt lại" onClick={() => openModal('forgot')} />
            <MenuItem icon={BookOpen} iconColor="text-emerald-500" label="Hướng dẫn sử dụng" onClick={() => openModal('manual')} />
            <div className="h-px bg-slate-100 dark:bg-slate-700/50 my-2 mx-4"></div>
            <MenuItem icon={LogOut} iconColor="text-red-600" label="Đăng xuất" onClick={() => openModal('logout')} isDanger />
          </div>
        </>
      )}

      {activeModal === 'theme' && <ChangeThemeModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'avatar' && <ChangeAvatarModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'password' && <ChangePasswordModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'forgot' && <ForgotPasswordModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'logout' && <LogoutConfirmDialog onClose={() => setActiveModal(null)} />}
      {activeModal === 'manual' && <UserManualModal onClose={() => setActiveModal(null)} />}
    </div>
  );
}

function MenuItem({ icon: Icon, iconColor, label, onClick, isDanger }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={`w-full text-left px-5 py-3 text-[14px] font-semibold flex items-center gap-3 transition-colors outline-none focus-visible:bg-slate-50 dark:focus-visible:bg-slate-800
        ${isDanger ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 focus-visible:bg-red-50' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
    >
      <Icon size={18} className={iconColor} />
      {label}
    </button>
  );
}
