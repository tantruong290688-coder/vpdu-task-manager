import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // 1. Chỉ chấp nhận phương thức POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Chỉ chấp nhận phương thức POST' });
  }

  // 2. Kiểm tra xác thực
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Bạn không có quyền truy cập' });
  }

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Cấu hình hệ thống (Vercel ENV) chưa đầy đủ' });
  }

  try {
    // Khởi tạo Supabase Admin
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Xác thực người dùng
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
    }

    // Kiểm tra role admin
    const { data: profile, error: profError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profError || profile?.role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ Quản trị viên (Admin) mới có quyền xóa nhật ký' });
    }

    // 3. Xóa sạch nhật ký
    const { error: delError } = await supabaseAdmin
      .from('activity_logs')
      .delete()
      .not('id', 'is', null);

    if (delError) throw delError;

    // 4. Ghi lại hành động xóa
    await supabaseAdmin.from('activity_logs').insert({
      actor_id: user.id,
      actor_name: 'Hệ thống (Admin)',
      actor_role: 'admin',
      action: 'Xóa nhật ký',
      note: `Toàn bộ nhật ký thao tác đã được dọn dẹp sạch sẽ bởi Admin.`
    });

    return res.status(200).json({ success: true, message: 'Đã xóa sạch nhật ký thành công' });
  } catch (error) {
    console.error('[Clear Logs API Error]:', error);
    return res.status(500).json({ error: 'Lỗi máy chủ: ' + error.message });
  }
}
