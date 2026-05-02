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
    return res.status(500).json({ error: 'Cấu hình hệ thống chưa đầy đủ (Service Role Key)' });
  }

  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Xác thực người dùng
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Phiên làm việc hết hạn' });
    }

    // Kiểm tra quyền admin
    const { data: profile, error: profError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profError || profile?.role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ Admin mới có quyền xóa sạch tin nhắn' });
    }

    // 3. Thực hiện xóa sạch tin nhắn ở cả 2 bảng
    const [delPrivate, delGroup] = await Promise.all([
      supabaseAdmin.from('messages').delete().not('id', 'is', null),
      supabaseAdmin.from('chat_messages').delete().not('id', 'is', null)
    ]);

    if (delPrivate.error) throw delPrivate.error;
    if (delGroup.error) throw delGroup.error;

    // 4. Ghi lại nhật ký hành động này
    await supabaseAdmin.from('activity_logs').insert({
      actor_id: user.id,
      actor_name: 'Hệ thống (Admin)',
      actor_role: 'admin',
      action: 'Xóa sạch tin nhắn',
      note: 'Quản trị viên đã xóa sạch toàn bộ lịch sử tin nhắn riêng và tin nhắn nhóm.'
    });

    return res.status(200).json({ success: true, message: 'Đã xóa sạch toàn bộ tin nhắn thành công' });
  } catch (error) {
    console.error('[Clear Chats API Error]:', error);
    return res.status(500).json({ error: 'Lỗi máy chủ: ' + error.message });
  }
}
