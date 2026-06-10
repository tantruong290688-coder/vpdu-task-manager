import leaderAvatar from '../assets/avatar_leader.jpg';
import adminAvatar from '../assets/avatar_admin.jpg';
import manager1Avatar from '../assets/avatar_manager1.jpg';
import manager2Avatar from '../assets/avatar_manager2.jpg';
import staff1Avatar from '../assets/avatar_staff1.jpg';
import staff2Avatar from '../assets/avatar_staff2.jpg';
import staff3Avatar from '../assets/avatar_staff3.jpg';
import staff4Avatar from '../assets/avatar_staff4.jpg';

export function getUserAvatar(profileOrName, role = null) {
  let name = '';
  let avatarUrl = '';
  let userRole = role;

  if (typeof profileOrName === 'string') {
    name = profileOrName;
  } else if (profileOrName && typeof profileOrName === 'object') {
    name = profileOrName.full_name || profileOrName.name || '';
    avatarUrl = profileOrName.avatar_url || '';
    userRole = profileOrName.role || role;
  }

  if (avatarUrl) return avatarUrl;

  if (name.includes('Bùi Tấn Trưởng')) return leaderAvatar;
  if (name.includes('Nguyễn Đức Lợi')) return manager1Avatar;
  if (name.includes('Lê Công Hào')) return manager2Avatar;
  if (name.includes('Phạm Học Thuyết')) return staff1Avatar;
  if (name.includes('Nguyễn Thị Hoài Thu')) return staff2Avatar;
  if (name.includes('Nguyễn Thị Thanh Pháp')) return staff3Avatar;
  if (name.includes('Phan Thị Linh')) return staff4Avatar;

  if (userRole === 'admin') return adminAvatar;
  if (userRole === 'viewer') return leaderAvatar;

  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=4f46e5&color=fff`;
}
