import { createClient } from '@supabase/supabase-client';

export default async function handler(req, res) {
  // 1. Chỉ chấp nhận phương thức POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 2. Kiểm tra xác thực (Chỉ Admin mới được gọi API này)
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Khởi tạo Supabase với Service Role Key (Quyền tối cao - Bỏ qua RLS)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Xác thực người dùng từ token gửi lên
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Kiểm tra role admin trong profiles
    const { data: profile, error: profError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profError || profile?.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Only admin can clear logs' });
    }

    // 3. Thực hiện xóa sạch nhật ký thao tác
    const { error: delError } = await supabaseAdmin
      .from('activity_logs')
      .delete()
      .not('id', 'is', null);

    if (delError) throw delError;

    // 4. Ghi lại một log duy nhất về hành động xóa này (Tùy chọn)
    await supabaseAdmin.from('activity_logs').insert({
      actor_id: user.id,
      actor_name: 'Hệ thống (Admin)',
      actor_role: 'admin',
      action: 'Xóa nhật ký',
      note: `Quản trị viên đã xóa sạch toàn bộ nhật ký thao tác lúc ${new Date().toLocaleString('vi-VN')}`
    });

    return res.status(200).json({ success: true, message: 'Đã xóa sạch nhật ký thành công' });
  } catch (error) {
    console.error('[Clear Logs API Error]:', error);
    return res.status(500).json({ error: error.message });
  }
}
