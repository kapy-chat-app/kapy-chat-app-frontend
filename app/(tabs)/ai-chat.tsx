// app/(root)/ai-chat.tsx - UPDATED WITH SIDEBAR
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
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
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
              {translateEmotion(item.emotion)}
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

// ============================================
// MAIN COMPONENT
// ============================================

export default function AIChatbotScreen() {
  const { actualTheme } = useTheme();
  const { t } = useLanguage();
  const isDark = actualTheme === "dark";
  const router = useRouter();
  const params = useLocalSearchParams();
  const flatListRef = useRef<FlatList>(null);

  const [inputText, setInputText] = useState("");
  const [sidebarVisible, setSidebarVisible] = useState(false);

  const hasLoadedRecommendations = useRef(false);

  // ✅ UPDATED: Use new useChatbot with conversations
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
  } = useChatbot(params.conversationId as string);

  const { getRecommendations, loading: emotionLoading } = useEmotion();

  // ✅ Get current emotion from emotionContext (from backend)
  const currentEmotion = emotionContext?.emotion || "";
  const emotionConfidence = emotionContext?.confidence || 0;

  // Load recommendations
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

  // Load history if conversation ID exists
  useEffect(() => {
    if (params.conversationId) {
      loadHistory(params.conversationId as string);
    }
  }, [params.conversationId, loadHistory]);

  // Load recommendations on mount
  useEffect(() => {
    if (!hasLoadedRecommendations.current) {
      hasLoadedRecommendations.current = true;
      loadRecommendations();
    }
  }, [loadRecommendations]);

  // Auto scroll
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

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

  // ✅ NEW: Sidebar handlers
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

  // ✅ RENDER FUNCTIONS
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

  const renderEmptyState = useCallback(
    () => (
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
          {t("aiChat.empty.title")}
        </Text>

        {currentEmotion && (
          <View className="flex-row items-center mb-4">
            <Text className="text-2xl mr-2">
              {getEmotionEmoji(currentEmotion)}
            </Text>
            <View>
              <Text
                className="text-base font-semibold capitalize"
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
          className={`text-center mb-8 leading-6 ${
            isDark ? "text-gray-400" : "text-gray-600"
          }`}
        >
          {t("aiChat.empty.subtitle")}
        </Text>

        {recommendations.length > 0 && (
          <View className="w-full">
            <Text
              className={`text-sm font-semibold mb-4 text-center ${
                isDark ? "text-gray-400" : "text-gray-600"
              }`}
            >
              💡 {t("aiChat.suggestions.startWith")}
            </Text>
            {recommendations.slice(0, 3).map((rec, index) => (
              <TouchableOpacity
                key={`empty-rec-${index}`}
                onPress={() => setInputText(rec)}
                className={`p-4 rounded-2xl mb-3 border-l-4 ${
                  isDark
                    ? "bg-orange-900/20 border-orange-800/30"
                    : "bg-orange-50 border-orange-100"
                }`}
                style={{
                  borderLeftColor: getEmotionColor(currentEmotion) || "#F97316",
                }}
              >
                <Text
                  className={`text-sm ${
                    isDark ? "text-orange-400" : "text-orange-600"
                  }`}
                >
                  {rec}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    ),
    [
      currentEmotion,
      emotionConfidence,
      recommendations,
      isDark,
      getEmotionEmoji,
      getEmotionColor,
      translateEmotion,
      t,
    ]
  );

  const inputHasText = useMemo(() => inputText.trim().length > 0, [inputText]);

  const headerRightComponent = useMemo(
    () => (
      <View className="flex-row items-center gap-2">
        {currentEmotion && (
          <View
            className={`flex-row items-center px-3 py-1 rounded-full ${isDark ? "bg-gray-800" : "bg-gray-100"}`}
          >
            <Text className="text-sm mr-1">
              {getEmotionEmoji(currentEmotion)}
            </Text>
            <Text
              className="text-xs font-semibold capitalize"
              style={{ color: getEmotionColor(currentEmotion) }}
            >
              {translateEmotion(currentEmotion)}
            </Text>
          </View>
        )}

        {conversationId && (
          <TouchableOpacity onPress={handleNewChat} className="p-2">
            <Ionicons
              name="add-circle-outline"
              size={24}
              color={isDark ? "#F97316" : "#FF8C42"}
            />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={handleRefreshRecommendations}
          className="p-2"
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
              size={24}
              color={isDark ? "#F97316" : "#FF8C42"}
            />
          )}
        </TouchableOpacity>

        {/* ✅ NEW: Menu button for sidebar */}
        <TouchableOpacity
          onPress={() => setSidebarVisible(true)}
          className="p-2"
        >
          <Ionicons
            name="menu"
            size={24}
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

        <View
          className={`border-t px-4 py-3 ${
            isDark ? "border-gray-800 bg-black" : "border-gray-200 bg-white"
          }`}
        >
          <View className="flex-row items-end gap-2">
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
                placeholder={t("aiChat.placeholder")}
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
              onPress={handleSend}
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

      {/* ✅ NEW: Sidebar Modal */}
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
            className={`w-80 ${isDark ? "bg-gray-900" : "bg-white"}`}
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
