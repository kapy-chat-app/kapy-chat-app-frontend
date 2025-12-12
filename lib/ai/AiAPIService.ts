// mobile/lib/ai/AiAPIService.ts
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export interface AIChatMessage {
  role: 'user' | 'assistant';
  content: string;
  language?: 'vi' | 'en' | 'zh';
  emotion?: string;
  timestamp: Date;
}

export interface ConversationPreview {
  conversation_id: string;
  title: string;
  preview: string;
  last_updated: Date;
  message_count: number;
  emotion_context?: {
    dominant_emotion: string;
    recent_emotions: string[];
    avg_confidence: number;
  };
  language: string;
}

export interface EmotionContext {
  emotion: string;
  confidence: number;
  trends: string[];
  intensity: number;
}

class AIAPIService {
  // ============================================
  // SEND MESSAGE
  // ============================================
  static async sendMessage(
    token: string,
    message: string,
    conversationId?: string,
    language?: 'vi' | 'en' | 'zh'
  ) {
    try {
      const response = await axios.post(
        `${API_URL}/api/ai/chat`,
        {
          message,
          conversationId,
          includeEmotionContext: true,
          language,
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
      console.error('❌ Send message error:', error.response?.data || error);
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to send message',
      };
    }
  }

  // ============================================
  // GET CHAT HISTORY
  // ============================================
  static async getChatHistory(
    token: string,
    conversationId: string,
    page: number = 1,
    limit: number = 50
  ) {
    try {
      const response = await axios.get(
        `${API_URL}/api/ai/history?conversationId=${conversationId}&page=${page}&limit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('❌ Get history error:', error.response?.data || error);
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to get history',
      };
    }
  }

  // ============================================
  // GET ALL CONVERSATIONS (for sidebar)
  // ============================================
  static async getAllConversations(
    token: string,
    limit: number = 50,
    offset: number = 0
  ) {
    try {
      const response = await axios.get(
        `${API_URL}/api/ai/conversations?limit=${limit}&offset=${offset}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('❌ Get conversations error:', error.response?.data || error);
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to get conversations',
      };
    }
  }

  // ============================================
  // DELETE CONVERSATION
  // ============================================
  static async deleteConversation(token: string, conversationId: string) {
    try {
      const response = await axios.delete(`${API_URL}/api/ai/conversations`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: { conversationId },
      });

      return response.data;
    } catch (error: any) {
      console.error('❌ Delete conversation error:', error.response?.data || error);
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to delete conversation',
      };
    }
  }

  // ============================================
  // GET EMOTION RECOMMENDATION
  // ============================================
  static async getEmotionRecommendation(
    token: string,
    language: 'vi' | 'en' | 'zh' = 'vi'
  ) {
    try {
      const response = await axios.get(
        `${API_URL}/api/ai/recommend?language=${language}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('❌ Get recommendation error:', error.response?.data || error);
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to get recommendation',
      };
    }
  }
}

export default AIAPIService;