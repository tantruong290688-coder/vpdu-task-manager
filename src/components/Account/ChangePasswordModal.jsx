import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { Eye, EyeOff } from 'lucide-react';
import ModalWrapper from './ModalWrapper';

export default function ChangePasswordModal({ onClose }) {
  const { changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState({ current: false, new: false, confirm: false });
  const [loading, setLoading] = useState(false);

  const toggleShow = (field) => setShowPassword(prev => ({ ...prev, [field]: !prev[field] }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Vui lòng điền đầy đủ thông tin');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Mật khẩu mới phải có ít nhất 8 ký tự');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Xác nhận mật khẩu không khớp');
      return;
    }
    if (currentPassword === newPassword) {
      toast.error('Mật khẩu mới không được trùng mật khẩu cũ');
      return;
    }

    setLoading(true);
    const { error } = await changePassword(newPassword);
    setLoading(false);

    if (error) {
      toast.error('Đổi mật khẩu thất bại: ' + error.message);
    } else {
      toast.success('Đổi mật khẩu thành công!');
      onClose();
    }
  };

  const inputClass = "w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-700 transition-all text-sm pr-10 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500";
  const labelClass = "block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5";
  const eyeBtnClass = "absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1";

  return (
    <ModalWrapper onClose={onClose} title="Đổi mật khẩu">
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Mật khẩu hiện tại */}
        <div>
          <label className={labelClass}>Mật khẩu hiện tại</label>
          <div className="relative">
            <input
              type={showPassword.current ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputClass}
              placeholder="Nhập mật khẩu hiện tại"
              autoComplete="current-password"
            />
            <button tabIndex="-1" type="button" onClick={() => toggleShow('current')} className={eyeBtnClass}>
              {showPassword.current ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Mật khẩu mới */}
        <div>
          <label className={labelClass}>Mật khẩu mới</label>
          <div className="relative">
            <input
              type={showPassword.new ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClass}
              placeholder="Nhập mật khẩu mới"
              autoComplete="new-password"
            />
            <button tabIndex="-1" type="button" onClick={() => toggleShow('new')} className={eyeBtnClass}>
              {showPassword.new ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Xác nhận mật khẩu mới */}
        <div>
          <label className={labelClass}>Xác nhận mật khẩu mới</label>
          <div className="relative">
            <input
              type={showPassword.confirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass}
              placeholder="Nhập xác nhận mật khẩu mới"
              autoComplete="new-password"
            />
            <button tabIndex="-1" type="button" onClick={() => toggleShow('confirm')} className={eyeBtnClass}>
              {showPassword.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 rounded-xl font-bold bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-[0_4px_12px_rgba(37,99,235,0.3)] transition-colors disabled:opacity-50"
          >
            {loading ? 'Đang lưu...' : 'Đổi mật khẩu'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}
