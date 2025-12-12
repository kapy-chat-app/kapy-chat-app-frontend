import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";

interface FloatingRecommendationProps {
  visible: boolean;
  recommendations: string[];
  dominantEmotion: string;
  confidence?: number;
  onClose: () => void;
  onOpenAIChat: () => void;
}

export default function FloatingRecommendation({
  visible,
  recommendations,
  dominantEmotion,
  confidence = 0.5,
  onClose,
  onOpenAIChat,
}: FloatingRecommendationProps) {
  const { actualTheme } = useTheme();
  const { t } = useLanguage();
  const isDark = actualTheme === 'dark';
  const [scaleAnim] = useState(new Animated.Value(0));
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible) {
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

      const timer = setTimeout(() => {
        handleDismiss();
      }, 10000);

      return () => clearTimeout(timer);
    } else {
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
    setTimeout(() => {
      onOpenAIChat();
    }, 200);
  };

  const getIntensityKey = (conf: number) => {
    if (conf > 0.7) return 'very';
    if (conf > 0.5) return 'somewhat';
    return '';
  };

  const getEmotionMessage = (emotion: string, conf: number) => {
    const intensityKey = getIntensityKey(conf);
    const intensity = t(`conversations.floating.intensity.${intensityKey}` as any);
    
    if (emotion === 'neutral') {
      return t('conversations.floating.neutral', { count: recommendations.length });
    }
    
    return t(`conversations.floating.${emotion}` as any, { intensity });
  };

  const getEmotionEmoji = (emotion: string) => {
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

  const getBubbleColor = () => {
    const emotionColors: Record<string, { light: string; dark: string }> = {
      joy: { light: '#FEF3C7', dark: '#854D0E' },
      sadness: { light: '#DBEAFE', dark: '#1E3A8A' },
      anger: { light: '#FEE2E2', dark: '#991B1B' },
      fear: { light: '#EDE9FE', dark: '#5B21B6' },
      surprise: { light: '#FED7AA', dark: '#9A3412' },
      neutral: { light: '#FEF3C7', dark: '#854D0E' },
    };

    const colors = emotionColors[dominantEmotion] || emotionColors.neutral;
    return isDark ? colors.dark : colors.light;
  };

  const getEmotionAccentColor = () => {
    const accentColors: Record<string, string> = {
      joy: '#EAB308',
      sadness: '#3B82F6',
      anger: '#EF4444',
      fear: '#8B5CF6',
      surprise: '#F97316',
      neutral: '#F97316',
    };
    return accentColors[dominantEmotion] || '#F97316';
  };

  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={handleDismiss}>
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.15)',
            opacity: fadeAnim,
            zIndex: 999,
          }}
        />
      </TouchableWithoutFeedback>

      {/* Speech Bubble */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 60,
          right: 16,
          zIndex: 1000,
          transform: [
            { scale: scaleAnim },
            {
              translateX: scaleAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
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
          <View
            style={{
              maxWidth: 280,
              backgroundColor: getBubbleColor(),
              borderRadius: 20,
              padding: 14,
              paddingHorizontal: 16,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 10,
              elevation: 8,
              borderWidth: 2,
              borderColor: getEmotionAccentColor() + '30',
            }}
          >
            {/* Main Message Row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Text style={{ fontSize: 24, marginRight: 10 }}>
                  {getEmotionEmoji(dominantEmotion)}
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: isDark ? '#FFFFFF' : '#000000',
                    flex: 1,
                    lineHeight: 20,
                  }}
                >
                  {getEmotionMessage(dominantEmotion, confidence)}
                </Text>
              </View>

              {/* AI Badge */}
              <View style={{ 
                backgroundColor: getEmotionAccentColor() + '20',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 12,
                marginLeft: 8,
              }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: getEmotionAccentColor() }}>
                  AI
                </Text>
              </View>
            </View>

            {/* Count Badge */}
            {recommendations.length > 0 && (
              <View style={{ 
                marginTop: 10,
                alignSelf: 'flex-start',
                backgroundColor: isDark ? '#3A3A3C' : '#FFFFFF',
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
              }}>
                <Ionicons 
                  name="bulb" 
                  size={14} 
                  color={getEmotionAccentColor()} 
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: getEmotionAccentColor(),
                  }}
                >
                  {t('conversations.floating.suggestions', { count: recommendations.length })}
                </Text>
              </View>
            )}

            {/* Call-to-action */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 10,
                paddingTop: 10,
                borderTopWidth: 1,
                borderTopColor: isDark ? '#3A3A3C80' : '#D1D1D680',
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  color: getEmotionAccentColor(),
                  fontWeight: '600',
                }}
              >
                {t('conversations.floating.tapToView')}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={14}
                color={getEmotionAccentColor()}
                style={{ marginLeft: 4 }}
              />
            </View>
          </View>

          {/* Triangle Tail */}
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
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 4,
          }}
        >
          <Ionicons name="close" size={16} color={isDark ? '#FFFFFF' : '#000000'} />
        </TouchableOpacity>
      </Animated.View>
    </>
  );
}