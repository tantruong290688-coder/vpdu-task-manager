import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useMessage } from '../context/MessageContext';
import { X, Search, Send, Loader2, ArrowLeft, Check, CheckCheck, Reply, Trash2, Users } from 'lucide-react';
import toast from 'react-hot-toast';

export default function MessagesDrawer() {
  const { user, profile, onlineUsers } = useAuth();
  const { isDrawerOpen, closeDrawer, activeChatUserId, setActiveChatUserId, fetchUnreadCount } = useMessage();
  
  const [profiles, setProfiles] = useState({});
  const [messages, setMessages] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [roomMessages, setRoomMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Chat state
  const [newMessage, setNewMessage] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isDrawerOpen && user) {
      loadData();
    }
  }, [isDrawerOpen, user]);

  // Realtime messages subscription
  useEffect(() => {
    if (!user || !isDrawerOpen) return;

    const channel = supabase.channel('drawer:messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new;
          if (msg.sender_id === user.id || msg.receiver_id === user.id) {
            setMessages(prev => {
              // Ignore duplicates
              if (prev.some(m => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
            
            // If we are actively chatting with the sender, mark it as read immediately
            if (msg.receiver_id === user.id && msg.sender_id === activeChatUserId) {
              markAsRead(msg.sender_id);
            } else if (msg.receiver_id === user.id) {
              // Update global count
              fetchUnreadCount();
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isDrawerOpen, activeChatUserId]);

  // Realtime room messages subscription
  useEffect(() => {
    if (!user || !isDrawerOpen || !activeRoomId) return;

    const channel = supabase.channel(`room:${activeRoomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${activeRoomId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const msg = payload.new;
            setRoomMessages(prev => {
              if (prev.some(m => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
          } else if (payload.eventType === 'UPDATE') {
            setRoomMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isDrawerOpen, activeRoomId]);

  // Scroll to bottom
  useEffect(() => {
    if ((activeChatUserId || activeRoomId) && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, roomMessages, activeChatUserId, activeRoomId]);

  // Mark as read when opening a chat
  useEffect(() => {
    if (activeChatUserId && isDrawerOpen) {
      markAsRead(activeChatUserId);
    }
  }, [activeChatUserId, isDrawerOpen]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch profiles and rooms
      const [{ data: profs }, { data: rms }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email, role, is_online, last_seen_at'),
        supabase.from('chat_rooms').select('*')
      ]);
      
      const profMap = {};
      (profs || []).forEach(p => profMap[p.id] = p);
      setProfiles(profMap);
      setRooms(rms || []);

      // 2. Fetch messages involving current user
      const { data: msgs, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: true });
        
      if (error) throw error;
      setMessages(msgs || []);
    } catch (err) {
      console.error(err);
      // Don't toast if it's just the rooms table missing (migration not run yet)
    } finally {
      setLoading(false);
    }
  };

  const loadRoomMessages = async (roomId) => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setRoomMessages(data || []);
    } catch (err) {
      console.error(err);
      toast.error('Lỗi tải tin nhắn nhóm');
    }
  };

  useEffect(() => {
    if (activeRoomId) {
      loadRoomMessages(activeRoomId);
      setReplyTo(null);
    }
  }, [activeRoomId]);

  const markAsRead = async (otherUserId) => {
    // Find unread messages from this user to me
    const unreadMsgs = messages.filter(m => m.sender_id === otherUserId && m.receiver_id === user.id && !m.is_read);
    if (unreadMsgs.length > 0) {
      // Update local state optimistically
      setMessages(prev => prev.map(m => 
        (m.sender_id === otherUserId && m.receiver_id === user.id && !m.is_read) 
          ? { ...m, is_read: true, read_at: new Date().toISOString() } 
          : m
      ));
      
      // Update DB
      await supabase
        .from('messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('sender_id', otherUserId)
        .eq('receiver_id', user.id)
        .eq('is_read', false);
        
      fetchUnreadCount();
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || (!activeChatUserId && !activeRoomId)) return;

    const content = newMessage.trim();
    setNewMessage('');
    const currentReplyTo = replyTo;
    setReplyTo(null);
    setSending(true);

    try {
      if (activeRoomId) {
        const msg = {
          room_id: activeRoomId,
          sender_id: user.id,
          sender_name: profile?.full_name || user.email.split('@')[0],
          content,
          reply_to_id: currentReplyTo?.id || null
        };
        const { error } = await supabase.from('chat_messages').insert(msg);
        if (error) throw error;
      } else {
        const msg = {
          sender_id: user.id,
          receiver_id: activeChatUserId,
          content,
          is_read: false,
          reply_to_id: currentReplyTo?.id || null
        };
        const { error } = await supabase.from('messages').insert(msg);
        if (error) throw error;
      }
    } catch (err) {
      console.error(err);
      toast.error('Không thể gửi tin nhắn');
    } finally {
      setSending(false);
    }
  };

  const softDeleteMessage = async (msgId) => {
    if (!window.confirm('Bạn có chắc muốn xóa tin nhắn này?')) return;
    try {
      const table = activeRoomId ? 'chat_messages' : 'messages';
      const { error } = await supabase
        .from(table)
        .update({ is_deleted: true, content: 'Tin nhắn đã bị xóa' })
        .eq('id', msgId);
      if (error) throw error;
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi xóa tin nhắn');
    }
  };

  const handleClearRoomMessages = async () => {
    if (!activeRoomId) return;
    const room = rooms.find(r => r.id === activeRoomId);
    if (!window.confirm(`CẢNH BÁO: Bạn có chắc muốn XÓA VĨNH VIỄN toàn bộ tin nhắn trong nhóm "${room?.name}"? Hành động này không thể hoàn tác và nhằm tiết kiệm dung lượng.`)) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('room_id', activeRoomId);
      
      if (error) throw error;
      
      setRoomMessages([]);
      toast.success('Đã xóa sạch lịch sử nhóm');
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi xóa lịch sử: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isDrawerOpen) return null;

  // Group conversations
  const conversationsMap = {};
  messages.forEach(m => {
    const otherId = m.sender_id === user.id ? m.receiver_id : m.sender_id;
    if (!conversationsMap[otherId] || new Date(m.created_at) > new Date(conversationsMap[otherId].lastMessage.created_at)) {
      conversationsMap[otherId] = {
        otherUserId: otherId,
        lastMessage: m,
        unreadCount: messages.filter(msg => msg.sender_id === otherId && msg.receiver_id === user.id && !msg.is_read).length
      };
    }
  });

  // Create list of all users, sorted by latest message, then by name
  let userList = Object.values(profiles)
    .filter(p => p.id !== user.id) // Exclude self
    .map(p => ({
      ...p,
      conversation: conversationsMap[p.id] || null
    }));

  if (search) {
    userList = userList.filter(p => 
      (p.full_name || '').toLowerCase().includes(search.toLowerCase()) || 
      (p.email || '').toLowerCase().includes(search.toLowerCase())
    );
  }

  userList.sort((a, b) => {
    const aTime = a.conversation ? new Date(a.conversation.lastMessage.created_at).getTime() : 0;
    const bTime = b.conversation ? new Date(b.conversation.lastMessage.created_at).getTime() : 0;
    if (aTime !== bTime) return bTime - aTime;
    return (a.full_name || '').localeCompare(b.full_name || '');
  });

  const activeUser = activeChatUserId ? profiles[activeChatUserId] : null;

  // Filter messages for active chat
  const chatMessages = messages.filter(m => 
    (m.sender_id === user.id && m.receiver_id === activeChatUserId) ||
    (m.sender_id === activeChatUserId && m.receiver_id === user.id)
  );

  const formatTime = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[60]" onClick={closeDrawer} />
      <div className="fixed top-0 right-0 h-full w-full sm:w-[400px] md:w-[450px] bg-white dark:bg-[#111827] shadow-2xl z-[70] flex flex-col transform transition-transform duration-300">
        
        {/* Header */}
        <div className="h-[calc(70px+env(safe-area-inset-top))] md:h-[80px] pt-[env(safe-area-inset-top)] px-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            {(activeChatUserId || activeRoomId) ? (
              <>
                <button 
                  onClick={() => { setActiveChatUserId(null); setActiveRoomId(null); }} 
                  className="w-10 h-10 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 transition-colors"
                >
                  <ArrowLeft size={20} />
                </button>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${activeRoomId ? 'from-amber-400 to-orange-600' : 'from-blue-500 to-indigo-600'} flex items-center justify-center text-white font-bold shadow-sm`}>
                      {activeRoomId ? <Users size={20} /> : (activeUser?.full_name || activeUser?.email || '?').charAt(0).toUpperCase()}
                    </div>
                    {!activeRoomId && !!onlineUsers[activeUser?.id] && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-[15px] text-slate-800 dark:text-white leading-tight">
                      {activeRoomId ? rooms.find(r => r.id === activeRoomId)?.name : (activeUser?.full_name || '(Chưa có tên)')}
                    </h3>
                    <p className="text-[12px] text-slate-500 font-medium">
                      {activeRoomId ? `${Object.keys(profiles).length} thành viên` : (!!onlineUsers[activeUser?.id] ? 'Đang trực tuyến' : 'Ngoại tuyến')}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <h2 className="text-[18px] font-extrabold text-slate-800 dark:text-white ml-2">Tin nhắn</h2>
            )}
          </div>
          <div className="flex items-center gap-1">
            {activeRoomId && profile?.role === 'admin' && (
              <button 
                onClick={handleClearRoomMessages}
                className="w-10 h-10 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center text-red-500 transition-colors"
                title="Xóa toàn bộ lịch sử nhóm (Chỉ Admin)"
              >
                <Trash2 size={20} />
              </button>
            )}
            <button onClick={closeDrawer} className="w-10 h-10 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col relative">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 size={32} className="animate-spin text-slate-300" />
            </div>
          ) : (!activeChatUserId && !activeRoomId) ? (
            // Contacts and Groups List
            <div className="flex-1 overflow-y-auto flex flex-col">
              <div className="p-4 shrink-0">
                <div className="relative">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm người dùng..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
                {/* Fixed Rooms */}
                {rooms.map(room => (
                  <button
                    key={room.id}
                    onClick={() => setActiveRoomId(room.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100/50 dark:border-amber-900/20 hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-all group text-left mb-2"
                  >
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-white shadow-sm shrink-0">
                      <Users size={24} />
                    </div>
                    <div className="overflow-hidden">
                      <h4 className="font-black text-[15px] text-amber-900 dark:text-amber-400 truncate uppercase">
                        {room.name}
                      </h4>
                      <p className="text-[12px] text-amber-700/60 dark:text-amber-500/60 font-bold truncate">
                        Phòng chat chung nội bộ
                      </p>
                    </div>
                  </button>
                ))}

                {userList.length === 0 ? (
                  <p className="text-center text-slate-400 text-sm mt-10">Không tìm thấy ai</p>
                ) : (
                  userList.map(p => {
                    const isOnline = !!onlineUsers[p.id];
                    const lastMsg = p.conversation?.lastMessage;
                    const unread = p.conversation?.unreadCount || 0;
                    
                    return (
                      <button
                        key={p.id}
                        onClick={() => setActiveChatUserId(p.id)}
                        className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group text-left"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="relative shrink-0">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-sm">
                              {(p.full_name || p.email || '?').charAt(0).toUpperCase()}
                            </div>
                            {isOnline && (
                              <span className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-green-500 border-2 border-white dark:border-[#111827] rounded-full"></span>
                            )}
                          </div>
                          <div className="overflow-hidden">
                            <h4 className="font-bold text-[15px] text-slate-800 dark:text-white truncate">
                              {p.full_name || p.email}
                            </h4>
                            {lastMsg && (
                              <p className={`text-[13px] truncate mt-0.5 ${unread > 0 ? 'font-bold text-slate-800 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'}`}>
                                {lastMsg.sender_id === user.id ? 'Bạn: ' : ''}{lastMsg.content}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-end gap-1 shrink-0 ml-3">
                          {lastMsg && (
                            <span className="text-[11px] font-medium text-slate-400">
                              {formatTime(lastMsg.created_at)}
                            </span>
                          )}
                          {unread > 0 && (
                            <span className="px-2 py-0.5 bg-blue-500 text-white text-[11px] font-bold rounded-full">
                              {unread}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            // Chat Interface
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-slate-900/20">
                {activeRoomId ? (
                  roomMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                       <p className="font-medium text-sm">Chưa có tin nhắn nào trong nhóm.</p>
                    </div>
                  ) : (
                    roomMessages.map((m, i) => {
                      const isMe = m.sender_id === user.id;
                      const isAdmin = profile?.role === 'admin';
                      const repliedMsg = m.reply_to_id ? roomMessages.find(rm => rm.id === m.reply_to_id) : null;
                      
                      return (
                        <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          {/* Sender Name - color coded: Green for self, Blue for others */}
                          {!m.is_deleted && (
                            <span className={`text-[11px] font-bold mb-1 px-1 uppercase tracking-wider ${
                              isMe ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'
                            }`}>
                              {m.sender_name}
                            </span>
                          )}
                          <div className={`flex gap-2 max-w-[85%] relative group ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                            <div className={`px-4 py-2.5 rounded-2xl text-[14px] leading-relaxed shadow-sm transition-all ${
                              m.is_deleted 
                                ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 italic' 
                                : isMe 
                                  ? 'bg-blue-600 text-white rounded-br-sm' 
                                  : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-bl-sm'
                            }`}>
                              {repliedMsg && !m.is_deleted && (
                                <div className={`text-[12px] p-2 mb-2 rounded-lg border-l-4 ${isMe ? 'bg-blue-700/50 border-blue-400 text-blue-100' : 'bg-slate-100 dark:bg-slate-700 border-slate-400 text-slate-500'} italic truncate`}>
                                  <span className="font-bold mr-1 block">{repliedMsg.sender_name}:</span>
                                  {repliedMsg.content}
                                </div>
                              )}
                              {m.content}
                            </div>
                            
                            {!m.is_deleted && (
                              <div className={`flex gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all self-center ${isMe ? 'mr-1' : 'ml-1'}`}>
                                <button onClick={() => setReplyTo(m)} title="Trả lời" className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 bg-slate-100/50 dark:bg-slate-800/50 md:bg-transparent">
                                  <Reply size={15} />
                                </button>
                                {(isMe || isAdmin) && (
                                  <button onClick={() => softDeleteMessage(m.id)} title="Xóa" className="p-1.5 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 bg-red-50/50 dark:bg-red-900/10 md:bg-transparent">
                                    <Trash2 size={15} />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="mt-1 px-1">
                            <span className="text-[10px] text-slate-400 font-medium tracking-tight">
                              {formatTime(m.created_at)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )
                ) : (
                  chatMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-2">
                        <Send size={24} className="text-slate-300 ml-1" />
                      </div>
                      <p className="font-medium text-sm">Bắt đầu cuộc trò chuyện với {activeUser?.full_name}</p>
                    </div>
                  ) : (
                    chatMessages.map((m, i) => {
                      const isMe = m.sender_id === user.id;
                      const showAvatar = !isMe && (i === 0 || chatMessages[i-1].sender_id !== m.sender_id);
                      
                      return (
                        <div key={m.id} className={`flex gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                          {!isMe && (
                            <div className="w-8 shrink-0 flex flex-col justify-end">
                              {showAvatar && (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                                  {(activeUser?.full_name || '?').charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                          )}
                          <div className={`max-w-[85%] flex relative group ${isMe ? 'flex-row-reverse items-end' : 'flex-row items-start'}`}>
                            <div className="flex flex-col">
                              <div className={`px-4 py-2.5 rounded-2xl text-[14px] leading-relaxed shadow-sm transition-all ${
                                m.is_deleted 
                                  ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 italic' 
                                  : isMe 
                                    ? 'bg-blue-600 text-white rounded-br-sm' 
                                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-bl-sm'
                              }`}>
                                {m.reply_to_id && !m.is_deleted && (
                                  <div className={`text-[12px] p-2 mb-2 rounded-lg border-l-4 ${isMe ? 'bg-blue-700/50 border-blue-400 text-blue-100' : 'bg-slate-100 dark:bg-slate-700 border-slate-400 text-slate-500'} italic truncate`}>
                                    {chatMessages.find(rm => rm.id === m.reply_to_id)?.content || 'Tin nhắn gốc'}
                                  </div>
                                )}
                                {m.content}
                              </div>
                              <div className={`flex items-center gap-1 mt-1 px-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <span className="text-[10px] text-slate-400 font-medium">{formatTime(m.created_at)}</span>
                                {isMe && !m.is_deleted && (
                                  m.is_read ? <CheckCheck size={12} className="text-blue-500" /> : <Check size={12} className="text-slate-400" />
                                )}
                              </div>
                            </div>

                            {!m.is_deleted && (
                              <div className={`flex gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all self-center ${isMe ? 'mr-1' : 'ml-1'}`}>
                                <button 
                                  onClick={() => setReplyTo({ ...m, sender_name: isMe ? 'Bạn' : activeUser?.full_name })} 
                                  title="Trả lời" 
                                  className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 bg-slate-100/50 dark:bg-slate-800/50 md:bg-transparent"
                                >
                                  <Reply size={15} />
                                </button>
                                {(isMe || profile?.role === 'admin') && (
                                  <button onClick={() => softDeleteMessage(m.id)} title="Xóa" className="p-1.5 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 bg-red-50/50 dark:bg-red-900/10 md:bg-transparent">
                                    <Trash2 size={15} />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )
                )}
                <div ref={messagesEndRef} />
              </div>
              
              {/* Input Area */}
              <div className="p-3 sm:p-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-4 bg-white dark:bg-[#111827] border-t border-slate-100 dark:border-slate-800 shrink-0">
                {replyTo && (
                  <div className="mb-3 p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border-l-4 border-blue-500 flex justify-between items-start animate-in slide-in-from-bottom-2">
                    <div className="overflow-hidden">
                      <span className="text-[11px] font-bold text-blue-600 uppercase block mb-1">Đang trả lời {replyTo.sender_name}</span>
                      <p className="text-[13px] text-slate-600 dark:text-slate-400 truncate">{replyTo.content}</p>
                    </div>
                    <button onClick={() => setReplyTo(null)} className="p-1 text-slate-400 hover:text-slate-600 transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                )}
                <form onSubmit={handleSend} className="flex gap-2 relative">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={replyTo ? `Trả lời ${replyTo.sender_name}...` : "Nhập tin nhắn..."}
                    className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full pl-5 pr-12 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800 dark:text-slate-200 transition-all"
                  />
                  <button 
                    type="submit" 
                    disabled={!newMessage.trim() || sending}
                    className="absolute right-1.5 top-1.5 bottom-1.5 w-10 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-full flex items-center justify-center transition-colors shadow-sm"
                  >
                    {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} className="-ml-0.5 mt-0.5" />}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
