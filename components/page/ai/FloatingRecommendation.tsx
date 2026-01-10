import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  TouchableWithoutFeedback,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { EmotionCounselingData } from "@/hooks/ai/useEmotion";

interface FloatingRecommendationProps {
  visible: boolean;
  counselingData: EmotionCounselingData | null;
  loading?: boolean;
  onClose: () => void;
  onViewFull: () => void;
}

export default function FloatingRecommendation({
  visible,
  counselingData,
  loading = false,
  onClose,
  onViewFull,
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

  const handleViewFull = () => {
    handleDismiss();
    setTimeout(() => {
      onViewFull();
    }, 200);
  };

  const getEmotionEmoji = (emotion?: string) => {
    if (!emotion) return '😐';
    const iconMap: Record<string, string> = {
      sadness: '😢',
      anger: '😠',
      fear: '😨',
      joy: '😊',
      surprise: '😮',
      neutral: '😐',
      happy: '😊',
      sad: '😢',
      anxious: '😰',
      stressed: '😫',
    };
    return iconMap[emotion.toLowerCase()] || '💭';
  };

  const getBubbleColor = (emotion?: string) => {
    if (!emotion) {
      return isDark ? '#854D0E' : '#FEF3C7';
    }

    const emotionColors: Record<string, { light: string; dark: string }> = {
      joy: { light: '#FEF3C7', dark: '#854D0E' },
      happy: { light: '#FEF3C7', dark: '#854D0E' },
      sadness: { light: '#DBEAFE', dark: '#1E3A8A' },
      sad: { light: '#DBEAFE', dark: '#1E3A8A' },
      anger: { light: '#FEE2E2', dark: '#991B1B' },
      fear: { light: '#EDE9FE', dark: '#5B21B6' },
      anxious: { light: '#EDE9FE', dark: '#5B21B6' },
      surprise: { light: '#FED7AA', dark: '#9A3412' },
      stressed: { light: '#FEE2E2', dark: '#991B1B' },
      neutral: { light: '#FEF3C7', dark: '#854D0E' },
    };

    const colors = emotionColors[emotion.toLowerCase()] || emotionColors.neutral;
    return isDark ? colors.dark : colors.light;
  };

  const getEmotionAccentColor = (emotion?: string) => {
    if (!emotion) return '#F97316';

    const accentColors: Record<string, string> = {
      joy: '#EAB308',
      happy: '#EAB308',
      sadness: '#3B82F6',
      sad: '#3B82F6',
      anger: '#EF4444',
      fear: '#8B5CF6',
      anxious: '#8B5CF6',
      surprise: '#F97316',
      stressed: '#EF4444',
      neutral: '#F97316',
    };
    return accentColors[emotion.toLowerCase()] || '#F97316';
  };

  if (!visible) return null;

  const dominantEmotion = counselingData?.emotion_analysis?.dominant_emotion;
  const recommendations = counselingData?.recommendations || [];
  const hasRecommendations = recommendations.length > 0;

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
          onPress={handleViewFull}
        >
          <View
            style={{
              maxWidth: 320,
              backgroundColor: getBubbleColor(dominantEmotion),
              borderRadius: 20,
              padding: 16,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 10,
              elevation: 8,
              borderWidth: 2,
              borderColor: getEmotionAccentColor(dominantEmotion) + '30',
            }}
          >
            {loading ? (
              // Loading State
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
                <ActivityIndicator size="small" color={getEmotionAccentColor(dominantEmotion)} />
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: isDark ? '#FFFFFF' : '#000000',
                    marginLeft: 12,
                  }}
                >
                  {t('emotion.counselor.loading')}
                </Text>
              </View>
            ) : !counselingData ? (
              // No Data State
              <View style={{ paddingVertical: 12 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: isDark ? '#FFFFFF' : '#000000',
                    textAlign: 'center',
                  }}
                >
                  {t('emotion.counselor.noData')}
                </Text>
              </View>
            ) : (
              <>
                {/* Header with Emotion */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <Text style={{ fontSize: 28, marginRight: 10 }}>
                      {getEmotionEmoji(dominantEmotion)}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: '700',
                          color: isDark ? '#FFFFFF' : '#000000',
                        }}
                      >
                        {t('emotion.counselor.title')}
                      </Text>
                      {dominantEmotion && (
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '500',
                            color: isDark ? '#D1D5DB' : '#6B7280',
                            marginTop: 2,
                          }}
                        >
                          {dominantEmotion.charAt(0).toUpperCase() + dominantEmotion.slice(1)}
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* AI Badge */}
                  <View style={{ 
                    backgroundColor: getEmotionAccentColor(dominantEmotion) + '20',
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 12,
                    marginLeft: 8,
                  }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: getEmotionAccentColor(dominantEmotion) }}>
                      AI
                    </Text>
                  </View>
                </View>

                {/* Summary */}
                {counselingData.summary && (
                  <Text
                    style={{
                      fontSize: 13,
                      color: isDark ? '#E5E7EB' : '#374151',
                      lineHeight: 18,
                      marginBottom: 12,
                    }}
                    numberOfLines={3}
                  >
                    {counselingData.summary}
                  </Text>
                )}

                {/* Recommendations Preview */}
                {hasRecommendations && (
                  <View style={{ 
                    backgroundColor: isDark ? '#3A3A3C' : '#FFFFFF',
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: 12,
                    marginBottom: 10,
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                      <Ionicons 
                        name="bulb" 
                        size={16} 
                        color={getEmotionAccentColor(dominantEmotion)} 
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '700',
                          color: getEmotionAccentColor(dominantEmotion),
                        }}
                      >
                        {t('emotion.counselor.recommendations')} ({recommendations.length})
                      </Text>
                    </View>
                    
                    <ScrollView 
                      style={{ maxHeight: 80 }}
                      showsVerticalScrollIndicator={false}
                    >
                      {recommendations.slice(0, 2).map((rec, index) => (
                        <Text
                          key={index}
                          style={{
                            fontSize: 12,
                            color: isDark ? '#D1D5DB' : '#6B7280',
                            lineHeight: 16,
                            marginBottom: index < 1 ? 6 : 0,
                          }}
                          numberOfLines={2}
                        >
                          • {rec}
                        </Text>
                      ))}
                      {recommendations.length > 2 && (
                        <Text
                          style={{
                            fontSize: 11,
                            color: getEmotionAccentColor(dominantEmotion),
                            fontWeight: '600',
                            marginTop: 4,
                          }}
                        >
                          +{recommendations.length - 2} {t('emotion.counselor.more')}
                        </Text>
                      )}
                    </ScrollView>
                  </View>
                )}

                {/* Call-to-action */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingTop: 12,
                    borderTopWidth: 1,
                    borderTopColor: isDark ? '#3A3A3C80' : '#D1D1D680',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      color: getEmotionAccentColor(dominantEmotion),
                      fontWeight: '600',
                    }}
                  >
                    {t('emotion.counselor.viewFull')}
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={getEmotionAccentColor(dominantEmotion)}
                    style={{ marginLeft: 4 }}
                  />
                </View>
              </>
            )}
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
              borderBottomColor: getBubbleColor(dominantEmotion),
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