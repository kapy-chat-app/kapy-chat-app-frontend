import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  useColorScheme,
  View,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CheckboxProps {
  checked: boolean;
  onPress: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
  checkColor?: string;
  checkedBackgroundColor?: string;
  uncheckedBackgroundColor?: string;
  borderColor?: string;
  style?: object;
  labelStyle?: object;
  checkboxStyle?: object;
  labelPosition?: 'left' | 'right';
  borderRadius?: number;
  animationDuration?: number;
}

const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  onPress,
  label,
  disabled = false,
  size = 'medium',
  checkColor,
  checkedBackgroundColor,
  uncheckedBackgroundColor,
  borderColor,
  style,
  labelStyle,
  checkboxStyle,
  labelPosition = 'right',
  borderRadius = 4,
  animationDuration = 200,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Định nghĩa màu sắc cho light/dark mode
  const colors = {
    light: {
      checkedBackground: '#007AFF',
      uncheckedBackground: '#FFFFFF',
      checkColor: '#FFFFFF',
      border: '#C7C7CC',
      checkedBorder: '#007AFF',
      label: '#000000',
      disabled: {
        background: '#F2F2F7',
        border: '#E5E5EA',
        check: '#8E8E93',
        label: '#8E8E93',
      },
    },
    dark: {
      checkedBackground: '#0A84FF',
      uncheckedBackground: '#1C1C1E',
      checkColor: '#FFFFFF',
      border: '#38383A',
      checkedBorder: '#0A84FF',
      label: '#FFFFFF',
      disabled: {
        background: '#2C2C2E',
        border: '#48484A',
        check: '#48484A',
        label: '#48484A',
      },
    }
  };

  // Kích thước checkbox
  const sizes = {
    small: {
      size: 18,
      checkSize: 12,
      fontSize: 14,
      spacing: 8,
    },
    medium: {
      size: 24,
      checkSize: 16,
      fontSize: 16,
      spacing: 10,
    },
    large: {
      size: 30,
      checkSize: 20,
      fontSize: 18,
      spacing: 12,
    },
  };

  const currentColors = isDark ? colors.dark : colors.light;
  const currentSize = sizes[size];

  // Tính toán màu sắc
  const getBackgroundColor = () => {
    if (disabled) {
      return currentColors.disabled.background;
    }
    if (checked) {
      return checkedBackgroundColor || currentColors.checkedBackground;
    }
    return uncheckedBackgroundColor || currentColors.uncheckedBackground;
  };

  const getBorderColor = () => {
    if (disabled) {
      return currentColors.disabled.border;
    }
    if (checked) {
      return borderColor || currentColors.checkedBorder;
    }
    return borderColor || currentColors.border;
  };

  const getCheckColor = () => {
    if (disabled) {
      return currentColors.disabled.check;
    }
    return checkColor || currentColors.checkColor;
  };

  const getLabelColor = () => {
    if (disabled) {
      return currentColors.disabled.label;
    }
    return currentColors.label;
  };

  const handlePress = () => {
    if (!disabled) {
      onPress(!checked);
    }
  };

  const renderCheckbox = () => (
    <View
      style={[
        styles.checkbox,
        {
          width: currentSize.size,
          height: currentSize.size,
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
          borderRadius: borderRadius,
          opacity: disabled ? 0.6 : 1,
        },
        checkboxStyle,
      ]}
    >
      {checked && (
        <Ionicons
          name="checkmark"
          size={currentSize.checkSize}
          color={getCheckColor()}
          style={styles.checkIcon}
        />
      )}
    </View>
  );

  const renderLabel = () => {
    if (!label) return null;
    
    return (
      <Text
        style={[
          styles.label,
          {
            color: getLabelColor(),
            fontSize: currentSize.fontSize,
            marginLeft: labelPosition === 'right' ? currentSize.spacing : 0,
            marginRight: labelPosition === 'left' ? currentSize.spacing : 0,
          },
          labelStyle,
        ]}
      >
        {label}
      </Text>
    );
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          flexDirection: labelPosition === 'left' ? 'row-reverse' : 'row',
        },
        style,
      ]}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      {renderCheckbox()}
      {renderLabel()}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  checkbox: {
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkIcon: {
    // Icon sẽ được center tự động bởi parent container
  },
  label: {
    flex: 1,
    lineHeight: 20,
  },
});

// Thêm displayName để tránh lỗi ESLint
Checkbox.displayName = 'Checkbox';

export default Checkbox;
