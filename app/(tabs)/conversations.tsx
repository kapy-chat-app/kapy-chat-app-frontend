import ConversationItem from "@/components/page/message/ConversationItem";
import CreateConversationModal from "@/components/page/message/CreateConversationModel";
import Header from "@/components/shared/Header";
import Sidebar from "@/components/shared/Sidebar";
import SearchInput from "@/components/ui/SearchInput";
import { useConversations } from "@/hooks/message/useConversations";
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
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

export default function ConversationsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const router = useRouter();
  const { userId } = useAuth();
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
            
            <TouchableOpacity className="p-1">
              <View className="w-8 h-8 rounded-full border-2 border-orange-500 justify-center items-center">
                <Ionicons name="happy" size={16} color="#FF8C42" />
              </View>
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