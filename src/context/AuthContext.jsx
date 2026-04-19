import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { writeLog } from '../lib/logger';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId) => {
    try {
      // Cập nhật last_login_at khi fetch profile (thường là lúc mới đăng nhập hoặc tải lại trang)
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (error) throw error;
      
      if (data) {
        setProfile(data);
        // Cập nhật thời gian truy cập (không chặn việc load app nếu lỗi)
        supabase.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', userId).then();
      }
    } catch (err) {
      console.error('Lỗi fetchProfile:', err);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.data?.user) {
      const { data: prof } = await supabase.from('profiles').select('full_name, role').eq('id', result.data.user.id).single();
      writeLog({
        actorId: result.data.user.id,
        actorName: prof?.full_name || email,
        actorRole: prof?.role || 'user',
        action: 'Đăng nhập',
        note: `Đăng nhập từ ${new Date().toLocaleString('vi-VN')}`,
      });
    }
    return result;
  };

  const logout = async () => {
    if (profile) {
      await writeLog({
        actorId: profile.id,
        actorName: profile.full_name,
        actorRole: profile.role,
        action: 'Đăng xuất',
        note: `Đăng xuất lúc ${new Date().toLocaleString('vi-VN')}`,
      });
    }
    await supabase.auth.signOut();
  };

  const changePassword = async (newPassword) => {
    return await supabase.auth.updateUser({ password: newPassword });
  };

  const resetPasswordForEmail = async (email) => {
    return await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Đang tải hệ thống...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, profile, login, logout, changePassword, resetPasswordForEmail, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
