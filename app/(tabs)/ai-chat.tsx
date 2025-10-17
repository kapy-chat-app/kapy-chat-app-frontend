/* eslint-disable react/no-unescaped-entities */
// app/(root)/ai-chat.tsx - AUTO SHOW RECOMMENDATIONS ON ENTER
import Header from "@/components/shared/Header";
import { useChatbot } from "@/hooks/ai/useChatbot";
import { useEmotion } from "@/hooks/ai/useEmotion";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState, useCallback, useMemo, memo } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ============================================
// TYPES
// ============================================
interface MessageBubbleProps {
  item: any;
  index: number;
  isDark: boolean;
  getEmotionEmoji: (emotion?: string) => string;
  getEmotionColor: (emotion?: string) => string;
}

interface TypingIndicatorProps {
  isDark: boolean;
}

interface SuggestionItemProps {
  suggestion: string;
  index: number;
  isDark: boolean;
  emotionColor: string;
  onPress: () => void;
}

// ============================================
// MEMOIZED COMPONENTS
// ============================================

const MessageBubble = memo(function MessageBubble({ 
  item, 
  index, 
  isDark, 
  getEmotionEmoji, 
  getEmotionColor 
}: MessageBubbleProps) {
  const isUser = item.role === "user";
  const emoji = getEmotionEmoji(item.emotion);
  const emotionColor = getEmotionColor(item.emotion);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(isUser ? 50 : -50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 50,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        delay: index * 50,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [index]);

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateX: slideAnim }],
      }}
      className={`flex-row mb-4 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser && (
        <View
          className="w-10 h-10 rounded-full bg-orange-500 items-center justify-center mr-2.5"
          style={{
            shadowColor: "#F97316",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            elevation: 5,
          }}
        >
          <Text className="text-lg">🤖</Text>
        </View>
      )}

      <View className={`max-w-[75%] ${isUser ? "items-end" : "items-start"}`}>
        <View
          className={`rounded-3xl px-5 py-3.5 ${
            isUser
              ? "bg-orange-500"
              : isDark
              ? "bg-gray-800 border border-gray-700"
              : "bg-white border border-gray-100"
          }`}
          style={
            isUser
              ? {
                  shadowColor: "#F97316",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.25,
                  shadowRadius: 3.84,
                  elevation: 5,
                }
              : {
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.1,
                  shadowRadius: 2,
                  elevation: 2,
                }
          }
        >
          <Text
            className={`text-[15px] leading-5 ${
              isUser ? "text-white" : isDark ? "text-gray-100" : "text-gray-800"
            }`}
          >
            {item.content}
          </Text>
        </View>

        {item.emotion && (
          <View className="flex-row items-center mt-2 px-2">
            <Text className="text-xs mr-1.5">{emoji}</Text>
            <Text
              className="text-xs font-medium capitalize"
              style={{ color: emotionColor }}
            >
              {item.emotion}
            </Text>
          </View>
        )}

        <Text
          className={`text-[11px] mt-1.5 px-2 ${
            isDark ? "text-gray-500" : "text-gray-400"
          }`}
        >
          {new Date(item.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>

      {isUser && (
        <View
          className="w-10 h-10 rounded-full bg-blue-500 items-center justify-center ml-2.5"
          style={{
            shadowColor: "#3B82F6",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            elevation: 5,
          }}
        >
          <Ionicons name="person" size={18} color="white" />
        </View>
      )}
    </Animated.View>
  );
});

const TypingIndicator = memo(function TypingIndicator({ isDark }: { isDark: boolean }) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createAnimation = (value: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, {
            toValue: -8,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const animations = [
      createAnimation(dot1, 0),
      createAnimation(dot2, 150),
      createAnimation(dot3, 300),
    ];

    Animated.parallel(animations).start();
  }, []);

  return (
    <View className="flex-row items-center mb-4">
      <View className="w-10 h-10 rounded-full bg-orange-500 items-center justify-center mr-2.5">
        <Text className="text-lg">🤖</Text>
      </View>
      <View
        className={`rounded-3xl px-5 py-4 ${
          isDark ? "bg-gray-800" : "bg-white border border-gray-100"
        }`}
      >
        <View className="flex-row gap-1.5">
          <Animated.View
            style={{ transform: [{ translateY: dot1 }] }}
            className="w-2 h-2 rounded-full bg-orange-500"
          />
          <Animated.View
            style={{ transform: [{ translateY: dot2 }] }}
            className="w-2 h-2 rounded-full bg-orange-500"
          />
          <Animated.View
            style={{ transform: [{ translateY: dot3 }] }}
            className="w-2 h-2 rounded-full bg-orange-500"
          />
        </View>
      </View>
    </View>
  );
});

const SuggestionItem = memo(function SuggestionItem({
  suggestion,
  index,
  isDark,
  emotionColor,
  onPress,
}: SuggestionItemProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 100,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        delay: index * 100,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [index]);

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}
    >
      <TouchableOpacity
        onPress={onPress}
        className={`p-4 rounded-2xl border-l-4 ${
          isDark
            ? "bg-gray-800 border-gray-700"
            : "bg-white border-gray-200"
        }`}
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 2,
          elevation: 1,
          borderLeftColor: emotionColor,
        }}
      >
        <View className="flex-row items-start">
          <Text className="text-base mr-2">💡</Text>
          <Text
            className={`flex-1 text-sm leading-5 ${
              isDark ? "text-gray-300" : "text-gray-700"
            }`}
          >
            {suggestion}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ============================================
// MAIN COMPONENT
// ============================================

export default function AIChatbotScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const router = useRouter();
  const params = useLocalSearchParams();
  const flatListRef = useRef<FlatList>(null);

  const [inputText, setInputText] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [currentEmotion, setCurrentEmotion] = useState<string>("");
  const [emotionConfidence, setEmotionConfidence] = useState<number>(0);

  const hasLoadedRecommendations = useRef(false);
  const hasAutoSentRecommendations = useRef(false);

  const { messages, sendMessage, loading, typing, error } = useChatbot();
  const { getRecommendations, loading: emotionLoading } = useEmotion();

  // ✅ MEMOIZED FUNCTIONS
  const getEmotionEmoji = useCallback((emotion?: string) => {
    const emojiMap: Record<string, string> = {
      joy: "😊",
      sadness: "😢",
      anger: "😠",
      fear: "😨",
      surprise: "😮",
      neutral: "😐",
    };
    return emotion ? emojiMap[emotion] || "💬" : "💬";
  }, []);

  const getEmotionColor = useCallback((emotion?: string) => {
    const colorMap: Record<string, string> = {
      joy: "#10B981",
      sadness: "#3B82F6",
      anger: "#EF4444",
      fear: "#8B5CF6",
      surprise: "#F59E0B",
      neutral: "#6B7280",
    };
    return emotion ? colorMap[emotion] || "#6B7280" : "#6B7280";
  }, []);

  const loadRecommendationsInternal = useCallback(async () => {
    const data = await getRecommendations();
    
    if (data?.recommendations) {
      setRecommendations(data.recommendations);
      
      if (data.based_on?.dominant_pattern) {
        setCurrentEmotion(data.based_on.dominant_pattern);
      }
      if (data.based_on?.confidence) {
        setEmotionConfidence(data.based_on.confidence);
      }

      return data.recommendations;
    }
    return [];
  }, [getRecommendations]);

  const handleSend = useCallback(async (customMessage?: string) => {
    const message = customMessage || inputText.trim();
    if (!message || loading) return;

    if (!customMessage) {
      setInputText("");
    }
    setShowSuggestions(false);

    sendMessage(message, true).then(response => {
      if (response?.suggestions && response.suggestions.length > 0) {
        setRecommendations(response.suggestions);
        setShowSuggestions(true);
      }

      if (response?.emotion) {
        setCurrentEmotion(response.emotion);
        setEmotionConfidence(response.confidence || 0.5);
      }
    });
  }, [inputText, loading, sendMessage]);

  const handleSuggestionPress = useCallback((suggestion: string) => {
    setInputText(suggestion);
    setShowSuggestions(false);
  }, []);

  // 🔥 NEW: Send welcome message with recommendations automatically
  const sendWelcomeWithRecommendations = useCallback(async (recs: string[]) => {
    if (hasAutoSentRecommendations.current || recs.length === 0) return;
    
    hasAutoSentRecommendations.current = true;

    // Wait a bit for smooth animation
    await new Promise(resolve => setTimeout(resolve, 500));

    // Format recommendations as a nice message
    const welcomeMessage = `Dựa trên cảm xúc của bạn, tôi có một số gợi ý:\n\n${recs.map((r, i) => `${i + 1}. ${r}`).join('\n\n')}\n\nBạn muốn trao đổi về điều gì?`;
    
    // Send as bot message (not user message)
    await handleSend(welcomeMessage);
  }, [handleSend]);

  // Load recommendations once on mount
  useEffect(() => {
    if (!hasLoadedRecommendations.current) {
      hasLoadedRecommendations.current = true;
      
      loadRecommendationsInternal().then(recs => {
        // 🔥 Auto show suggestions if came from floating notification
        if (params.hasRecommendations === 'true' && recs.length > 0) {
          sendWelcomeWithRecommendations(recs);
        }
      });
    }
  }, [loadRecommendationsInternal, params.hasRecommendations, sendWelcomeWithRecommendations]);

  // Handle params
  useEffect(() => {
    if (params.emotion) {
      setCurrentEmotion(params.emotion as string);
    }
    if (params.confidence) {
      setEmotionConfidence(parseFloat(params.confidence as string));
    }
  }, [params.emotion, params.confidence]);

  // Auto scroll
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const handleRefreshRecommendations = useCallback(async () => {
    hasLoadedRecommendations.current = false;
    await loadRecommendationsInternal();
    hasLoadedRecommendations.current = true;
  }, [loadRecommendationsInternal]);

  // ✅ MEMOIZED RENDER FUNCTIONS
  const renderMessage = useCallback(({ item, index }: { item: any; index: number }) => {
    return (
      <MessageBubble 
        item={item} 
        index={index} 
        isDark={isDark}
        getEmotionEmoji={getEmotionEmoji}
        getEmotionColor={getEmotionColor}
      />
    );
  }, [isDark, getEmotionEmoji, getEmotionColor]);

  const renderTypingIndicator = useCallback(() => {
    if (!typing) return null;
    return <TypingIndicator isDark={isDark} />;
  }, [typing, isDark]);

  const renderSuggestions = useCallback(() => {
    if (!showSuggestions || recommendations.length === 0) return null;

    return (
      <View
        className={`px-4 pb-3 border-t ${
          isDark ? "border-gray-800 bg-gray-900/50" : "border-gray-100 bg-gray-50/80"
        }`}
      >
        <View className="flex-row items-center justify-between mb-3 pt-3">
          <View className="flex-row items-center">
            <Text className="text-xl mr-2">{getEmotionEmoji(currentEmotion)}</Text>
            <View>
              <Text
                className={`text-sm font-semibold ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Gợi ý AI cho bạn
              </Text>
              {currentEmotion && (
                <Text
                  className="text-xs capitalize"
                  style={{ color: getEmotionColor(currentEmotion) }}
                >
                  {currentEmotion} · {(emotionConfidence * 100).toFixed(0)}%
                </Text>
              )}
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setShowSuggestions(false)}
            className="p-1"
          >
            <Ionicons
              name="close-circle"
              size={22}
              color={isDark ? "#9CA3AF" : "#6B7280"}
            />
          </TouchableOpacity>
        </View>
        <View className="gap-2">
          {recommendations.map((suggestion, index) => (
            <SuggestionItem
              key={`suggestion-${index}`}
              suggestion={suggestion}
              index={index}
              isDark={isDark}
              emotionColor={getEmotionColor(currentEmotion)}
              onPress={() => handleSuggestionPress(suggestion)}
            />
          ))}
        </View>
      </View>
    );
  }, [showSuggestions, recommendations, currentEmotion, emotionConfidence, isDark, getEmotionEmoji, getEmotionColor, handleSuggestionPress]);

  const renderEmptyState = useCallback(() => (
    <View className="flex-1 justify-center items-center px-8">
      <View
        className="w-24 h-24 rounded-full bg-orange-500 items-center justify-center mb-6"
        style={{
          shadowColor: "#F97316",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <Text className="text-5xl">🤖</Text>
      </View>

      <Text
        className={`text-2xl font-bold text-center mb-2 ${
          isDark ? "text-white" : "text-gray-900"
        }`}
      >
        Trợ Lý Sức Khỏe AI
      </Text>

      {currentEmotion && (
        <View className="flex-row items-center mb-4">
          <Text className="text-2xl mr-2">{getEmotionEmoji(currentEmotion)}</Text>
          <View>
            <Text
              className="text-base font-semibold capitalize"
              style={{ color: getEmotionColor(currentEmotion) }}
            >
              Bạn đang {currentEmotion}
            </Text>
            <Text className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              {(emotionConfidence * 100).toFixed(0)}% độ tin cậy
            </Text>
          </View>
        </View>
      )}

      <Text
        className={`text-center mb-8 leading-6 ${
          isDark ? "text-gray-400" : "text-gray-600"
        }`}
      >
        Tôi ở đây để hỗ trợ sức khỏe tinh thần của bạn.{"\n"}
        Hãy chia sẻ cảm xúc của bạn!
      </Text>

      {recommendations.length > 0 && (
        <View className="w-full">
          <Text
            className={`text-sm font-semibold mb-4 text-center ${
              isDark ? "text-gray-400" : "text-gray-600"
            }`}
          >
            Bắt đầu với các chủ đề:
          </Text>
          {recommendations.slice(0, 4).map((rec, index) => (
            <TouchableOpacity
              key={`empty-rec-${index}`}
              onPress={() => handleSuggestionPress(rec)}
              className={`p-4 rounded-2xl mb-3 border-l-4 ${
                isDark
                  ? "bg-orange-900/20 border-orange-800/30"
                  : "bg-orange-50 border-orange-100"
              }`}
              style={{
                borderLeftColor: getEmotionColor(currentEmotion) || '#F97316',
              }}
            >
              <Text
                className={`text-sm font-medium ${
                  isDark ? "text-orange-400" : "text-orange-600"
                }`}
              >
                💡 {rec}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  ), [currentEmotion, emotionConfidence, recommendations, isDark, getEmotionEmoji, getEmotionColor, handleSuggestionPress]);

  const inputHasText = useMemo(() => inputText.trim().length > 0, [inputText]);

  const headerRightComponent = useMemo(() => (
    <View className="flex-row items-center gap-2">
      {currentEmotion && (
        <View className="flex-row items-center px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800">
          <Text className="text-sm mr-1">{getEmotionEmoji(currentEmotion)}</Text>
          <Text
            className="text-xs font-semibold capitalize"
            style={{ color: getEmotionColor(currentEmotion) }}
          >
            {currentEmotion}
          </Text>
        </View>
      )}
      
      <TouchableOpacity 
        onPress={handleRefreshRecommendations} 
        className="p-2"
        disabled={emotionLoading}
      >
        {emotionLoading ? (
          <ActivityIndicator size="small" color={isDark ? "#F97316" : "#FF8C42"} />
        ) : (
          <Ionicons
            name="refresh"
            size={24}
            color={isDark ? "#F97316" : "#FF8C42"}
          />
        )}
      </TouchableOpacity>
    </View>
  ), [currentEmotion, isDark, emotionLoading, getEmotionEmoji, getEmotionColor, handleRefreshRecommendations]);

  return (
    <SafeAreaView
      className={`flex-1 ${isDark ? "bg-black" : "bg-gray-50"}`}
      edges={["top"]}
    >
      <Header
        title="AI Assistant"
        onBackPress={() => router.back()}
        rightComponent={headerRightComponent}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
        keyboardVerticalOffset={0}
      >
        <View className="flex-1">
          {messages.length === 0 ? (
            renderEmptyState()
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item, index) => `message-${index}`}
              contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
              showsVerticalScrollIndicator={false}
              ListFooterComponent={renderTypingIndicator}
              onContentSizeChange={() => {
                flatListRef.current?.scrollToEnd({ animated: true });
              }}
              removeClippedSubviews={true}
              maxToRenderPerBatch={10}
              updateCellsBatchingPeriod={50}
              initialNumToRender={10}
              windowSize={10}
            />
          )}
        </View>

        {renderSuggestions()}

        <View
          className={`border-t px-4 py-3 ${
            isDark
              ? "border-gray-800 bg-black"
              : "border-gray-200 bg-white"
          }`}
        >
          <View className="flex-row items-end gap-2">
            <TouchableOpacity
              onPress={() => setShowSuggestions(!showSuggestions)}
              className={`p-2.5 rounded-full ${
                showSuggestions
                  ? "bg-orange-500/10"
                  : isDark
                  ? "bg-gray-800"
                  : "bg-gray-100"
              }`}
            >
              <View className="relative">
                <Ionicons
                  name="bulb-outline"
                  size={22}
                  color={showSuggestions ? "#F97316" : "#9CA3AF"}
                />
                {recommendations.length > 0 && (
                  <View className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 items-center justify-center">
                    <Text className="text-white text-[8px] font-bold">
                      {recommendations.length}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>

            <View
              className={`flex-1 rounded-3xl px-5 py-3 min-h-[44px] max-h-[120px] justify-center ${
                isDark
                  ? "bg-gray-800 border border-gray-700"
                  : "bg-gray-100 border border-gray-200"
              }`}
            >
              <TextInput
                value={inputText}
                onChangeText={setInputText}
                placeholder="Chia sẻ suy nghĩ của bạn..."
                placeholderTextColor={isDark ? "#9CA3AF" : "#6B7280"}
                className={`text-[15px] leading-5 ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
                multiline
                maxLength={500}
                editable={!loading}
                style={{ paddingTop: Platform.OS === "ios" ? 0 : 4 }}
              />
            </View>

            <TouchableOpacity
              onPress={() => handleSend()}
              disabled={!inputHasText || loading}
              className={`w-11 h-11 rounded-full items-center justify-center ${
                inputHasText && !loading
                  ? "bg-orange-500"
                  : isDark
                  ? "bg-gray-800"
                  : "bg-gray-300"
              }`}
              style={
                inputHasText && !loading
                  ? {
                      shadowColor: "#F97316",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.4,
                      shadowRadius: 4,
                      elevation: 5,
                    }
                  : {}
              }
            >
              {loading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons
                  name="send"
                  size={18}
                  color={
                    inputHasText && !loading
                      ? "white"
                      : isDark
                      ? "#6B7280"
                      : "#9CA3AF"
                  }
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}