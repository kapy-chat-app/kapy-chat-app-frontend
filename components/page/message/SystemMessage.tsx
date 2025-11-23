// components/page/message/SystemMessage.tsx - UPDATED
import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";

interface SystemMessageProps {
  message: {
    _id: string;
    content: string;
    metadata?: {
      isSystemMessage: boolean;
      action: string;
      [key: string]: any;
    };
    created_at: Date | string;
  };
}

const SystemMessage: React.FC<SystemMessageProps> = ({ message }) => {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === "dark";

  console.log('🔍 SystemMessage received:', {
    isSystemMessage: message.metadata?.isSystemMessage,
    action: message.metadata?.action,
    content: message.content
  });

  if (!message.metadata?.isSystemMessage) {
    console.log('❌ Not a system message, returning null');
    return null;
  }

  console.log('✅ Rendering system message UI');

  const getIcon = (action: string): keyof typeof Ionicons.glyphMap => {
    const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
      create_group: "people",
      add_participants: "person-add",
      remove_participant: "person-remove",
      leave_group: "exit-outline",
      transfer_admin: "shield-checkmark",
      auto_transfer_admin: "shield",
      update_group_name: "pencil",
      update_group_description: "document-text-outline",
      update_group_avatar: "image-outline",
    };
    return iconMap[action] || "information-circle-outline";
  };

  const action = message.metadata?.action || "";
  const icon = getIcon(action);

  return (
    <View className="flex-row justify-center items-center py-2 px-4">
      {/* Left line */}
      <View
        className={`flex-1 h-[1px] ${
          isDark ? "bg-gray-800" : "bg-gray-200"
        }`}
      />

      {/* Message content */}
      <View className="flex-row items-center px-3 py-1.5 mx-2">
        <Ionicons
          name={icon}
          size={14}
          color={isDark ? "#9CA3AF" : "#6B7280"}
        />
        <Text
          className={`text-xs ml-1.5 ${
            isDark ? "text-gray-400" : "text-gray-500"
          }`}
        >
          {message.content}
        </Text>
      </View>

      {/* Right line */}
      <View
        className={`flex-1 h-[1px] ${
          isDark ? "bg-gray-800" : "bg-gray-200"
        }`}
      />
    </View>
  );
};

export default SystemMessage;