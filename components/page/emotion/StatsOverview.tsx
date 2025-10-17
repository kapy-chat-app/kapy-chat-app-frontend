// components/emotion/StatsOverview.tsx
import React from 'react';
import { View, Text, ActivityIndicator, useColorScheme } from 'react-native';

interface StatsOverviewProps {
  stats: any;
  loading: boolean;
  chartData: any[];
  averageScoresArray: any[];
  topEmotion: any;
  emotionsByContext: Record<string, number>;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({
  stats,
  loading,
  chartData,
  averageScoresArray,
  topEmotion,
  emotionsByContext,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Map contexts to Vietnamese
  const contextMap: Record<string, string> = {
    message: "Tin nhắn",
    voice_note: "Ghi âm",
    call: "Cuộc gọi",
    general: "Chung",
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center py-10">
        <ActivityIndicator size="large" color="#F57206" />
      </View>
    );
  }

  if (!stats) return null;

  return (
    <View className="gap-4">
      {/* Overview Card */}
      <View className={`rounded-xl p-4 ${isDark ? 'bg-[#1a1a1a]' : 'bg-white'} shadow-sm`}>
        <Text className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Tổng quan
        </Text>
        
        <View className="flex-row justify-around">
          <View className="items-center">
            <Text className="text-3xl font-bold text-[#F57206]">
              {stats.total_analyses}
            </Text>
            <Text className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Phân tích
            </Text>
          </View>
          
          {topEmotion && (
            <View className="items-center">
              <View
                className="w-16 h-16 rounded-full justify-center items-center mb-2"
                style={{ backgroundColor: topEmotion.color }}
              />
              <Text className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {topEmotion.label}
              </Text>
              <Text className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                Cảm xúc chủ đạo
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Emotion Distribution */}
      <View className={`rounded-xl p-4 ${isDark ? 'bg-[#1a1a1a]' : 'bg-white'} shadow-sm`}>
        <Text className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Phân bố cảm xúc
        </Text>
        
        {chartData.map((item) => (
          <View key={item.emotion} className="flex-row items-center mb-3">
            <View className="flex-row items-center w-24">
              <View
                className="w-5 h-5 rounded-full mr-2"
                style={{ backgroundColor: item.color }}
              />
              <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {item.label}
              </Text>
            </View>
            
            <View className={`flex-1 h-6 rounded-full mx-2 overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
              <View
                className="h-full rounded-full"
                style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
              />
            </View>
            
            <Text className={`text-sm font-semibold w-10 text-right ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {item.count}
            </Text>
          </View>
        ))}
      </View>

      {/* Average Scores */}
      <View className={`rounded-xl p-4 ${isDark ? 'bg-[#1a1a1a]' : 'bg-white'} shadow-sm`}>
        <Text className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Điểm trung bình
        </Text>
        
        <View className="flex-row flex-wrap justify-between">
          {averageScoresArray.map((item) => (
            <View key={item.emotion} className="w-[30%] items-center mb-4">
              <View
                className="w-16 h-16 rounded-full justify-center items-center mb-2"
                style={{ backgroundColor: item.color + '20' }}
              >
                <Text className="text-xl font-bold" style={{ color: item.color }}>
                  {item.percentage.toFixed(0)}
                </Text>
              </View>
              <Text className={`text-xs text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Context Distribution */}
      {Object.keys(emotionsByContext).length > 0 && (
        <View className={`rounded-xl p-4 ${isDark ? 'bg-[#1a1a1a]' : 'bg-white'} shadow-sm`}>
          <Text className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Theo ngữ cảnh
          </Text>
          
          {Object.entries(emotionsByContext).map(([context, count]) => (
            <View
              key={context}
              className={`flex-row justify-between items-center py-3 border-b ${isDark ? 'border-gray-800' : 'border-gray-100'}`}
            >
              <Text className={`text-base ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {contextMap[context] || context}
              </Text>
              <Text className="text-base font-semibold text-[#F57206]">
                {count}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};