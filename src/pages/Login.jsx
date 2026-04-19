import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    const { error: err } = await login(email, password);
    if (err) {
      setError('Đăng nhập thất bại: Kiểm tra lại tên đăng nhập và mật khẩu.');
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1a2332] relative overflow-hidden p-4">
      {/* Background geometric pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M54.627 0l.83.83-53.797 53.797-.83-.83L54.627 0zM29.627 0l.83.83-28.797 28.797-.83-.83L29.627 0zM59.627 30l.83.83-28.797 28.797-.83-.83L59.627 30z' fill='%23ffffff' fill-rule='evenodd'/%3E%3C/svg%3E")`,
        backgroundSize: '120px 120px'
      }}></div>

      <div className="bg-[#f0f2f5] p-8 md:p-10 rounded-[32px] shadow-2xl w-full max-w-[480px] relative z-10">
        <div className="text-center mb-8">
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-blue-500 blur-xl opacity-40 rounded-full transform translate-y-1"></div>
            <div className="w-[76px] h-[76px] bg-gradient-to-b from-[#1da1f2] to-[#0077b5] rounded-full flex items-center justify-center relative shadow-md mx-auto">
              <span className="text-white font-black text-2xl tracking-wide">VP</span>
            </div>
          </div>
          <h2 className="text-[26px] leading-[1.3] font-extrabold text-[#111827] mb-3 px-2">
            Quản trị nhiệm vụ VPĐU xã Trà Bồng
          </h2>
          <p className="text-[#64748b] text-[15px] leading-relaxed px-4">
            Đăng nhập để theo dõi, giao việc và xử lý thông báo nhiệm vụ trong hệ thống nội bộ.
          </p>
        </div>

        {error && <div className="bg-red-50 text-red-500 p-3 rounded-xl mb-6 text-sm text-center border border-red-100 font-medium">{error}</div>}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-[14px] font-bold text-[#111827] mb-2">Tên đăng nhập</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required
              className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-[14px] focus:ring-[3px] focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-slate-800 placeholder-slate-400 font-medium"
              placeholder="Nhập email hoặc tên đăng nhập" 
            />
          </div>
          
          <div>
            <label className="block text-[14px] font-bold text-[#111827] mb-2">Mật khẩu</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required
                className="w-full pl-4 pr-14 py-3.5 bg-white border border-slate-200 rounded-[14px] focus:ring-[3px] focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-slate-800 placeholder-slate-400 font-medium"
                placeholder="Nhập mật khẩu" 
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-white border border-slate-100 hover:bg-slate-50 text-slate-600 rounded-xl transition-colors shadow-sm"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          
          <div className="pt-3">
            <button 
              type="submit" 
              className="w-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold py-4 rounded-[14px] shadow-[0_4px_14px_0_rgba(37,99,235,0.25)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.2)] hover:-translate-y-0.5 transition-all duration-200 text-[16px]"
            >
              Đăng nhập
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
