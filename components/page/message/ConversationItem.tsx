import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";

interface Conversation {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  avatar?: string;
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

  return (
    <TouchableOpacity
      className={`flex-row items-center px-4 py-5 active:opacity-70 ${isDark ? 'bg-black' : 'bg-white'}`}
      onPress={onPress}
    >
      {/* Avatar with online status */}
      <View className="relative mr-4">
        <View className={`w-14 h-14 rounded-full border-2 border-orange-500 justify-center items-center overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
          {conversation.avatar ? (
            <Image 
              source={{ uri: conversation.avatar }}
              className="w-full h-full"
              resizeMode="cover"
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
                {conversation?.unreadCount! > 99 ? "99+" : conversation.unreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default ConversationItem;