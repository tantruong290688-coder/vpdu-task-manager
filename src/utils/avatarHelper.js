import leaderAvatar from '../assets/avatar_leader.jpg';
import adminAvatar from '../assets/avatar_admin.jpg';
import manager1Avatar from '../assets/avatar_manager1.jpg';
import manager2Avatar from '../assets/avatar_manager2.jpg';
import staff1Avatar from '../assets/avatar_staff1.jpg';
import staff2Avatar from '../assets/avatar_staff2.jpg';
import staff3Avatar from '../assets/avatar_staff3.jpg';
import staff4Avatar from '../assets/avatar_staff4.jpg';

// Ánh xạ khoá ảnh (cột profiles.avatar_key) -> ảnh dựng sẵn.
// Dữ liệu quyết định ai dùng ảnh nào nằm ở CSDL, không so tên trong mã.
const AVATAR_BY_KEY = {
  leader: leaderAvatar,
  admin: adminAvatar,
  manager1: manager1Avatar,
  manager2: manager2Avatar,
  staff1: staff1Avatar,
  staff2: staff2Avatar,
  staff3: staff3Avatar,
  staff4: staff4Avatar,
};

function uiAvatar(name) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=4f46e5&color=fff`;
}

/**
 * Lấy URL ảnh đại diện của một người.
 * Thứ tự ưu tiên: avatar_url (người dùng tự tải) -> avatar_key (ảnh dựng sẵn)
 *   -> mặc định theo role (admin/viewer) -> ui-avatars sinh từ tên.
 * @param {object|string} profileOrName - profile ({full_name, avatar_url, avatar_key, role}) hoặc chuỗi tên.
 * @param {string|null} role - role dự phòng khi truyền vào là chuỗi tên.
 */
export function getUserAvatar(profileOrName, role = null) {
  // Truyền vào là chuỗi tên: không còn ánh xạ tên->ảnh, trả ui-avatars.
  if (typeof profileOrName === 'string') {
    if (role === 'admin') return adminAvatar;
    if (role === 'viewer') return leaderAvatar;
    return uiAvatar(profileOrName);
  }

  const profile = profileOrName || {};
  const name = profile.full_name || profile.name || '';
  const userRole = profile.role || role;

  if (profile.avatar_url) return profile.avatar_url;
  if (profile.avatar_key && AVATAR_BY_KEY[profile.avatar_key]) return AVATAR_BY_KEY[profile.avatar_key];
  if (userRole === 'admin') return adminAvatar;
  if (userRole === 'viewer') return leaderAvatar;

  return uiAvatar(name);
}
