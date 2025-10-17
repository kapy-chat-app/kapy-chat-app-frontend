// hooks/emotion/useEmotion.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '@clerk/clerk-expo';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

// ============================================
// TYPES
// ============================================
export interface EmotionScores {
  joy: number;
  sadness: number;
  anger: number;
  fear: number;
  surprise: number;
  neutral: number;
}

export interface EmotionAnalysis {
  _id: string;
  user: string;
  message?: string;
  conversation?: string;
  emotion_scores: EmotionScores;
  dominant_emotion: string;
  confidence_score: number;
  text_analyzed?: string;
  context: 'message' | 'voice_note' | 'call' | 'general';
  analyzed_at: string;
  created_at: string;
}

export interface EmotionTrend {
  date: string;
  emotion: string;
  count: number;
  avg_confidence: number;
  avg_joy: number;
  avg_sadness: number;
  avg_anger: number;
  avg_fear: number;
}

export interface EmotionStats {
  total_analyses: number;
  dominant_emotions_count: { [key: string]: number };
  average_scores: EmotionScores;
  trends: EmotionTrend[];
}

export interface FilterOptions {
  context?: 'message' | 'voice_note' | 'call' | 'general';
  startDate?: string;
  endDate?: string;
  days?: number;
}

export interface EmotionPattern {
  _id: {
    emotion: string;
    hour: number;
    dayOfWeek: number;
  };
  count: number;
  avg_confidence: number;
}

export interface RecommendationData {
  recommendations: string[];
  based_on?: {
    recent_emotions: string[];
    dominant_pattern: string;
  };
}

// ============================================
// CONSTANTS
// ============================================
export const EMOTION_COLORS: { [key: string]: string } = {
  joy: '#FFD700',
  sadness: '#4169E1',
  anger: '#DC143C',
  fear: '#9370DB',
  surprise: '#FF8C00',
  neutral: '#808080',
};

export const EMOTION_ICONS: { [key: string]: string } = {
  joy: 'happy-outline',
  sadness: 'sad-outline',
  anger: 'flame-outline',
  fear: 'alert-circle-outline',
  surprise: 'bulb-outline',
  neutral: 'remove-circle-outline',
};

export const EMOTION_LABELS: { [key: string]: string } = {
  joy: 'Vui vẻ',
  sadness: 'Buồn bã',
  anger: 'Giận dữ',
  fear: 'Sợ hãi',
  surprise: 'Ngạc nhiên',
  neutral: 'Trung lập',
};

export const CONTEXT_LABELS: { [key: string]: string } = {
  message: 'Tin nhắn',
  voice_note: 'Ghi âm',
  call: 'Cuộc gọi',
  general: 'Chung',
};

