import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface AlphabetIndexProps {
  alphabet: string[];
  onLetterPress: (letter: string) => void;
  currentLetter?: string;
}

export const AlphabetIndex: React.FC<AlphabetIndexProps> = ({
  alphabet,
  onLetterPress,
  currentLetter,
}) => {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';

  return (
    <View className="absolute right-2 top-1/2 transform -translate-y-1/2">
      <ScrollView showsVerticalScrollIndicator={false}>
        {alphabet.map((letter) => (
          <TouchableOpacity
            key={letter}
            onPress={() => onLetterPress(letter)}
            className={`py-1 px-2 ${
              currentLetter === letter ? 'bg-orange-500 rounded' : ''
            }`}
          >
            <Text
              className={`text-xs font-medium ${
                currentLetter === letter
                  ? 'text-white'
                  : isDark
                  ? 'text-gray-400'
                  : 'text-gray-600'
              }`}
            >
              {letter}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};