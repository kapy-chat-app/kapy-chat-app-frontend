// app/(root)/(tabs)/conversations.tsx - UPDATED
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
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

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

  // Floating recommendation state
  const [showFloatingRec, setShowFloatingRec] = useState(false);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [dominantEmotion, setDominantEmotion] = useState<string>("neutral");
  const [hasNewRecommendations, setHasNewRecommendations] = useState(false);

  // Check recommendations on mount and periodically
  useEffect(() => {
    checkAndShowRecommendations();

    // Check every 5 minutes
    const interval = setInterval(checkAndShowRecommendations, CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // Listen to socket events for real-time emotion updates
  useEffect(() => {
    if (!socket) return;

    socket.on("sendRecommendations", (data: any) => {
      console.log("📨 Received recommendations:", data);
      handleNewRecommendations(data.recommendations, data.based_on?.emotion);
    });

    socket.on("emotionAnalysisComplete", (data: any) => {
      console.log("😊 Emotion analyzed:", data);
      const emotion = data.emotion_data.dominant_emotion;

      // Show recommendations for negative emotions
      if (["sadness", "anger", "fear"].includes(emotion)) {
        checkAndShowRecommendations();
      }
    });

    return () => {
      socket.off("sendRecommendations");
      socket.off("emotionAnalysisComplete");
    };
  }, [socket]);

  const checkAndShowRecommendations = async () => {
    try {
      // Check if user dismissed recommendations recently
      const dismissed = await AsyncStorage.getItem(RECOMMENDATION_STORAGE_KEY);
      const dismissedTime = dismissed ? parseInt(dismissed) : 0;
      const now = Date.now();

      // Don't show if dismissed less than 30 minutes ago
      if (now - dismissedTime < 30 * 60 * 1000) {
        return;
      }

      const data = await getRecommendations();

      if (data?.recommendations && data.recommendations.length > 0) {
        const emotion = data.based_on?.dominant_pattern || "neutral";

        // Only show floating notification for negative emotions
        if (["sadness", "anger", "fear"].includes(emotion)) {
          handleNewRecommendations(data.recommendations, emotion);
        } else {
          // Just set badge for positive/neutral emotions
          setHasNewRecommendations(true);
          setRecommendations(data.recommendations);
          setDominantEmotion(emotion);
        }
      }
    } catch (error) {
      console.error("Error checking recommendations:", error);
    }
  };

  const handleNewRecommendations = (
    recs: string[],
    emotion: string = "neutral"
  ) => {
    setRecommendations(recs);
    setDominantEmotion(emotion);
    setHasNewRecommendations(true);

    // Show floating notification for concerning emotions
    if (["sadness", "anger", "fear"].includes(emotion)) {
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
  };

  const handleAIChatPress = () => {
    setHasNewRecommendations(false);
    setShowFloatingRec(false);
    router.push("/ai-chat");
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

            {/* AI Chatbot Button with Badge */}
            <TouchableOpacity
              className="p-1 relative"
              onPress={handleAIChatPress}
            >
              <View className="w-10 h-10 rounded-full border-2 border-orange-500 justify-center items-center bg-orange-50 dark:bg-orange-900/20">
                <Ionicons name="happy" size={20} color="#F97316" />
              </View>

              {/* Notification Badge */}
              {hasNewRecommendations && (
                <View className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 items-center justify-center border-2 border-white dark:border-black">
                  <View className="w-2 h-2 rounded-full bg-white" />
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

      {/* Floating Recommendation */}
      <FloatingRecommendation
        visible={showFloatingRec}
        recommendations={recommendations}
        dominantEmotion={dominantEmotion}
        onClose={handleCloseFloating}
        onOpenAIChat={handleAIChatPress}
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
