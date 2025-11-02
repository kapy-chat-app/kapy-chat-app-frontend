// hooks/useConversations.ts - Updated with E2EE support
// Giữ nguyên toàn bộ code cũ, chỉ cần update type cho last_message

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from './useSocket';
import { useAuth } from '@clerk/clerk-expo';

export interface ConversationParticipant {
  _id: string;
  clerkId: string;
  full_name: string;
  username: string;
  avatar?: string;
  is_online: boolean;
  last_seen?: Date;
}

export interface ConversationMessage {
  _id: string;
  content?: string; // ✨ Optional (có thể là plaintext hoặc encrypted)
  encrypted_content?: string; // ✨ NEW: Encrypted content
  type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'voice_note' | 'location';
  sender: ConversationParticipant;
  created_at: Date;
}

export interface Conversation {
  _id: string;
  type: 'private' | 'group';
  participants: ConversationParticipant[];
  name?: string;
  description?: string;
  avatar?: string;
  last_message?: ConversationMessage;
  last_activity: Date;
  is_archived: boolean;
  is_pinned: boolean;
  is_muted: boolean;
  unreadCount: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateConversationData {
  type: 'private' | 'group';
  participantIds: string[];
  name?: string;
  description?: string;
}

interface UseConversationsReturn {
  conversations: Conversation[];
  loading: boolean;
  error: string | null;
  createConversation: (data: CreateConversationData) => Promise<Conversation>;
  updateConversation: (id: string, data: any) => Promise<Conversation>;
  deleteConversation: (id: string) => Promise<void>;
  refreshConversations: () => Promise<void>;
  getConversationById: (id: string) => Promise<Conversation | null>;
}

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export const useConversations = (): UseConversationsReturn => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { socket, on, off } = useSocket();
  const { getToken, userId } = useAuth();
  
  const getTokenRef = useRef(getToken);
  const userIdRef = useRef(userId);

