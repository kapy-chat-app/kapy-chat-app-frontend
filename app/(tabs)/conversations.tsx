// app/(root)/(tabs)/conversations.tsx - UPDATED WITH CORRECT ONLINE STATUS
import FloatingRecommendation from "@/components/page/ai/FloatingRecommendation";
import ConversationItem from "@/components/page/message/ConversationItem";
import CreateConversationModal from "@/components/page/message/CreateConversationModel";
import Header from "@/components/shared/Header";
import Sidebar from "@/components/shared/Sidebar";
import SearchInput from "@/components/ui/SearchInput";
import { useEmotion } from "@/hooks/ai/useEmotion";
import { useConversations } from "@/hooks/message/useConversations";
import { useEncryption } from "@/hooks/message/useEncryption";
import { useSocket } from "@/hooks/message/useSocket";
import { useAuth } from "@clerk/clerk-expo";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState, useCallback, useRef } from "react";
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

const RECOMMENDATION_STORAGE_KEY = "emotion_recommendation_dismissed";
const CHECK_INTERVAL = 2 * 60 * 1000;
const DISMISS_COOLDOWN = 15 * 60 * 1000;

export default function ConversationsScreen() {
  const { actualTheme } = useTheme();
  const { t } = useLanguage();
  const isDark = actualTheme === "dark";
  const router = useRouter();
  const { userId } = useAuth();
  
  // ✅ UPDATED: Get isUserOnline function from socket
  const { socket, isUserOnline, onlineUsers } = useSocket();

  const [searchText, setSearchText] = useState("");
  const [filteredConversations, setFilteredConversations] = useState<any[]>([]);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Decrypted messages cache
  const [decryptedMessages, setDecryptedMessages] = useState<Record<string, string>>({});
  const decryptionInProgress = useRef<Set<string>>(new Set());

  const {
    conversations,
    loading,
    error,
    createConversation,
    refreshConversations,
  } = useConversations();

  // E2EE Hook
  const { 
    decryptMessage, 
    isInitialized: encryptionReady 
  } = useEncryption();

  const { getRecommendations } = useEmotion();

  // Recommendation state
  const [showFloatingRec, setShowFloatingRec] = useState(false);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [dominantEmotion, setDominantEmotion] = useState<string>("neutral");
  const [emotionConfidence, setEmotionConfidence] = useState<number>(0);
  const [hasNewRecommendations, setHasNewRecommendations] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<number>(0);

  // ✅ Log online users for debugging
  useEffect(() => {
    console.log("👥 Online users updated in conversations:", onlineUsers.length);
    onlineUsers.forEach(u => {
      console.log(`  - ${u.userId} (${u.profile?.full_name || 'Unknown'})`);
    });
  }, [onlineUsers]);

  // Decrypt last messages when conversations change
  useEffect(() => {
    if (!encryptionReady || conversations.length === 0) return;

    const decryptLastMessages = async () => {
      for (const conversation of conversations) {
        const lastMessage = conversation.last_message;
        
        if (!lastMessage) continue;
        if (decryptedMessages[lastMessage._id]) continue;
        if (decryptionInProgress.current.has(lastMessage._id)) continue;

        if (lastMessage.type === 'text' && lastMessage.encrypted_content) {
          decryptionInProgress.current.add(lastMessage._id);

          try {
            const senderId = lastMessage.sender?.clerkId;
            if (!senderId) {
              console.warn(`⚠️ No sender ID for message ${lastMessage._id}`);
              continue;
            }

            console.log(`🔓 Decrypting preview for message ${lastMessage._id}`);
            
            const decrypted = await decryptMessage(
              senderId,
              lastMessage.encrypted_content
            );

            setDecryptedMessages(prev => ({
              ...prev,
              [lastMessage._id]: decrypted
            }));

            console.log(`✅ Decrypted preview: ${decrypted.substring(0, 30)}...`);
          } catch (error) {
            console.error(`❌ Failed to decrypt message ${lastMessage._id}:`, error);
            
            setDecryptedMessages(prev => ({
              ...prev,
              [lastMessage._id]: "[🔒 Encrypted]"
            }));
          } finally {
            decryptionInProgress.current.delete(lastMessage._id);
          }
        }
      }
    };

    decryptLastMessages();
  }, [conversations, encryptionReady, decryptMessage]);

  // Check recommendations on mount
  useEffect(() => {
    checkAndShowRecommendations();
    const interval = setInterval(checkAndShowRecommendations, CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    socket.on("sendRecommendations", (data: any) => {
      console.log("📨 Received AI recommendations:", data);
      handleNewRecommendations(
        data.recommendations, 
        data.based_on?.emotion || data.emotion,
        data.based_on?.confidence
      );
    });

    socket.on("emotionAnalysisComplete", (data: any) => {
      console.log("😊 Emotion analyzed:", data);
      const emotion = data.emotion_data.dominant_emotion;
      const confidence = data.emotion_data.confidence_score;

      if (confidence > 0.6) {
        console.log(`🎯 Strong ${emotion} detected, fetching recommendations...`);
        checkAndShowRecommendations();
      }
    });

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
      const dismissed = await AsyncStorage.getItem(RECOMMENDATION_STORAGE_KEY);
      const dismissedTime = dismissed ? parseInt(dismissed) : 0;

      if (now - dismissedTime < DISMISS_COOLDOWN) {
        console.log(`⏳ Cooldown active, ${Math.round((DISMISS_COOLDOWN - (now - dismissedTime)) / 60000)}m remaining`);
        return;
      }

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

        if (confidence > 0.5) {
          handleNewRecommendations(data.recommendations, emotion, confidence);
        } else {
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

    if (confidence > 0.5) {
      setShowFloatingRec(true);
    }
  };

  const handleCloseFloating = async () => {
    setShowFloatingRec(false);
    await AsyncStorage.setItem(
      RECOMMENDATION_STORAGE_KEY,
      Date.now().toString()
    );
    console.log("✅ Recommendations dismissed");
  };

  const handleAIChatPress = async (fromFloating: boolean = false) => {
    setHasNewRecommendations(false);
    setShowFloatingRec(false);

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

  // Filter with decrypted content
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

        const lastMessageId = conversation.last_message?._id;
        const lastMessageContent = lastMessageId && decryptedMessages[lastMessageId]
          ? decryptedMessages[lastMessageId]
          : conversation.last_message?.content || "";

        return (
          name.toLowerCase().includes(searchText.toLowerCase()) ||
          lastMessageContent.toLowerCase().includes(searchText.toLowerCase())
        );
      });
      setFilteredConversations(filtered);
    }
  }, [searchText, conversations, userId, decryptedMessages]);

  const handleSearch = (text: string) => {
    setSearchText(text);
  };

  const handleClear = () => {
    setSearchText("");
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      setDecryptedMessages({});
      decryptionInProgress.current.clear();
      
      await refreshConversations();
      await checkAndShowRecommendations();
    } catch (error) {
      Alert.alert(t('error'), t('conversations.error.tryAgain'));
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
      Alert.alert(t('error'), t('conversations.createModal.errors.createFailed'));
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

  // Get decrypted last message text
  const getLastMessageText = useCallback((conversation: any) => {
    if (!conversation.last_message) return t('conversations.messageTypes.noMessages');
    
    const message = conversation.last_message;
    
    switch (message.type) {
      case "text":
        if (message.encrypted_content) {
          const decrypted = decryptedMessages[message._id];
          if (decrypted) {
            return decrypted;
          }
          return "[🔒 Encrypted]";
        }
        return message.content || "";
      case "image":
        return t('conversations.messageTypes.image');
      case "file":
        return t('conversations.messageTypes.file');
      case "audio":
        return t('conversations.messageTypes.audio');
      case "video":
        return t('conversations.messageTypes.video');
      case "voice_note":
        return t('conversations.messageTypes.voiceNote');
      case "location":
        return t('conversations.messageTypes.location');
      case "gif":
        return "🎬 GIF";
      case "sticker":
        return "🎨 Sticker";
      default:
        return t('conversations.messageTypes.message');
    }
  }, [decryptedMessages, t]);

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

  // ✅ UPDATED: renderConversation with correct online status from socket
  const renderConversation = ({ item }: { item: any }) => {
    // ✅ Calculate isOnline from socket onlineUsers instead of database
    let isOnline = false;
    let avatarUrl = item.avatar;
    
    if (item.type === "private") {
      const otherParticipant = item.participants?.find(
        (p: any) => p.clerkId !== userId
      );
      if (otherParticipant) {
        isOnline = isUserOnline(otherParticipant.clerkId);
        avatarUrl = otherParticipant.avatar;
        
        // Debug log
        console.log(`🔍 Checking online status for ${otherParticipant.full_name}: ${isOnline ? '🟢 Online' : '⚪ Offline'}`);
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
      isOnline: isOnline, // ✅ Use value from socket
    };

    return (
      <ConversationItem
        conversation={conversationData}
        onPress={() => handleConversationPress(item)}
      />
    );
  };

  const renderSeparator = () => (
    <View className={`h-px ml-16 ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`} />
  );

  const renderEmptyState = () => (
    <View className="flex-1 justify-center items-center px-8">
      <Ionicons
        name="chatbubbles-outline"
        size={64}
        color={isDark ? "#4B5563" : "#D1D5DB"}
      />
      <Text className={`text-center mt-4 text-lg ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
        {t('conversations.empty.title')}
      </Text>
      <Text className={`text-center mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
        {t('conversations.empty.subtitle')}
      </Text>
      <TouchableOpacity
        onPress={() => setIsCreateModalVisible(true)}
        className="bg-orange-500 rounded-full px-6 py-3 mt-6"
      >
        <Text className="text-white font-semibold">{t('conversations.empty.startChatting')}</Text>
      </TouchableOpacity>
    </View>
  );

  if (error) {
    return (
      <SafeAreaView className={`flex-1 ${isDark ? 'bg-black' : 'bg-white'}`}>
        <Header
          title={t('conversations.title')}
          onMenuPress={() => setIsSidebarVisible(true)}
        />
        <View className="flex-1 justify-center items-center px-8">
          <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
          <Text className="text-red-500 text-center mt-4 text-lg">{error}</Text>
          <TouchableOpacity
            onPress={handleRefresh}
            className="bg-orange-500 rounded-full px-6 py-3 mt-6"
          >
            <Text className="text-white font-semibold">{t('conversations.error.tryAgain')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className={`flex-1 ${isDark ? 'bg-black' : 'bg-white'}`}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={isDark ? "#000000" : "#FFFFFF"}
      />

      <Header
        title={t('conversations.title')}
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

            {/* AI Chatbot Button */}
            <TouchableOpacity
              className="p-1 relative"
              onPress={() => handleAIChatPress(false)}
            >
              <View className={`w-10 h-10 rounded-full border-2 border-orange-500 justify-center items-center ${isDark ? 'bg-orange-900/20' : 'bg-orange-50'}`}>
                <Ionicons name="happy" size={20} color="#F97316" />
              </View>

              {hasNewRecommendations && (
                <View className={`absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 items-center justify-center border-2 ${isDark ? 'border-black' : 'border-white'}`}>
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
          placeholder={t('conversations.searchPlaceholder')}
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
          // ✅ Add extraData to re-render when onlineUsers changes
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

      {/* Floating Recommendation */}
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