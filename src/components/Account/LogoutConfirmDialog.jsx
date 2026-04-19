import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LogOut } from 'lucide-react';
import ModalWrapper from './ModalWrapper';

export default function LogoutConfirmDialog({ onClose }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      toast.success('Đăng xuất thành công');
      onClose(); // Đóng modal trước
      await logout(); // Gọi hàm logout, sau đó hệ thống tự chuyển trang nhờ ProtectedRoute
    } catch (error) {
      toast.error('Lỗi đăng xuất: ' + error.message);
    }
  };

  return (
    <ModalWrapper onClose={onClose} title="Xác nhận đăng xuất">
      <div className="text-center pb-6 pt-2">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <LogOut size={28} className="text-red-600" />
        </div>
        <p className="text-slate-600 text-[15px] font-medium">Bạn có chắc chắn muốn đăng xuất không?</p>
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
        <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 transition-colors">Hủy</button>
        <button onClick={handleLogout} className="px-5 py-2.5 rounded-xl font-bold bg-[#dc2626] hover:bg-[#b91c1c] text-white shadow-[0_4px_12px_rgba(220,38,38,0.3)] transition-colors">Đăng xuất</button>
      </div>
    </ModalWrapper>
  );
}
