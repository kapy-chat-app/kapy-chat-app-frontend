import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";

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
  const hasUnread = conversation.unreadCount && conversation.unreadCount > 0;

  return (
    <TouchableOpacity
      className="flex-row items-center px-4 py-5 bg-white dark:bg-black active:opacity-70"
      onPress={onPress}
    >
      {/* Avatar with online status */}
      <View className="relative mr-4">
        <View className="w-14 h-14 rounded-full border-2 border-orange-500 justify-center items-center bg-gray-100 dark:bg-gray-800 overflow-hidden">
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
          <View className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-black" />
        )}
      </View>

      {/* Content */}
      <View className="flex-1">
        <View className="flex-row justify-between items-center mb-2">
          <Text 
            className={`text-base flex-1 mr-2 ${
              hasUnread 
                ? "font-bold text-black dark:text-white" 
                : "font-semibold text-black dark:text-white"
            }`}
            numberOfLines={1}
          >
            {conversation.name}
          </Text>
          <Text className={`text-xs ${
            hasUnread 
              ? "text-orange-500 font-semibold" 
              : "text-gray-500 dark:text-gray-400"
          }`}>
            {conversation.time}
          </Text>
        </View>

        <View className="flex-row items-center justify-between">
          <Text
            className={`flex-1 text-sm leading-5 mr-2 ${
              hasUnread
                ? "font-semibold text-gray-900 dark:text-gray-100"
                : "text-gray-500 dark:text-gray-400"
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
                {conversation?.unreadCount > 99 ? "99+" : conversation.unreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default ConversationItem;