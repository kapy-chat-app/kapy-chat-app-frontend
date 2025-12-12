/* eslint-disable react/no-unescaped-entities */
// components/emotion/EmotionCard.tsx
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";

interface EmotionCardProps {
  item: {
    _id: string;
    dominant_emotion: string;
    confidence_score: number;
    text_analyzed?: string;
    context: string;
    analyzed_at: string;
  };
  onDelete: (id: string) => void;
}

export const EmotionCard: React.FC<EmotionCardProps> = ({ item, onDelete }) => {
  const { actualTheme } = useTheme();
  const { t } = useLanguage();
  const isDark = actualTheme === 'dark';

  // Map emotions to colors
  const emotionColors: Record<string, string> = {
    joy: "#FFD700",
    sadness: "#4169E1",
    anger: "#DC143C",
    fear: "#9370DB",
    surprise: "#FF8C00",
    love: "#FF1493",
    neutral: "#808080",
  };

  const emotionColor = emotionColors[item.dominant_emotion] || "#808080";
  const emotionText = t(`emotion.emotions.${item.dominant_emotion}` as any) || item.dominant_emotion;
  const contextText = t(`emotion.contexts.${item.context}` as any) || item.context;

  return (
    <View
      className={`rounded-xl p-4 mb-3 shadow-sm ${isDark ? "bg-[#1a1a1a]" : "bg-white"}`}
    >
      {/* Header */}
      <View className="flex-row justify-between items-center mb-3">
        <View className="flex-row items-center flex-1">
          <View
            className="w-12 h-12 rounded-full justify-center items-center mr-3"
            style={{ backgroundColor: emotionColor + "20" }}
          >
            <View 
              className="w-6 h-6 rounded-full"
              style={{ backgroundColor: emotionColor }}
            />
          </View>

          <View className="flex-1">
            <Text
              className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}
            >
              {emotionText}
            </Text>
            <Text
              className={`text-sm mt-0.5 ${isDark ? "text-gray-400" : "text-gray-600"}`}
            >
              {t('emotion.stats.confidence', { percent: (item.confidence_score * 100).toFixed(0) })}
            </Text>
          </View>
        </View>

        <TouchableOpacity onPress={() => onDelete(item._id)} className="p-2">
          <Ionicons name="trash-outline" size={20} color="#DC143C" />
        </TouchableOpacity>
      </View>

      {/* Text */}
      {item.text_analyzed && (
        <Text
          className={`text-sm italic mb-3 px-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}
          numberOfLines={2}
        >
          "{item.text_analyzed}"
        </Text>
      )}

      {/* Footer */}
      <View
        className={`flex-row justify-between pt-3 border-t ${isDark ? "border-gray-800" : "border-gray-100"}`}
      >
        <Text
          className={`text-xs ${isDark ? "text-gray-500" : "text-gray-500"}`}
        >
          {contextText}
        </Text>
        <Text
          className={`text-xs ${isDark ? "text-gray-500" : "text-gray-500"}`}
        >
          {new Date(item.analyzed_at).toLocaleDateString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })}
        </Text>
      </View>
    </View>
  );
};