// components/emotion/EmotionInsights.tsx
import { useEmotion } from "@/hooks/ai/useEmotion";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    Text,
    TouchableOpacity,
    useColorScheme,
    View,
} from "react-native";

interface EmotionInsightsProps {
  userId: string;
  days?: number;
}

export default function EmotionInsights({
  userId,
  days = 7,
}: EmotionInsightsProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const { getEmotionTrends, loading } = useEmotion();
  const [trends, setTrends] = useState<any>(null);

  useEffect(() => {
    loadTrends();
  }, [days]);

  const loadTrends = async () => {
    const data = await getEmotionTrends(days);
    if (data) {
      setTrends(data);
    }
  };

  const getEmotionIcon = (emotion: string) => {
    const iconMap: Record<string, string> = {
      joy: "😊",
      sadness: "😢",
      anger: "😠",
      fear: "😨",
      surprise: "😮",
      neutral: "😐",
    };
    return iconMap[emotion] || "💬";
  };

  const getEmotionColor = (emotion: string) => {
    const colorMap: Record<string, string> = {
      joy: "#10B981",
      sadness: "#3B82F6",
      anger: "#EF4444",
      fear: "#8B5CF6",
      surprise: "#F59E0B",
      neutral: "#6B7280",
    };
    return colorMap[emotion] || "#6B7280";
  };

  if (loading) {
    return (
      <View className="p-4 items-center justify-center">
        <ActivityIndicator size="large" color="#F97316" />
        <Text className="text-gray-500 dark:text-gray-400 mt-2">
          Analyzing your emotions...
        </Text>
      </View>
    );
  }

  if (!trends) {
    return (
      <View className="p-4 items-center justify-center">
        <Ionicons name="analytics-outline" size={48} color="#9CA3AF" />
        <Text className="text-gray-500 dark:text-gray-400 mt-2 text-center">
          No emotion data available yet
        </Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 p-4">
      {/* Summary Card */}
      <View
        className={`rounded-2xl p-5 mb-4 ${
          isDark ? "bg-gray-800" : "bg-white"
        }`}
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 3,
        }}
      >
        <Text className="text-lg font-bold text-gray-800 dark:text-white mb-3">
          📊 Emotion Summary ({days} days)
        </Text>

        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-1 mr-2">
            <Text className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              Most Common
            </Text>
            <View className="flex-row items-center">
              <Text className="text-2xl mr-2">
                {getEmotionIcon(trends.summary.most_common_emotion)}
              </Text>
              <Text
                className="text-base font-semibold capitalize"
                style={{
                  color: getEmotionColor(trends.summary.most_common_emotion),
                }}
              >
                {trends.summary.most_common_emotion}
              </Text>
            </View>
          </View>

          <View className="flex-1 ml-2">
            <Text className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              Confidence
            </Text>
            <Text className="text-base font-semibold text-gray-800 dark:text-white">
              {(trends.summary.avg_confidence * 100).toFixed(1)}%
            </Text>
          </View>
        </View>

        <View className="border-t border-gray-200 dark:border-gray-700 pt-3">
          <Text className="text-sm text-gray-500 dark:text-gray-400 mb-1">
            Total Analyses
          </Text>
          <Text className="text-2xl font-bold text-orange-500">
            {trends.summary.total_analyses}
          </Text>
        </View>
      </View>

      {/* Emotion Distribution */}
      <View
        className={`rounded-2xl p-5 mb-4 ${
          isDark ? "bg-gray-800" : "bg-white"
        }`}
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 3,
        }}
      >
        <Text className="text-lg font-bold text-gray-800 dark:text-white mb-4">
          🎭 Emotion Distribution
        </Text>

        {trends.trends && trends.trends.length > 0 ? (
          <View className="gap-3">
            {Object.entries(
              trends.trends.reduce((acc: any, trend: any) => {
                const emotion = trend._id.emotion;
                acc[emotion] = (acc[emotion] || 0) + trend.count;
                return acc;
              }, {})
            )
              .sort((a, b) => (b[1] as number) - (a[1] as number))
              .map(([emotion, count]) => {
                const percentage =
                  ((count as number) / trends.summary.total_analyses) * 100;
                return (
                  <View key={emotion} className="mb-2">
                    <View className="flex-row items-center justify-between mb-1">
                      <View className="flex-row items-center">
                        <Text className="text-xl mr-2">
                          {getEmotionIcon(emotion)}
                        </Text>
                        <Text
                          className="text-sm font-medium capitalize"
                          style={{ color: getEmotionColor(emotion) }}
                        >
                          {emotion}
                        </Text>
                      </View>
                      <Text className="text-sm text-gray-500 dark:text-gray-400">
                        {percentage.toFixed(1)}%
                      </Text>
                    </View>
                    <View className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <View
                        className="h-full rounded-full"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: getEmotionColor(emotion),
                        }}
                      />
                    </View>
                  </View>
                );
              })}
          </View>
        ) : (
          <Text className="text-gray-500 dark:text-gray-400 text-center">
            No emotion trends available
          </Text>
        )}
      </View>

      {/* Refresh Button */}
      <TouchableOpacity
        onPress={loadTrends}
        className="bg-orange-500 rounded-full py-3 px-6 items-center"
      >
        <Text className="text-white font-semibold">Refresh Insights</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
