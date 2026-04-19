import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  Settings, Users, Plus, UserPlus, Shield, Lock, Unlock,
  Search, X, Loader2, Edit, Key, RefreshCw, Trash2,
  Circle, ChevronDown, AlertCircle,
} from 'lucide-react';

// ── helpers ──────────────────────────────────────────────────────────────────
const callApi = async (action, userData = {}) => {
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, userData }),
  });
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
};

const relTime = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts);
  if (isNaN(d)) return '—';
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return 'Vừa xong';
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  return d.toLocaleDateString('vi-VN');
};

const ROLE_LABELS = { admin: 'Quản trị', manager: 'Quản lý', specialist: 'Chuyên viên', staff: 'Nhân viên' };
const ROLE_COLORS = {
  admin: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  manager: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  specialist: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  staff: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-100 dark:border-slate-800">
      {[...Array(6)].map((_, i) => (
        <td key={i} className="p-5">
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" style={{ width: `${60 + i * 8}%` }} />
        </td>
      ))}
    </tr>
  );
}

function OnlineBadge({ isOnline, lastSeen }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Circle size={8} fill={isOnline ? '#10b981' : '#94a3b8'} className={isOnline ? 'text-green-500 animate-pulse' : 'text-slate-400'} />
        <span className={`text-[13px] font-semibold ${isOnline ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </div>
      {!isOnline && lastSeen && (
        <span className="text-[11px] text-slate-400 italic">{relTime(lastSeen)}</span>
      )}
    </div>
  );
}

function Modal({ isOpen, onClose, title, icon: Icon, iconColor = 'text-blue-500', children }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#111827] rounded-[28px] w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-8 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <h2 className="text-[18px] font-extrabold text-slate-800 dark:text-white flex items-center gap-3">
            {Icon && <Icon size={20} className={iconColor} />} {title}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 transition-colors"><X size={16} /></button>
        </div>
        <div className="p-8">{children}</div>
      </div>
    </div>
  );
}

const inputCls = 'w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-[14px] text-slate-800 dark:text-slate-200';
const labelCls = 'block text-[13px] font-bold text-slate-700 dark:text-slate-300 mb-2';

function RoleSelect({ value, onChange }) {
  return (
    <select value={value} onChange={onChange} className={inputCls}>
      <option value="staff">Nhân viên</option>
      <option value="specialist">Chuyên viên</option>
      <option value="manager">Quản lý</option>
      <option value="admin">Quản trị</option>
    </select>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Admin() {
  const { profile, onlineUsers } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiErr, setApiErr] = useState(null);
  const [search, setSearch] = useState('');

  // Modal states
  const [modal, setModal] = useState(null); // 'create' | 'edit' | 'password'
  const [selectedUser, setSelectedUser] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [createForm, setCreateForm] = useState({ full_name: '', email: '', role: 'staff', password: '', method: 'password' });
  const [editForm, setEditForm] = useState({ full_name: '', role: 'staff' });
  const [newPwd, setNewPwd] = useState('');
  
  const isAdmin = profile?.role === 'admin';

  const fetchUsers = useCallback(async () => {
    // Không set loading = true ở đây nếu chỉ là polling ngầm
    setApiErr(null);
    try {
      const data = await callApi('list_users');
      setUsers(data.users || []);
    } catch (e) {
      setApiErr(e.message);
      // Chỉ toast lỗi nếu danh sách đang rỗng (lỗi load lần đầu)
      if (users.length === 0) toast.error('Lỗi tải danh sách: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [users.length, callApi]);

  useEffect(() => {
    fetchUsers();
    // Cần polling 15s/lần để phòng hờ Realtime lỗi, ta vẫn có Data từ DB (Heartbeat fallback)
    const pollId = setInterval(fetchUsers, 15000);
    return () => clearInterval(pollId);
  }, [fetchUsers]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const doAction = async (action, userData, successMsg, afterCb) => {
    setSubmitting(true);
    try {
      await callApi(action, userData);
      toast.success(successMsg);
      afterCb?.();
      await fetchUsers();
    } catch (e) {
      toast.error('Lỗi: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreate = (e) => {
    e.preventDefault();
    doAction('create_user', createForm,
      createForm.method === 'invite' ? 'Đã gửi lời mời!' : 'Tạo tài khoản thành công!',
      () => { setModal(null); setCreateForm({ full_name: '', email: '', role: 'staff', password: '', method: 'password' }); }
    );
  };

  const handleEdit = (e) => {
    e.preventDefault();
    doAction('update_user', { userId: selectedUser.id, ...editForm },
      'Cập nhật thành công!',
      () => setModal(null)
    );
  };

  const handlePassword = (e) => {
    e.preventDefault();
    doAction('reset_password', { userId: selectedUser.id, newPassword: newPwd },
      'Đã đổi mật khẩu!',
      () => { setModal(null); setNewPwd(''); }
    );
  };

  const handleToggleLock = (u) => {
    const locked = u.is_locked;
    if (!window.confirm(`Bạn có chắc muốn ${locked ? 'mở khóa' : 'khóa'} tài khoản ${u.full_name || u.email}?`)) return;
    doAction('toggle_lock', { userId: u.id, isLocked: !locked },
      locked ? 'Đã mở khóa tài khoản!' : 'Đã khóa tài khoản!'
    );
  };

  const handleDelete = (u) => {
    if (!window.confirm(`XÓA VĨNH VIỄN tài khoản ${u.full_name || u.email}? Không thể hoàn tác!`)) return;
    doAction('delete_user', { userId: u.id }, 'Đã xóa tài khoản!');
  };

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return !q || (u.full_name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="bg-white dark:bg-[#111827] rounded-[24px] shadow-sm border border-slate-100 dark:border-slate-800 p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-purple-50 dark:bg-purple-900/20 rounded-2xl flex items-center justify-center text-purple-600">
              <Settings size={28} />
            </div>
            <div>
              <h1 className="text-[24px] font-extrabold text-slate-800 dark:text-white">Quản trị hệ thống</h1>
              <p className="text-[13px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Quản lý tài khoản người dùng — {users.length} tài khoản
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchUsers} disabled={loading}
              className="p-3 text-slate-400 hover:text-blue-500 bg-slate-50 dark:bg-slate-800 rounded-xl transition-colors" title="Làm mới">
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            {isAdmin && (
              <button onClick={() => setModal('create')}
                className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-[0_4px_12px_rgba(37,99,235,0.3)] transition-all active:scale-95">
                <Plus size={18} /> Tạo tài khoản
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white dark:bg-[#111827] rounded-[24px] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">

        {/* Search bar */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Users size={18} className="text-slate-400" />
            Danh sách tài khoản
            <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 text-[12px] font-bold px-2 py-0.5 rounded-lg">{filtered.length}</span>
          </h3>
          <div className="relative w-full sm:w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Tìm theo tên hoặc email..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2.5 w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[13px] outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {/* Error state */}
        {apiErr && (
          <div className="mx-6 mt-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start gap-3">
            <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-red-700 dark:text-red-400 text-[14px]">Không thể tải danh sách người dùng</p>
              <p className="text-[12px] text-red-600 dark:text-red-400 mt-1">{apiErr}</p>
              <p className="text-[12px] text-red-500 mt-1">Kiểm tra: biến môi trường <code className="bg-red-100 dark:bg-red-900 px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> đã được thêm trên Vercel chưa?</p>
            </div>
          </div>
        )}

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-900/50 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="px-5 py-4">Người dùng</th>
                <th className="px-5 py-4">Vai trò</th>
                <th className="px-5 py-4">Trực tuyến</th>
                <th className="px-5 py-4">Hoạt động cuối</th>
                <th className="px-5 py-4">Trạng thái</th>
                {isAdmin && <th className="px-5 py-4 text-center">Thao tác</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {loading && users.length === 0
                ? [...Array(4)].map((_, i) => <SkeletonRow key={i} />)
                : filtered.length === 0
                  ? (
                    <tr>
                      <td colSpan="6" className="py-20 text-center">
                        <div className="flex flex-col items-center gap-3 text-slate-400">
                          <Users size={40} className="opacity-30" />
                          <p className="font-semibold">{search ? 'Không tìm thấy tài khoản phù hợp' : 'Chưa có tài khoản nào'}</p>
                        </div>
                      </td>
                    </tr>
                  )
                  : filtered.map(u => {
                    // Xác định Online thông qua state realtime onlineUsers (Ưu tiên số 1)
                    let isOnline = !!onlineUsers[u.id];
                    
                    // Fallback: nếu realtime bị mất kết nối, dùng db last_seen_at
                    if (!isOnline && u.is_online && u.last_seen_at) {
                      const diffSeconds = (Date.now() - new Date(u.last_seen_at).getTime()) / 1000;
                      if (diffSeconds < 60) isOnline = true;
                    }
                    
                    const locked = u.is_locked || u.status === 'locked';
                    const avatar = (u.full_name || u.email || '?').charAt(0).toUpperCase();
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors">
                        {/* User */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-[15px] shadow-sm ${locked ? 'bg-slate-400' : 'bg-gradient-to-br from-indigo-500 to-purple-600'}`}>
                              {avatar}
                            </div>
                            <div>
                              <p className="font-bold text-slate-800 dark:text-slate-100 text-[14px]">{u.full_name || '(Chưa có tên)'}</p>
                              <p className="text-[12px] text-slate-500 dark:text-slate-400">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        {/* Role */}
                        <td className="px-5 py-4">
                          <span className={`inline-flex px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase ${ROLE_COLORS[u.role] || ROLE_COLORS.staff}`}>
                            {ROLE_LABELS[u.role] || u.role}
                          </span>
                        </td>
                        {/* Online */}
                        <td className="px-5 py-4">
                          <OnlineBadge isOnline={isOnline} lastSeen={onlineUsers[u.id] || u.last_seen_at} />
                        </td>
                        {/* Last active */}
                        <td className="px-5 py-4">
                          <span className="text-[13px] text-slate-600 dark:text-slate-400">{relTime(u.last_login_at)}</span>
                        </td>
                        {/* Status */}
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-bold ${locked ? 'text-red-600 bg-red-50 dark:bg-red-900/20' : 'text-green-600 bg-green-50 dark:bg-green-900/20'}`}>
                            <Circle size={6} fill={locked ? '#dc2626' : '#16a34a'} /> {locked ? 'Đã khóa' : 'Hoạt động'}
                          </span>
                        </td>
                        {/* Actions */}
                        {isAdmin && (
                          <td className="px-5 py-4">
                            <div className="flex items-center justify-center gap-1">
                              <button title="Chỉnh sửa" onClick={() => { setSelectedUser(u); setEditForm({ full_name: u.full_name || '', role: u.role || 'staff' }); setModal('edit'); }}
                                className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                                <Edit size={16} />
                              </button>
                              <button title="Đổi mật khẩu" onClick={() => { setSelectedUser(u); setNewPwd(''); setModal('password'); }}
                                className="p-2 rounded-lg text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors">
                                <Key size={16} />
                              </button>
                              <button title={locked ? 'Mở khóa' : 'Khóa tài khoản'} onClick={() => handleToggleLock(u)}
                                className={`p-2 rounded-lg transition-colors ${locked ? 'text-green-600 bg-green-50 dark:bg-green-900/20 hover:bg-green-100' : 'text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'}`}>
                                {locked ? <Unlock size={16} /> : <Lock size={16} />}
                              </button>
                              {u.id !== profile?.id && (
                                <button title="Xóa tài khoản" onClick={() => handleDelete(u)}
                                  className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
              }
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800/50">
          {loading && users.length === 0 ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="p-4 space-y-3 animate-pulse">
                <div className="flex gap-3"><div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full"></div><div className="flex-1 space-y-2"><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div><div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div></div></div>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center gap-2 text-slate-400">
              <Users size={32} className="opacity-30" />
              <p className="font-semibold text-[13px]">{search ? 'Không tìm thấy tài khoản phù hợp' : 'Chưa có tài khoản nào'}</p>
            </div>
          ) : (
            filtered.map(u => {
              let isOnline = !!onlineUsers[u.id];
              if (!isOnline && u.is_online && u.last_seen_at) {
                const diffSeconds = (Date.now() - new Date(u.last_seen_at).getTime()) / 1000;
                if (diffSeconds < 60) isOnline = true;
              }
              const locked = u.is_locked || u.status === 'locked';
              const avatar = (u.full_name || u.email || '?').charAt(0).toUpperCase();

              return (
                <div key={u.id} className="p-4 bg-white dark:bg-[#111827] hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-[15px] shadow-sm shrink-0 ${locked ? 'bg-slate-400' : 'bg-gradient-to-br from-indigo-500 to-purple-600'}`}>
                        {avatar}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-100 text-[14px] leading-tight">{u.full_name || '(Chưa có tên)'}</p>
                        <p className="text-[12px] text-slate-500 dark:text-slate-400">{u.email}</p>
                      </div>
                    </div>
                    <span className={`shrink-0 inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold ${locked ? 'text-red-600 bg-red-50 dark:bg-red-900/20' : 'text-green-600 bg-green-50 dark:bg-green-900/20'}`}>
                      <Circle size={6} fill={locked ? '#dc2626' : '#16a34a'} /> {locked ? 'Đã khóa' : 'Hoạt động'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[12px]">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-md font-bold uppercase ${ROLE_COLORS[u.role] || ROLE_COLORS.staff}`}>
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                      <OnlineBadge isOnline={isOnline} lastSeen={onlineUsers[u.id] || u.last_seen_at} />
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button onClick={() => { setSelectedUser(u); setEditForm({ full_name: u.full_name || '', role: u.role || 'staff' }); setModal('edit'); }}
                        className="flex-1 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-blue-600 flex items-center justify-center font-medium text-[12px]">
                        Sửa
                      </button>
                      <button onClick={() => { setSelectedUser(u); setNewPwd(''); setModal('password'); }}
                        className="flex-1 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-orange-500 flex items-center justify-center font-medium text-[12px]">
                        Pass
                      </button>
                      <button onClick={() => handleToggleLock(u)}
                        className={`flex-1 py-1.5 rounded-lg flex items-center justify-center font-medium text-[12px] ${locked ? 'text-green-600 bg-green-50 dark:bg-green-900/20' : 'text-slate-500 bg-slate-50 dark:bg-slate-800 hover:text-red-600'}`}>
                        {locked ? 'Mở' : 'Khóa'}
                      </button>
                      {u.id !== profile?.id && (
                        <button onClick={() => handleDelete(u)}
                          className="w-10 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-red-600 flex items-center justify-center font-medium">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Modal: Tạo tài khoản ── */}
      <Modal isOpen={modal === 'create'} onClose={() => setModal(null)} title="Tạo tài khoản mới" icon={UserPlus} iconColor="text-blue-500">
        <form onSubmit={handleCreate} className="space-y-4">
          <div><label className={labelCls}>Họ và tên</label>
            <input required type="text" value={createForm.full_name} onChange={e => setCreateForm(f => ({ ...f, full_name: e.target.value }))} className={inputCls} /></div>
          <div><label className={labelCls}>Email</label>
            <input required type="email" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} className={inputCls} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Vai trò</label><RoleSelect value={createForm.role} onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))} /></div>
            <div><label className={labelCls}>Phương thức</label>
              <select value={createForm.method} onChange={e => setCreateForm(f => ({ ...f, method: e.target.value }))} className={inputCls}>
                <option value="password">Mật khẩu tạm</option>
                <option value="invite">Mời qua email</option>
              </select>
            </div>
          </div>
          {createForm.method === 'password' && (
            <div><label className={labelCls}>Mật khẩu tạm (≥6 ký tự)</label>
              <input type="text" required minLength={6} value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} className={inputCls} placeholder="Ít nhất 6 ký tự" /></div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(null)} className="flex-1 py-3 font-bold text-slate-600 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Hủy</button>
            <button type="submit" disabled={submitting} className="flex-1 py-3 font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors disabled:opacity-60">
              {submitting ? <Loader2 size={18} className="animate-spin mx-auto" /> : (createForm.method === 'invite' ? 'Gửi lời mời' : 'Tạo tài khoản')}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Modal: Chỉnh sửa ── */}
      <Modal isOpen={modal === 'edit'} onClose={() => setModal(null)} title="Chỉnh sửa tài khoản" icon={Edit} iconColor="text-blue-500">
        <form onSubmit={handleEdit} className="space-y-4">
          <div><label className={labelCls}>Họ và tên</label>
            <input required type="text" value={editForm.full_name} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} className={inputCls} /></div>
          <div><label className={labelCls}>Vai trò</label><RoleSelect value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))} /></div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(null)} className="flex-1 py-3 font-bold text-slate-600 bg-slate-100 dark:bg-slate-800 rounded-xl">Hủy</button>
            <button type="submit" disabled={submitting} className="flex-1 py-3 font-bold bg-blue-600 text-white rounded-xl disabled:opacity-60">
              {submitting ? <Loader2 size={18} className="animate-spin mx-auto" /> : 'Cập nhật'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Modal: Đổi mật khẩu ── */}
      <Modal isOpen={modal === 'password'} onClose={() => setModal(null)} title="Đặt lại mật khẩu" icon={Key} iconColor="text-orange-500">
        <form onSubmit={handlePassword} className="space-y-4">
          <p className="text-[13px] text-slate-500 dark:text-slate-400">Đặt lại mật khẩu cho <strong className="text-slate-700 dark:text-white">{selectedUser?.full_name || selectedUser?.email}</strong></p>
          <div><label className={labelCls}>Mật khẩu mới (≥6 ký tự)</label>
            <input required type="text" minLength={6} value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="Nhập mật khẩu mới..." className={inputCls} /></div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(null)} className="flex-1 py-3 font-bold text-slate-600 bg-slate-100 dark:bg-slate-800 rounded-xl">Hủy</button>
            <button type="submit" disabled={submitting} className="flex-1 py-3 font-bold bg-orange-600 text-white rounded-xl disabled:opacity-60">
              {submitting ? <Loader2 size={18} className="animate-spin mx-auto" /> : 'Xác nhận đổi'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
