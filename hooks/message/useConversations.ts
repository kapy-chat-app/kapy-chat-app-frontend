// hooks/useConversations.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
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
  content?: string;
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

export const useConversations = (): UseConversationsReturn => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { socket, on, off } = useSocket();
  const {getToken} =  useAuth();
  const API_BASE_URL = useMemo(() => 
    process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000', []
  );
  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getToken();
      const response = await fetch(`${API_BASE_URL}/api/conversations`,{
        method:'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      const result = await response.json();
      console.log("conversation>>",result.data);
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
      const token = await getToken();
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
      const token = await getToken();
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
      const token = await getToken();
      const response = await fetch(`${API_BASE_URL}/api/conversations/${id}`, {
        method: 'DELETE',
        headers:{
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
      const token = await getToken();
      const response = await fetch(`${API_BASE_URL}/api/conversations/${id}`,
        {method:'GET',
          headers:{
            'Authorization':`Bearer ${token}`
          }
        }
      );
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

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    const handleNewConversation = (data: any) => {
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
      setConversations(prev =>
        prev.map(conv => 
          conv._id === data.conversation_id 
            ? { ...conv, ...data.updates, updated_at: new Date() } 
            : conv
        )
      );
    };

    const handleConversationDeleted = (data: any) => {
      setConversations(prev => 
        prev.filter(conv => conv._id !== data.conversation_id)
      );
    };

    const handleNewMessage = (data: any) => {
      if (!data.conversation_id) return;
      
      setConversations(prev =>
        prev.map(conv => {
          if (conv._id === data.conversation_id) {
            const updatedConv = {
              ...conv,
              last_message: {
                _id: data.message_id,
                content: data.message_content,
                type: data.message_type,
                sender: { clerkId: data.sender_id } as ConversationParticipant,
                created_at: new Date(),
              } as ConversationMessage,
              last_activity: new Date(),
            };

            // Only increment unread count if message is not from current user
            if (data.sender_id !== 'current_user_id') { 
              updatedConv.unreadCount = (conv.unreadCount || 0) + 1;
            }

            return updatedConv;
          }
          return conv;
        })
      );
    };

    on('newConversation', handleNewConversation);
    on('conversationUpdated', handleConversationUpdated);
    on('conversationDeleted', handleConversationDeleted);
    on('newMessage', handleNewMessage);

    return () => {
      off('newConversation', handleNewConversation);
      off('conversationUpdated', handleConversationUpdated);
      off('conversationDeleted', handleConversationDeleted);
      off('newMessage', handleNewMessage);
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