// app/(root)/ai-chat.tsx - RESPONSIVE & SCROLLABLE FIX
import ChatSidebar from "@/components/page/ai/ChatSidebar";
import Header from "@/components/shared/Header";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useChatbot } from "@/hooks/ai/useChatbot";
import { useEmotion } from "@/hooks/ai/useEmotion";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ============================================
// RESPONSIVE UTILITIES
// ============================================
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const isSmallScreen = SCREEN_WIDTH < 375;
const isMediumScreen = SCREEN_WIDTH >= 375 && SCREEN_WIDTH < 414;

// ============================================
// TYPES
// ============================================
interface MessageBubbleProps {
  item: any;
  index: number;
  isDark: boolean;
  getEmotionEmoji: (emotion?: string) => string;
  getEmotionColor: (emotion?: string) => string;
  translateEmotion: (emotion?: string) => string;
}

// ============================================
// MEMOIZED COMPONENTS
// ============================================

const MessageBubble = memo(function MessageBubble({
  item,
  index,
  isDark,
  getEmotionEmoji,
  getEmotionColor,
  translateEmotion,
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
      className={`flex-row mb-3 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser && (
        <View
          className={`${isSmallScreen ? "w-8 h-8" : "w-10 h-10"} rounded-full bg-orange-500 items-center justify-center ${isSmallScreen ? "mr-2" : "mr-2.5"}`}
          style={{
            shadowColor: "#F97316",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            elevation: 5,
          }}
        >
          <Text className={isSmallScreen ? "text-base" : "text-lg"}>🤖</Text>
        </View>
      )}

      <View className={`max-w-[75%] ${isUser ? "items-end" : "items-start"}`}>
        <View
          className={`rounded-3xl ${isSmallScreen ? "px-3 py-2.5" : "px-5 py-3.5"} ${
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
            className={`${isSmallScreen ? "text-sm" : "text-[15px]"} leading-5 ${
              isUser ? "text-white" : isDark ? "text-gray-100" : "text-gray-800"
            }`}
          >
            {item.content}
          </Text>
        </View>

        {item.emotion && (
          <View className={`flex-row items-center ${isSmallScreen ? "mt-1 px-1" : "mt-2 px-2"}`}>
            <Text className={`${isSmallScreen ? "text-[10px]" : "text-xs"} mr-1.5`}>{emoji}</Text>
            <Text
              className={`${isSmallScreen ? "text-[10px]" : "text-xs"} font-medium capitalize`}
              style={{ color: emotionColor }}
            >
              {translateEmotion(item.emotion)}
            </Text>
          </View>
        )}

        <Text
          className={`text-[10px] ${isSmallScreen ? "mt-1 px-1" : "mt-1.5 px-2"} ${
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
          className={`${isSmallScreen ? "w-8 h-8" : "w-10 h-10"} rounded-full bg-blue-500 items-center justify-center ${isSmallScreen ? "ml-2" : "ml-2.5"}`}
          style={{
            shadowColor: "#3B82F6",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            elevation: 5,
          }}
        >
          <Ionicons name="person" size={isSmallScreen ? 14 : 18} color="white" />
        </View>
      )}
    </Animated.View>
  );
});

const TypingIndicator = memo(function TypingIndicator({
  isDark,
}: {
  isDark: boolean;
}) {
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
      <View className={`${isSmallScreen ? "w-8 h-8" : "w-10 h-10"} rounded-full bg-orange-500 items-center justify-center ${isSmallScreen ? "mr-2" : "mr-2.5"}`}>
        <Text className={isSmallScreen ? "text-base" : "text-lg"}>🤖</Text>
      </View>
      <View
        className={`rounded-3xl ${isSmallScreen ? "px-3 py-3" : "px-5 py-4"} ${
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

// ============================================
// MAIN COMPONENT
// ============================================

export default function AIChatbotScreen() {
  const { actualTheme } = useTheme();
  const { t, language } = useLanguage();
  const isDark = actualTheme === "dark";
  const router = useRouter();
  const params = useLocalSearchParams();
  const flatListRef = useRef<FlatList>(null);

  const [inputText, setInputText] = useState("");
  const [sidebarVisible, setSidebarVisible] = useState(false);

  const hasLoadedRecommendations = useRef(false);

  const {
    messages,
    sendMessage,
    loadHistory,
    clearConversation,
    conversations,
    loadConversations,
    deleteConversation,
    conversationsLoading,
    loading,
    typing,
    error,
    conversationId,
    conversationTitle,
    emotionContext,
    smartSuggestions,
    suggestionsLoading,
    loadSmartSuggestions,
  } = useChatbot(params.conversationId as string);

  const { getRecommendations, loading: emotionLoading } = useEmotion();

  const currentEmotion = emotionContext?.emotion || "";
  const emotionConfidence = emotionContext?.confidence || 0;

  const [recommendations, setRecommendations] = useState<string[]>([]);

  const loadRecommendations = useCallback(async () => {
    try {
      const data = await getRecommendations();
      if (data?.recommendations) {
        setRecommendations(data.recommendations);
      }
    } catch (error) {
      console.error("Error loading recommendations:", error);
    }
  }, [getRecommendations]);

  useEffect(() => {
    if (params.conversationId) {
      loadHistory(params.conversationId as string);
    }
  }, [params.conversationId, loadHistory]);

  useEffect(() => {
    if (!hasLoadedRecommendations.current) {
      hasLoadedRecommendations.current = true;
      loadRecommendations();
    }
  }, [loadRecommendations]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

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

  const translateEmotion = useCallback(
    (emotion?: string) => {
      if (!emotion) return "";
      return t(`aiChat.emotions.${emotion}` as any) || emotion;
    },
    [t]
  );

  const handleSend = useCallback(async () => {
    const message = inputText.trim();
    if (!message || loading) return;

    setInputText("");
    await sendMessage(message);
  }, [inputText, loading, sendMessage]);

  const handleRefreshRecommendations = useCallback(async () => {
    hasLoadedRecommendations.current = false;
    await loadRecommendations();
    hasLoadedRecommendations.current = true;
  }, [loadRecommendations]);

  const handleNewChat = useCallback(() => {
    Alert.alert(
      t("aiChat.newChat.confirm.title") || "New Chat",
      t("aiChat.newChat.confirm.message") || "Start a new conversation?",
      [
        { text: t("common.cancel") || "Cancel", style: "cancel" },
        {
          text: t("common.confirm") || "Confirm",
          onPress: () => {
            clearConversation();
            setSidebarVisible(false);
          },
        },
      ]
    );
  }, [clearConversation, t]);

  const handleSuggestionPress = useCallback(
    async (suggestion: string) => {
      setInputText(suggestion);
      setTimeout(async () => {
        if (!loading) {
          setInputText("");
          await sendMessage(suggestion);
        }
      }, 150);
    },
    [loading, sendMessage]
  );

  const handleSelectConversation = useCallback(
    (convId: string) => {
      setSidebarVisible(false);
      loadHistory(convId);
    },
    [loadHistory]
  );

  const handleDeleteConversation = useCallback(
    async (convId: string) => {
      await deleteConversation(convId);
      if (conversationId === convId) {
        clearConversation();
      }
    },
    [deleteConversation, conversationId, clearConversation]
  );

  const renderMessage = useCallback(
    ({ item, index }: { item: any; index: number }) => {
      return (
        <MessageBubble
          item={item}
          index={index}
          isDark={isDark}
          getEmotionEmoji={getEmotionEmoji}
          getEmotionColor={getEmotionColor}
          translateEmotion={translateEmotion}
        />
      );
    },
    [isDark, getEmotionEmoji, getEmotionColor, translateEmotion]
  );

  const renderTypingIndicator = useCallback(() => {
    if (!typing) return null;
    return <TypingIndicator isDark={isDark} />;
  }, [typing, isDark]);

  // ✅ IMPROVED EMPTY STATE - SCROLLABLE
  const renderEmptyState = useCallback(
    () => (
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingHorizontal: isSmallScreen ? 16 : 24,
          paddingBottom: 16,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center">
          <View
            className={`${isSmallScreen ? "w-20 h-20" : "w-24 h-24"} rounded-full bg-orange-500 items-center justify-center mb-4`}
            style={{
              shadowColor: "#F97316",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}
          >
            <Text className={isSmallScreen ? "text-4xl" : "text-5xl"}>🤖</Text>
          </View>

          <Text
            className={`${isSmallScreen ? "text-xl" : "text-2xl"} font-bold text-center mb-2 ${
              isDark ? "text-white" : "text-gray-900"
            }`}
          >
            {t("aiChat.empty.title")}
          </Text>

          {currentEmotion && (
            <View className="flex-row items-center mb-3">
              <Text className={isSmallScreen ? "text-xl mr-2" : "text-2xl mr-2"}>
                {getEmotionEmoji(currentEmotion)}
              </Text>
              <View>
                <Text
                  className={`${isSmallScreen ? "text-sm" : "text-base"} font-semibold capitalize`}
                  style={{ color: getEmotionColor(currentEmotion) }}
                >
                  {translateEmotion(currentEmotion)}
                </Text>
                <Text
                  className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}
                >
                  {t("aiChat.empty.confidence", {
                    percent: (emotionConfidence * 100).toFixed(0),
                  })}
                </Text>
              </View>
            </View>
          )}

          <Text
            className={`text-center mb-4 ${isSmallScreen ? "text-sm" : "text-base"} leading-6 ${
              isDark ? "text-gray-400" : "text-gray-600"
            }`}
          >
            {t("aiChat.empty.subtitle")}
          </Text>

          {/* ✅ SMART SUGGESTIONS - SCROLLABLE */}
          {smartSuggestions.length > 0 && (
            <View className="w-full mb-4">
              <View className="flex-row items-center justify-between mb-3">
                <Text
                  className={`${isSmallScreen ? "text-xs" : "text-sm"} font-semibold ${
                    isDark ? "text-orange-400" : "text-orange-600"
                  }`}
                >
                  💡 {t("aiChat.suggestions.smartTitle") || "Gợi ý cho bạn"}
                </Text>
                <TouchableOpacity
                  onPress={loadSmartSuggestions}
                  disabled={suggestionsLoading}
                  className="p-1"
                >
                  {suggestionsLoading ? (
                    <ActivityIndicator size="small" color="#F97316" />
                  ) : (
                    <Ionicons name="refresh" size={isSmallScreen ? 16 : 18} color="#F97316" />
                  )}
                </TouchableOpacity>
              </View>

              {smartSuggestions.map((suggestion, index) => (
                <TouchableOpacity
                  key={`smart-suggestion-${index}`}
                  onPress={() => handleSuggestionPress(suggestion)}
                  className={`${isSmallScreen ? "p-3" : "p-4"} rounded-2xl mb-2.5 border-l-4 ${
                    isDark
                      ? "bg-gradient-to-r from-orange-900/20 to-transparent border-orange-800/40"
                      : "bg-gradient-to-r from-orange-50 to-transparent border-orange-200"
                  }`}
                  style={{
                    borderLeftColor: getEmotionColor(currentEmotion) || "#F97316",
                  }}
                >
                  <View className="flex-row items-center">
                    <Ionicons
                      name="bulb-outline"
                      size={isSmallScreen ? 14 : 16}
                      color={isDark ? "#FB923C" : "#EA580C"}
                      style={{ marginRight: 8 }}
                    />
                    <Text
                      className={`${isSmallScreen ? "text-xs" : "text-sm"} flex-1 ${
                        isDark ? "text-orange-300" : "text-orange-700"
                      }`}
                      numberOfLines={3}
                    >
                      {suggestion}
                    </Text>
                    <Ionicons
                      name="send"
                      size={isSmallScreen ? 12 : 14}
                      color={isDark ? "#9CA3AF" : "#D1D5DB"}
                    />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ✅ FALLBACK RECOMMENDATIONS - SCROLLABLE */}
          {smartSuggestions.length === 0 && recommendations.length > 0 && (
            <View className="w-full">
              <Text
                className={`${isSmallScreen ? "text-xs" : "text-sm"} font-semibold mb-3 text-center ${
                  isDark ? "text-gray-400" : "text-gray-600"
                }`}
              >
                💡 {t("aiChat.suggestions.startWith")}
              </Text>
              {recommendations.slice(0, 3).map((rec, index) => (
                <TouchableOpacity
                  key={`fallback-rec-${index}`}
                  onPress={() => handleSuggestionPress(rec)}
                  className={`${isSmallScreen ? "p-3" : "p-4"} rounded-2xl mb-2.5 border-l-4 ${
                    isDark
                      ? "bg-orange-900/20 border-orange-800/30"
                      : "bg-orange-50 border-orange-100"
                  }`}
                  style={{
                    borderLeftColor: getEmotionColor(currentEmotion) || "#F97316",
                  }}
                >
                  <Text
                    className={`${isSmallScreen ? "text-xs" : "text-sm"} ${
                      isDark ? "text-orange-400" : "text-orange-600"
                    }`}
                    numberOfLines={3}
                  >
                    {rec}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    ),
    [
      currentEmotion,
      emotionConfidence,
      smartSuggestions,
      suggestionsLoading,
      recommendations,
      isDark,
      getEmotionEmoji,
      getEmotionColor,
      translateEmotion,
      handleSuggestionPress,
      loadSmartSuggestions,
      t,
    ]
  );

  const inputHasText = useMemo(() => inputText.trim().length > 0, [inputText]);

  const headerRightComponent = useMemo(
    () => (
      <View className="flex-row items-center gap-1">
        {currentEmotion && (
          <View
            className={`flex-row items-center ${isSmallScreen ? "px-2 py-0.5" : "px-3 py-1"} rounded-full ${isDark ? "bg-gray-800" : "bg-gray-100"}`}
          >
            <Text className={isSmallScreen ? "text-xs mr-1" : "text-sm mr-1"}>
              {getEmotionEmoji(currentEmotion)}
            </Text>
            <Text
              className={`${isSmallScreen ? "text-[10px]" : "text-xs"} font-semibold capitalize`}
              style={{ color: getEmotionColor(currentEmotion) }}
            >
              {translateEmotion(currentEmotion)}
            </Text>
          </View>
        )}

        {conversationId && (
          <TouchableOpacity onPress={handleNewChat} className={isSmallScreen ? "p-1" : "p-2"}>
            <Ionicons
              name="add-circle-outline"
              size={isSmallScreen ? 20 : 24}
              color={isDark ? "#F97316" : "#FF8C42"}
            />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={handleRefreshRecommendations}
          className={isSmallScreen ? "p-1" : "p-2"}
          disabled={emotionLoading}
        >
          {emotionLoading ? (
            <ActivityIndicator
              size="small"
              color={isDark ? "#F97316" : "#FF8C42"}
            />
          ) : (
            <Ionicons
              name="refresh"
              size={isSmallScreen ? 20 : 24}
              color={isDark ? "#F97316" : "#FF8C42"}
            />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setSidebarVisible(true)}
          className={isSmallScreen ? "p-1" : "p-2"}
        >
          <Ionicons
            name="menu"
            size={isSmallScreen ? 20 : 24}
            color={isDark ? "#F97316" : "#FF8C42"}
          />
        </TouchableOpacity>
      </View>
    ),
    [
      currentEmotion,
      conversationId,
      emotionLoading,
      isDark,
      getEmotionEmoji,
      getEmotionColor,
      translateEmotion,
      handleRefreshRecommendations,
      handleNewChat,
    ]
  );

  return (
    <SafeAreaView
      className={`flex-1 ${isDark ? "bg-black" : "bg-gray-50"}`}
      edges={["top"]}
    >
      <Header
        title={conversationTitle || t("aiChat.title")}
        onBackPress={() => router.back()}
        rightComponent={headerRightComponent}
      />

      {/* ✅ FIXED: Better KeyboardAvoidingView with proper offset */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <View style={{ flex: 1 }}>
          {messages.length === 0 ? (
            renderEmptyState()
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item, index) => `message-${index}`}
              contentContainerStyle={{ 
                padding: isSmallScreen ? 12 : 16, 
                paddingBottom: 8 
              }}
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
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>

        {/* ✅ RESPONSIVE INPUT BAR */}
        <View
          className={`border-t ${isSmallScreen ? "px-3 py-2" : "px-4 py-3"} ${
            isDark ? "border-gray-800 bg-black" : "border-gray-200 bg-white"
          }`}
        >
          <View className={`flex-row items-end ${isSmallScreen ? "gap-1.5" : "gap-2"}`}>
            <View
              className={`flex-1 rounded-3xl ${isSmallScreen ? "px-3 py-2" : "px-5 py-3"} min-h-[44px] max-h-[100px] justify-center ${
                isDark
                  ? "bg-gray-800 border border-gray-700"
                  : "bg-gray-100 border border-gray-200"
              }`}
            >
              <TextInput
                value={inputText}
                onChangeText={setInputText}
                placeholder={t("aiChat.placeholder")}
                placeholderTextColor={isDark ? "#9CA3AF" : "#6B7280"}
                className={`${isSmallScreen ? "text-sm" : "text-[15px]"} leading-5 ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
                multiline
                maxLength={500}
                editable={!loading}
                style={{ paddingTop: Platform.OS === "ios" ? 0 : 4 }}
              />
            </View>

            <TouchableOpacity
              onPress={handleSend}
              disabled={!inputHasText || loading}
              className={`${isSmallScreen ? "w-10 h-10" : "w-11 h-11"} rounded-full items-center justify-center ${
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
                  size={isSmallScreen ? 16 : 18}
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

      {/* ✅ RESPONSIVE SIDEBAR */}
      <Modal
        visible={sidebarVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSidebarVisible(false)}
      >
        <View className="flex-1 flex-row">
          <TouchableOpacity
            className="flex-1 bg-black/50"
            activeOpacity={1}
            onPress={() => setSidebarVisible(false)}
          />
          <View
            className={`${isSmallScreen ? "w-[85%]" : isMediumScreen ? "w-80" : "w-96"} ${isDark ? "bg-gray-900" : "bg-white"}`}
            style={{
              shadowColor: "#000",
              shadowOpacity: 0.5,
              shadowRadius: 10,
              elevation: 10,
            }}
          >
            <ChatSidebar
              conversations={conversations}
              currentConversationId={conversationId}
              loading={conversationsLoading}
              onSelectConversation={handleSelectConversation}
              onDeleteConversation={handleDeleteConversation}
              onNewChat={handleNewChat}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}