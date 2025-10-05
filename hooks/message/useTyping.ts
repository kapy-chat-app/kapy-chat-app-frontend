import { useState, useEffect, useCallback } from 'react';
import { useSocket } from './useSocket';

interface TypingUser {
  userId: string;
  username: string;
}

export const useTyping = (conversationId: string) => {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const { socket, emit, on, off } = useSocket();

  const startTyping = useCallback(() => {
    if (socket && conversationId) {
      emit('startTyping', { conversationId });
    }
  }, [socket, conversationId, emit]);

  const stopTyping = useCallback(() => {
    if (socket && conversationId) {
      emit('stopTyping', { conversationId });
    }
  }, [socket, conversationId, emit]);

  useEffect(() => {
    if (!socket || !conversationId) return;

    const handleUserStartedTyping = (data: any) => {
      if (data.conversationId === conversationId) {
        setTypingUsers(prev => {
          const exists = prev.some(user => user.userId === data.userId);
          if (!exists) {
            return [...prev, { userId: data.userId, username: data.username }];
          }
          return prev;
        });
      }
    };

    const handleUserStoppedTyping = (data: any) => {
      if (data.conversationId === conversationId) {
        setTypingUsers(prev => 
          prev.filter(user => user.userId !== data.userId)
        );
      }
    };

    on('userStartedTyping', handleUserStartedTyping);
    on('userStoppedTyping', handleUserStoppedTyping);

    return () => {
      off('userStartedTyping', handleUserStartedTyping);
      off('userStoppedTyping', handleUserStoppedTyping);
    };
  }, [socket, conversationId, on, off]);

  return {
    typingUsers,
    startTyping,
    stopTyping,
    isTyping: typingUsers.length > 0,
  };
};