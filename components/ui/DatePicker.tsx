import React, { useState } from 'react';
import {
  View,
  useColorScheme,
  TouchableOpacity,
  Text,
  Platform,
  Modal,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

interface DatePickerProps {
  value?: Date;
  onChange?: (date: Date) => void;
  containerStyle?: object;
  style?: ViewStyle;
  error?: boolean;
  errorMessage?: string;
  label?: string;
  required?: boolean;
  placeholder?: string;
  mode?: 'date' | 'time' | 'datetime';
  minimumDate?: Date;
  maximumDate?: Date;
  format?: 'short' | 'long' | 'medium' | 'full';
  leftIcon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
}

const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  containerStyle,
  style,
  error,
  errorMessage,
  label,
  required = false,
  placeholder = "Select date",
  mode = 'date',
  minimumDate,
  maximumDate,
  format = 'medium',
  leftIcon = 'calendar-outline',
  disabled = false,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState(value || new Date());

  // Sử dụng cùng màu sắc với Input component
  const colors = {
    light: {
      background: '#FFFFFF',
      border: '#E5E5E5',
      focusedBorder: '#007AFF',
      text: '#000000',
      placeholder: '#8E8E93',
      icon: '#8E8E93',
      error: '#FF3B30',
      label: '#000000',
      disabled: '#F2F2F7',
      disabledText: '#C7C7CC',
    },
    dark: {
      background: '#1C1C1E',
      border: '#38383A',
      focusedBorder: '#0A84FF',
      text: '#FFFFFF',
      placeholder: '#8E8E93',
      icon: '#8E8E93',
      error: '#FF453A',
      label: '#FFFFFF',
      disabled: '#2C2C2E',
      disabledText: '#8E8E93',
    }
  };

  const currentColors = isDark ? colors.dark : colors.light;

  const formatDate = (date: Date) => {
    if (!date) return '';
    
    const options: Intl.DateTimeFormatOptions = {};
    
    switch (format) {
      case 'short':
        options.day = '2-digit';
        options.month = '2-digit';
        options.year = 'numeric';
        break;
      case 'long':
        options.weekday = 'long';
        options.day = 'numeric';
        options.month = 'long';
        options.year = 'numeric';
        break;
      case 'full':
        options.weekday = 'long';
        options.day = 'numeric';
        options.month = 'long';
        options.year = 'numeric';
        if (mode === 'time' || mode === 'datetime') {
          options.hour = '2-digit';
          options.minute = '2-digit';
        }
        break;
      default: // medium
        options.day = 'numeric';
        options.month = 'short';
        options.year = 'numeric';
        if (mode === 'time' || mode === 'datetime') {
          options.hour = '2-digit';
          options.minute = '2-digit';
        }
    }

    if (mode === 'time') {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    return date.toLocaleDateString('en-US', options);
  };

  const getBorderColor = () => {
    if (error) return currentColors.error;
    return currentColors.border;
  };

  const handlePress = () => {
    if (disabled) return;
    setTempDate(value || new Date());
    setShowPicker(true);
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    
    if (selectedDate) {
      setTempDate(selectedDate);
      if (Platform.OS === 'android') {
        onChange?.(selectedDate);
      }
    }
  };

  const handleConfirm = () => {
    onChange?.(tempDate);
    setShowPicker(false);
  };

  const handleCancel = () => {
    setShowPicker(false);
  };

  const renderIOSPicker = () => (
    <Modal
      visible={showPicker}
      transparent
      animationType="slide"
    >
      <View style={styles.modalOverlay}>
        <View style={[
          styles.modalContainer,
          { backgroundColor: currentColors.background }
        ]}>
          <View style={[
            styles.modalHeader,
            { borderBottomColor: currentColors.border }
          ]}>
            <TouchableOpacity onPress={handleCancel}>
              <Text style={[styles.modalButton, { color: currentColors.icon }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleConfirm}>
              <Text style={[styles.modalButton, { color: currentColors.focusedBorder }]}>
                Done
              </Text>
            </TouchableOpacity>
          </View>
          <DateTimePicker
            value={tempDate}
            mode={mode}
            display="spinner"
            onChange={handleDateChange}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            themeVariant={isDark ? 'dark' : 'light'}
          />
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <View style={styles.labelContainer}>
          <Text style={[styles.label, { color: currentColors.label }]}>
            {label}
          </Text>
          {required && (
            <Text style={[styles.required, { color: currentColors.error }]}>
              *
            </Text>
          )}
        </View>
      )}
      
      <TouchableOpacity
        onPress={handlePress}
        disabled={disabled}
        style={[
          styles.inputContainer,
          {
            backgroundColor: disabled ? currentColors.disabled : currentColors.background,
            borderColor: getBorderColor(),
          },
          style,
        ]}
        activeOpacity={0.7}
      >
        {leftIcon && (
          <View style={styles.leftIconContainer}>
            <Ionicons
              name={leftIcon}
              size={20}
              color={disabled ? currentColors.disabledText : currentColors.icon}
            />
          </View>
        )}
        
        <View style={styles.textContainer}>
          <Text
            style={[
              styles.text,
              {
                color: value 
                  ? (disabled ? currentColors.disabledText : currentColors.text)
                  : currentColors.placeholder,
              },
            ]}
          >
            {value ? formatDate(value) : placeholder}
          </Text>
        </View>
        
        <View style={styles.rightIconContainer}>
          <Ionicons
            name="chevron-down-outline"
            size={16}
            color={disabled ? currentColors.disabledText : currentColors.icon}
          />
        </View>
      </TouchableOpacity>
      
      {error && errorMessage && (
        <Text style={[styles.errorMessage, { color: currentColors.error }]}>
          {errorMessage}
        </Text>
      )}

      {Platform.OS === 'ios' ? (
        renderIOSPicker()
      ) : (
        showPicker && (
          <DateTimePicker
            value={tempDate}
            mode={mode}
            display="default"
            onChange={handleDateChange}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
          />
        )
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
  },
  required: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 25, // Giống Input component
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 50,
  },
  leftIconContainer: {
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightIconContainer: {
    marginLeft: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  text: {
    fontSize: 16,
  },
  errorMessage: {
    fontSize: 14,
    marginTop: 4,
    marginLeft: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalButton: {
    fontSize: 16,
    fontWeight: '500',
  },
});

export default DatePicker;