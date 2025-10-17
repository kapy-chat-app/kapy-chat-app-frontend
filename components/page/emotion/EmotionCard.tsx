/* eslint-disable react/no-unescaped-entities */
// components/emotion/EmotionCard.tsx
import React from "react";
import { Text, TouchableOpacity, View, useColorScheme } from "react-native";
import { Ionicons } from "@expo/vector-icons";

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
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

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

  // Map contexts to Vietnamese
  const contextMap: Record<string, string> = {
    message: "Tin nhắn",
    voice_note: "Ghi âm",
    call: "Cuộc gọi",
    general: "Chung",
  };

  // Map emotions to Vietnamese
  const emotionMap: Record<string, string> = {
    joy: "Vui vẻ",
    sadness: "Buồn bã",
    anger: "Giận dữ",
    fear: "Sợ hãi",
    surprise: "Ngạc nhiên",
    love: "Yêu thương",
    neutral: "Trung lập",
  };

  const emotionColor = emotionColors[item.dominant_emotion] || "#808080";
  const emotionText = emotionMap[item.dominant_emotion] || item.dominant_emotion;
  const contextText = contextMap[item.context] || item.context;

  return (
    <View
      className={`rounded-xl p-4 mb-3 ${isDark ? "bg-[#1a1a1a]" : "bg-white"} shadow-sm`}
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
              className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"} mt-0.5`}
            >
              {(item.confidence_score * 100).toFixed(0)}% độ tin cậy
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