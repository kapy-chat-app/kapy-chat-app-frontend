import React from 'react';
import {
  View,
  Text,
  useColorScheme,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Conversation {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  avatar?: string;
  unreadCount?: number;
}

interface ConversationItemProps {
  conversation: Conversation;
  onPress: () => void;
}

const ConversationItem: React.FC<ConversationItemProps> = ({ conversation, onPress }) => {
  return (
    <TouchableOpacity
      className="flex-row items-center px-4 py-5 bg-white dark:bg-black active:opacity-70"
      onPress={onPress}
    >
      <View className="w-14 h-14 rounded-full border-2 border-orange-500 justify-center items-center mr-4 bg-gray-100 dark:bg-gray-800">
        <Ionicons name="person" size={26} color="#FF8C42" />
      </View>

      <View className="flex-1">
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-base font-semibold text-black dark:text-white">
            {conversation.name}
          </Text>
          <Text className="text-xs text-gray-500 dark:text-gray-400">
            {conversation.time}
          </Text>
        </View>

        <Text 
          className="text-sm text-gray-500 dark:text-gray-400 leading-5"
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {conversation.lastMessage}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

export default ConversationItem;