// ============================================
// MAIN HOOK
// ============================================
export const useEmotion = (initialFilters: FilterOptions = {}) => {
  const { getToken } = useAuth();

  // States
  const [emotions, setEmotions] = useState<EmotionAnalysis[]>([]);
  const [stats, setStats] = useState<EmotionStats | null>(null);
  const [patterns, setPatterns] = useState<EmotionPattern[]>([]);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [patternsLoading, setPatternsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterOptions>(initialFilters);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  // ============================================
  // API: GET EMOTION HISTORY
  // ============================================
  const fetchEmotions = useCallback(async (resetOffset = true) => {
    try {
      setLoading(true);
      setError(null);

      const token = await getToken();
      const queryParams = new URLSearchParams();
      
      queryParams.append('limit', limit.toString());
      queryParams.append('offset', (resetOffset ? 0 : offset).toString());
      
      if (filters.context) queryParams.append('context', filters.context);
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);

      const response = await axios.get(
        `${API_URL}/api/emotion-analysis?${queryParams.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.success) {
        if (resetOffset) {
          setEmotions(response.data.data.emotions);
          setOffset(limit);
        } else {
          setEmotions(prev => [...prev, ...response.data.data.emotions]);
          setOffset(prev => prev + limit);
        }
        setHasMore(response.data.data.pagination.hasMore);
        setTotal(response.data.data.pagination.total);
      } else {
        setError(response.data.error || 'Không thể tải dữ liệu cảm xúc');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Có lỗi xảy ra khi tải dữ liệu');
      console.error('Error fetching emotions:', err);
    } finally {
      setLoading(false);
    }
  }, [getToken, filters, offset]);

  // ============================================
  // API: GET EMOTION STATISTICS
  // ============================================
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);

      const token = await getToken();
      const queryParams = new URLSearchParams({ action: 'stats' });
      
      if (filters.days) queryParams.append('days', filters.days.toString());

      const response = await axios.get(
        `${API_URL}/api/emotion-analysis?${queryParams.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (err: any) {
      console.error('Error fetching stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, [getToken, filters.days]);

  // ============================================
  // API: GET EMOTION PATTERNS
  // ============================================
  const fetchPatterns = useCallback(async () => {
    try {
      setPatternsLoading(true);

      const token = await getToken();
      const response = await axios.get(
        `${API_URL}/api/emotion-analysis/patterns`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.success) {
        setPatterns(response.data.data);
      }
    } catch (err: any) {
      console.error('Error fetching patterns:', err);
    } finally {
      setPatternsLoading(false);
    }
  }, [getToken]);

  // ============================================
  // API: GET RECOMMENDATIONS (MỚI THÊM)
  // ============================================
  const getRecommendations = useCallback(async (): Promise<RecommendationData | null> => {
    try {
      const token = await getToken();
      const response = await axios.get(
        `${API_URL}/api/emotion/recommendations`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.success) {
        return response.data.data;
      }
      return null;
    } catch (err: any) {
      console.error('Error getting recommendations:', err);
      return null;
    }
  }, [getToken]);

  // ============================================
  // API: DELETE EMOTION ANALYSIS
  // ============================================
  const deleteEmotion = useCallback(async (emotionId: string) => {
    try {
      const token = await getToken();
      const response = await axios.delete(
        `${API_URL}/api/emotion-analysis/${emotionId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.success) {
        setEmotions(prev => prev.filter(e => e._id !== emotionId));
        setTotal(prev => prev - 1);
        fetchStats();
        return { success: true, message: 'Đã xóa thành công' };
      } else {
        return { success: false, error: response.data.error };
      }
    } catch (err: any) {
      return { 
        success: false, 
        error: err.response?.data?.error || 'Không thể xóa' 
      };
    }
  }, [getToken, fetchStats]);

  // ============================================
  // API: ANALYZE TEXT
  // ============================================
  const analyzeText = useCallback(async (
    text: string,
    messageId?: string,
    conversationId?: string
  ) => {
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

  // ============================================
  // ACTIONS
  // ============================================
  const loadMore = useCallback(() => {
    if (!hasMore || loading) return;
    fetchEmotions(false);
  }, [hasMore, loading, fetchEmotions]);

  const refresh = useCallback(() => {
    setOffset(0);
    fetchEmotions(true);
    fetchStats();
  }, [fetchEmotions, fetchStats]);

  const updateFilters = useCallback((newFilters: Partial<FilterOptions>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setOffset(0);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
    setOffset(0);
  }, []);

  // ============================================
  // COMPUTED DATA
  // ============================================
  const chartData = useMemo(() => {
    if (!stats) return [];

    return Object.entries(stats.dominant_emotions_count)
      .map(([emotion, count]) => ({
        emotion,
        count,
        percentage: (count / stats.total_analyses) * 100,
        color: EMOTION_COLORS[emotion] || '#808080',
        label: EMOTION_LABELS[emotion] || emotion,
      }))
      .sort((a, b) => b.count - a.count);
  }, [stats]);

  const timelineData = useMemo(() => {
    if (!stats) return [];

    const dateMap: { [key: string]: { [key: string]: number } } = {};

    stats.trends.forEach(trend => {
      if (!dateMap[trend.date]) {
        dateMap[trend.date] = {};
      }
      dateMap[trend.date][trend.emotion] = trend.count;
    });

    return Object.entries(dateMap)
      .map(([date, emotions]) => ({
        date,
        ...emotions,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [stats]);

  const averageScoresArray = useMemo(() => {
    if (!stats) return [];

    return Object.entries(stats.average_scores)
      .map(([emotion, score]) => ({
        emotion,
        score,
        percentage: score * 100,
        color: EMOTION_COLORS[emotion] || '#808080',
        label: EMOTION_LABELS[emotion] || emotion,
      }))
      .sort((a, b) => b.score - a.score);
  }, [stats]);

  const recentEmotions = useMemo(() => {
    return emotions.slice(0, 5);
  }, [emotions]);

  const topEmotion = useMemo(() => {
    if (!chartData.length) return null;
    return chartData[0];
  }, [chartData]);

  const emotionsByContext = useMemo(() => {
    const grouped: { [key: string]: number } = {};
    emotions.forEach(emotion => {
      grouped[emotion.context] = (grouped[emotion.context] || 0) + 1;
    });
    return grouped;
  }, [emotions]);

  // ============================================
  // EFFECTS
  // ============================================
  useEffect(() => {
    fetchEmotions(true);
  }, [filters.context, filters.startDate, filters.endDate]);

  useEffect(() => {
    fetchStats();
  }, [filters.days]);

  // ============================================
  // RETURN
  // ============================================
  return {
    // Raw data
    emotions,
    stats,
    patterns,
    
    // Loading states
    loading,
    statsLoading,
    patternsLoading,
    error,
    
    // Pagination
    hasMore,
    total,
    
    // Filters
    filters,
    updateFilters,
    clearFilters,
    
    // Actions
    refresh,
    loadMore,
    deleteEmotion,
    analyzeText,
    fetchPatterns,
    getRecommendations, // ✅ THÊM VÀO ĐÂY
    
    // Computed data
    chartData,
    timelineData,
    averageScoresArray,
    recentEmotions,
    topEmotion,
    emotionsByContext,
    
    // Constants
    EMOTION_COLORS,
    EMOTION_ICONS,
    EMOTION_LABELS,
    CONTEXT_LABELS,
  };
};