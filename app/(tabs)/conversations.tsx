// app/(root)/(tabs)/conversations.tsx - UPDATED VERSION
import FloatingRecommendation from "@/components/page/ai/FloatingRecommendation";
import ConversationItem from "@/components/page/message/ConversationItem";
import CreateConversationModal from "@/components/page/message/CreateConversationModel";
import Header from "@/components/shared/Header";
import Sidebar from "@/components/shared/Sidebar";
import SearchInput from "@/components/ui/SearchInput";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useEmotion, EmotionCounselingData } from "@/hooks/ai/useEmotion";
import { useConversations } from "@/hooks/message/useConversations";
import { useSocket } from "@/hooks/message/useSocket";
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  RefreshControl,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ConversationsScreen() {
  const { actualTheme } = useTheme();
  const { t } = useLanguage();
  const isDark = actualTheme === "dark";
  const router = useRouter();
  const { userId } = useAuth();

  const { socket, isUserOnline, onlineUsers } = useSocket();

  const [searchText, setSearchText] = useState("");
  const [filteredConversations, setFilteredConversations] = useState<any[]>([]);
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

  const { getEmotionCounseling } = useEmotion({ days: 7 });

  // ✅ NEW: Floating recommendation states
  const [showFloatingRec, setShowFloatingRec] = useState(false);
  const [counselingData, setCounselingData] = useState<EmotionCounselingData | null>(null);
  const [counselingLoading, setCounselingLoading] = useState(false);

  // ✅ Log online users for debugging
  useEffect(() => {
    console.log("👥 Online users updated:", onlineUsers.length);
  }, [onlineUsers]);

  // ✅ Load counseling data on mount
  useEffect(() => {
    loadCounselingData();
  }, []);

  const loadCounselingData = async () => {
    setCounselingLoading(true);
    try {
      const result = await getEmotionCounseling(7); // Last 7 days
      if (result.success && result.data) {
        setCounselingData(result.data);
        console.log("📊 Counseling data loaded:", result.data);
      } else {
        console.error("Failed to load counseling:", result.error);
      }
    } catch (error) {
      console.error("Error loading counseling:", error);
    } finally {
      setCounselingLoading(false);
    }
  };

  // ✅ Socket listeners for real-time emotion updates
  useEffect(() => {
    if (!socket) return;

    socket.on("emotionAnalysisComplete", (data: any) => {
      console.log("🎯 Emotion analysis complete, refreshing counseling data");
      loadCounselingData();
    });

    socket.on("emotionAnalyzedWithRecommendations", (data: any) => {
      console.log("🎯 Emotion analyzed with recommendations, refreshing");
      loadCounselingData();
    });

    return () => {
      socket.off("emotionAnalysisComplete");
      socket.off("emotionAnalyzedWithRecommendations");
    };
  }, [socket]);

  // ✅ Toggle floating recommendation
  const toggleFloatingRec = () => {
    setShowFloatingRec(!showFloatingRec);
  };

  // ✅ Navigate to emotion tab
  const handleViewFullCounseling = () => {
    setShowFloatingRec(false);
    // Navigate to emotion tab
    router.push("/(tabs)/emotion");
  };

  // ✅ Filter conversations
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
      await loadCounselingData();
    } catch (error) {
      Alert.alert(t("error"), t("conversations.error.tryAgain"));
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
      Alert.alert(
        t("error"),
        t("conversations.createModal.errors.createFailed")
      );
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

  const getLastMessageText = useCallback(
    (conversation: any) => {
      if (!conversation.last_message) {
        return t("conversations.messageTypes.noMessages");
      }

      const message = conversation.last_message;
      const isMyMessage = message.sender?.clerkId === userId;

      let messageContent = "";

      switch (message.type) {
        case "text":
          messageContent =
            message.content || t("conversations.messageTypes.message");
          break;
        case "image":
          messageContent = t("conversations.messageTypes.image");
          break;
        case "file":
          messageContent = t("conversations.messageTypes.file");
          break;
        case "audio":
          messageContent = t("conversations.messageTypes.audio");
          break;
        case "video":
          messageContent = t("conversations.messageTypes.video");
          break;
        case "voice_note":
          messageContent = t("conversations.messageTypes.voiceNote");
          break;
        case "location":
          messageContent = t("conversations.messageTypes.location");
          break;
        case "gif":
          messageContent = "🎬 GIF";
          break;
        case "sticker":
          messageContent = "🎨 Sticker";
          break;
        default:
          messageContent = t("conversations.messageTypes.message");
      }

      if (conversation.type === "group") {
        if (isMyMessage) {
          return `${t("conversations.messagePrefix.you")} ${messageContent}`;
        } else if (message.sender) {
          const senderName =
            message.sender.full_name || message.sender.username || "Unknown";
          return `${t("conversations.messagePrefix.sender", { name: senderName })} ${messageContent}`;
        }
      } else {
        if (isMyMessage) {
          return `${t("conversations.messagePrefix.you")} ${messageContent}`;
        }
      }

      return messageContent;
    },
    [t, userId]
  );

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
    let isOnline = false;
    let avatarUrl = item.avatar;
    let otherUserId = null;

    if (item.type === "private") {
      const otherParticipant = item.participants?.find(
        (p: any) => p.clerkId !== userId
      );
      if (otherParticipant) {
        isOnline = isUserOnline(otherParticipant.clerkId);
        avatarUrl = otherParticipant.avatar;
        otherUserId = otherParticipant.clerkId;
      }
    }

    const conversationData = {
      id: item._id,
      name: getConversationName(item),
      lastMessage: getLastMessageText(item),
      time: getLastMessageTime(item),
      unreadCount: item.unreadCount || 0,
      avatar: avatarUrl,
      type: item.type,
      isOnline: isOnline,
      otherUserId: otherUserId,
    };

    return (
      <ConversationItem
        conversation={conversationData}
        onPress={() => handleConversationPress(item)}
      />
    );
  };

  const renderSeparator = () => (
    <View className={`h-px ml-16 ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />
  );

  const renderEmptyState = () => (
    <View className="flex-1 justify-center items-center px-8">
      <Ionicons
        name="chatbubbles-outline"
        size={64}
        color={isDark ? "#4B5563" : "#D1D5DB"}
      />
      <Text
        className={`text-center mt-4 text-lg ${isDark ? "text-gray-400" : "text-gray-500"}`}
      >
        {t("conversations.empty.title")}
      </Text>
      <Text
        className={`text-center mt-2 ${isDark ? "text-gray-500" : "text-gray-400"}`}
      >
        {t("conversations.empty.subtitle")}
      </Text>
      <TouchableOpacity
        onPress={() => setIsCreateModalVisible(true)}
        className="bg-orange-500 rounded-full px-6 py-3 mt-6"
      >
        <Text className="text-white font-semibold">
          {t("conversations.empty.startChatting")}
        </Text>
      </TouchableOpacity>
    </View>
  );

  if (error) {
    return (
      <SafeAreaView className={`flex-1 ${isDark ? "bg-black" : "bg-white"}`}>
        <Header
          title={t("conversations.title")}
          onMenuPress={() => setIsSidebarVisible(true)}
        />
        <View className="flex-1 justify-center items-center px-8">
          <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
          <Text className="text-red-500 text-center mt-4 text-lg">{error}</Text>
          <TouchableOpacity
            onPress={handleRefresh}
            className="bg-orange-500 rounded-full px-6 py-3 mt-6"
          >
            <Text className="text-white font-semibold">
              {t("conversations.error.tryAgain")}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ✅ Check if there's counseling data with recommendations
  const hasRecommendations = counselingData?.recommendations && 
    counselingData.recommendations.length > 0;

  return (
    <SafeAreaView className={`flex-1 ${isDark ? "bg-black" : "bg-white"}`}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={isDark ? "#000000" : "#FFFFFF"}
      />

      <Header
        title={t("conversations.title")}
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

            {/* ✅ NEW: Toggle button for floating recommendation */}
            <TouchableOpacity
              className="p-1 relative"
              onPress={toggleFloatingRec}
            >
              <View
                className={`w-10 h-10 rounded-full border-2 border-orange-500 justify-center items-center ${isDark ? "bg-orange-900/20" : "bg-orange-50"}`}
              >
                <Ionicons name="happy" size={20} color="#F97316" />
              </View>

              {/* ✅ Badge showing if there are recommendations */}
              {hasRecommendations && !showFloatingRec && (
                <View
                  className={`absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 items-center justify-center border-2 ${isDark ? "border-black" : "border-white"}`}
                >
                  <Text className="text-white text-[9px] font-bold">
                    {counselingData.recommendations.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        }
      />

      <View className="px-4 py-2">
        <SearchInput
          placeholder={t("conversations.searchPlaceholder")}
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
          extraData={onlineUsers}
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

      {/* ✅ NEW: Floating Recommendation with counseling data */}
      <FloatingRecommendation
        visible={showFloatingRec}
        counselingData={counselingData}
        loading={counselingLoading}
        onClose={() => setShowFloatingRec(false)}
        onViewFull={handleViewFullCounseling}
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