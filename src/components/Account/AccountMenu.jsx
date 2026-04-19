import { useState, useRef, useEffect } from 'react';
import { UserCircle, Palette, Key, ShieldAlert, LogOut } from 'lucide-react';
import ChangeThemeModal from './ChangeThemeModal';
import ChangePasswordModal from './ChangePasswordModal';
import ForgotPasswordModal from './ForgotPasswordModal';
import LogoutConfirmDialog from './LogoutConfirmDialog';

export default function AccountMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'theme', 'password', 'forgot', 'logout', null
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
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className={`flex items-center gap-2 px-4 py-2 border rounded-full transition-colors bg-white shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500
          ${isOpen ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 hover:bg-slate-50 text-slate-700'}`}
      >
        <UserCircle size={20} className={isOpen ? 'text-blue-600' : 'text-slate-600'} />
        <span className="text-[14px] font-bold">Tài khoản</span>
      </button>

      {isOpen && (
        <div 
          ref={menuRef}
          role="menu"
          className="absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-100 py-2 z-50 transform origin-top-right transition-all animate-in fade-in slide-in-from-top-2"
        >
          <MenuItem icon={Palette} iconColor="text-orange-500" label="Đổi giao diện" onClick={() => openModal('theme')} />
          <MenuItem icon={Key} iconColor="text-orange-500" label="Đổi mật khẩu" onClick={() => openModal('password')} />
          <MenuItem icon={ShieldAlert} iconColor="text-blue-600" label="Quên mật khẩu / đặt lại" onClick={() => openModal('forgot')} />
          <div className="h-px bg-slate-100 my-2 mx-4"></div>
          <MenuItem icon={LogOut} iconColor="text-red-600" label="Đăng xuất" onClick={() => openModal('logout')} isDanger />
        </div>
      )}

      {activeModal === 'theme' && <ChangeThemeModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'password' && <ChangePasswordModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'forgot' && <ForgotPasswordModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'logout' && <LogoutConfirmDialog onClose={() => setActiveModal(null)} />}
    </div>
  );
}

function MenuItem({ icon: Icon, iconColor, label, onClick, isDanger }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={`w-full text-left px-5 py-3 text-[14px] font-semibold flex items-center gap-3 transition-colors outline-none focus-visible:bg-slate-50
        ${isDanger ? 'text-red-600 hover:bg-red-50 focus-visible:bg-red-50' : 'text-slate-700 hover:bg-slate-50'}`}
    >
      <Icon size={18} className={iconColor} />
      {label}
    </button>
  );
}
