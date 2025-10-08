// components/emotion/RecommendationBox.tsx
import React from 'react';
import { View, Text, TouchableOpacity, useColorScheme, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface RecommendationBoxProps {
  recommendations: string[];
  dominantEmotion: string;
  onSelectRecommendation?: (recommendation: string) => void;
  onRefresh?: () => void;
}

export default function RecommendationBox({
  recommendations,
  dominantEmotion,
  onSelectRecommendation,
  onRefresh,
}: RecommendationBoxProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const getEmotionIcon = (emotion: string) => {
    const iconMap: Record<string, string> = {
      sadness: '😢',
      anger: '😠',
      fear: '😨',
      joy: '😊',
      surprise: '😮',
      neutral: '😐',
    };
    return iconMap[emotion] || '💭';
  };

  const getEmotionColor = (emotion: string) => {
    const colorMap: Record<string, string> = {
      sadness: '#3B82F6',
      anger: '#EF4444',
      fear: '#8B5CF6',
      joy: '#10B981',
      surprise: '#F59E0B',
      neutral: '#6B7280',
    };
    return colorMap[emotion] || '#6B7280';
  };

  const getEmotionTitle = (emotion: string) => {
    const titles: Record<string, string> = {
      sadness: 'Ways to Lift Your Mood',
      anger: 'Calming Techniques',
      fear: 'Anxiety Relief Strategies',
      joy: 'Maintain Your Positive Energy',
      surprise: 'Process Your Feelings',
      neutral: 'Wellness Suggestions',
    };
    return titles[emotion] || 'Recommendations for You';
  };

  if (recommendations.length === 0) return null;

  return (
    <View className="px-4 mb-4">
      <View
        className={`rounded-2xl p-4 ${
          isDark ? 'bg-gray-800' : 'bg-white'
        }`}
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 3,
          borderLeftWidth: 4,
          borderLeftColor: getEmotionColor(dominantEmotion),
        }}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center flex-1">
            <View
              className="w-8 h-8 rounded-full items-center justify-center mr-2"
              style={{ backgroundColor: getEmotionColor(dominantEmotion) + '20' }}
            >
              <Text className="text-xl">{getEmotionIcon(dominantEmotion)}</Text>
            </View>
            <Text className="text-base font-bold text-gray-800 dark:text-white flex-1">
              {getEmotionTitle(dominantEmotion)}
            </Text>
          </View>
          
          {onRefresh && (
            <TouchableOpacity onPress={onRefresh} className="p-1">
              <Ionicons
                name="refresh"
                size={20}
                color={isDark ? '#9CA3AF' : '#6B7280'}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Recommendations List */}
        <View className="gap-2">
          {recommendations.map((rec, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => onSelectRecommendation?.(rec)}
              className={`flex-row items-start p-3 rounded-xl ${
                isDark ? 'bg-gray-700' : 'bg-gray-50'
              }`}
              activeOpacity={0.7}
            >
              <View
                className="w-6 h-6 rounded-full items-center justify-center mr-3 mt-0.5"
                style={{ backgroundColor: getEmotionColor(dominantEmotion) }}
              >
                <Text className="text-white text-xs font-bold">
                  {index + 1}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm text-gray-700 dark:text-gray-300 leading-5">
                  {rec}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={isDark ? '#9CA3AF' : '#6B7280'}
                style={{ marginTop: 2 }}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Footer */}
        <View className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <Text className="text-xs text-gray-500 dark:text-gray-400 text-center">
            💡 Tap on any suggestion to discuss it with me
          </Text>
        </View>
      </View>
    </View>
  );
}