// mobile/components/ai/ChatSidebar.tsx - COMPLETE
import React, { memo } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ConversationPreview } from '@/lib/ai/AiAPIService';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ChatSidebarProps {
  conversations: ConversationPreview[];
  currentConversationId: string | null;
  loading: boolean;
  onSelectConversation: (conversationId: string) => void;
  onDeleteConversation: (conversationId: string) => void;
  onNewChat: () => void;
}

function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const hours = diff / (1000 * 60 * 60);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  if (hours < 48) return 'Yesterday';
  return new Date(date).toLocaleDateString();
}

function getEmotionEmoji(emotion: string): string {
  const emojiMap: Record<string, string> = {
    joy: '😊', sadness: '😢', anger: '😠', fear: '😨', surprise: '😮', neutral: '😐',
  };
  return emojiMap[emotion] || '💬';
}

const ChatSidebar = memo(function ChatSidebar({
  conversations, currentConversationId, loading, onSelectConversation, onDeleteConversation, onNewChat,
}: ChatSidebarProps) {
  const { actualTheme } = useTheme();
  const { t } = useLanguage();
  const isDark = actualTheme === 'dark';

  const handleDelete = (conversationId: string, title: string) => {
    Alert.alert(
      t('aiChat.sidebar.deleteConfirm.title') || 'Delete Chat',
      t('aiChat.sidebar.deleteConfirm.message', { title }) || `Delete "${title}"?`,
      [
        { text: t('common.cancel') || 'Cancel', style: 'cancel' },
        { text: t('common.delete') || 'Delete', style: 'destructive', onPress: () => onDeleteConversation(conversationId) },
      ]
    );
  };

  const renderConversation = ({ item }: { item: ConversationPreview }) => {
    const isActive = item.conversation_id === currentConversationId;
    return (
      <TouchableOpacity
        onPress={() => onSelectConversation(item.conversation_id)}
        onLongPress={() => handleDelete(item.conversation_id, item.title)}
        className={`p-3 mb-2 rounded-xl border ${
          isActive ? 'bg-orange-500/20 border-orange-500' : isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}
      >
        <View className="flex-row items-start justify-between mb-1">
          <Text
            className={`flex-1 font-semibold text-sm ${
              isActive ? 'text-orange-500' : isDark ? 'text-white' : 'text-gray-900'
            }`}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          {item.emotion_context?.dominant_emotion && (
            <Text className="text-base ml-2">{getEmotionEmoji(item.emotion_context.dominant_emotion)}</Text>
          )}
        </View>
        <Text className={`text-xs mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} numberOfLines={2}>
          {item.preview || 'No messages'}
        </Text>
        <View className="flex-row items-center justify-between">
          <Text className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            {formatDate(item.last_updated)}
          </Text>
          <View className="flex-row items-center gap-2">
            <View className={`px-2 py-0.5 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {item.message_count}
              </Text>
            </View>
            <TouchableOpacity onPress={() => handleDelete(item.conversation_id, item.title)} className="p-1">
              <Ionicons name="trash-outline" size={14} color={isDark ? '#9CA3AF' : '#6B7280'} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#F97316" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1">
      <View className="p-4 border-b border-gray-700">
        <TouchableOpacity
          onPress={onNewChat}
          className="flex-row items-center justify-center bg-orange-500 p-3 rounded-xl"
        >
          <Ionicons name="add" size={20} color="white" />
          <Text className="text-white font-semibold ml-2">
            {t('aiChat.sidebar.newChat') || 'New Chat'}
          </Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={conversations}
        renderItem={renderConversation}
        keyExtractor={item => item.conversation_id}
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View className="items-center justify-center py-12">
            <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
              {t('aiChat.sidebar.noChats') || 'No conversations yet'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
});

export default ChatSidebar;