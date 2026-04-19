import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const MessageContext = createContext({});

export const MessageProvider = ({ children }) => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeChatUserId, setActiveChatUserId] = useState(null);

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
          // If the message is for the currently active chat and the drawer is open,
          // we might mark it as read immediately in the UI component, but initially it's unread
          if (payload.new.is_read === false) {
            setUnreadCount(prev => prev + 1);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` },
        (payload) => {
          // Recalculate if a message was marked as read
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

  const toggleDrawer = () => setIsDrawerOpen(prev => !prev);
  const openDrawer = () => setIsDrawerOpen(true);
  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setActiveChatUserId(null); // optional: clear active chat on close
  };

  const openChatWith = (userId) => {
    setActiveChatUserId(userId);
    setIsDrawerOpen(true);
  };

  return (
    <MessageContext.Provider value={{
      unreadCount,
      setUnreadCount,
      fetchUnreadCount,
      isDrawerOpen,
      toggleDrawer,
      openDrawer,
      closeDrawer,
      activeChatUserId,
      setActiveChatUserId,
      openChatWith
    }}>
      {children}
    </MessageContext.Provider>
  );
};

export const useMessage = () => useContext(MessageContext);
