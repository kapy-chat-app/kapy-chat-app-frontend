// lib/api/ai-api.service.ts
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export interface AIChatMessage {
  role: 'user' | 'assistant';
  content: string;
  language?: 'vi' | 'en' | 'zh';
  emotion?: string;
  timestamp: Date;
}

export interface AIChatResponse {
  success: boolean;
  data?: {
    message: string;
    conversation_id: string;
    language: 'vi' | 'en' | 'zh';
    title?: string;
    emotion_detected?: string;
    timestamp: Date;
  };
  error?: string;
}

export interface EmotionRecommendation {
  success: boolean;
  data?: {
    currentEmotion: string;
    emotionIntensity: number;
    recommendation: string;
    supportMessage: string;
    actionSuggestion?: string;
    language: 'vi' | 'en' | 'zh';
    generatedAt: Date;
  };
  error?: string;
}

export interface ChatHistory {
  success: boolean;
  data?: {
    messages: AIChatMessage[];
    title?: string;
    emotion_context?: {
      dominant_emotion: string;
      recent_emotions: string[];
      avg_confidence: number;
    };
    pagination: {
      page: number;
      limit: number;
      total: number;
      hasMore: boolean;
    };
  };
  error?: string;
}

export interface ConversationsList {
  success: boolean;
  data?: Array<{
    conversation_id: string;
    title?: string;
    last_message: string;
    last_updated: Date;
    message_count: number;
    emotion_context?: any;
    language: 'vi' | 'en' | 'zh';
  }>;
  error?: string;
}

class AIAPIService {
  /**
   * Gửi tin nhắn đến AI chatbot
   */
  static async sendMessage(
    token: string,
    message: string,
    conversationId?: string,
    language?: 'vi' | 'en' | 'zh'
  ): Promise<AIChatResponse> {
    try {
      const response = await axios.post(
        `${API_URL}/api/ai/chat`,
        {
          message,
          conversationId,
          includeEmotionContext: true,
          language: language || 'vi',
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('❌ Send AI message failed:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to send message',
      };
    }
  }

  /**
   * Lấy lịch sử chat
   */
  static async getChatHistory(
    token: string,
    conversationId: string,
    page: number = 1
  ): Promise<ChatHistory> {
    try {
      const response = await axios.get(
        `${API_URL}/api/ai/chat/history`,
        {
          params: { conversationId, page, limit: 50 },
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('❌ Get chat history failed:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to get history',
      };
    }
  }

  /**
   * Lấy tất cả cuộc trò chuyện
   */
  static async getAllConversations(token: string): Promise<ConversationsList> {
    try {
      const response = await axios.get(
        `${API_URL}/api/ai/chat/conversations`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('❌ Get conversations failed:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to get conversations',
      };
    }
  }

  /**
   * Xóa cuộc trò chuyện
   */
  static async deleteConversation(
    token: string,
    conversationId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await axios.delete(
        `${API_URL}/api/ai/chat/conversations/${conversationId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('❌ Delete conversation failed:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to delete',
      };
    }
  }

  /**
   * Lấy gợi ý cảm xúc từ backend AI
   */
  static async getEmotionRecommendation(
    token: string,
    language: 'vi' | 'en' | 'zh' = 'vi'
  ): Promise<EmotionRecommendation> {
    try {
      const response = await axios.get(
        `${API_URL}/api/ai/recommend`,
        {
          params: { language },
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('❌ Get recommendation failed:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to get recommendation',
      };
    }
  }

  /**
   * Kiểm tra health của AI service
   */
  static async checkHealth(): Promise<boolean> {
    try {
      const response = await axios.get(`${API_URL}/api/ai/health`);
      return response.data.status === 'healthy';
    } catch {
      return false;
    }
  }
}

export default AIAPIService;