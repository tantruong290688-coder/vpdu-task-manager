import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const MessageContext = createContext({});

export const MessageProvider = ({ children }) => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeChatUserId, setActiveChatUserId] = useState(null);
  const [activeRoomId, setActiveRoomId] = useState(null);

  // Fetch initial unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', user.id)
      .eq('is_read', false);
      
    if (!error && count !== null) {
      setUnreadCount(count);
    }
  }, [user]);

  useEffect(() => {
    fetchUnreadCount();

    if (!user) return;

    // Realtime subscription for unread messages
    const channel = supabase.channel('public:messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` },
        (payload) => {
          if (payload.new.is_read === false) {
            setUnreadCount(prev => prev + 1);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` },
        (payload) => {
          if (payload.new.is_read === true && payload.old.is_read === false) {
            setUnreadCount(prev => Math.max(0, prev - 1));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchUnreadCount]);

  const toggleChat = () => {
    setIsChatOpen(prev => !prev);
    setIsMinimized(false);
  };
  const openChat = () => {
    setIsChatOpen(true);
    setIsMinimized(false);
  };
  const closeChat = () => {
    setIsChatOpen(false);
    setIsMinimized(false);
    setActiveChatUserId(null);
    setActiveRoomId(null);
  };
  const minimizeChat = () => setIsMinimized(true);
  const maximizeChat = () => setIsMinimized(false);

  const openChatWith = (userId) => {
    setActiveChatUserId(userId);
    setActiveRoomId(null);
    setIsChatOpen(true);
    setIsMinimized(false);
  };

  const openRoomChat = (roomId) => {
    setActiveRoomId(roomId);
    setActiveChatUserId(null);
    setIsChatOpen(true);
    setIsMinimized(false);
  };

  return (
    <MessageContext.Provider value={{
      unreadCount,
      setUnreadCount,
      fetchUnreadCount,
      isChatOpen,
      isDrawerOpen: isChatOpen, // Backward compatibility
      isMinimized,
      toggleChat,
      toggleDrawer: toggleChat, // Backward compatibility
      openChat,
      openDrawer: openChat, // Backward compatibility
      closeChat,
      closeDrawer: closeChat, // Backward compatibility
      minimizeChat,
      maximizeChat,
      activeChatUserId,
      setActiveChatUserId,
      activeRoomId,
      setActiveRoomId,
      openChatWith,
      openRoomChat
    }}>
      {children}
    </MessageContext.Provider>
  );
};

export const useMessage = () => useContext(MessageContext);
