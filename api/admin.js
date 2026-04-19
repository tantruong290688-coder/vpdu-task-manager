import { createClient } from '@supabase/supabase-js';

function getAdmin() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Thiếu SUPABASE_SERVICE_ROLE_KEY trên server');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

const ok  = (res, d = {}) => res.status(200).json({ success: true, ...d });
const err = (res, s, m)   => res.status(s).json({ error: m });

// ── Handlers ──────────────────────────────────────────────────────────────────

async function listUsers(db, res) {
  // Lấy từ auth.users (nguồn sự thật) + join profiles
  const { data: authData, error: authErr } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (authErr) throw authErr;

  const { data: profiles } = await db
    .from('profiles')
    .select('id, full_name, role, status, is_locked, is_online, last_seen_at, last_login_at, created_at');

  const profileMap = {};
  (profiles || []).forEach(p => { profileMap[p.id] = p; });

  const now = new Date();
  const users = (authData?.users || []).map(u => {
    const p = profileMap[u.id] || {};
    const isBanned = u.banned_until && new Date(u.banned_until) > now;
    return {
      id: u.id,
      email: u.email || '',
      full_name: p.full_name || u.user_metadata?.full_name || u.email?.split('@')[0] || '',
      role: p.role || u.user_metadata?.role || 'staff',
      status: isBanned ? 'locked' : (p.status || 'active'),
      is_locked: isBanned || p.is_locked || false,
      is_online: p.is_online || false,
      last_seen_at: p.last_seen_at || null,
      last_login_at: p.last_login_at || u.last_sign_in_at || null,
      created_at: u.created_at,
    };
  });

  // Sắp xếp: admin lên đầu, rồi theo full_name
  users.sort((a, b) => {
    if (a.role === 'admin' && b.role !== 'admin') return -1;
    if (b.role === 'admin' && a.role !== 'admin') return 1;
    return (a.full_name || '').localeCompare(b.full_name || '', 'vi');
  });

  return ok(res, { users });
}

async function createUser(db, d, res) {
  if (!d.email) throw new Error('Email không được để trống');

  let authUser;
  if (d.method === 'invite') {
    const { data, error } = await db.auth.admin.inviteUserByEmail(d.email, {
      data: { full_name: d.full_name, role: d.role },
    });
    if (error) throw error;
    authUser = data.user;
  } else {
    if (!d.password || d.password.length < 6) throw new Error('Mật khẩu phải có ít nhất 6 ký tự');
    const { data, error } = await db.auth.admin.createUser({
      email: d.email,
      password: d.password,
      email_confirm: true,
      user_metadata: { full_name: d.full_name, role: d.role },
    });
    if (error) throw error;
    authUser = data.user;
  }

  // Upsert profile với fallback nếu trigger chưa chạy
  await db.from('profiles').upsert({
    id: authUser.id,
    email: d.email,
    full_name: d.full_name || '',
    role: d.role || 'staff',
    status: 'active',
    is_locked: false,
  }, { onConflict: 'id', ignoreDuplicates: false });

  return ok(res, { userId: authUser.id });
}

async function updateUser(db, d, res) {
  if (!d.userId) throw new Error('Thiếu userId');
  await Promise.all([
    db.from('profiles').update({ full_name: d.full_name, role: d.role }).eq('id', d.userId),
    db.auth.admin.updateUserById(d.userId, { user_metadata: { full_name: d.full_name, role: d.role } }),
  ]);
  return ok(res);
}

async function resetPassword(db, d, res) {
  if (!d.userId || !d.newPassword) throw new Error('Thiếu thông tin');
  if (d.newPassword.length < 6) throw new Error('Mật khẩu phải có ít nhất 6 ký tự');
  const { error } = await db.auth.admin.updateUserById(d.userId, { password: d.newPassword });
  if (error) throw error;
  return ok(res);
}

async function toggleLock(db, d, res) {
  if (!d.userId) throw new Error('Thiếu userId');
  const ban = d.isLocked ? '876000h' : 'none';
  const [r1, r2] = await Promise.all([
    db.auth.admin.updateUserById(d.userId, { ban_duration: ban }),
    db.from('profiles').update({ is_locked: d.isLocked, status: d.isLocked ? 'locked' : 'active' }).eq('id', d.userId),
  ]);
  if (r1.error) throw r1.error;
  if (r2.error) throw r2.error;
  return ok(res);
}

async function deleteUser(db, d, res) {
  if (!d.userId) throw new Error('Thiếu userId');
  await db.from('profiles').delete().eq('id', d.userId);
  const { error } = await db.auth.admin.deleteUser(d.userId);
  if (error) throw error;
  return ok(res);
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return err(res, 405, 'Method not allowed');

  const { action, userData = {} } = req.body || {};
  if (!action) return err(res, 400, 'Thiếu action');

  let db;
  try { db = getAdmin(); } catch (e) { return err(res, 500, e.message); }

  try {
    switch (action) {
      case 'list_users':     return await listUsers(db, res);
      case 'create_user':    return await createUser(db, userData, res);
      case 'update_user':    return await updateUser(db, userData, res);
      case 'reset_password': return await resetPassword(db, userData, res);
      case 'toggle_lock':    return await toggleLock(db, userData, res);
      case 'delete_user':    return await deleteUser(db, userData, res);
      default:               return err(res, 400, `Hành động không hợp lệ: ${action}`);
    }
  } catch (e) {
    console.error('[AdminAPI]', action, e.message);
    return err(res, 400, e.message);
  }
}
