// components/page/message/ConversationItem.tsx - WITH UserLastSeen

import { useTheme } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import { UserLastSeen } from "../profile/UserLastSeen";

interface Conversation {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  avatar?: string | null | any;
  unreadCount?: number;
  type?: "private" | "group";
  isOnline?: boolean;
  otherUserId?: string | null; // ✅ NEW: ID của người dùng khác trong private chat
}

interface ConversationItemProps {
  conversation: Conversation;
  onPress: () => void;
}

const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  onPress,
}) => {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === "dark";
  const hasUnread = conversation.unreadCount && conversation.unreadCount > 0;

  const [imageError, setImageError] = useState(false);

  const getValidAvatarUri = (): string | null => {
    const { avatar } = conversation;

    if (avatar == null) {
      return null;
    }

    if (typeof avatar === "string") {
      const trimmed = avatar.trim();
      if (trimmed.length === 0) {
        return null;
      }
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        return trimmed;
      }
      console.warn(
        "⚠️ [ConversationItem] Invalid avatar string:",
        trimmed.substring(0, 50)
      );
      return null;
    }

    if (typeof avatar === "object" && avatar.url) {
      if (typeof avatar.url === "string") {
        const trimmed = avatar.url.trim();
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
          return trimmed;
        }
      }
      console.warn("⚠️ [ConversationItem] Invalid avatar object:", avatar);
      return null;
    }

    console.warn("⚠️ [ConversationItem] Unknown avatar type:", typeof avatar);
    return null;
  };

  const validAvatarUri = getValidAvatarUri();
  const shouldShowImage = validAvatarUri && !imageError;

  const renderAvatar = () => {
    return (
      <View className="relative mr-4">
        <View
          className={`w-14 h-14 rounded-full border-2 border-orange-500 justify-center items-center overflow-hidden ${isDark ? "bg-gray-800" : "bg-gray-100"}`}
        >
          {shouldShowImage ? (
            <Image
              source={{ uri: validAvatarUri }}
              className="w-full h-full"
              resizeMode="cover"
              onError={(e) => {
                console.warn("❌ [ConversationItem] Image load failed:", {
                  uri: validAvatarUri?.substring(0, 50),
                  error: e.nativeEvent.error,
                });
                setImageError(true);
              }}
            />
          ) : (
            <Ionicons
              name={conversation.type === "group" ? "people" : "person"}
              size={26}
              color="#FF8C42"
            />
          )}
        </View>

        {conversation.type === "private" && conversation.isOnline && (
          <View
            className={`absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 ${isDark ? "border-black" : "border-white"}`}
          />
        )}
      </View>
    );
  };

  return (
    <TouchableOpacity
      className={`flex-row items-center px-4 py-5 active:opacity-70 ${isDark ? "bg-black" : "bg-white"}`}
      onPress={onPress}
    >
      {renderAvatar()}

      <View className="flex-1">
        <View className="flex-row justify-between items-center mb-2">
          <Text
            className={`text-base flex-1 mr-2 ${
              hasUnread
                ? `font-bold ${isDark ? "text-white" : "text-black"}`
                : `font-semibold ${isDark ? "text-white" : "text-black"}`
            }`}
            numberOfLines={1}
          >
            {conversation.name}
          </Text>
          <Text
            className={`text-xs ${
              hasUnread
                ? "text-orange-500 font-semibold"
                : isDark
                  ? "text-gray-400"
                  : "text-gray-500"
            }`}
          >
            {conversation.time}
          </Text>
        </View>

        {/* ✅ NEW: Show last seen for private chats */}
        {conversation.type === "private" && conversation.otherUserId && (
          <View className="mb-1">
            <UserLastSeen
              userId={conversation.otherUserId}
              textSize="xs"
              showDot={false}
            />
          </View>
        )}

        <View className="flex-row items-center justify-between">
          <Text
            className={`flex-1 text-sm leading-5 mr-2 ${
              hasUnread
                ? `font-semibold ${isDark ? "text-gray-100" : "text-gray-900"}`
                : isDark
                  ? "text-gray-400"
                  : "text-gray-500"
            }`}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {conversation.lastMessage}
          </Text>

          {hasUnread && (
            <View className="bg-orange-500 rounded-full min-w-[20px] h-5 px-1.5 justify-center items-center">
              <Text className="text-white text-xs font-bold">
                {conversation.unreadCount! > 99
                  ? "99+"
                  : conversation.unreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default ConversationItem;
