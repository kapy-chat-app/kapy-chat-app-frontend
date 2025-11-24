// hooks/ai/useChatbot.ts - BACKEND AI VERSION
import { useLanguage } from '@/contexts/LanguageContext';
import { useSocket } from '@/hooks/message/useSocket';
import AIAPIService, { AIChatMessage } from '@/lib/ai/AiAPIService';
import { useAuth } from '@clerk/clerk-expo';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  language?: 'vi' | 'en' | 'zh';
  emotion?: string;
  timestamp: Date;
}

interface UseChatbotReturn {
  messages: ChatMessage[];
  sendMessage: (message: string, includeEmotion?: boolean) => Promise<any>;
  loadHistory: (conversationId: string) => Promise<void>;
  clearConversation: () => void;
  loading: boolean;
  typing: boolean;
  error: string | null;
  conversationId: string | null;
  conversationTitle: string | null;
}

export const useChatbot = (initialConversationId?: string): UseChatbotReturn => {
  const { getToken } = useAuth();
  const { language } = useLanguage();
  const { socket } = useSocket();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(
    initialConversationId || null
  );
  const [conversationTitle, setConversationTitle] = useState<string | null>(null);

  const isLoadingHistory = useRef(false);

  // ============================================
  // SOCKET LISTENERS
  // ============================================
  useEffect(() => {
    if (!socket) return;

    // AI typing indicator
    socket.on('aiTyping', (data: any) => {
      if (data.conversation_id === conversationId) {
        setTyping(data.is_typing);
      }
    });

    // AI response received
    socket.on('aiChatResponse', (data: any) => {
      if (data.conversation_id === conversationId) {
        const aiMessage: ChatMessage = {
          role: 'assistant',
          content: data.message,
          language: data.language,
          timestamp: new Date(data.timestamp),
        };

        setMessages(prev => [...prev, aiMessage]);
        setTyping(false);
        setLoading(false);
      }
    });

    // AI error
    socket.on('aiChatError', (data: any) => {
      setError(data.error);
      setTyping(false);
      setLoading(false);
    });

    return () => {
      socket.off('aiTyping');
      socket.off('aiChatResponse');
      socket.off('aiChatError');
    };
  }, [socket, conversationId]);

  // ============================================
  // SEND MESSAGE
  // ============================================
  const sendMessage = useCallback(
    async (message: string, includeEmotion: boolean = true) => {
      try {
        setLoading(true);
        setError(null);

        const token = await getToken();
        if (!token) throw new Error('Not authenticated');

        // Add user message immediately
        const userMessage: ChatMessage = {
          role: 'user',
          content: message,
          timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);

        // Get current language
        const currentLang =
          language === 'vi' ? 'vi' : language === 'zh' ? 'zh' : 'en';

        // Call API
        const response = await AIAPIService.sendMessage(
          token,
          message,
          conversationId || undefined,
          currentLang
        );

        if (response.success && response.data) {
          // Update conversation ID nếu là chat mới
          if (!conversationId) {
            setConversationId(response.data.conversation_id);
          }

          // Update title nếu có
          if (response.data.title) {
            setConversationTitle(response.data.title);
          }

          // Nếu không có socket, add response trực tiếp
          if (!socket) {
            const aiMessage: ChatMessage = {
              role: 'assistant',
              content: response.data.message,
              language: response.data.language,
              emotion: response.data.emotion_detected,
              timestamp: new Date(response.data.timestamp),
            };
            setMessages(prev => [...prev, aiMessage]);
          }

          return {
            message: response.data.message,
            emotion: response.data.emotion_detected,
            suggestions: [], // Backend không còn trả suggestions trong response
          };
        } else {
          throw new Error(response.error || 'Failed to send message');
        }
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to send message';
        setError(errorMessage);
        console.error('❌ Send message error:', err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [getToken, language, conversationId, socket]
  );

  // ============================================
  // LOAD HISTORY
  // ============================================
  const loadHistory = useCallback(
    async (convId: string) => {
      if (isLoadingHistory.current) return;

      try {
        isLoadingHistory.current = true;
        setLoading(true);
        setError(null);

        const token = await getToken();
        if (!token) throw new Error('Not authenticated');

        const response = await AIAPIService.getChatHistory(token, convId);

        if (response.success && response.data) {
          const historyMessages: ChatMessage[] = response.data.messages.map(
            (msg: AIChatMessage) => ({
              role: msg.role,
              content: msg.content,
              language: msg.language,
              emotion: msg.emotion,
              timestamp: new Date(msg.timestamp),
            })
          );

          setMessages(historyMessages);
          setConversationId(convId);
          
          if (response.data.title) {
            setConversationTitle(response.data.title);
          }
        } else {
          throw new Error(response.error || 'Failed to load history');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load history');
        console.error('❌ Load history error:', err);
      } finally {
        setLoading(false);
        isLoadingHistory.current = false;
      }
    },
    [getToken]
  );

  // ============================================
  // CLEAR CONVERSATION
  // ============================================
  const clearConversation = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setConversationTitle(null);
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
    conversationTitle,
  };
};