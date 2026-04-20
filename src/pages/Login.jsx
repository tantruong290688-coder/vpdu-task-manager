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
    <div className="min-h-screen flex items-center justify-center bg-[#f4f7fa] p-4 font-sans transition-colors duration-300">
      
      <div className="bg-white p-8 md:p-12 rounded-[40px] shadow-[0_20px_50px_rgba(0,0,0,0.05)] w-full max-w-[460px] animate-in fade-in zoom-in duration-500">
        
        {/* Header Section */}
        <div className="text-center mb-10">
          <div className="flex justify-center mb-8">
            <div className="w-[120px] h-[120px] rounded-full shadow-[0_10px_25px_rgba(220,38,38,0.3)] overflow-hidden bg-white flex items-center justify-center">
              <img src="/assets/logo.jpg" alt="Logo" className="w-[130%] h-[130%] max-w-none object-cover" />
            </div>
          </div>
          
          <h1 className="text-[28px] md:text-[32px] font-black text-[#111827] leading-[1.2] mb-4 tracking-tight">
            Quản trị nhiệm vụ VPĐU xã Trà Bồng
          </h1>
          <p className="text-[#6b7280] text-[15px] leading-relaxed font-medium px-4">
            Đăng nhập để theo dõi, giao việc và xử lý thông báo nhiệm vụ trong hệ thống nội bộ.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-500 px-4 py-3 rounded-2xl mb-6 text-sm text-center border border-red-100 font-bold animate-in slide-in-from-top-2">
            {error}
          </div>
        )}

        {/* Form Section */}
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2.5">
            <label className="block text-[15px] font-bold text-[#111827] ml-1">Tên đăng nhập</label>
            <input 
              type="text" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required
              className="w-full px-5 py-4 bg-[#f8fafc] border border-slate-200 rounded-[20px] focus:ring-[4px] focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white outline-none transition-all text-slate-800 placeholder-[#94a3b8] font-semibold text-[15px]"
              placeholder="Nhập email hoặc tên đăng nhập" 
            />
          </div>
          
          <div className="space-y-2.5">
            <label className="block text-[15px] font-bold text-[#111827] ml-1">Mật khẩu</label>
            <div className="relative group">
              <input 
                type={showPassword ? "text" : "password"} 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required
                className="w-full px-5 py-4 bg-[#f8fafc] border border-slate-200 rounded-[20px] focus:ring-[4px] focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white outline-none transition-all text-slate-800 placeholder-[#94a3b8] font-semibold text-[15px]"
                placeholder="Nhập mật khẩu" 
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center hover:bg-slate-100/80 text-slate-400 rounded-2xl transition-colors"
                tabIndex="-1"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
          
          <div className="pt-6">
            <button 
              type="submit" 
              className="w-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-black py-4.5 rounded-[20px] shadow-[0_10px_25px_-5px_rgba(37,99,235,0.4)] hover:shadow-[0_15px_30px_-5px_rgba(37,99,235,0.5)] hover:-translate-y-1 active:translate-y-0 transition-all duration-300 text-[17px]"
            >
              Đăng nhập
            </button>
          </div>
        </form>

        {/* Footer info (Optional but adds to premium feel) */}
        <div className="mt-10 text-center">
          <span className="text-[12px] font-bold text-[#cbd5e1] uppercase tracking-[0.2em]">Hệ thống bảo mật nội bộ</span>
        </div>
      </div>
    </div>
  );
}
