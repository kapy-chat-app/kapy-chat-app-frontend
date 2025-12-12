import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'text';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  style?: object;
  textStyle?: object;
  fullWidth?: boolean;
  borderRadius?: number;
}

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  leftIcon,
  rightIcon,
  style,
  textStyle,
  fullWidth = false,
  borderRadius = 25,
}) => {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';

  // Định nghĩa màu sắc cho light/dark mode
  const colors = {
    light: {
      primary: {
        background: '#FF8C42', // Orange như trong hình
        text: '#FFFFFF',
        border: '#FF8C42',
      },
      secondary: {
        background: '#F2F2F7',
        text: '#000000',
        border: '#F2F2F7',
      },
      outline: {
        background: 'transparent',
        text: '#FF8C42',
        border: '#FF8C42',
      },
      text: {
        background: 'transparent',
        text: '#FF8C42',
        border: 'transparent',
      },
      disabled: {
        background: '#E5E5EA',
        text: '#8E8E93',
        border: '#E5E5EA',
      },
    },
    dark: {
      primary: {
        background: '#FF8C42', // Giữ nguyên màu orange trong dark mode
        text: '#FFFFFF',
        border: '#FF8C42',
      },
      secondary: {
        background: '#1C1C1E',
        text: '#FFFFFF',
        border: '#1C1C1E',
      },
      outline: {
        background: 'transparent',
        text: '#FF8C42',
        border: '#FF8C42',
      },
      text: {
        background: 'transparent',
        text: '#FF8C42',
        border: 'transparent',
      },
      disabled: {
        background: '#2C2C2E',
        text: '#48484A',
        border: '#2C2C2E',
      },
    }
  };

  // Kích thước button
  const sizes = {
    small: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      fontSize: 14,
      minHeight: 36,
    },
    medium: {
      paddingVertical: 12,
      paddingHorizontal: 24,
      fontSize: 16,
      minHeight: 50,
    },
    large: {
      paddingVertical: 16,
      paddingHorizontal: 32,
      fontSize: 18,
      minHeight: 56,
    },
  };

  const currentColors = isDark ? colors.dark : colors.light;
  const currentVariant = disabled ? 'disabled' : variant;
  const buttonColors = currentColors[currentVariant];
  const buttonSize = sizes[size];

  const handlePress = () => {
    if (!disabled && !loading) {
      onPress();
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: buttonColors.background,
          borderColor: buttonColors.border,
          borderWidth: variant === 'outline' ? 1 : 0,
          paddingVertical: buttonSize.paddingVertical,
          paddingHorizontal: buttonSize.paddingHorizontal,
          minHeight: buttonSize.minHeight,
          borderRadius: borderRadius,
          width: fullWidth ? '100%' : undefined,
          opacity: disabled ? 0.6 : 1,
        },
        style,
      ]}
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={buttonColors.text}
            style={styles.loader}
          />
        ) : (
          <>
            {leftIcon && (
              <Ionicons
                name={leftIcon}
                size={buttonSize.fontSize}
                color={buttonColors.text}
                style={styles.leftIcon}
              />
            )}
            
            <Text
              style={[
                styles.text,
                {
                  color: buttonColors.text,
                  fontSize: buttonSize.fontSize,
                  fontWeight: variant === 'primary' ? '600' : '500',
                },
                textStyle,
              ]}
            >
              {title}
            </Text>
            
            {rightIcon && (
              <Ionicons
                name={rightIcon}
                size={buttonSize.fontSize}
                color={buttonColors.text}
                style={styles.rightIcon}
              />
            )}
          </>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 25,
    elevation: 2, // Android shadow
    shadowColor: '#000', // iOS shadow
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    textAlign: 'center',
    fontWeight: '500',
  },
  leftIcon: {
    marginRight: 8,
  },
  rightIcon: {
    marginLeft: 8,
  },
  loader: {
    marginHorizontal: 8,
  },
});

// Thêm displayName để tránh lỗi ESLint
Button.displayName = 'Button';

export default Button;