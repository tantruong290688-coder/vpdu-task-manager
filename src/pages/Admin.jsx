import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Settings, Users, Plus, UserPlus, Shield, Lock, Unlock, Search, X, Loader2, Circle, Edit, Key, RefreshCw, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Admin() {
  const { profile } = useAuth();
  const [users, setUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    role: 'staff',
    password: '',
    method: 'password', // 'password' or 'invite'
  });

  const [editData, setEditData] = useState({
    full_name: '',
    role: 'staff',
    status: 'active'
  });

  const [newPassword, setNewPassword] = useState('');

  const isAdmin = profile?.role === 'admin';

  const callAdminApi = async (action, userData) => {
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, userData })
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Lỗi server');
    return data;
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await callAdminApi('list_users');
      setUsers(data.users || []);
    } catch (err) {
      console.error('Fetch users error:', err);
      toast.error('Lỗi tải danh sách: ' + (err.message || 'Không xác định'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    fetchUsers();

    // TRUE REALTIME PRESENCE: Listen to the channel directly
    const channel = supabase.channel('online-users');
    
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const onlineMap = {};
        Object.keys(state).forEach(uid => {
          onlineMap[uid] = true;
        });
        setOnlineUsers(onlineMap);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, fetchUsers]);

  // Realtime subscription for profile changes
  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel('admin-profile-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
        setUsers(prev => prev.map(u => u.id === payload.new.id ? { ...u, ...payload.new } : u));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await callAdminApi('create_user', formData);

      toast.success(formData.method === 'invite' ? 'Đã gửi lời mời qua email!' : 'Tạo tài khoản thành công!');
      setIsModalOpen(false);
      setFormData({ full_name: '', email: '', role: 'staff', password: '', method: 'password' });
      fetchUsers();
    } catch (err) {
      toast.error('Lỗi: ' + (err.message.includes('already registered') ? 'Email này đã tồn tại!' : err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await callAdminApi('update_user', { userId: selectedUser.id, ...editData });

      toast.success('Cập nhật tài khoản thành công');
      setIsEditModalOpen(false);
      fetchUsers();
    } catch (err) {
      toast.error('Lỗi: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await callAdminApi('reset_password', { userId: selectedUser.id, newPassword });

      toast.success('Đã đổi mật khẩu mới cho ' + selectedUser.full_name);
      setIsPasswordModalOpen(false);
      setNewPassword('');
    } catch (err) {
      toast.error('Lỗi: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleLock = async (user) => {
    const isCurrentlyLocked = user.status === 'locked' || user.is_locked;
    const actionLabel = isCurrentlyLocked ? 'Mở khóa' : 'Khóa';
    
    if (!window.confirm(`Bạn có chắc muốn ${actionLabel.toLowerCase()} tài khoản này?`)) return;

    try {
      await callAdminApi('toggle_lock', { userId: user.id, isLocked: !isCurrentlyLocked });

      toast.success(`${actionLabel} tài khoản thành công`);
      fetchUsers();
    } catch (err) {
      toast.error('Lỗi: ' + err.message);
    }
  };

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`NGUY HIỂM: Bạn có chắc chắn muốn XÓA VĨNH VIỄN tài khoản của ${user.full_name}? Hành động này không thể hoàn tác!`)) return;

    try {
      await callAdminApi('delete_user', { userId: user.id });
      toast.success('Xóa tài khoản thành công');
      fetchUsers();
    } catch (err) {
      toast.error('Lỗi khi xóa: ' + err.message);
    }
  };

  const filteredUsers = (users || []).filter(u => 
    (u.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const getRelativeTime = (ts) => {
    if (!ts) return 'Chưa từng';
    const now = new Date();
    const then = new Date(ts);
    if (isNaN(then.getTime())) return 'N/A';
    
    const diffInSeconds = Math.floor((now - then) / 1000);
    if (diffInSeconds < 60) return 'Vừa truy cập';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} phút trước`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} giờ trước`;
    return then.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500">
        <Shield size={64} className="mb-4 opacity-20" />
        <h2 className="text-xl font-bold">Truy cập bị từ chối</h2>
        <p>Bạn không có quyền quản trị để xem trang này.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#111827] rounded-[24px] shadow-sm border border-slate-100 dark:border-slate-800 p-8 transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-purple-50 dark:bg-purple-900/20 rounded-2xl flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
              <Settings size={28} />
            </div>
            <div>
              <h2 className="text-[24px] font-extrabold text-slate-800 dark:text-white leading-tight">Quản trị hệ thống</h2>
              <p className="text-[14px] text-slate-500 dark:text-slate-400 font-medium">Quản lý người dùng và trạng thái trực tuyến thật.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchUsers} disabled={loading} className="p-3 text-slate-400 hover:text-blue-500 bg-slate-50 dark:bg-slate-800 rounded-xl transition-colors">
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-6 py-3 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold rounded-xl shadow-[0_4px_12px_rgba(37,99,235,0.3)] transition-all hover:scale-105 active:scale-95">
              <Plus size={20} /> Tạo tài khoản mới
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#111827] rounded-[24px] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden transition-colors">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Users size={20} className="text-slate-400" /> Danh sách tài khoản 
            <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg text-[13px] text-slate-500">{(users || []).length}</span>
          </h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type="text" placeholder="Tìm kiếm tài khoản..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2.5 w-full sm:w-80 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-900/50 text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                <th className="p-5">Người dùng</th>
                <th className="p-5">Vai trò</th>
                <th className="p-5">Trực tuyến</th>
                <th className="p-5">Hoạt động cuối</th>
                <th className="p-5">Trạng thái</th>
                <th className="p-5 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {loading && users.length === 0 ? (
                <tr><td colSpan="6" className="p-20 text-center text-slate-400 font-medium">Đang đồng bộ dữ liệu với Auth...</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan="6" className="p-20 text-center text-slate-400 font-medium">Không tìm thấy tài khoản nào.</td></tr>
              ) : (
                filteredUsers.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="p-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-sm">{(u.full_name || u.email || 'U').charAt(0).toUpperCase()}</div>
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-200 text-[15px]">{u.full_name || 'Chưa có tên'}</p>
                          <p className="text-[12px] text-slate-500 dark:text-slate-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-5">
                      <span className={`inline-flex px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase ${u.role === 'admin' ? 'bg-red-50 text-red-600 dark:bg-red-900/20' : u.role === 'manager' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                        {u.role === 'admin' ? 'Quản trị' : u.role === 'manager' ? 'Quản lý' : u.role === 'specialist' ? 'Chuyên viên' : 'Nhân viên'}
                      </span>
                    </td>
                    <td className="p-5">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Circle size={8} fill={onlineUsers[u.id] ? '#10b981' : '#ef4444'} className={onlineUsers[u.id] ? 'text-green-500 animate-pulse' : 'text-red-500'} />
                          <span className={`text-[13px] font-bold ${onlineUsers[u.id] ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>
                            {onlineUsers[u.id] ? 'Online' : 'Offline'}
                          </span>
                        </div>
                        {onlineUsers[u.id] && (
                          <span className="text-[10px] text-green-500 font-medium px-2 py-0.5 bg-green-50 dark:bg-green-900/20 rounded-full w-fit">Đang hoạt động</span>
                        )}
                      </div>
                    </td>
                    <td className="p-5">
                       <div className="flex flex-col">
                        <span className="text-[13px] text-slate-700 dark:text-slate-300 font-semibold">
                          {onlineUsers[u.id] ? 'Vừa truy cập' : getRelativeTime(u.last_seen_at)}
                        </span>
                        <span className="text-[10px] text-slate-400 italic">
                          {onlineUsers[u.id] ? 'Trực tuyến' : `Lần cuối: ${(() => {
                            if (!u.last_seen_at) return 'N/A';
                            const d = new Date(u.last_seen_at);
                            return isNaN(d.getTime()) ? 'N/A' : d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                          })()}`}
                        </span>
                      </div>
                    </td>
                    <td className="p-5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-bold ${u.status === 'active' && !u.is_locked ? 'text-green-600 bg-green-50 dark:bg-green-900/20' : 'text-red-600 bg-red-50 dark:bg-red-900/20'}`}>
                        {u.status === 'active' && !u.is_locked ? 'Hoạt động' : 'Đã khóa'}
                      </span>
                    </td>
                    <td className="p-5">
                      <div className="flex justify-center gap-1">
                        <button onClick={() => { setSelectedUser(u); setEditData({ full_name: u.full_name, role: u.role, status: u.status }); setIsEditModalOpen(true); }} className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"><Edit size={18} /></button>
                        <button onClick={() => { setSelectedUser(u); setIsPasswordModalOpen(true); }} className="p-2 text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"><Key size={18} /></button>
                        <button onClick={() => handleToggleLock(u)} className={`p-2 rounded-lg transition-colors ${u.status === 'active' && !u.is_locked ? 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-red-500 bg-red-50 dark:bg-red-900/20 hover:text-green-500 hover:bg-green-50'}`}>{u.status === 'active' && !u.is_locked ? <Lock size={18} /> : <Unlock size={18} />}</button>
                        <button onClick={() => handleDeleteUser(u)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Xóa tài khoản"><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: CREATE USER */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111827] rounded-[28px] w-full max-w-md shadow-2xl border border-white dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <h2 className="text-[20px] font-extrabold text-slate-800 dark:text-white flex items-center gap-3"><UserPlus className="text-blue-500" /> Tạo tài khoản mới</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateUser} className="p-8 space-y-5">
              <div><label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300 mb-2">Họ và tên</label><input type="text" required value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-[14px]" /></div>
              <div><label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300 mb-2">Email</label><input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-[14px]" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300 mb-2">Vai trò</label><select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-[14px]"><option value="staff">Nhân viên</option><option value="specialist">Chuyên viên</option><option value="manager">Quản lý</option><option value="admin">Quản trị</option></select></div>
                <div><label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300 mb-2">Phương thức</label><select value={formData.method} onChange={e => setFormData({...formData, method: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-[14px]"><option value="password">Mật khẩu tạm</option><option value="invite">Mời qua email</option></select></div>
              </div>
              {formData.method === 'password' && (<div><label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300 mb-2">Mật khẩu tạm</label><input type="text" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-[14px]" /></div>)}
              <div className="pt-4 flex gap-3"><button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-3 font-bold text-slate-600 bg-slate-50 dark:bg-slate-800 rounded-xl">Hủy</button><button type="submit" disabled={submitting} className="flex-1 px-4 py-3 font-bold bg-[#2563eb] text-white rounded-xl shadow-[0_4px_12px_rgba(37,99,235,0.3)]">{submitting ? <Loader2 className="animate-spin mx-auto" size={18} /> : (formData.method === 'invite' ? 'Gửi lời mời' : 'Tạo tài khoản')}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT USER */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111827] rounded-[28px] w-full max-w-md shadow-2xl border border-white dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <h2 className="text-[20px] font-extrabold text-slate-800 dark:text-white flex items-center gap-3"><Edit className="text-blue-500" /> Chỉnh sửa tài khoản</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
            </div>
            <form onSubmit={handleUpdateUser} className="p-8 space-y-5">
              <div><label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300 mb-2">Họ và tên</label><input type="text" required value={editData.full_name} onChange={e => setEditData({...editData, full_name: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-[14px]" /></div>
              <div><label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300 mb-2">Vai trò</label><select value={editData.role} onChange={e => setEditData({...editData, role: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-[14px]"><option value="staff">Nhân viên</option><option value="specialist">Chuyên viên</option><option value="manager">Quản lý</option><option value="admin">Quản trị</option></select></div>
              <div className="pt-4 flex gap-3"><button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 px-4 py-3 font-bold text-slate-600 bg-slate-50 dark:bg-slate-800 rounded-xl">Hủy</button><button type="submit" disabled={submitting} className="flex-1 px-4 py-3 font-bold bg-blue-600 text-white rounded-xl shadow-[0_4px_12px_rgba(37,99,235,0.3)]">{submitting ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'Cập nhật'}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESET PASSWORD */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111827] rounded-[28px] w-full max-w-md shadow-2xl border border-white dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <h2 className="text-[20px] font-extrabold text-slate-800 dark:text-white flex items-center gap-3"><Key className="text-orange-500" /> Đặt lại mật khẩu</h2>
              <button onClick={() => setIsPasswordModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
            </div>
            <form onSubmit={handleResetPassword} className="p-8 space-y-5">
              <p className="text-[14px] text-slate-500 dark:text-slate-400">Đặt lại mật khẩu mới cho <strong>{selectedUser?.full_name}</strong> ({selectedUser?.email})</p>
              <div><label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300 mb-2">Mật khẩu mới</label><input type="text" required value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-[14px]" placeholder="Nhập ít nhất 6 ký tự..." /></div>
              <div className="pt-4 flex gap-3"><button type="button" onClick={() => setIsPasswordModalOpen(false)} className="flex-1 px-4 py-3 font-bold text-slate-600 bg-slate-50 dark:bg-slate-800 rounded-xl">Hủy</button><button type="submit" disabled={submitting} className="flex-1 px-4 py-3 font-bold bg-orange-600 text-white rounded-xl shadow-[0_4px_12px_rgba(234,88,12,0.3)]">{submitting ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'Xác nhận đổi'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
