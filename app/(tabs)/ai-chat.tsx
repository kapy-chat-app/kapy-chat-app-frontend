/* eslint-disable react/no-unescaped-entities */
// app/(root)/ai-chat.tsx
import Header from "@/components/shared/Header";
import { useChatbot } from "@/hooks/ai/useChatbot";
import { useEmotion } from "@/hooks/ai/useEmotion";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
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
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AIChatbotScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);

  const [inputText, setInputText] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recommendations, setRecommendations] = useState<string[]>([]);

  const { messages, sendMessage, loading, typing, error } = useChatbot();
  const { getRecommendations, loading: emotionLoading } = useEmotion();

  useEffect(() => {
    loadRecommendations();
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const loadRecommendations = async () => {
    const data = await getRecommendations();
    if (data?.recommendations) {
      setRecommendations(data.recommendations);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || loading) return;

    const message = inputText.trim();
    setInputText("");

    const response = await sendMessage(message, true);

    if (response?.suggestions && response.suggestions.length > 0) {
      setRecommendations(response.suggestions);
      setShowSuggestions(true);
    }
  };

  const handleSuggestionPress = (suggestion: string) => {
    setInputText(suggestion);
    setShowSuggestions(false);
  };

  const getEmotionEmoji = (emotion?: string) => {
    const emojiMap: Record<string, string> = {
      joy: "😊",
      sadness: "😢",
      anger: "😠",
      fear: "😨",
      surprise: "😮",
      neutral: "😐",
    };
    return emotion ? emojiMap[emotion] || "💬" : "💬";
  };

  const getEmotionColor = (emotion?: string) => {
    const colorMap: Record<string, string> = {
      joy: "#10B981",
      sadness: "#3B82F6",
      anger: "#EF4444",
      fear: "#8B5CF6",
      surprise: "#F59E0B",
      neutral: "#6B7280",
    };
    return emotion ? colorMap[emotion] || "#6B7280" : "#6B7280";
  };

  // Message with animation
  const MessageBubble = ({ item, index }: { item: any; index: number }) => {
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
    }, []);

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
  };

  const renderMessage = ({ item, index }: { item: any; index: number }) => {
    return <MessageBubble item={item} index={index} />;
  };

  // Typing indicator with animation
  const TypingIndicator = () => {
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
  };

  const renderTypingIndicator = () => {
    if (!typing) return null;
    return <TypingIndicator />;
  };

  // Suggestion Item with animation
  const SuggestionItem = ({
    suggestion,
    index,
    onPress,
  }: {
    suggestion: string;
    index: number;
    onPress: () => void;
  }) => {
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
    }, []);

    return (
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }}
      >
        <TouchableOpacity
          onPress={onPress}
          className={`p-4 rounded-2xl border ${
            isDark
              ? "bg-gray-800 border-gray-700"
              : "bg-white border-gray-200"
          }`}
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
            elevation: 1,
          }}
        >
          <Text
            className={`text-sm leading-5 ${
              isDark ? "text-gray-300" : "text-gray-700"
            }`}
          >
            {suggestion}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderSuggestions = () => {
    if (!showSuggestions || recommendations.length === 0) return null;

    return (
      <View
        className={`px-4 pb-3 border-t ${
          isDark ? "border-gray-800 bg-gray-900/50" : "border-gray-100 bg-gray-50/80"
        }`}
      >
        <View className="flex-row items-center justify-between mb-3 pt-3">
          <View className="flex-row items-center">
            <Text className="text-xl mr-2">💡</Text>
            <Text
              className={`text-sm font-semibold ${
                isDark ? "text-gray-300" : "text-gray-700"
              }`}
            >
              Gợi ý cho bạn
            </Text>
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
          {recommendations.slice(0, 3).map((suggestion, index) => (
            <SuggestionItem
              key={index}
              suggestion={suggestion}
              index={index}
              onPress={() => handleSuggestionPress(suggestion)}
            />
          ))}
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
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
          {recommendations.slice(0, 3).map((rec, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => handleSuggestionPress(rec)}
              className={`p-4 rounded-2xl mb-3 border ${
                isDark
                  ? "bg-orange-900/20 border-orange-800/30"
                  : "bg-orange-50 border-orange-100"
              }`}
            >
              <Text
                className={`text-sm font-medium ${
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
  );

  const inputHasText = inputText.trim().length > 0;

  return (
    <SafeAreaView
      className={`flex-1 ${isDark ? "bg-black" : "bg-gray-50"}`}
      edges={["top"]}
    >
      <Header
        title="AI Assistant"
        onBackPress={() => router.back()}
        rightComponent={
          <TouchableOpacity onPress={loadRecommendations} className="p-2">
            <Ionicons
              name="refresh"
              size={24}
              color={isDark ? "#F97316" : "#FF8C42"}
            />
          </TouchableOpacity>
        }
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
              <Ionicons
                name="bulb-outline"
                size={22}
                color={showSuggestions ? "#F97316" : "#9CA3AF"}
              />
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
    </SafeAreaView>
  );
}