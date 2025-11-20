// hooks/useSocket.ts - Optimized with stable connection
import { useEffect, useState, useRef, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';
import { useUser } from '@clerk/clerk-expo';

interface OnlineUser {
  userId: string;
  socketId: string;
  profile: {
    _id: string;
    username: string;
    full_name: string;
    avatar?: string;
    email?: string;
  };
  lastActive: number;
}

interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  onlineUsers: OnlineUser[];
  isUserOnline: (userId: string) => boolean;
  emit: (event: string, data: any) => void;
  on: (event: string, callback: (...args: any[]) => void) => void;
  off: (event: string, callback?: (...args: any[]) => void) => void;
}

export const useSocket = (): UseSocketReturn => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const { user } = useUser();
  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // ✨ NEW: Prevent multiple addNewUsers calls
  const hasAddedUserRef = useRef(false);
  const addUserTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user) return;

    const connectSocket = () => {
      const newSocket = io(process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:3000', {
        transports: ['websocket'],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        // ✨ NEW: Add timeout settings
        timeout: 20000,
      });

      socketRef.current = newSocket;
      setSocket(newSocket);

      newSocket.on('connect', () => {
        console.log('✅ Socket connected:', newSocket.id);
        setIsConnected(true);
        
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
        
        // ✨ IMPROVED: Debounce addNewUsers to prevent rapid calls
        if (addUserTimeoutRef.current) {
          clearTimeout(addUserTimeoutRef.current);
        }

        addUserTimeoutRef.current = setTimeout(() => {
          if (!hasAddedUserRef.current || newSocket.id !== socketRef.current?.id) {
            console.log('👤 Adding user to online list...');
            
            // Add user to online users
            newSocket.emit('addNewUsers', {
              _id: user.id,
              username: user.username || user.fullName,
              full_name: user.fullName,
              avatar: user.imageUrl,
              email: user.primaryEmailAddress?.emailAddress,
            });

            // ✅ Join personal room for friend events
            const userRoom = `user:${user.id}`;
            newSocket.emit('joinRoom', userRoom);
            console.log('🚪 Joined personal room:', userRoom);

            hasAddedUserRef.current = true;
          }
        }, 300); // Small delay to batch rapid reconnects
      });

      newSocket.on('disconnect', (reason) => {
        console.log('❌ Socket disconnected:', reason);
        setIsConnected(false);
        hasAddedUserRef.current = false;
        
        // Only auto-reconnect if server disconnected us
        if (reason === 'io server disconnect') {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('🔄 Attempting to reconnect...');
            newSocket.connect();
          }, 2000);
        }
      });

      // ✨ IMPROVED: Listen for online users updates with deduplication
      let lastUpdateTime = 0;
      newSocket.on('getUsers', (users: OnlineUser[]) => {
        const now = Date.now();
        // Ignore rapid updates (< 500ms)
        if (now - lastUpdateTime < 500) {
          console.log('⏭️ Skipping rapid online users update');
          return;
        }
        lastUpdateTime = now;
        
        console.log('👥 Online users updated:', users.length);
        setOnlineUsers(users || []);
      });

      // ✨ NEW: Send heartbeat to keep connection alive
      const heartbeatInterval = setInterval(() => {
        if (newSocket.connected && user) {
          newSocket.emit('updateUserStatus', {
            user_id: user.id,
            status: 'online'
          });
        }
      }, 30000); // Every 30 seconds

      // Friend event listeners (keep existing)
      newSocket.on('friendRequestReceived', (data) => {
        console.log('📬 [Socket] friendRequestReceived:', data);
      });

      newSocket.on('friendRequestSent', (data) => {
        console.log('📤 [Socket] friendRequestSent:', data);
      });

      newSocket.on('friendRequestAccepted', (data) => {
        console.log('✅ [Socket] friendRequestAccepted:', data);
      });

      newSocket.on('friendRequestDeclined', (data) => {
        console.log('❌ [Socket] friendRequestDeclined:', data);
      });

      newSocket.on('friendRequestCancelled', (data) => {
        console.log('🚫 [Socket] friendRequestCancelled:', data);
      });

      newSocket.on('friendRemoved', (data) => {
        console.log('👋 [Socket] friendRemoved:', data);
      });

      newSocket.on('friendBlocked', (data) => {
        console.log('🚫 [Socket] friendBlocked:', data);
      });

      newSocket.on('friendCountUpdated', (data) => {
        console.log('🔢 [Socket] friendCountUpdated:', data);
      });

      newSocket.on('friendRequestCountUpdated', (data) => {
        console.log('🔢 [Socket] friendRequestCountUpdated:', data);
      });

      newSocket.on('friendStatusChanged', (data) => {
        console.log('👤 [Socket] friendStatusChanged:', data);
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setIsConnected(false);
      });

      newSocket.on('reconnect', (attemptNumber) => {
        console.log('Socket reconnected after', attemptNumber, 'attempts');
        setIsConnected(true);
        hasAddedUserRef.current = false; // Allow re-adding user
        
        // Re-join room after reconnect
        const userRoom = `user:${user.id}`;
        newSocket.emit('joinRoom', userRoom);
        console.log('🚪 Re-joined personal room after reconnect:', userRoom);
      });

      newSocket.on('reconnect_error', (error) => {
        console.error('Socket reconnection error:', error);
      });

      return { socket: newSocket, heartbeatInterval };
    };

    const { socket: socketInstance, heartbeatInterval } = connectSocket();

    return () => {
      console.log('🧹 Cleaning up socket connection...');
      
      if (addUserTimeoutRef.current) {
        clearTimeout(addUserTimeoutRef.current);
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      clearInterval(heartbeatInterval);
      
      if (socketInstance) {
        socketInstance.disconnect();
        socketInstance.removeAllListeners();
      }
      
      hasAddedUserRef.current = false;
      socketRef.current = null;
    };
  }, [user?.id]); // Only reconnect if user ID changes

  const emit = useCallback((event: string, data: any) => {
    if (socket && isConnected) {
      socket.emit(event, data);
    } else {
      console.warn(`Cannot emit ${event}: socket not connected`);
    }
  }, [socket, isConnected]);

  const on = useCallback((event: string, callback: (...args: any[]) => void) => {
    if (socket) {
      socket.on(event, callback);
    }
  }, [socket]);

  const off = useCallback((event: string, callback?: (...args: any[]) => void) => {
    if (socket) {
      socket.off(event, callback);
    }
  }, [socket]);

  // ✨ IMPROVED: Check if a user is online with memoization
  const isUserOnline = useCallback((userId: string): boolean => {
    return onlineUsers.some(u => u.userId === userId);
  }, [onlineUsers]);

  return {
    socket,
    isConnected,
    onlineUsers,
    isUserOnline,
    emit,
    on,
    off,
  };
};