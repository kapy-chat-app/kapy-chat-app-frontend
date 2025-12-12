// components/page/message/ConversationItem.tsx - BULLETPROOF VERSION

import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";

interface Conversation {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  avatar?: string | null | any;  // ✅ Accept any type
  unreadCount?: number;
  type?: "private" | "group";
  isOnline?: boolean;
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
  const isDark = actualTheme === 'dark';
  const hasUnread = conversation.unreadCount && conversation.unreadCount > 0;
  
  // ✅ Track image load error
  const [imageError, setImageError] = useState(false);

  // ✅ CRITICAL: Validate and extract valid URI
  const getValidAvatarUri = (): string | null => {
    const { avatar } = conversation;

    // Null or undefined
    if (avatar == null) {
      return null;
    }

    // Already a valid string
    if (typeof avatar === 'string') {
      const trimmed = avatar.trim();
      if (trimmed.length === 0) {
        return null;
      }
      // Check if it's a valid URL
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return trimmed;
      }
      // Invalid string format
      console.warn('⚠️ [ConversationItem] Invalid avatar string:', trimmed.substring(0, 50));
      return null;
    }

    // Object with url field
    if (typeof avatar === 'object' && avatar.url) {
      if (typeof avatar.url === 'string') {
        const trimmed = avatar.url.trim();
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
          return trimmed;
        }
      }
      console.warn('⚠️ [ConversationItem] Invalid avatar object:', avatar);
      return null;
    }

    // Unknown type
    console.warn('⚠️ [ConversationItem] Unknown avatar type:', typeof avatar);
    return null;
  };

  const validAvatarUri = getValidAvatarUri();
  const shouldShowImage = validAvatarUri && !imageError;

  // ✅ Render avatar with fallback
  const renderAvatar = () => {
    return (
      <View className="relative mr-4">
        <View className={`w-14 h-14 rounded-full border-2 border-orange-500 justify-center items-center overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
          {shouldShowImage ? (
            <Image 
              source={{ uri: validAvatarUri }}
              className="w-full h-full"
              resizeMode="cover"
              onError={(e) => {
                console.warn('❌ [ConversationItem] Image load failed:', {
                  uri: validAvatarUri?.substring(0, 50),
                  error: e.nativeEvent.error
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
        
        {/* Online indicator - only show for private chats */}
        {conversation.type === "private" && conversation.isOnline && (
          <View className={`absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 ${isDark ? 'border-black' : 'border-white'}`} />
        )}
      </View>
    );
  };

  return (
    <TouchableOpacity
      className={`flex-row items-center px-4 py-5 active:opacity-70 ${isDark ? 'bg-black' : 'bg-white'}`}
      onPress={onPress}
    >
      {/* Avatar */}
      {renderAvatar()}

      {/* Content */}
      <View className="flex-1">
        <View className="flex-row justify-between items-center mb-2">
          <Text 
            className={`text-base flex-1 mr-2 ${
              hasUnread 
                ? `font-bold ${isDark ? 'text-white' : 'text-black'}` 
                : `font-semibold ${isDark ? 'text-white' : 'text-black'}`
            }`}
            numberOfLines={1}
          >
            {conversation.name}
          </Text>
          <Text className={`text-xs ${
            hasUnread 
              ? "text-orange-500 font-semibold" 
              : isDark ? "text-gray-400" : "text-gray-500"
          }`}>
            {conversation.time}
          </Text>
        </View>

        <View className="flex-row items-center justify-between">
          <Text
            className={`flex-1 text-sm leading-5 mr-2 ${
              hasUnread
                ? `font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`
                : isDark ? 'text-gray-400' : 'text-gray-500'
            }`}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {conversation.lastMessage}
          </Text>

          {/* Unread badge */}
          {hasUnread && (
            <View className="bg-orange-500 rounded-full min-w-[20px] h-5 px-1.5 justify-center items-center">
              <Text className="text-white text-xs font-bold">
                {conversation.unreadCount! > 99 ? "99+" : conversation.unreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default ConversationItem;