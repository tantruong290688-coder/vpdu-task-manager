import { useState } from 'react';
import { Search, Users, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function ContactList({ profiles, rooms, conversations, onlineUsers, onSelectUser, onSelectRoom }) {
  const [search, setSearch] = useState('');
  const { user: currentUser } = useAuth();

  const filteredUsers = Object.values(profiles)
    .filter(p => p.id !== currentUser.id)
    .filter(p => 
      (p.full_name || '').toLowerCase().includes(search.toLowerCase()) || 
      (p.email || '').toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const aConv = conversations[a.id];
      const bConv = conversations[b.id];
      if (aConv && bConv) return new Date(bConv.lastMessage.created_at) - new Date(aConv.lastMessage.created_at);
      if (aConv) return -1;
      if (bConv) return 1;
      return (a.full_name || '').localeCompare(b.full_name || '');
    });

  const formatTime = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/30 dark:bg-slate-900/10">
      <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
        <div className="relative group">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
          <input
            type="text"
            placeholder="Tìm kiếm đồng nghiệp..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-800 dark:text-slate-200"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-4 space-y-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
        {/* Rooms Section */}
        {rooms.length > 0 && (
          <div className="mb-6 px-2">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">Phòng chat nhóm</h4>
            {rooms.map(room => (
              <button
                key={room.id}
                onClick={() => onSelectRoom(room.id)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white dark:hover:bg-slate-800 transition-all group text-left shadow-sm hover:shadow-md mb-2 border border-transparent hover:border-slate-100 dark:hover:border-slate-700"
              >
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-white shadow-lg shrink-0 transform group-hover:rotate-3 transition-transform">
                  <Users size={24} />
                </div>
                <div className="overflow-hidden flex-1">
                  <div className="flex justify-between items-center mb-0.5">
                    <h4 className="font-extrabold text-[14px] text-slate-800 dark:text-white truncate uppercase">
                      {room.name}
                    </h4>
                  </div>
                  <p className="text-[12px] text-slate-500 dark:text-slate-400 truncate">
                    Hội ý công việc nội bộ
                  </p>
                </div>
                <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-1 transition-all" />
              </button>
            ))}
          </div>
        )}

        {/* Contacts Section */}
        <div className="px-2">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">Tin nhắn cá nhân</h4>
          {filteredUsers.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-slate-400 text-sm italic">Không tìm thấy người dùng này</p>
            </div>
          ) : (
            filteredUsers.map(p => {
              const isOnline = !!onlineUsers[p.id];
              const conv = conversations[p.id];
              const lastMsg = conv?.lastMessage;
              const unread = conv?.unreadCount || 0;
              
              return (
                <button
                  key={p.id}
                  onClick={() => onSelectUser(p.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white dark:hover:bg-slate-800 transition-all group text-left hover:shadow-sm mb-1 border border-transparent hover:border-slate-100 dark:hover:border-slate-700"
                >
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-sm group-hover:rotate-2 transition-transform">
                      {(p.full_name || p.email || '?').charAt(0).toUpperCase()}
                    </div>
                    {isOnline && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-slate-50 dark:border-slate-900 rounded-full"></span>
                    )}
                  </div>
                  
                  <div className="overflow-hidden flex-1">
                    <div className="flex justify-between items-center mb-0.5">
                      <h4 className="font-bold text-[14px] text-slate-800 dark:text-white truncate">
                        {p.full_name || p.email}
                      </h4>
                      {lastMsg && (
                        <span className="text-[10px] font-medium text-slate-400">
                          {formatTime(lastMsg.created_at)}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <p className={`text-[12px] truncate ${unread > 0 ? 'font-bold text-slate-800 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'}`}>
                        {lastMsg ? (lastMsg.sender_id === currentUser.id ? 'Bạn: ' : '') + lastMsg.content : 'Bắt đầu trò chuyện'}
                      </p>
                      {unread > 0 && (
                        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-black text-white ml-2 ring-2 ring-white dark:ring-slate-900">
                          {unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
