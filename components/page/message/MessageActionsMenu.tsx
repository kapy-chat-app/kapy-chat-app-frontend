// components/page/message/MessageActionsMenu.tsx
import React from 'react';
import { Dimensions, Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface MessageActionsMenuProps {
  visible: boolean;
  onClose: () => void;
  position: { top: number; right: number };
  isOwnMessage: boolean;
  hasBeenRead: boolean;
  readByCount: number;
  isDark: boolean;
  onReply: () => void;
  onReact: () => void;
  onViewReads: () => void;
  onDelete: () => void;
}

export const MessageActionsMenu: React.FC<MessageActionsMenuProps> = ({
  visible,
  onClose,
  position,
  isOwnMessage,
  hasBeenRead,
  readByCount,
  isDark,
  onReply,
  onReact,
  onViewReads,
  onDelete,
}) => {
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/30" onPress={onClose}>
        <View 
          className={`absolute rounded-xl p-1 min-w-[220px] max-w-[220px] ${isDark ? 'bg-gray-800' : 'bg-white'}`}
          style={{
            top: position.top,
            right: position.right,
            maxHeight: SCREEN_HEIGHT - 120,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          <TouchableOpacity 
            onPress={onReply} 
            className="flex-row items-center py-3.5 px-3 rounded-lg active:opacity-70"
          >
            <Ionicons name="arrow-undo" size={18} color={isDark ? '#fff' : '#1f2937'} />
            <Text className={`text-sm ml-3 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Trả lời
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={onReact} 
            className="flex-row items-center py-3.5 px-3 rounded-lg active:opacity-70"
          >
            <Ionicons name="happy-outline" size={18} color={isDark ? '#fff' : '#1f2937'} />
            <Text className={`text-sm ml-3 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Thả cảm xúc
            </Text>
          </TouchableOpacity>

          {isOwnMessage && hasBeenRead && (
            <TouchableOpacity 
              onPress={onViewReads} 
              className="flex-row items-center py-3.5 px-3 rounded-lg active:opacity-70"
            >
              <Ionicons name="eye-outline" size={18} color={isDark ? '#10b981' : '#059669'} />
              <Text className="text-sm ml-3 font-medium text-green-600 dark:text-green-500">
                Xem ai đã đọc ({readByCount})
              </Text>
            </TouchableOpacity>
          )}

          {isOwnMessage && (
            <TouchableOpacity 
              onPress={onDelete} 
              className="flex-row items-center py-3.5 px-3 rounded-lg active:opacity-70"
            >
              <Ionicons name="trash-outline" size={18} color="#ef4444" />
              <Text className="text-sm ml-3 font-medium text-red-500">Xóa</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            onPress={onClose} 
            className="flex-row items-center py-3.5 px-3 rounded-lg active:opacity-70 border-t border-gray-200 dark:border-gray-700 mt-1"
          >
            <Ionicons name="close-circle-outline" size={18} color="#6b7280" />
            <Text className="text-sm ml-3 font-medium text-gray-500">Hủy</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
};