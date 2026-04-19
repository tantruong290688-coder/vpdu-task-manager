import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Chỉ chấp nhận POST request
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, userData } = req.body;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  // BẮT BUỘC PHẢI DÙNG SERVICE ROLE KEY ĐỂ QUẢN TRỊ AUTH
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Thiếu cấu hình SUPABASE_SERVICE_ROLE_KEY trên server' });
  }

  // Khởi tạo Supabase Admin Client
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    switch (action) {
      case 'list_users': {
        const { data, error } = await supabaseAdmin
          .from('profiles')
          .select('id, full_name, email, role, status, is_locked, last_seen_at, last_login_at, created_at')
          .order('full_name');
        if (error) throw error;
        return res.status(200).json({ success: true, users: data });
      }

      case 'create_user': {
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email: userData.email,
          password: userData.password,
          email_confirm: true,
          user_metadata: { full_name: userData.full_name, role: userData.role }
        });
        if (error) throw error;
        
        // Cập nhật profile (vì trigger có thể đã tạo profile rỗng)
        await supabaseAdmin.from('profiles').update({
          full_name: userData.full_name,
          role: userData.role,
          status: 'active'
        }).eq('id', data.user.id);
        
        return res.status(200).json({ success: true, user: data.user });
      }

      case 'update_user': {
        // Cập nhật bảng profiles
        const { error: profileError } = await supabaseAdmin.from('profiles').update({
          full_name: userData.full_name,
          role: userData.role
        }).eq('id', userData.userId);
        
        if (profileError) throw profileError;

        // Cập nhật user_metadata trong Auth
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
          userData.userId,
          { user_metadata: { full_name: userData.full_name, role: userData.role } }
        );
        if (authError) throw authError;

        return res.status(200).json({ success: true });
      }

      case 'reset_password': {
        const { error } = await supabaseAdmin.auth.admin.updateUserById(
          userData.userId,
          { password: userData.newPassword }
        );
        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      case 'toggle_lock': {
        // Khóa user: cấm đăng nhập bằng cách cập nhật ban_duration
        const banDuration = userData.isLocked ? '87600h' : 'none'; // Khóa 10 năm hoặc mở khóa
        
        const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(
          userData.userId,
          { ban_duration: banDuration }
        );
        if (banError) throw banError;

        // Cập nhật status trong profiles
        const { error: profileError } = await supabaseAdmin.from('profiles').update({
          is_locked: userData.isLocked,
          status: userData.isLocked ? 'locked' : 'active'
        }).eq('id', userData.userId);
        
        if (profileError) throw profileError;

        return res.status(200).json({ success: true });
      }

      case 'delete_user': {
        // Xóa user khỏi Supabase Auth (bảng profiles sẽ tự động bị xóa do CASCADE nếu đã setup, nếu chưa thì xóa tay)
        await supabaseAdmin.from('profiles').delete().eq('id', userData.userId);
        
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userData.userId);
        if (error) throw error;

        return res.status(200).json({ success: true });
      }

      default:
        return res.status(400).json({ error: 'Hành động không hợp lệ' });
    }
  } catch (error) {
    console.error('Lỗi Admin API:', error);
    return res.status(400).json({ error: error.message });
  }
}
