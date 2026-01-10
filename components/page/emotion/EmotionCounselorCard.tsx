// components/page/emotion/EmotionCounselorCard.tsx - FIXED UI
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface EmotionRecommendationData {
  hasData: boolean;
  recommendations: string[]; // ✅ Array of recommendations
  currentEmotion: string;
  emotionIntensity: number;
  negativeRatio?: number;
  isAcuteSituation?: boolean;
}

interface EmotionCounselorCardProps {
  loading: boolean;
  data: EmotionRecommendationData | null;
  onRefresh: () => void;
}

const EMOTION_COLORS: Record<string, string> = {
  joy: "#10B981",
  sadness: "#3B82F6",
  anger: "#EF4444",
  fear: "#8B5CF6",
  surprise: "#F59E0B",
  neutral: "#6B7280",
};

const EMOTION_EMOJIS: Record<string, string> = {
  joy: "😊",
  sadness: "😢",
  anger: "😠",
  fear: "😨",
  surprise: "😮",
  neutral: "😐",
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const isSmallScreen = SCREEN_WIDTH < 375;

export function EmotionCounselorCard({
  loading,
  data,
  onRefresh,
}: EmotionCounselorCardProps) {
  const { actualTheme } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const isDark = actualTheme === "dark";

  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(-20));

  useEffect(() => {
    if (data) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [data]);

  const emotionColor = data
    ? EMOTION_COLORS[data.currentEmotion] || "#6B7280"
    : "#6B7280";
  const emotionEmoji = data
    ? EMOTION_EMOJIS[data.currentEmotion] || "💬"
    : "💬";

  const handleChatWithAI = () => {
    router.push("/(tabs)/ai-chat");
  };

  if (loading) {
    return (
      <View
        className={`mx-4 mb-4 mt-4 rounded-3xl ${isSmallScreen ? "p-5" : "p-6"} ${
          isDark ? "bg-gray-800" : "bg-white"
        }`}
      >
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center">
            <View className="w-10 h-10 rounded-full bg-orange-500/20 items-center justify-center mr-3">
              <Text className="text-2xl">🤖</Text>
            </View>
            <Text
              className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}
            >
              {t("emotion.counselor.title") || "Tư vấn cảm xúc"}
            </Text>
          </View>
        </View>

        <View className="items-center justify-center py-8">
          <ActivityIndicator size="large" color="#F57206" />
          <Text
            className={`mt-3 text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}
          >
            {t("emotion.counselor.analyzing") || "Đang phân tích cảm xúc..."}
          </Text>
        </View>
      </View>
    );
  }

  if (!data || !data.hasData) {
    return (
      <View
        className={`mx-4 mb-4 mt-4 rounded-3xl p-6 ${
          isDark ? "bg-gray-800" : "bg-white"
        }`}
      >
        <View className="items-center py-6">
          <Text className="text-4xl mb-3">📊</Text>
          <Text
            className={`text-base text-center ${isDark ? "text-gray-400" : "text-gray-600"}`}
          >
            {t("emotion.counselor.noData") ||
              "Chưa có đủ dữ liệu để phân tích. Hãy ghi nhận cảm xúc của bạn!"}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}
      className={`mx-4 mb-4 mt-4 rounded-3xl overflow-hidden ${
        isDark ? "bg-gray-800" : "bg-white"
      }`}
    >
      {/* Warning Banner for Acute Situations */}
      {data.isAcuteSituation && (
        <View className={`px-4 py-2 border-l-4 border-red-500 ${isDark ? "bg-red-900/20" : "bg-red-50"}`}>
          <Text className={`font-semibold text-xs ${isDark ? "text-red-400" : "text-red-600"}`}>
            ⚠️{" "}
            {t("emotion.counselor.acuteWarning") ||
              "Bạn đang có cảm xúc mạnh. Hãy cân nhắc tìm kiếm sự hỗ trợ."}
          </Text>
        </View>
      )}

      <View className="p-6">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center flex-1">
            <View
              className="w-12 h-12 rounded-full items-center justify-center mr-3"
              style={{ backgroundColor: emotionColor + "20" }}
            >
              <Text className="text-2xl">{emotionEmoji}</Text>
            </View>
            <View className="flex-1">
              <Text
                className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}
              >
                {t("emotion.counselor.title") || "Tư vấn cảm xúc AI"}
              </Text>
              <View className="flex-row items-center mt-1">
                <View
                  className="w-2 h-2 rounded-full mr-2"
                  style={{ backgroundColor: emotionColor }}
                />
                <Text
                  className="text-xs font-medium capitalize"
                  style={{ color: emotionColor }}
                >
                  {t(`emotion.emotions.${data.currentEmotion}`) ||
                    data.currentEmotion}
                </Text>
                <Text
                  className={`text-xs ml-2 ${isDark ? "text-gray-500" : "text-gray-400"}`}
                >
                  {(data.emotionIntensity * 100).toFixed(0)}%
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity onPress={onRefresh} className="p-2">
            <Ionicons
              name="refresh"
              size={20}
              color={isDark ? "#9CA3AF" : "#6B7280"}
            />
          </TouchableOpacity>
        </View>

        {/* ✅ RECOMMENDATIONS LIST */}
        {data.recommendations && data.recommendations.length > 0 && (
          <View className="mb-4">
            {data.recommendations.map((recommendation, index) => {
              // Determine style based on content
              const isWarning = recommendation.includes("⚠️");
              const emoji = isWarning
                ? "⚠️"
                : index === 0
                  ? "💡"
                  : index === 1
                    ? "🤗"
                    : "✨";

              const bgColor = isWarning
                ? isDark
                  ? "bg-red-900/20"
                  : "bg-red-50"
                : index === 0
                  ? isDark
                    ? "bg-gray-700"
                    : "bg-gray-50"
                  : index === 1
                    ? isDark
                      ? "bg-orange-900/20"
                      : "bg-orange-50"
                    : isDark
                      ? "bg-blue-900/20"
                      : "bg-blue-50";

              const textColor = isWarning
                ? isDark
                  ? "text-red-400"
                  : "text-red-600"
                : index === 0
                  ? isDark
                    ? "text-gray-300"
                    : "text-gray-700"
                  : index === 1
                    ? isDark
                      ? "text-orange-300"
                      : "text-orange-700"
                    : isDark
                      ? "text-blue-300"
                      : "text-blue-700";

              const borderColor =
                index === 0
                  ? emotionColor
                  : isWarning
                    ? "#EF4444"
                    : "transparent";

              return (
                <View
                  key={index}
                  className={`rounded-2xl p-4 mb-3 ${
                    index === 0 ? "border-l-4" : ""
                  } ${bgColor}`}
                  style={index === 0 ? { borderLeftColor: borderColor } : {}}
                >
                  <View className="flex-row items-start">
                    <Text className="text-lg mr-2">{emoji}</Text>
                    <Text className={`flex-1 text-sm leading-5 ${textColor}`}>
                      {recommendation.replace("⚠️", "").trim()}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Chat with AI Button */}
        <TouchableOpacity
          onPress={handleChatWithAI}
          className="bg-orange-500 rounded-2xl py-4 px-6 flex-row items-center justify-center"
          activeOpacity={0.8}
        >
          <Ionicons name="chatbubbles" size={20} color="white" />
          <Text className="text-white font-semibold text-base ml-2">
            {t("emotion.counselor.chatButton") ||
              "Trò chuyện với AI để được tư vấn"}
          </Text>
        </TouchableOpacity>

        {/* Stats Footer */}
        {data.negativeRatio !== undefined && (
          <View className={`mt-4 pt-4 ${isDark ? "border-t border-gray-700" : "border-t border-gray-200"}`}>
            <View className="flex-row justify-between items-center">
              <View className="flex-1">
                <Text
                  className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}
                >
                  {t("emotion.counselor.emotionBalance") || "Cân bằng cảm xúc"}
                </Text>
                <View className="flex-row items-center mt-1">
                  <View className={`flex-1 h-2 rounded-full overflow-hidden mr-2 ${isDark ? "bg-gray-700" : "bg-gray-200"}`}>
                    <View
                      className="h-full rounded-full"
                      style={{
                        width: `${(1 - data.negativeRatio) * 100}%`,
                        backgroundColor:
                          data.negativeRatio > 0.6 ? "#EF4444" : "#10B981",
                      }}
                    />
                  </View>
                  <Text
                    className={`text-xs font-semibold ${
                      data.negativeRatio > 0.6
                        ? "text-red-500"
                        : "text-green-500"
                    }`}
                  >
                    {((1 - data.negativeRatio) * 100).toFixed(0)}%
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>
    </Animated.View>
  );
}