import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function usePresence() {
  const { user, profile } = useAuth();

  useEffect(() => {
    if (!user || !profile) return;

    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState();
        // console.log('sync', newState);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        // console.log('join', key, newPresences);
        updateOnlineStatus(key, true);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        // console.log('leave', key, leftPresences);
        updateOnlineStatus(key, false);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            online_at: new Date().toISOString(),
            full_name: profile.full_name,
          });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [user?.id, profile?.id]);

  const updateOnlineStatus = async (userId, isOnline) => {
    // Only admins update other users, or user updates themselves
    // To keep it simple and efficient, we update the profile table
    // However, frequent DB writes for presence can be heavy.
    // For a small app like this, it's fine.
    await supabase
      .from('profiles')
      .update({ 
        is_online: isOnline, 
        last_seen_at: new Date().toISOString() 
      })
      .eq('id', userId);
  };
}
