import { useTheme } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
import {
  Animated,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
export interface SelectOption {
  label: string;
  value: string;
  icon?: keyof typeof Ionicons.glyphMap;
  description?: string;
}

interface SingleSelectorProps {
  options: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  containerStyle?: object;
  style?: ViewStyle;
  error?: boolean;
  errorMessage?: string;
  label?: string;
  required?: boolean;
  placeholder?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  maxHeight?: number;
  renderItem?: (option: SelectOption, isSelected: boolean) => React.ReactNode;
}

const SingleSelector: React.FC<SingleSelectorProps> = ({
  options = [],
  value,
  onChange,
  containerStyle,
  style,
  error,
  errorMessage,
  label,
  required = false,
  placeholder = "Select an option",
  leftIcon = "list-outline",
  disabled = false,
  maxHeight = 200,
  renderItem,
}) => {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === "dark";
  const [isOpen, setIsOpen] = useState(false);
  const animatedHeight = useRef(new Animated.Value(0)).current;

  // Sử dụng cùng màu sắc với Input component
  const colors = {
    light: {
      background: "#FFFFFF",
      border: "#E5E5E5",
      focusedBorder: "#007AFF",
      text: "#000000",
      placeholder: "#8E8E93",
      icon: "#8E8E93",
      error: "#FF3B30",
      label: "#000000",
      disabled: "#F2F2F7",
      disabledText: "#C7C7CC",
      selectedBackground: "#007AFF",
      selectedText: "#FFFFFF",
      dropdownBackground: "#FFFFFF",
      dropdownBorder: "#E5E5E5",
    },
    dark: {
      background: "#1C1C1E",
      border: "#38383A",
      focusedBorder: "#0A84FF",
      text: "#FFFFFF",
      placeholder: "#8E8E93",
      icon: "#8E8E93",
      error: "#FF453A",
      label: "#FFFFFF",
      disabled: "#2C2C2E",
      disabledText: "#8E8E93",
      selectedBackground: "#0A84FF",
      selectedText: "#FFFFFF",
      dropdownBackground: "#1C1C1E",
      dropdownBorder: "#38383A",
    },
  };

  const currentColors = isDark ? colors.dark : colors.light;
  const selectedOption = options.find((option) => option.value === value);

  const getBorderColor = () => {
    if (error) return currentColors.error;
    if (isOpen) return currentColors.focusedBorder;
    return currentColors.border;
  };

  const toggleDropdown = () => {
    if (disabled) return;

    const toValue = isOpen ? 0 : Math.min(options.length * 50, maxHeight);
    setIsOpen(!isOpen);

    Animated.timing(animatedHeight, {
      toValue,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const handleSelectOption = (option: SelectOption) => {
    onChange?.(option.value);
    setIsOpen(false);
    Animated.timing(animatedHeight, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const renderOptionItem = ({ item }: { item: SelectOption }) => {
    const isSelected = item.value === value;

    if (renderItem) {
      return (
        <TouchableOpacity onPress={() => handleSelectOption(item)}>
          {renderItem(item, isSelected)}
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={[
          styles.optionItem,
          {
            backgroundColor: isSelected
              ? currentColors.selectedBackground
              : "transparent",
          },
        ]}
        onPress={() => handleSelectOption(item)}
        activeOpacity={0.7}
      >
        <View style={styles.optionContent}>
          {item.icon && (
            <Ionicons
              name={item.icon}
              size={18}
              color={
                isSelected ? currentColors.selectedText : currentColors.icon
              }
              style={styles.optionIcon}
            />
          )}

          <View style={styles.optionTextContainer}>
            <Text
              style={[
                styles.optionLabel,
                {
                  color: isSelected
                    ? currentColors.selectedText
                    : currentColors.text,
                },
              ]}
            >
              {item.label}
            </Text>

            {item.description && (
              <Text
                style={[
                  styles.optionDescription,
                  {
                    color: isSelected
                      ? currentColors.selectedText
                      : currentColors.placeholder,
                  },
                ]}
              >
                {item.description}
              </Text>
            )}
          </View>
        </View>

        {isSelected && (
          <Ionicons
            name="checkmark"
            size={18}
            color={currentColors.selectedText}
          />
        )}
      </TouchableOpacity>
    );
  };

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
        onPress={toggleDropdown}
        disabled={disabled}
        style={[
          styles.inputContainer,
          {
            backgroundColor: disabled
              ? currentColors.disabled
              : currentColors.background,
            borderColor: getBorderColor(),
            borderWidth: isOpen ? 2 : 1,
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
                color: selectedOption
                  ? disabled
                    ? currentColors.disabledText
                    : currentColors.text
                  : currentColors.placeholder,
              },
            ]}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </Text>

          {selectedOption?.description && (
            <Text
              style={[
                styles.description,
                {
                  color: disabled
                    ? currentColors.disabledText
                    : currentColors.placeholder,
                },
              ]}
            >
              {selectedOption.description}
            </Text>
          )}
        </View>

        <View style={styles.rightIconContainer}>
          <Ionicons
            name={isOpen ? "chevron-up-outline" : "chevron-down-outline"}
            size={16}
            color={disabled ? currentColors.disabledText : currentColors.icon}
          />
        </View>
      </TouchableOpacity>

      {/* Dropdown Options */}
      <Animated.View
        style={[
          styles.dropdown,
          {
            height: animatedHeight,
            backgroundColor: currentColors.dropdownBackground,
            borderColor: currentColors.dropdownBorder,
          },
        ]}
      >
        <FlatList
          data={options}
          renderItem={renderOptionItem}
          keyExtractor={(item) => item.value}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => (
            <View
              style={[
                styles.separator,
                { backgroundColor: currentColors.border },
              ]}
            />
          )}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Text
                style={[styles.emptyText, { color: currentColors.placeholder }]}
              >
                No options available
              </Text>
            </View>
          )}
        />
      </Animated.View>

      {error && errorMessage && (
        <Text style={[styles.errorMessage, { color: currentColors.error }]}>
          {errorMessage}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    zIndex: 1000,
  },
  labelContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
  },
  required: {
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 2,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 25, // Giống Input component
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 50,
  },
  leftIconContainer: {
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  rightIconContainer: {
    marginLeft: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  textContainer: {
    flex: 1,
    justifyContent: "center",
  },
  text: {
    fontSize: 16,
  },
  description: {
    fontSize: 12,
    marginTop: 2,
  },
  dropdown: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    marginTop: -1,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 50,
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  optionIcon: {
    marginRight: 12,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: "500",
  },
  optionDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
  },
  emptyContainer: {
    padding: 20,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
  errorMessage: {
    fontSize: 14,
    marginTop: 4,
    marginLeft: 16,
  },
});

export default SingleSelector;
