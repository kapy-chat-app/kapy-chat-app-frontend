// hooks/useSocket.ts - Thêm online status tracking
import { useEffect, useState, useRef } from 'react';
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
}

interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  onlineUsers: OnlineUser[];
  isUserOnline: (userId: string) => boolean; // ✅ NEW
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

  useEffect(() => {
    if (!user) return;

    const connectSocket = () => {
      const newSocket = io(process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:3000', {
        transports: ['websocket'],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
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
        
        // Add user to online users
        newSocket.emit('addNewUsers', {
          _id: user.id,
          username: user.username || user.fullName,
          full_name: user.fullName,
          avatar: user.imageUrl,
          email: user.primaryEmailAddress?.emailAddress,
        });
      });

      newSocket.on('disconnect', (reason) => {
        console.log('❌ Socket disconnected:', reason);
        setIsConnected(false);
        
        if (reason === 'io server disconnect') {
          reconnectTimeoutRef.current = setTimeout(() => {
            newSocket.connect();
          }, 2000);
        }
      });

      // ✅ Listen for online users updates
      newSocket.on('getUsers', (users: OnlineUser[]) => {
        console.log('👥 Online users updated:', users.length);
        setOnlineUsers(users || []);
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setIsConnected(false);
      });

      newSocket.on('reconnect', (attemptNumber) => {
        console.log('Socket reconnected after', attemptNumber, 'attempts');
        setIsConnected(true);
      });

      newSocket.on('reconnect_error', (error) => {
        console.error('Socket reconnection error:', error);
      });

      return newSocket;
    };

    const socketInstance = connectSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (socketInstance) {
        socketInstance.disconnect();
        socketInstance.removeAllListeners();
      }
      
      socketRef.current = null;
    };
  }, [user]);

  const emit = (event: string, data: any) => {
    if (socket && isConnected) {
      socket.emit(event, data);
    } else {
      console.warn(`Cannot emit ${event}: socket not connected`);
    }
  };

  const on = (event: string, callback: (...args: any[]) => void) => {
    if (socket) {
      socket.on(event, callback);
    }
  };

  const off = (event: string, callback?: (...args: any[]) => void) => {
    if (socket) {
      socket.off(event, callback);
    }
  };

  // ✅ NEW: Check if a user is online
  const isUserOnline = (userId: string): boolean => {
    return onlineUsers.some(u => u.userId === userId);
  };

  return {
    socket,
    isConnected,
    onlineUsers,
    isUserOnline, // ✅ NEW
    emit,
    on,
    off,
  };
};