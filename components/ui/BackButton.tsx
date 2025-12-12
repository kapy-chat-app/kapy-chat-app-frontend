import React from 'react';
import { TouchableOpacity, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

interface BackButtonProps {
  onPress?: () => void;
  color?: string;
  size?: number;
  style?: object;
  disabled?: boolean;
}

const BackButton: React.FC<BackButtonProps> = ({
  onPress,
  color,
  size = 24,
  style,
  disabled = false,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const defaultColor = color || (isDark ? 'white' : 'black');

  const handlePress = () => {
    if (disabled) return;
    
    if (onPress) {
      onPress();
    } else {
      router.back();
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled}
      style={[
        {
          padding: 8,
          borderRadius: 8,
          alignItems: 'center',
          justifyContent: 'center',
        },
        disabled && { opacity: 0.5 },
        style,
      ]}
      activeOpacity={0.7}
    >
      <Ionicons
        name="arrow-back"
        size={size}
        color={disabled ? (isDark ? '#6B7280' : '#9CA3AF') : defaultColor}
      />
    </TouchableOpacity>
  );
};

BackButton.displayName = 'BackButton';

export default BackButton;