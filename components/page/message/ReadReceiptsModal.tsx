// components/page/message/ReadReceiptsModal.tsx
import React from 'react';
import { Dimensions, FlatList, Image, Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import * as Haptics from 'expo-haptics';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ReadReceiptsModalProps {
  visible: boolean;
  onClose: () => void;
  readBy: any[];
  isDark: boolean;
}

export const ReadReceiptsModal: React.FC<ReadReceiptsModalProps> = ({
  visible,
  onClose,
  readBy,
  isDark,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onShow={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
    >
      <View className="flex-1 bg-black/50">
        <Pressable className="flex-1" onPress={onClose} />
        
        <View 
          className={`rounded-t-3xl ${isDark ? 'bg-gray-900' : 'bg-white'}`}
          style={{ maxHeight: SCREEN_HEIGHT * 0.7 }}
        >
          <View className="items-center py-4 px-5 border-b border-gray-200 dark:border-gray-800">
            <View className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mb-3" />
            <Text className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Đã đọc bởi {readBy.length} người
            </Text>
            <TouchableOpacity onPress={onClose} className="absolute right-4 top-4 p-1">
              <Ionicons name="close" size={24} color={isDark ? '#fff' : '#000'} />
            </TouchableOpacity>
          </View>

          {readBy.length === 0 ? (
            <View className="items-center justify-center py-20">
              <Ionicons name="eye-off-outline" size={48} color="#9ca3af" />
              <Text className="text-gray-400 text-sm mt-3">Chưa ai đọc tin nhắn này</Text>
            </View>
          ) : (
            <FlatList
              data={readBy}
              keyExtractor={(item, index) => `${item.user}-${index}`}
              renderItem={({ item }) => (
                <View className={`flex-row items-center py-3 px-3 rounded-xl mx-4 mb-2 ${
                  isDark ? 'bg-gray-800' : 'bg-gray-50'
                }`}>
                  {item.userInfo?.avatar ? (
                    <Image source={{ uri: item.userInfo.avatar }} className="w-11 h-11 rounded-full mr-3" />
                  ) : (
                    <View className="w-11 h-11 rounded-full bg-orange-500 items-center justify-center mr-3">
                      <Ionicons name="person" size={20} color="#fff" />
                    </View>
                  )}

                  <View className="flex-1">
                    <Text className={`text-base font-semibold mb-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {item.userInfo?.full_name || 'Unknown User'}
                    </Text>
                    <Text className="text-gray-500 text-sm">
                      @{item.userInfo?.username || 'unknown'}
                    </Text>
                  </View>

                  <View className="flex-row items-center">
                    <Ionicons name="checkmark-done" size={16} color="#10b981" />
                    <Text className="text-green-500 text-xs ml-1 font-medium">
                      {formatDistanceToNow(new Date(item.read_at), { addSuffix: true })}
                    </Text>
                  </View>
                </View>
              )}
              contentContainerClassName="pt-2 pb-5"
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};