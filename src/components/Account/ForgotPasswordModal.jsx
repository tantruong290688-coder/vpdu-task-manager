import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import ModalWrapper from './ModalWrapper';

export default function ForgotPasswordModal({ onClose }) {
  const { resetPasswordForEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      toast.error('Vui lòng nhập email');
      return;
    }
    
    setLoading(true);
    const { error } = await resetPasswordForEmail(email);
    setLoading(false);

    if (error) {
      toast.error('Lỗi: ' + error.message);
    } else {
      toast.success('Đã gửi email đặt lại mật khẩu! Vui lòng kiểm tra hộp thư của bạn.');
      onClose();
    }
  };

  return (
    <ModalWrapper onClose={onClose} title="Quên mật khẩu / đặt lại">
      <p className="text-sm text-slate-500 mb-6">Nhập địa chỉ email của bạn. Chúng tôi sẽ gửi một liên kết để bạn có thể đặt lại mật khẩu của mình.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1.5">Email tài khoản</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm"
            placeholder="vd: canbo@trabong.gov.vn"
          />
        </div>
        
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 transition-colors">Hủy</button>
          <button type="submit" disabled={loading} className="px-5 py-2.5 rounded-xl font-bold bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-[0_4px_12px_rgba(37,99,235,0.3)] transition-colors disabled:opacity-50">
            {loading ? 'Đang gửi...' : 'Gửi liên kết'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}
