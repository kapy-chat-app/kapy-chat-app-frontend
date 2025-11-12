import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';

interface TabHeaderProps {
  leftText: string;
  rightText: string;
  rightAction?: () => void;
}

export const TabHeader: React.FC<TabHeaderProps> = ({
  leftText,
  rightText,
  rightAction,
}) => {
  const { actualTheme } = useTheme();
  const { t } = useLanguage();
  const isDark = actualTheme === 'dark';

  return (
    <View className={`flex-row items-center justify-between px-4 py-3 ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
      <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
        {leftText}
      </Text>
      <TouchableOpacity
        onPress={rightAction}
        className="flex-row items-center bg-orange-500 rounded-full px-4 py-2"
      >
        <Text className="text-white font-medium mr-2">{rightText}</Text>
        <View className="w-6 h-6 bg-white rounded-full items-center justify-center">
          <Text className="text-orange-500 font-bold">→</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};