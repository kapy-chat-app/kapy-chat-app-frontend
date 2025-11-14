// components/page/message/ReactionPicker.tsx - WITH ANIMATED IONICONS
import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface ReactionPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (reaction: string) => void;
  position?: { top: number; left: number };
}

// ✨ Icon mapping với animation khác nhau
const REACTIONS = [
  { icon: "heart", type: "heart", color: "#ef4444", animation: "bounce" },
  { icon: "thumbs-up", type: "like", color: "#3b82f6", animation: "scale" },
  { icon: "sad", type: "sad", color: "#8b5cf6", animation: "shake" },
  { icon: "flame", type: "angry", color: "#f97316", animation: "pulse" },
  { icon: "happy", type: "laugh", color: "#eab308", animation: "rotate" },
  { icon: "telescope", type: "wow", color: "#06b6d4", animation: "bounce" },
  { icon: "thumbs-down", type: "dislike", color: "#6b7280", animation: "scale" },
];

// ✨ Animation Component
const AnimatedReaction: React.FC<{
  icon: any;
  color: string;
  animationType: string;
  onPress: () => void;
  delay: number;
}> = ({ icon, color, animationType, onPress, delay }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // ✨ Entrance animation with delay
    Animated.spring(scaleAnim, {
      toValue: 1,
      delay,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();

    // ✨ Continuous animation based on type
    if (animationType === "bounce") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(bounceAnim, {
            toValue: -8,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(bounceAnim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else if (animationType === "rotate") {
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        })
      ).start();
    } else if (animationType === "pulse") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else if (animationType === "shake") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(shakeAnim, {
            toValue: 10,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(shakeAnim, {
            toValue: -10,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(shakeAnim, {
            toValue: 10,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(shakeAnim, {
            toValue: 0,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.delay(2000),
        ])
      ).start();
    }
  }, [animationType, delay]);

  const getAnimatedStyle = () => {
    const rotate = rotateAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ["0deg", "360deg"],
    });

    if (animationType === "bounce") {
      return {
        transform: [
          { scale: scaleAnim },
          { translateY: bounceAnim },
        ],
      };
    } else if (animationType === "rotate") {
      return {
        transform: [
          { scale: scaleAnim },
          { rotate },
        ],
      };
    } else if (animationType === "shake") {
      return {
        transform: [
          { scale: scaleAnim },
          { translateX: shakeAnim },
        ],
      };
    } else {
      return {
        transform: [{ scale: scaleAnim }],
      };
    }
  };

  const handlePress = () => {
    // ✨ Press animation
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.3,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => onPress());
  };

  return (
    <TouchableOpacity
      style={styles.reactionButton}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Animated.View style={getAnimatedStyle()}>
        <Ionicons name={icon as any} size={32} color={color} />
      </Animated.View>
    </TouchableOpacity>
  );
};

export const ReactionPicker: React.FC<ReactionPickerProps> = ({
  visible,
  onClose,
  onSelect,
  position,
}) => {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === "dark";
  const containerScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // ✨ Container entrance animation
      Animated.spring(containerScale, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }).start();
    } else {
      containerScale.setValue(0);
    }
  }, [visible]);

  const handleSelect = (type: string) => {
    // ✨ Exit animation
    Animated.timing(containerScale, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      onSelect(type);
      onClose();
    });
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <Animated.View
          style={[
            styles.container,
            isDark ? styles.containerDark : styles.containerLight,
            position && {
              position: "absolute",
              top: position.top,
              left: Math.max(8, Math.min(position.left, SCREEN_WIDTH - 360)),
            },
            {
              transform: [{ scale: containerScale }],
            },
          ]}
        >
          <View style={styles.reactionsRow}>
            {REACTIONS.map((reaction, index) => (
              <AnimatedReaction
                key={reaction.type}
                icon={reaction.icon}
                color={reaction.color}
                animationType={reaction.animation}
                onPress={() => handleSelect(reaction.type)}
                delay={index * 50} // Staggered entrance
              />
            ))}
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    borderRadius: 28,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  containerLight: {
    backgroundColor: "#ffffff",
  },
  containerDark: {
    backgroundColor: "#1f2937",
  },
  reactionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  reactionButton: {
    padding: 8,
    borderRadius: 20,
  },
});