  useEffect(() => {
    getTokenRef.current = getToken;
    userIdRef.current = userId;
  }, [getToken, userId]);

  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getTokenRef.current();
      const response = await fetch(`${API_BASE_URL}/api/conversations`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch conversations');
      }
      setConversations(result.data.conversations || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch conversations';
      setError(errorMessage);
      console.error('Error fetching conversations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const createConversation = useCallback(async (data: CreateConversationData): Promise<Conversation> => {
    try {
      setError(null);
      const token = await getTokenRef.current();
      const response = await fetch(`${API_BASE_URL}/api/conversations`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to create conversation');
      }

      const newConversation = result.data;
      setConversations(prev => [newConversation, ...prev]);
      
      return newConversation;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create conversation';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const updateConversation = useCallback(async (id: string, data: any): Promise<Conversation> => {
    try {
      setError(null);
      const token = await getTokenRef.current();
      const response = await fetch(`${API_BASE_URL}/api/conversations/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to update conversation');
      }

      const updatedConversation = result.data;
      setConversations(prev =>
        prev.map(conv => conv._id === id ? updatedConversation : conv)
      );

      return updatedConversation;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update conversation';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const deleteConversation = useCallback(async (id: string): Promise<void> => {
    try {
      setError(null);
      const token = await getTokenRef.current();
      const response = await fetch(`${API_BASE_URL}/api/conversations/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete conversation');
      }

      setConversations(prev => prev.filter(conv => conv._id !== id));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete conversation';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const getConversationById = useCallback(async (id: string): Promise<Conversation | null> => {
    try {
      setError(null);
      const token = await getTokenRef.current();
      const response = await fetch(`${API_BASE_URL}/api/conversations/${id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to get conversation');
      }

      return result.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get conversation';
      setError(errorMessage);
      return null;
    }
  }, []);

  // Socket event handlers (GIỮ NGUYÊN TOÀN BỘ)
  useEffect(() => {
    if (!socket) {
      console.log('⚠️ Socket not available in useConversations');
      return;
    }

    console.log('✅ Setting up conversation socket listeners');

    const handleNewConversation = (data: any) => {
      console.log('🆕 New conversation:', data.conversation_id);
      
      const conversationData = {
        _id: data.conversation_id,
        ...data,
      };
      
      setConversations(prev => {
        const exists = prev.some(conv => conv._id === data.conversation_id);
        if (!exists) {
          return [conversationData, ...prev];
        }
        return prev;
      });
    };

    const handleConversationUpdated = (data: any) => {
      console.log('📝 Conversation updated:', data.conversation_id);
      
      setConversations(prev =>
        prev.map(conv => 
          conv._id === data.conversation_id 
            ? { ...conv, ...data.updates, updated_at: new Date() } 
            : conv
        )
      );
    };

    const handleConversationDeleted = (data: any) => {
      console.log('🗑️ Conversation deleted:', data.conversation_id);
      
      setConversations(prev => 
        prev.filter(conv => conv._id !== data.conversation_id)
      );
    };

    const handleNewMessage = (data: any) => {
      if (!data.conversation_id) {
        console.log('⚠️ newMessage event missing conversation_id:', data);
        return;
      }
      
      console.log('💬 NEW MESSAGE EVENT in useConversations:', {
        conversation_id: data.conversation_id,
        sender_id: data.sender_id,
        currentUserId: userIdRef.current,
        hasEncryptedContent: !!data.encrypted_content // ✨ Log encrypted status
      });
      
      setConversations(prev => {
        const conversationIndex = prev.findIndex(c => c._id === data.conversation_id);
        
        if (conversationIndex === -1) {
          console.log('⚠️ Conversation not found in list');
          return prev;
        }

        const conversation = prev[conversationIndex];
        
        // ✨ Display encrypted indicator if message is encrypted
        const displayContent = data.encrypted_content 
          ? '🔒 Encrypted message' 
          : data.message_content;
        
        const updatedConv = {
          ...conversation,
          last_message: {
            _id: data.message_id,
            content: displayContent, // ✨ Show encrypted indicator
            encrypted_content: data.encrypted_content, // ✨ Include encrypted content
            type: data.message_type,
            sender: {
              clerkId: data.sender_id,
              full_name: data.sender_name || 'Unknown',
              username: data.sender_username || 'unknown',
              avatar: data.sender_avatar,
            } as ConversationParticipant,
            created_at: new Date(),
          } as ConversationMessage,
          last_activity: new Date(),
        };

        if (data.sender_id !== userIdRef.current) {
          updatedConv.unreadCount = (conversation.unreadCount || 0) + 1;
          console.log('📈 Unread count increased to:', updatedConv.unreadCount);
        } else {
          console.log('👤 Message from current user, not incrementing unread');
        }

        const newConversations = [...prev];
        newConversations.splice(conversationIndex, 1);
        newConversations.unshift(updatedConv);
        
        return newConversations;
      });
    };

    const handleMessageRead = (data: any) => {
      console.log('📖 Message read in useConversations:', {
        conversationId: data.conversation_id,
        userId: data.user_id,
        currentUserId: userIdRef.current
      });
      
      if (data.user_id === userIdRef.current && data.conversation_id) {
        setConversations(prev =>
          prev.map(conv => {
            if (conv._id === data.conversation_id && conv.unreadCount > 0) {
              console.log(`✅ Decrementing unread count for conversation ${conv._id}`);
              return {
                ...conv,
                unreadCount: Math.max(0, conv.unreadCount - 1)
              };
            }
            return conv;
          })
        );
      }
    };

    const handleConversationMarkedAsRead = (data: any) => {
      console.log('📖 Conversation marked as read in useConversations:', {
        conversationId: data.conversation_id,
        readBy: data.read_by,
        currentUserId: userIdRef.current
      });
      
      if (data.read_by === userIdRef.current) {
        setConversations(prev =>
          prev.map(conv => {
            if (conv._id === data.conversation_id) {
              console.log(`✅ Resetting unread count for conversation ${conv._id}`);
              return {
                ...conv,
                unreadCount: 0
              };
            }
            return conv;
          })
        );
      }
    };

    on('newConversation', handleNewConversation);
    on('conversationUpdated', handleConversationUpdated);
    on('conversationDeleted', handleConversationDeleted);
    on('newMessage', handleNewMessage);
    on('messageRead', handleMessageRead);
    on('conversationMarkedAsRead', handleConversationMarkedAsRead);

    return () => {
      off('newConversation', handleNewConversation);
      off('conversationUpdated', handleConversationUpdated);
      off('conversationDeleted', handleConversationDeleted);
      off('newMessage', handleNewMessage);
      off('messageRead', handleMessageRead);
      off('conversationMarkedAsRead', handleConversationMarkedAsRead);
    };
  }, [socket, on, off]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  return {
    conversations,
    loading,
    error,
    createConversation,
    updateConversation,
    deleteConversation,
    refreshConversations: fetchConversations,
    getConversationById,
  };
};