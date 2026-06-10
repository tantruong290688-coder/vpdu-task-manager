import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { uploadFileToExternalStorage } from '../../lib/externalStorage';
import { useAuth } from '../../context/AuthContext';
import { useMessage } from '../../context/MessageContext';
import toast from 'react-hot-toast';
import { Loader2, Send } from 'lucide-react';
import { createNotification } from '../../hooks/useNotifications';

import ChatHeader from './ChatHeader';
import ChatComposer from './ChatComposer';
import MessageList from './MessageList';
import ContactList from './ContactList';

export default function ChatPopup() {
  const { user, profile, onlineUsers } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    isChatOpen, isMinimized, closeChat, 
    activeChatUserId, setActiveChatUserId,
    activeRoomId, setActiveRoomId,
    fetchUnreadCount 
  } = useMessage();

  const [profiles, setProfiles] = useState({});
  const [messages, setMessages] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [roomMessages, setRoomMessages] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [roomReads, setRoomReads] = useState([]);
  const [isWideMode, setIsWideMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState(null);

  // Load initial data
  useEffect(() => {
    if (isChatOpen && user) {
      loadInitialData();
    }
  }, [isChatOpen, user]);

  // ── Xử lý nút Thoát dứt điểm ──────────────────────
  const handleClose = useCallback(() => {
    // Làm sạch URL bằng navigate (chuẩn React Router)
    const params = new URLSearchParams(location.search);
    if (params.has('chat') || params.has('room')) {
      params.delete('chat');
      params.delete('room');
      const newSearch = params.toString();
      navigate({ search: newSearch ? `?${newSearch}` : '' }, { replace: true });
    }
    closeChat();
  }, [location.search, navigate, closeChat]);

  // Real-time for private messages
  const privateChatRef = useRef(null);
  const isPrivateSubscribedRef = useRef(false);

  useEffect(() => {
    if (!user || !isChatOpen || isPrivateSubscribedRef.current) return;
    isPrivateSubscribedRef.current = true;

    try {
      const channel = supabase.channel('chat:private')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
          const msg = payload.new;
          if (payload.eventType === 'INSERT') {
            if (msg.sender_id === user.id || msg.receiver_id === user.id) {
              setMessages(prev => [...prev.filter(m => m.id !== msg.id), msg]);
              if (msg.receiver_id === user.id && msg.sender_id === activeChatUserId) {
                markAsRead(msg.sender_id);
              } else if (msg.receiver_id === user.id) {
                fetchUnreadCount();
              }
            }
          } else if (payload.eventType === 'UPDATE') {
            setMessages(prev => prev.map(m => m.id === msg.id ? msg : m));
          }
        })
        .subscribe();
      
      privateChatRef.current = channel;
    } catch (err) {
      console.warn('[Chat] Private channel error:', err);
    }

    return () => {
      if (privateChatRef.current) {
        supabase.removeChannel(privateChatRef.current);
        privateChatRef.current = null;
        isPrivateSubscribedRef.current = false;
      }
    };
  }, [user?.id, isChatOpen, activeChatUserId]);

  // Real-time for room messages
  const roomChatRef = useRef(null);
  const isRoomSubscribedRef = useRef(false);

  useEffect(() => {
    if (!user || !isChatOpen || !activeRoomId || isRoomSubscribedRef.current) return;
    isRoomSubscribedRef.current = true;

    try {
      const channel = supabase.channel(`chat:room:${activeRoomId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${activeRoomId}` }, (payload) => {
          const msg = payload.new;
          if (payload.eventType === 'INSERT') {
            setRoomMessages(prev => [...prev.filter(m => m.id !== msg.id), msg]);
          } else if (payload.eventType === 'UPDATE') {
            setRoomMessages(prev => prev.map(m => m.id === msg.id ? msg : m));
          }
        })
        .subscribe();
      
      roomChatRef.current = channel;
    } catch (err) {
      console.warn('[Chat] Room channel error:', err);
    }

    return () => {
      if (roomChatRef.current) {
        supabase.removeChannel(roomChatRef.current);
        roomChatRef.current = null;
        isRoomSubscribedRef.current = false;
      }
    };
  }, [user?.id, isChatOpen, activeRoomId]);

  // Real-time for message reactions
  const reactionsSubRef = useRef(null);
  const isReactionsSubscribedRef = useRef(false);

  useEffect(() => {
    if (!user || !isChatOpen || isReactionsSubscribedRef.current) return;
    isReactionsSubscribedRef.current = true;

    try {
      const channel = supabase.channel('chat:reactions')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, (payload) => {
          const react = payload.new;
          if (payload.eventType === 'INSERT') {
            setReactions(prev => [...prev.filter(r => r.id !== react.id), react]);
          } else if (payload.eventType === 'UPDATE') {
            setReactions(prev => prev.map(r => r.id === react.id ? react : r));
          } else if (payload.eventType === 'DELETE') {
            const oldReactId = payload.old.id;
            setReactions(prev => prev.filter(r => r.id !== oldReactId));
          }
        })
        .subscribe();
      
      reactionsSubRef.current = channel;
    } catch (err) {
      console.warn('[Chat] Reactions channel error:', err);
    }

    return () => {
      if (reactionsSubRef.current) {
        supabase.removeChannel(reactionsSubRef.current);
        reactionsSubRef.current = null;
        isReactionsSubscribedRef.current = false;
      }
    };
  }, [user?.id, isChatOpen]);

  // Real-time for room reads
  const roomReadsSubRef = useRef(null);
  const isRoomReadsSubscribedRef = useRef(false);

  useEffect(() => {
    if (!user || !isChatOpen || isRoomReadsSubscribedRef.current) return;
    isRoomReadsSubscribedRef.current = true;

    try {
      const channel = supabase.channel('chat:room_reads')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_message_reads' }, (payload) => {
          const readRec = payload.new;
          if (payload.eventType === 'INSERT') {
            setRoomReads(prev => [...prev.filter(r => r.id !== readRec.id), readRec]);
          } else if (payload.eventType === 'UPDATE') {
            setRoomReads(prev => prev.map(r => r.id === readRec.id ? readRec : r));
          } else if (payload.eventType === 'DELETE') {
            setRoomReads(prev => prev.filter(r => r.id !== payload.old.id));
          }
        })
        .subscribe();
      
      roomReadsSubRef.current = channel;
    } catch (err) {
      console.warn('[Chat] Room reads channel error:', err);
    }

    return () => {
      if (roomReadsSubRef.current) {
        supabase.removeChannel(roomReadsSubRef.current);
        roomReadsSubRef.current = null;
        isRoomReadsSubscribedRef.current = false;
      }
    };
  }, [user?.id, isChatOpen]);

  // Mark as read when active chat changes
  useEffect(() => {
    if (activeChatUserId && isChatOpen) {
      markAsRead(activeChatUserId);
    }
  }, [activeChatUserId, isChatOpen, messages]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [{ data: profs }, { data: rms }, { data: msgs }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email, role, is_online, last_seen_at, avatar_url'),
        supabase.from('chat_rooms').select('*'),
        supabase.from('messages').select('*').or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`).order('created_at', { ascending: true })
      ]);

      // Tải cảm xúc tin nhắn an toàn (không bị crash nếu bảng chưa được tạo)
      let reacts = [];
      try {
        const { data: reactsData } = await supabase.from('message_reactions').select('*');
        reacts = reactsData || [];
      } catch (e) {
        console.warn('[Chat] Could not load message_reactions, table may not exist yet:', e.message);
      }

      // Tải trạng thái xem tin nhắn nhóm an toàn
      let groupReads = [];
      try {
        const { data: readsData } = await supabase.from('chat_message_reads').select('*');
        groupReads = readsData || [];
      } catch (e) {
        console.warn('[Chat] Could not load chat_message_reads, table may not exist yet:', e.message);
      }

      const profMap = {};
      (profs || []).forEach(p => profMap[p.id] = p);
      setProfiles(profMap);
      setRooms(rms || []);
      setMessages(msgs || []);
      setReactions(reacts);
      setRoomReads(groupReads);
    } catch (err) {
      console.error('Error loading chat data:', err);
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
      console.error('Error loading room messages:', err);
      toast.error('Lỗi tải tin nhắn nhóm');
    }
  };

  useEffect(() => {
    if (activeRoomId) {
      loadRoomMessages(activeRoomId);
      setReplyTo(null);
    }
  }, [activeRoomId]);

  const markRoomAsRead = async (roomId) => {
    if (!roomId || !user || roomMessages.length === 0) return;
    
    // Tìm các tin nhắn của người khác trong phòng chat hiện tại
    const otherMessages = roomMessages.filter(m => m.sender_id !== user.id);
    if (otherMessages.length === 0) return;

    // Tìm các tin nhắn chưa được đánh dấu đã đọc bởi user hiện tại
    const unreadMsgIds = otherMessages
      .filter(m => !roomReads.some(r => r.message_id === m.id && r.user_id === user.id))
      .map(m => m.id);

    if (unreadMsgIds.length > 0) {
      const readPayload = unreadMsgIds.map(mId => ({
        message_id: mId,
        user_id: user.id
      }));

      // Optimistic update
      const tempRecords = readPayload.map((p, index) => ({
        id: `temp-read-${Date.now()}-${index}`,
        message_id: p.message_id,
        user_id: p.user_id,
        read_at: new Date().toISOString()
      }));
      setRoomReads(prev => [...prev, ...tempRecords]);

      const { data, error } = await supabase
        .from('chat_message_reads')
        .insert(readPayload)
        .select();

      if (error) {
        console.error('Lỗi khi lưu trạng thái xem tin nhắn nhóm:', error);
        // Rollback optimistic update
        setRoomReads(prev => prev.filter(r => !r.id.toString().startsWith('temp-read-')));
      } else if (data) {
        // Thay thế bản ghi tạm bằng bản ghi thật từ DB
        setRoomReads(prev => [
          ...prev.filter(r => !r.id.toString().startsWith('temp-read-')),
          ...data
        ]);
      }
    }
  };

  useEffect(() => {
    if (activeRoomId && isChatOpen && roomMessages.length > 0) {
      markRoomAsRead(activeRoomId);
    }
  }, [activeRoomId, isChatOpen, roomMessages, roomReads.length]);

  const markAsRead = async (otherUserId) => {
    const unreadIds = messages
      .filter(m => m.sender_id === otherUserId && m.receiver_id === user.id && !m.is_read)
      .map(m => m.id);
    
    if (unreadIds.length > 0) {
      setMessages(prev => prev.map(m => unreadIds.includes(m.id) ? { ...m, is_read: true } : m));
      await supabase
        .from('messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .in('id', unreadIds);
      fetchUnreadCount();
    }
  };

  const handleReact = async (msgId, reactionType) => {
    try {
      const isGroup = !!activeRoomId;
      const targetColumn = isGroup ? 'chat_message_id' : 'message_id';
      
      // Find if we already have a reaction on this message
      const existing = reactions.find(r => 
        r.user_id === user.id && 
        r[targetColumn] === msgId
      );

      if (existing) {
        // If it's the exact same reaction, delete it (toggle off)
        if (existing.reaction === reactionType) {
          // Optimistic update
          setReactions(prev => prev.filter(r => r.id !== existing.id));
          await supabase
            .from('message_reactions')
            .delete()
            .eq('id', existing.id);
        } else {
          // If it's a different reaction, update it
          // Optimistic update
          setReactions(prev => prev.map(r => r.id === existing.id ? { ...r, reaction: reactionType } : r));
          await supabase
            .from('message_reactions')
            .update({ reaction: reactionType })
            .eq('id', existing.id);
        }
      } else {
        // Insert new reaction
        const newReaction = {
          user_id: user.id,
          reaction: reactionType,
          [targetColumn]: msgId
        };
        // Optimistic update (we generate a temporary UUID)
        const tempId = Math.random().toString();
        setReactions(prev => [...prev, { id: tempId, ...newReaction }]);
        
        const { data, error } = await supabase
          .from('message_reactions')
          .insert(newReaction)
          .select();
        
        if (error) throw error;
        
        // Replace temp reaction with real one
        if (data && data[0]) {
          setReactions(prev => prev.map(r => r.id === tempId ? data[0] : r));
        }
      }
    } catch (err) {
      console.error('Error handling reaction:', err);
      // Fallback: reload reactions
      const { data } = await supabase.from('message_reactions').select('*');
      if (data) setReactions(data);
    }
  };

  const handleSend = async (content, file = null) => {
    setSending(true);
    const currentReplyTo = replyTo;
    setReplyTo(null);

    try {
      let attachmentUrl = null;
      let attachmentName = null;
      let attachmentType = null;
      let attachmentSize = null;

      if (file) {
        const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const fileName = `${Date.now()}_${safeName}`;
        const filePath = activeRoomId ? `room_${activeRoomId}/${user.id}/${fileName}` : `private_${activeChatUserId}/${user.id}/${fileName}`;

        // Upload trực tiếp lên Ổ Cứng Ngoài (MinIO)
        // Helper này sẽ tải tệp lên và tự động tạo link tải về được ký số có thời hạn dài (7 ngày)
        attachmentUrl = await uploadFileToExternalStorage(file, 'message-attachments', filePath);

        attachmentName = file.name;
        attachmentType = file.type;
        attachmentSize = file.size;
      }

      const displayContent = content || (file ? (file.type.startsWith('image/') ? '[Hình ảnh]' : '[Tệp đính kèm]') : '');

      if (activeRoomId) {
        // Tin nhắn nhóm
        const { error } = await supabase.from('chat_messages').insert({
          room_id: activeRoomId,
          sender_id: user.id,
          sender_name: profile?.full_name || user.email.split('@')[0],
          content: displayContent,
          reply_to_id: currentReplyTo?.id || null,
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
          attachment_type: attachmentType,
          attachment_size: attachmentSize
        });
        if (error) throw error;

        // Thông báo cho các thành viên trong phòng (trừ người gửi)
        const allProfiles = Object.values(profiles);
        const roomMemberIds = allProfiles
          .filter(p => p.id !== user.id)
          .map(p => p.id);

        if (roomMemberIds.length > 0) {
          const room = rooms.find(r => r.id === activeRoomId);
          createNotification({
            userIds: roomMemberIds,
            title: `Tin nhắn nhóm: ${room?.name || 'Nhóm CB,CC,NV'}`,
            body: `${profile?.full_name || 'Ai đó'}: ${displayContent.substring(0, 80)}`,
            type: 'message_group',
            relatedUrl: `/?room=${activeRoomId}`,
          });
        }

      } else {
        // Tin nhắn riêng
        const { error } = await supabase.from('messages').insert({
          sender_id: user.id,
          receiver_id: activeChatUserId,
          content: displayContent,
          is_read: false,
          reply_to_id: currentReplyTo?.id || null,
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
          attachment_type: attachmentType,
          attachment_size: attachmentSize
        });
        if (error) throw error;

        // Thông báo cho người nhận
        if (activeChatUserId) {
          const senderName = profile?.full_name || user.email?.split('@')[0] || 'Ai đó';
          createNotification({
            userIds: [activeChatUserId],
            title: `Tin nhắn mới từ ${senderName}`,
            body: displayContent.substring(0, 100),
            type: 'message_private',
            relatedUrl: `/?chat=${user.id}`,
          });
        }
      }
    } catch (err) {
      console.error('Send error:', err);
      const errMsg = err?.message || err?.error_description || 'Lỗi kết nối hoặc phiên đăng nhập hết hạn';
      toast.error(`Không thể gửi tin nhắn: ${errMsg}`);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (msgId) => {
    if (!window.confirm('Xóa tin nhắn này?')) return;
    try {
      const table = activeRoomId ? 'chat_messages' : 'messages';
      await supabase.from(table).update({ 
        is_deleted: true, 
        content: 'Tin nhắn đã bị xóa',
        attachment_url: null,
        attachment_name: null,
        attachment_type: null,
        attachment_size: null
      }).eq('id', msgId);
    } catch (err) {
      toast.error('Lỗi khi xóa');
    }
  };

  // Organize conversations for contact list
  const conversationsMap = {};
  messages.forEach(m => {
    const otherId = m.sender_id === user.id ? m.receiver_id : m.sender_id;
    if (!conversationsMap[otherId] || new Date(m.created_at) > new Date(conversationsMap[otherId].lastMessage.created_at)) {
      conversationsMap[otherId] = {
        lastMessage: m,
        unreadCount: messages.filter(msg => msg.sender_id === otherId && msg.receiver_id === user.id && !msg.is_read).length
      };
    }
  });

  if (!isChatOpen || isMinimized) return null;

  const currentChatMessages = (activeRoomId 
    ? roomMessages 
    : messages.filter(m => (m.sender_id === user.id && m.receiver_id === activeChatUserId) || (m.sender_id === activeChatUserId && m.receiver_id === user.id))
  ).filter(m => !m.is_deleted);

  return (
    <div className={`
      fixed top-0 right-0 h-[100dvh] w-full z-[150] flex flex-col bg-white dark:bg-slate-900 shadow-2xl transition-all duration-300 ease-in-out overflow-hidden
      sm:inset-auto sm:bottom-6 sm:right-6 sm:rounded-[24px] ${isWideMode ? 'sm:w-[850px] sm:h-[680px] sm:max-h-[90vh]' : 'sm:w-[400px] sm:h-[600px] sm:max-h-[85vh]'} sm:border sm:border-slate-100 dark:sm:border-slate-800
      animate-in slide-in-from-bottom-5 fade-in
    `}>
      <ChatHeader 
        activeUser={profiles[activeChatUserId]} 
        activeRoom={rooms.find(r => r.id === activeRoomId)}
        isWideMode={isWideMode}
        onToggleWide={() => setIsWideMode(!isWideMode)}
        onBack={() => { 
          setActiveChatUserId(null); 
          setActiveRoomId(null); 
          // Cập nhật URL khi quay lại danh sách
          const params = new URLSearchParams(location.search);
          params.delete('chat');
          params.delete('room');
          const newSearch = params.toString();
          navigate({ search: newSearch ? `?${newSearch}` : '' }, { replace: true });
        }}
        onClose={handleClose}
      />

      <div className="flex-1 overflow-hidden flex relative min-h-0 bg-slate-50/20 dark:bg-slate-900/5">
        {loading ? (
          <div className="flex-1 flex items-center justify-center bg-white dark:bg-slate-900">
            <Loader2 className="animate-spin text-blue-500" size={32} />
          </div>
        ) : (
          <>
            {/* Left Column: Contact List (shown in Wide Mode OR when no chat is active) */}
            {(!activeChatUserId && !activeRoomId || isWideMode) && (
              <div className={`
                h-full flex flex-col min-w-0
                ${isWideMode ? 'w-[320px] shrink-0 border-r border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900' : 'w-full'}
              `}>
                <ContactList 
                  profiles={profiles}
                  rooms={rooms}
                  conversations={conversationsMap}
                  onlineUsers={onlineUsers}
                  onSelectUser={setActiveChatUserId}
                  onSelectRoom={setActiveRoomId}
                />
              </div>
            )}

            {/* Right Column: Active Conversation */}
            {(activeChatUserId || activeRoomId) ? (
              <div className="flex-1 h-full flex flex-col min-w-0 bg-white dark:bg-slate-900">
                <MessageList 
                  messages={currentChatMessages}
                  currentUser={user}
                  reactions={reactions}
                  profiles={profiles}
                  roomReads={roomReads}
                  onReact={handleReact}
                  onReply={setReplyTo}
                  onDelete={handleDelete}
                />
                <ChatComposer 
                  onSend={handleSend}
                  sending={sending}
                  replyTo={replyTo}
                  onCancelReply={() => setReplyTo(null)}
                />
              </div>
            ) : isWideMode ? (
              <div className="flex-1 h-full flex flex-col items-center justify-center p-6 text-center bg-slate-50/30 dark:bg-slate-900/10">
                <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white mb-4 shadow-md shadow-blue-200 dark:shadow-none animate-bounce duration-1000">
                  <Send size={24} className="transform rotate-45 -translate-x-0.5 translate-y-0.5" />
                </div>
                <h4 className="font-extrabold text-[16px] text-slate-700 dark:text-slate-300 uppercase tracking-wider">VPDU Chat Hub</h4>
                <p className="text-[12px] text-slate-400 dark:text-slate-500 mt-1.5 max-w-[280px]">
                  Chọn một cuộc hội thoại ở cột bên trái để bắt đầu trao đổi văn bản và xử lý công việc.
                </p>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
