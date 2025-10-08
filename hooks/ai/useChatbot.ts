
// hooks/chatbot/useChatbot.ts
import { useAuth } from '@clerk/clerk-expo';
import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { useSocket } from '../message/useSocket';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  emotion?: string;
}

export interface ChatResponse {
  message: string;
  emotion_detected?: string;
  suggestions?: string[];
  timestamp: Date;
  conversation_id: string;
}

export const useChatbot = () => {
  const { getToken, userId } = useAuth();
  const { socket } = useSocket();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Listen to socket events
  useEffect(() => {
    if (!socket) return;

    socket.on('aiChatResponse', (data: ChatResponse) => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.message,
        timestamp: data.timestamp,
        emotion: data.emotion_detected,
      }]);
      setTyping(false);
      setLoading(false);
    });

    socket.on('aiTyping', (data: { is_typing: boolean }) => {
      setTyping(data.is_typing);
    });

    socket.on('aiChatError', (data: { error: string }) => {
      setError(data.error);
      setLoading(false);
      setTyping(false);
    });

    return () => {
      socket.off('aiChatResponse');
      socket.off('aiTyping');
      socket.off('aiChatError');
    };
  }, [socket]);

  const sendMessage = useCallback(async (
    message: string,
    includeEmotionContext: boolean = true
  ): Promise<ChatResponse | null> => {
    try {
      setLoading(true);
      setError(null);

      // Add user message to local state immediately
      const userMessage: ChatMessage = {
        role: 'user',
        content: message,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, userMessage]);

      // Emit socket event
      if (socket) {
        socket.emit('aiChatMessage', {
          user_id: userId,
          message,
          conversation_id: conversationId,
          include_emotion: includeEmotionContext,
        });
      }

      const token = await getToken();
      const response = await axios.post(
        `${API_URL}/api/chatbot/message`,
        {
          message,
          conversationId,
          includeEmotionContext,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.success) {
        const data = response.data.data;
        
        // Set conversation ID for future messages
        if (!conversationId) {
          setConversationId(data.conversation_id);
        }

        // Emit response ready
        if (socket) {
          socket.emit('aiResponseReady', {
            user_id: userId,
            conversation_id: data.conversation_id,
            response: data.message,
            emotion_detected: data.emotion_detected,
            suggestions: data.suggestions,
          });
        }

        return data;
      } else {
        setError(response.data.error);
        setLoading(false);
        return null;
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send message');
      setLoading(false);
      return null;
    }
  }, [getToken, socket, userId, conversationId]);

  const loadHistory = useCallback(async (
    convId: string,
    page: number = 1
  ) => {
    try {
      setLoading(true);
      setError(null);

      const token = await getToken();
      const response = await axios.get(
        `${API_URL}/api/chatbot/history?conversationId=${convId}&page=${page}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        setMessages(response.data.data.messages);
        setConversationId(convId);
        return response.data.data;
      } else {
        setError(response.data.error);
        return null;
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load history');
      return null;
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  const clearConversation = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setError(null);
  }, []);

  return {
    messages,
    sendMessage,
    loadHistory,
    clearConversation,
    loading,
    typing,
    error,
    conversationId,
  };
};