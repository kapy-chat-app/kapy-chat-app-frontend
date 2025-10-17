// components/emotion/FilterModal.tsx
import React from 'react';
import { View, Text, TouchableOpacity, Modal, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  filters: {
    context?: string;
    days: number;
  };
  updateFilters: (filters: any) => void;
  clearFilters: () => void;
}

export const FilterModal: React.FC<FilterModalProps> = ({
  visible,
  onClose,
  filters,
  updateFilters,
  clearFilters,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Map contexts to Vietnamese
  const contextMap: Record<string, string> = {
    message: "Tin nhắn",
    voice_note: "Ghi âm",
    call: "Cuộc gọi",
    general: "Chung",
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50 justify-end">
        <View className={`rounded-t-3xl p-5 max-h-[80%] ${isDark ? 'bg-black' : 'bg-white'}`}>
          {/* Header */}
          <View className="flex-row justify-between items-center mb-5">
            <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Bộ lọc
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={isDark ? '#fff' : '#333'} />
            </TouchableOpacity>
          </View>

          {/* Context Filter */}
          <View className="mb-6">
            <Text className={`text-base font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Ngữ cảnh
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {['message', 'voice_note', 'call', 'general'].map((ctx) => (
                <TouchableOpacity
                  key={ctx}
                  className={`px-4 py-2 rounded-full border ${
                    filters.context === ctx
                      ? 'bg-[#F57206] border-[#F57206]'
                      : isDark
                      ? 'bg-gray-800 border-gray-700'
                      : 'bg-gray-100 border-gray-300'
                  }`}
                  onPress={() => updateFilters({ context: ctx as any })}
                >
                  <Text
                    className={`text-sm ${
                      filters.context === ctx
                        ? 'text-white font-semibold'
                        : isDark
                        ? 'text-gray-400'
                        : 'text-gray-600'
                    }`}
                  >
                    {contextMap[ctx]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Time Range Filter */}
          <View className="mb-6">
            <Text className={`text-base font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Khoảng thời gian
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {[7, 14, 30, 90].map((days) => (
                <TouchableOpacity
                  key={days}
                  className={`px-4 py-2 rounded-full border ${
                    filters.days === days
                      ? 'bg-[#F57206] border-[#F57206]'
                      : isDark
                      ? 'bg-gray-800 border-gray-700'
                      : 'bg-gray-100 border-gray-300'
                  }`}
                  onPress={() => updateFilters({ days })}
                >
                  <Text
                    className={`text-sm ${
                      filters.days === days
                        ? 'text-white font-semibold'
                        : isDark
                        ? 'text-gray-400'
                        : 'text-gray-600'
                    }`}
                  >
                    {days} ngày
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Actions */}
          <View className="flex-row gap-3 mt-5">
            <TouchableOpacity
              className={`flex-1 py-3 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}
              onPress={() => {
                clearFilters();
                onClose();
              }}
            >
              <Text className={`text-base font-semibold text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Xóa bộ lọc
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              className="flex-1 py-3 rounded-lg bg-[#F57206]"
              onPress={onClose}
            >
              <Text className="text-base font-semibold text-center text-white">
                Áp dụng
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};