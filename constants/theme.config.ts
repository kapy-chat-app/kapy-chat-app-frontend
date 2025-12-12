// constants/theme.config.ts
export const COLORS = {
  light: {
    background: '#f5f5f5',
    card: '#ffffff',
    text: '#333333',
    textSecondary: '#666666',
    textTertiary: '#999999',
    border: '#e5e7eb',
    primary: '#6366f1',
    accent: '#F57206',
    error: '#DC143C',
  },
  dark: {
    background: '#000000',
    card: '#1a1a1a',
    text: '#ffffff',
    textSecondary: '#cccccc',
    textTertiary: '#888888',
    border: '#333333',
    primary: '#6366f1',
    accent: '#F57206',
    error: '#DC143C',
  },
};

export const EMOTION_COLORS = {
  joy: '#10b981',
  sadness: '#3b82f6',
  anger: '#ef4444',
  fear: '#8b5cf6',
  surprise: '#f59e0b',
  disgust: '#84cc16',
  neutral: '#6b7280',
};

export const EMOTION_ICONS = {
  joy: 'happy-outline',
  sadness: 'sad-outline',
  anger: 'flame-outline',
  fear: 'alert-circle-outline',
  surprise: 'sparkles-outline',
  disgust: 'close-circle-outline',
  neutral: 'remove-circle-outline',
};

export const EMOTION_LABELS: Record<string, string> = {
  joy: 'Vui vẻ',
  sadness: 'Buồn bã',
  anger: 'Tức giận',
  fear: 'Lo lắng',
  surprise: 'Ngạc nhiên',
  disgust: 'Khó chịu',
  neutral: 'Bình thường',
};

export const CONTEXT_LABELS: Record<string, string> = {
  message: 'Tin nhắn',
  voice_note: 'Ghi âm',
  call: 'Cuộc gọi',
  general: 'Chung',
};