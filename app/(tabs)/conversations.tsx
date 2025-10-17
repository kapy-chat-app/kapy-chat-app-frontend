// app/(root)/(tabs)/conversations.tsx - IMPROVED WITH FREQUENT RECOMMENDATIONS
import FloatingRecommendation from "@/components/page/ai/FloatingRecommendation";
import ConversationItem from "@/components/page/message/ConversationItem";
import CreateConversationModal from "@/components/page/message/CreateConversationModel";
import Header from "@/components/shared/Header";
import Sidebar from "@/components/shared/Sidebar";
import SearchInput from "@/components/ui/SearchInput";
import { useEmotion } from "@/hooks/ai/useEmotion";
import { useConversations } from "@/hooks/message/useConversations";
import { useSocket } from "@/hooks/message/useSocket";
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  RefreshControl,
  StatusBar,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const RECOMMENDATION_STORAGE_KEY = "emotion_recommendation_dismissed";
const CHECK_INTERVAL = 2 * 60 * 1000; // 🔥 2 phút (thay vì 5 phút)
const DISMISS_COOLDOWN = 15 * 60 * 1000; // 🔥 15 phút (thay vì 30 phút)

export default function ConversationsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const router = useRouter();
  const { userId } = useAuth();
  const { socket } = useSocket();

  const [searchText, setSearchText] = useState("");
  const [filteredConversations, setFilteredConversations] = useState([]);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const {
    conversations,
    loading,
    error,
    createConversation,
    refreshConversations,
  } = useConversations();

  const { getRecommendations } = useEmotion();

  // 🔥 Enhanced recommendation state
  const [showFloatingRec, setShowFloatingRec] = useState(false);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [dominantEmotion, setDominantEmotion] = useState<string>("neutral");
  const [emotionConfidence, setEmotionConfidence] = useState<number>(0);
  const [hasNewRecommendations, setHasNewRecommendations] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<number>(0);

  // 🔥 Check recommendations on mount and more frequently
  useEffect(() => {
    // Initial check
    checkAndShowRecommendations();

    // Check every 2 minutes
    const interval = setInterval(checkAndShowRecommendations, CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // 🔥 Listen to ALL emotion-related socket events
  useEffect(() => {
    if (!socket) return;

    // Real-time recommendations from backend
    socket.on("sendRecommendations", (data: any) => {
      console.log("📨 Received AI recommendations:", data);
      handleNewRecommendations(
        data.recommendations, 
        data.based_on?.emotion || data.emotion,
        data.based_on?.confidence
      );
    });

    // Emotion analysis complete (for all emotions, not just negative)
    socket.on("emotionAnalysisComplete", (data: any) => {
      console.log("😊 Emotion analyzed:", data);
      const emotion = data.emotion_data.dominant_emotion;
      const confidence = data.emotion_data.confidence_score;

      // 🔥 Show recommendations for ALL strong emotions (confidence > 0.6)
      if (confidence > 0.6) {
        console.log(`🎯 Strong ${emotion} detected, fetching recommendations...`);
        checkAndShowRecommendations();
      }
    });

    // Combined emotion + recommendations
    socket.on("emotionAnalyzedWithRecommendations", (data: any) => {
      console.log("🎁 Emotion + Recommendations received:", data);
      if (data.recommendations && data.recommendations.length > 0) {
        handleNewRecommendations(
          data.recommendations,
          data.emotion_data.emotion,
          data.emotion_data.confidence
        );
      }
    });

    // Emotion recommendations (dedicated event)
    socket.on("emotionRecommendations", (data: any) => {
      console.log("💡 Emotion recommendations:", data);
      handleNewRecommendations(
        data.recommendations,
        data.emotion || data.based_on?.emotion,
        data.based_on?.confidence
      );
    });

    return () => {
      socket.off("sendRecommendations");
      socket.off("emotionAnalysisComplete");
      socket.off("emotionAnalyzedWithRecommendations");
      socket.off("emotionRecommendations");
    };
  }, [socket]);

  const checkAndShowRecommendations = async () => {
    try {
      const now = Date.now();

      // Check if user dismissed recommendations recently
      const dismissed = await AsyncStorage.getItem(RECOMMENDATION_STORAGE_KEY);
      const dismissedTime = dismissed ? parseInt(dismissed) : 0;

      // Don't show if dismissed less than 15 minutes ago
      if (now - dismissedTime < DISMISS_COOLDOWN) {
        console.log(`⏳ Cooldown active, ${Math.round((DISMISS_COOLDOWN - (now - dismissedTime)) / 60000)}m remaining`);
        return;
      }

      // Don't check too frequently (at least 1 minute between checks)
      if (now - lastCheckTime < 60000) {
        return;
      }

      setLastCheckTime(now);
      console.log("🔍 Checking for recommendations...");

      const data = await getRecommendations();

      if (data?.recommendations && data.recommendations.length > 0) {
        const emotion = data.based_on?.dominant_pattern || "neutral";
        const confidence = data.based_on?.confidence || 0.5;

        console.log(`✅ Got ${data.recommendations.length} recommendations for ${emotion}`);

        // 🔥 Show floating for ALL emotions with medium+ confidence (>0.5)
        if (confidence > 0.5) {
          handleNewRecommendations(data.recommendations, emotion, confidence);
        } else {
          // Just set badge for low confidence
          setHasNewRecommendations(true);
          setRecommendations(data.recommendations);
          setDominantEmotion(emotion);
          setEmotionConfidence(confidence);
        }
      }
    } catch (error) {
      console.error("Error checking recommendations:", error);
    }
  };

  const handleNewRecommendations = (
    recs: string[],
    emotion: string = "neutral",
    confidence: number = 0.5
  ) => {
    console.log(`🎯 Handling new recommendations: ${emotion} (${(confidence * 100).toFixed(0)}%)`);
    
    setRecommendations(recs);
    setDominantEmotion(emotion);
    setEmotionConfidence(confidence);
    setHasNewRecommendations(true);

    // 🔥 Show floating for all emotions with confidence > 0.5
    if (confidence > 0.5) {
      setShowFloatingRec(true);
    }
  };

  const handleCloseFloating = async () => {
    setShowFloatingRec(false);
    // Store dismissal time
    await AsyncStorage.setItem(
      RECOMMENDATION_STORAGE_KEY,
      Date.now().toString()
    );
    console.log("✅ Recommendations dismissed");
  };

  // 🔥 Navigate to AI chat with recommendations context
  const handleAIChatPress = async (fromFloating: boolean = false) => {
    setHasNewRecommendations(false);
    setShowFloatingRec(false);

    // Pass recommendations to AI chat screen
    router.push({
      pathname: "/ai-chat",
      params: {
        emotion: dominantEmotion,
        confidence: emotionConfidence.toString(),
        hasRecommendations: fromFloating ? "true" : "false",
        recommendationCount: recommendations.length.toString(),
      },
    });
  };

  useEffect(() => {
    if (searchText.trim() === "") {
      setFilteredConversations(conversations);
    } else {
      const filtered = conversations.filter((conversation: any) => {
        const name =
          conversation.type === "group"
            ? conversation.name
            : conversation.participants
                ?.filter((p: any) => p.clerkId !== userId)
                ?.map((p: any) => p.full_name)
                ?.join(", ") || "Unknown";

        const lastMessageContent = conversation.last_message?.content || "";

        return (
          name.toLowerCase().includes(searchText.toLowerCase()) ||
          lastMessageContent.toLowerCase().includes(searchText.toLowerCase())
        );
      });
      setFilteredConversations(filtered);
    }
  }, [searchText, conversations, userId]);

  const handleSearch = (text: string) => {
    setSearchText(text);
  };

  const handleClear = () => {
    setSearchText("");
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshConversations();
      await checkAndShowRecommendations();
    } catch (error) {
      Alert.alert("Error", "Failed to refresh conversations");
    } finally {
      setRefreshing(false);
    }
  };

  const handleCreateConversation = async (data: any) => {
    try {
      const newConversation = await createConversation(data);
      router.push({
        pathname: "/message/[id]",
        params: { id: newConversation._id },
      });
    } catch (error) {
      Alert.alert("Error", "Failed to create conversation");
      throw error;
    }
  };

  const handleConversationPress = (conversation: any) => {
    router.push({
      pathname: "/message/[id]",
      params: { id: conversation._id },
    });
  };

  const getConversationName = (conversation: any) => {
    if (conversation.type === "group") {
      return conversation.name || "Group Chat";
    }
    const otherParticipant = conversation.participants?.find(
      (p: any) => p.clerkId !== userId
    );
    return otherParticipant?.full_name || "Unknown User";
  };

  const getLastMessageText = (conversation: any) => {
    if (!conversation.last_message) return "No messages yet";
    const message = conversation.last_message;
    switch (message.type) {
      case "text":
        return message.content || "";
      case "image":
        return "📷 Image";
      case "file":
        return "📎 File";
      case "audio":
        return "🎵 Audio";
      case "video":
        return "🎥 Video";
      case "voice_note":
        return "🎤 Voice message";
      case "location":
        return "📍 Location";
      default:
        return "Message";
    }
  };

  const getLastMessageTime = (conversation: any) => {
    if (!conversation.last_activity) return "";
    const now = new Date();
    const messageTime = new Date(conversation.last_activity);
    const diffInHours =
      Math.abs(now.getTime() - messageTime.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return messageTime.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else {
      return messageTime.toLocaleDateString();
    }
  };

  const renderConversation = ({ item }: { item: any }) => {
    const conversationData = {
      id: item._id,
      name: getConversationName(item),
      lastMessage: getLastMessageText(item),
      time: getLastMessageTime(item),
      unreadCount: item.unreadCount || 0,
      avatar: item.avatar,
      type: item.type,
      isOnline:
        item.type === "private"
          ? item.participants?.some(
              (p: any) => p.clerkId !== userId && p.is_online
            )
          : false,
    };

    return (
      <ConversationItem
        conversation={conversationData}
        onPress={() => handleConversationPress(item)}
      />
    );
  };

  const renderSeparator = () => (
    <View className="h-px bg-gray-200 dark:bg-gray-800 ml-16" />
  );

  const renderEmptyState = () => (
    <View className="flex-1 justify-center items-center px-8">
      <Ionicons
        name="chatbubbles-outline"
        size={64}
        color={isDark ? "#4B5563" : "#D1D5DB"}
      />
      <Text className="text-gray-500 dark:text-gray-400 text-center mt-4 text-lg">
        No conversations yet
      </Text>
      <Text className="text-gray-400 dark:text-gray-500 text-center mt-2">
        Start a conversation with your friends
      </Text>
      <TouchableOpacity
        onPress={() => setIsCreateModalVisible(true)}
        className="bg-orange-500 rounded-full px-6 py-3 mt-6"
      >
        <Text className="text-white font-semibold">Start Chatting</Text>
      </TouchableOpacity>
    </View>
  );

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-black">
        <Header
          title="Conversations"
          onMenuPress={() => setIsSidebarVisible(true)}
        />
        <View className="flex-1 justify-center items-center px-8">
          <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
          <Text className="text-red-500 text-center mt-4 text-lg">{error}</Text>
          <TouchableOpacity
            onPress={handleRefresh}
            className="bg-orange-500 rounded-full px-6 py-3 mt-6"
          >
            <Text className="text-white font-semibold">Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={isDark ? "#000000" : "#FFFFFF"}
      />

      <Header
        title="Conversations"
        onMenuPress={() => setIsSidebarVisible(true)}
        rightComponent={
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={() => setIsCreateModalVisible(true)}
              className="p-2"
            >
              <Ionicons
                name="create-outline"
                size={24}
                color={isDark ? "#F97316" : "#FF8C42"}
              />
            </TouchableOpacity>

            {/* 🔥 AI Chatbot Button with Enhanced Badge */}
            <TouchableOpacity
              className="p-1 relative"
              onPress={() => handleAIChatPress(false)}
            >
              <View className="w-10 h-10 rounded-full border-2 border-orange-500 justify-center items-center bg-orange-50 dark:bg-orange-900/20">
                <Ionicons name="happy" size={20} color="#F97316" />
              </View>

              {/* Animated Notification Badge */}
              {hasNewRecommendations && (
                <View className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 items-center justify-center border-2 border-white dark:border-black">
                  <Text className="text-white text-[9px] font-bold">
                    {recommendations.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        }
      />

      <View className="px-4 py-2">
        <SearchInput
          placeholder="Search conversations..."
          value={searchText}
          onSearch={handleSearch}
          onClear={handleClear}
          className="mx-0"
        />
      </View>

      {filteredConversations.length === 0 && !loading ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={filteredConversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item._id}
          ItemSeparatorComponent={renderSeparator}
          showsVerticalScrollIndicator={false}
          className="flex-1"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={["#F97316"]}
              tintColor="#F97316"
            />
          }
        />
      )}

      {/* 🔥 Enhanced Floating Recommendation */}
      <FloatingRecommendation
        visible={showFloatingRec}
        recommendations={recommendations}
        dominantEmotion={dominantEmotion}
        confidence={emotionConfidence}
        onClose={handleCloseFloating}
        onOpenAIChat={() => handleAIChatPress(true)}
      />

      <Sidebar
        isVisible={isSidebarVisible}
        onClose={() => setIsSidebarVisible(false)}
      />

      <CreateConversationModal
        visible={isCreateModalVisible}
        onClose={() => setIsCreateModalVisible(false)}
        onCreateConversation={handleCreateConversation}
      />
    </SafeAreaView>
  );
}