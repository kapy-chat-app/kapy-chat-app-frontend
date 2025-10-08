// hooks/emotion/useEmotion.ts
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '@clerk/clerk-expo';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export interface EmotionData {
  _id: string;
  emotion_scores: {
    joy: number;
    sadness: number;
    anger: number;
    fear: number;
    surprise: number;
    neutral: number;
  };
  dominant_emotion: string;
  confidence_score: number;
  analyzed_at: Date;
  recommendations?: string[];
}

export const useEmotion = () => {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeText = useCallback(async (
    text: string,
    messageId?: string,
    conversationId?: string
  ): Promise<EmotionData | null> => {
    try {
      setLoading(true);
      setError(null);

      const token = await getToken();
      const response = await axios.post(
        `${API_URL}/api/emotion/analyze`,
        {
          text,
          messageId,
          conversationId,
          context: 'message',
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.success) {
        return response.data.data;
      } else {
        setError(response.data.error);
        return null;
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to analyze emotion');
      return null;
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  const getEmotionTrends = useCallback(async (days: number = 30) => {
    try {
      setLoading(true);
      setError(null);

      const token = await getToken();
      const response = await axios.get(
        `${API_URL}/api/emotion/trends?days=${days}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        return response.data.data;
      } else {
        setError(response.data.error);
        return null;
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to get trends');
      return null;
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  const getRecommendations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await getToken();
      const response = await axios.get(
        `${API_URL}/api/emotion/recommendations`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        return response.data.data;
      } else {
        setError(response.data.error);
        return null;
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to get recommendations');
      return null;
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  return {
    analyzeText,
    getEmotionTrends,
    getRecommendations,
    loading,
    error,
  };
};