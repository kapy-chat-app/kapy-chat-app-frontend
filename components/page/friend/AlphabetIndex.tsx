import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';

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
                  : 'text-gray-600 dark:text-gray-400'
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