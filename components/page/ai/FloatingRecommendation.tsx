import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  useColorScheme,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface FloatingRecommendationProps {
  visible: boolean;
  recommendations: string[];
  dominantEmotion: string;
  onClose: () => void;
  onOpenAIChat: () => void;
}

export default function FloatingRecommendation({
  visible,
  recommendations,
  dominantEmotion,
  onClose,
  onOpenAIChat,
}: FloatingRecommendationProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [scaleAnim] = useState(new Animated.Value(0));
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      // Pop in animation
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto dismiss after 10 seconds
      const timer = setTimeout(() => {
        handleDismiss();
      }, 10000);

      return () => clearTimeout(timer);
    } else {
      // Pop out animation
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const handleBubblePress = () => {
    handleDismiss();
    // Small delay before navigating
    setTimeout(() => {
      onOpenAIChat();
    }, 200);
  };

  const getEmotionIcon = (emotion: string) => {
    const iconMap: Record<string, string> = {
      sadness: '😢',
      anger: '😠',
      fear: '😨',
      joy: '😊',
      surprise: '😮',
      neutral: '😐',
    };
    return iconMap[emotion] || '💭';
  };

  const getEmotionMessage = (emotion: string) => {
    const messages: Record<string, string> = {
      sadness: 'I noticed you might be feeling down. Would you like to talk?',
      anger: 'I sense some frustration. Let me help you calm down.',
      fear: 'You seem worried. I am here to support you.',
      joy: 'Great to see you happy! Let us keep that positive energy going!',
      surprise: 'Something unexpected? Let us process it together.',
      neutral: 'How are you feeling today? I am here to chat!',
    };
    return messages[emotion] || 'I am here to support you';
  };

  const getBubbleColor = () => {
    if (isDark) {
      return '#2C2C2E'; // Dark gray for dark mode
    }
    return '#E5E5EA'; // Light gray for light mode (iMessage incoming message color)
  };

  if (!visible) return null;

  return (
    <>
      {/* Backdrop for outside tap */}
      <TouchableWithoutFeedback onPress={handleDismiss}>
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: fadeAnim,
            zIndex: 999,
          }}
        />
      </TouchableWithoutFeedback>

      {/* Speech Bubble */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 60, // Below header
          right: 16, // Aligned with AI icon
          zIndex: 1000,
          transform: [
            { scale: scaleAnim },
            {
              translateX: scaleAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            },
            {
              translateY: scaleAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-10, 0],
              }),
            },
          ],
          opacity: fadeAnim,
        }}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleBubblePress}
        >
          {/* Main Bubble */}
          <View
            style={{
              maxWidth: 280,
              backgroundColor: getBubbleColor(),
              borderRadius: 18,
              padding: 12,
              paddingHorizontal: 14,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 8,
              elevation: 5,
            }}
          >
            {/* Emotion Icon & Message */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 }}>
              <Text style={{ fontSize: 20, marginRight: 8 }}>
                {getEmotionIcon(dominantEmotion)}
              </Text>
              <Text
                style={{
                  flex: 1,
                  fontSize: 15,
                  lineHeight: 20,
                  color: isDark ? '#FFFFFF' : '#000000',
                }}
              >
                {getEmotionMessage(dominantEmotion)}
              </Text>
            </View>

            {/* First Recommendation Preview */}
            {recommendations.length > 0 && (
              <View
                style={{
                  backgroundColor: isDark ? '#3A3A3C' : '#FFFFFF',
                  borderRadius: 12,
                  padding: 10,
                  marginTop: 4,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    color: isDark ? '#E5E5EA' : '#3C3C43',
                    lineHeight: 18,
                  }}
                  numberOfLines={2}
                >
                  💡 {recommendations[0]}
                </Text>
              </View>
            )}

            {/* More count */}
            {recommendations.length > 1 && (
              <View style={{ marginTop: 8, alignItems: 'center' }}>
                <Text
                  style={{
                    fontSize: 12,
                    color: isDark ? '#8E8E93' : '#8E8E93',
                    fontWeight: '600',
                  }}
                >
                  +{recommendations.length - 1} more tips
                </Text>
              </View>
            )}

            {/* Tap to chat hint */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 8,
                paddingTop: 8,
                borderTopWidth: 1,
                borderTopColor: isDark ? '#3A3A3C' : '#D1D1D6',
              }}
            >
              <Ionicons
                name="chatbubbles"
                size={14}
                color="#F97316"
              />
              <Text
                style={{
                  fontSize: 12,
                  color: '#F97316',
                  fontWeight: '600',
                  marginLeft: 4,
                }}
              >
                Tap to chat with me
              </Text>
            </View>
          </View>

          {/* Triangle Tail (pointing to AI icon) */}
          <View
            style={{
              position: 'absolute',
              top: -8,
              right: 12,
              width: 0,
              height: 0,
              backgroundColor: 'transparent',
              borderStyle: 'solid',
              borderLeftWidth: 8,
              borderRightWidth: 8,
              borderBottomWidth: 10,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderBottomColor: getBubbleColor(),
            }}
          />
        </TouchableOpacity>

        {/* Close button */}
        <TouchableOpacity
          onPress={handleDismiss}
          style={{
            position: 'absolute',
            top: -8,
            left: -8,
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: isDark ? '#48484A' : '#C7C7CC',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.2,
            shadowRadius: 3,
            elevation: 3,
          }}
        >
          <Ionicons name="close" size={18} color={isDark ? '#FFFFFF' : '#000000'} />
        </TouchableOpacity>
      </Animated.View>
    </>
  );
}