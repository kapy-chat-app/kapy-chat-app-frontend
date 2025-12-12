// components/TypingIndicator.tsx - FIXED VERSION
import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, useColorScheme } from 'react-native';

interface TypingIndicatorProps {
  typingUsers: Array<{ userId: string; userName: string }>;
  onTypingStart?: () => void;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ typingUsers, onTypingStart }) => {
  console.log('🎨 TypingIndicator render, users:', typingUsers.length); // Debug log
  
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    console.log('🎨 Animation effect triggered, users:', typingUsers.length);
    
    // Stop any existing animation
    if (animationRef.current) {
      animationRef.current.stop();
      animationRef.current = null;
    }

    if (typingUsers.length === 0) {
      // Reset dots to initial position
      dot1.setValue(0);
      dot2.setValue(0);
      dot3.setValue(0);
      return;
    }

    // Notify parent to scroll when typing starts
    if (onTypingStart) {
      onTypingStart();
    }

    // Create bounce animation for each dot
    const createBounce = (animatedValue: Animated.Value, delay: number) => {
      return Animated.sequence([
        Animated.delay(delay),
        Animated.timing(animatedValue, {
          toValue: -8,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]);
    };

    // Start looped animations with staggered delays
    animationRef.current = Animated.loop(
      Animated.parallel([
        createBounce(dot1, 0),
        createBounce(dot2, 150),
        createBounce(dot3, 300),
      ])
    );

    console.log('▶️ Starting animation');
    animationRef.current.start();

    return () => {
      console.log('⏹️ Stopping animation');
      if (animationRef.current) {
        animationRef.current.stop();
      }
    };
  }, [typingUsers.length]);

  if (typingUsers.length === 0) {
    console.log('❌ No typing users - not rendering');
    return null;
  }

  const typingText =
    typingUsers.length === 1
      ? `${typingUsers[0].userName} is typing`
      : typingUsers.length === 2
      ? `${typingUsers[0].userName} and ${typingUsers[1].userName} are typing`
      : `${typingUsers[0].userName} and ${typingUsers.length - 1} others are typing`;

  console.log('✅ Rendering indicator:', typingText);

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.bubble,
          isDark ? styles.bubbleDark : styles.bubbleLight,
        ]}
      >
        <View style={styles.dotsContainer}>
          <Animated.View
            style={[
              styles.dot,
              { transform: [{ translateY: dot1 }] },
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              { transform: [{ translateY: dot2 }] },
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              { transform: [{ translateY: dot3 }] },
            ]}
          />
        </View>
        <Text
          style={[
            styles.text,
            isDark ? styles.textDark : styles.textLight,
          ]}
        >
          {typingText}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 50, // Ensure minimum height
  },
  bubble: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  bubbleLight: {
    backgroundColor: '#e5e7eb',
  },
  bubbleDark: {
    backgroundColor: '#374151',
  },
  dotsContainer: {
    flexDirection: 'row',
    marginRight: 10,
    alignItems: 'center',
    height: 20,
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f97316',
    marginHorizontal: 3,
  },
  text: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  textLight: {
    color: '#4b5563',
  },
  textDark: {
    color: '#d1d5db',
  },
});