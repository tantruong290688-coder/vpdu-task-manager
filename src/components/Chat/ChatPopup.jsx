import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
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
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState(null);

  // Load initial data
  useEffect(() => {
    if (isChatOpen && user) {
      loadInitialData();
    }
  }, [isChatOpen, user]);

  // Real-time for private messages
  useEffect(() => {
    if (!user || !isChatOpen) return;

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

    return () => supabase.removeChannel(channel);
  }, [user, isChatOpen, activeChatUserId]);

  // Real-time for room messages
  useEffect(() => {
    if (!user || !isChatOpen || !activeRoomId) return;

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

    return () => supabase.removeChannel(channel);
  }, [user, isChatOpen, activeRoomId]);

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
        supabase.from('profiles').select('id, full_name, email, role, is_online, last_seen_at'),
        supabase.from('chat_rooms').select('*'),
        supabase.from('messages').select('*').or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`).order('created_at', { ascending: true })
      ]);

      const profMap = {};
      (profs || []).forEach(p => profMap[p.id] = p);
      setProfiles(profMap);
      setRooms(rms || []);
      setMessages(msgs || []);
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

  const handleSend = async (content) => {
    setSending(true);
    const currentReplyTo = replyTo;
    setReplyTo(null);

    try {
      if (activeRoomId) {
        // Tin nhắn nhóm
        const { error } = await supabase.from('chat_messages').insert({
          room_id: activeRoomId,
          sender_id: user.id,
          sender_name: profile?.full_name || user.email.split('@')[0],
          content,
          reply_to_id: currentReplyTo?.id || null
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
            body: `${profile?.full_name || 'Ai đó'}: ${content.substring(0, 80)}`,
            type: 'message_group',
            relatedUrl: '/',
          });
        }

      } else {
        // Tin nhắn riêng
        const { error } = await supabase.from('messages').insert({
          sender_id: user.id,
          receiver_id: activeChatUserId,
          content,
          is_read: false,
          reply_to_id: currentReplyTo?.id || null
        });
        if (error) throw error;

        // Thông báo cho người nhận
        if (activeChatUserId) {
          const senderName = profile?.full_name || user.email?.split('@')[0] || 'Ai đó';
          createNotification({
            userIds: [activeChatUserId],
            title: `Tin nhắn mới từ ${senderName}`,
            body: content.substring(0, 100),
            type: 'message_private',
            relatedUrl: '/',
          });
        }
      }
    } catch (err) {
      console.error('Send error:', err);
      toast.error('Không thể gửi tin nhắn');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (msgId) => {
    if (!window.confirm('Xóa tin nhắn này?')) return;
    try {
      const table = activeRoomId ? 'chat_messages' : 'messages';
      await supabase.from(table).update({ is_deleted: true, content: 'Tin nhắn đã bị xóa' }).eq('id', msgId);
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

  const currentChatMessages = activeRoomId 
    ? roomMessages 
    : messages.filter(m => (m.sender_id === user.id && m.receiver_id === activeChatUserId) || (m.sender_id === activeChatUserId && m.receiver_id === user.id));

  return (
    <div className={`
      fixed bottom-0 right-0 z-[100] flex flex-col bg-white dark:bg-slate-900 shadow-2xl transition-all duration-300 ease-in-out overflow-hidden
      sm:bottom-6 sm:right-6 sm:rounded-[24px] sm:w-[400px] sm:h-[600px] sm:max-h-[85vh] sm:border sm:border-slate-100 dark:sm:border-slate-800
      w-full h-full sm:h-[600px]
      animate-in slide-in-from-bottom-5 fade-in
    `}>
      <ChatHeader 
        activeUser={profiles[activeChatUserId]} 
        activeRoom={rooms.find(r => r.id === activeRoomId)}
        onBack={() => { setActiveChatUserId(null); setActiveRoomId(null); }}
      />

      <div className="flex-1 overflow-hidden flex flex-col relative">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="animate-spin text-blue-500" size={32} />
          </div>
        ) : (!activeChatUserId && !activeRoomId) ? (
          <ContactList 
            profiles={profiles}
            rooms={rooms}
            conversations={conversationsMap}
            onlineUsers={onlineUsers}
            onSelectUser={setActiveChatUserId}
            onSelectRoom={setActiveRoomId}
          />
        ) : (
          <>
            <MessageList 
              messages={currentChatMessages}
              currentUser={user}
              onReply={setReplyTo}
              onDelete={handleDelete}
            />
            <ChatComposer 
              onSend={handleSend}
              sending={sending}
              replyTo={replyTo}
              onCancelReply={() => setReplyTo(null)}
            />
          </>
        )}
      </div>
    </div>
  );
}
