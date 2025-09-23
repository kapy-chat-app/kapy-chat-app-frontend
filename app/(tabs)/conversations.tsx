import ConversationItem from "@/components/page/message/ConversationItem";
import Header from "@/components/shared/Header";
import Sidebar from "@/components/shared/Sidebar";
import SearchInput from "@/components/ui/SearchInput";
import React, { useState } from "react";
import {
  FlatList,
  StatusBar,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface Conversation {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  avatar?: string;
  unreadCount?: number;
}

const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: "1",
    name: "John Doe",
    lastMessage: "The recent message will be like this...",
    time: "00:00",
  },
  {
    id: "2",
    name: "Jane Smith",
    lastMessage: "The recent message will be like this...",
    time: "00:00",
  },
  {
    id: "3",
    name: "Mike Johnson",
    lastMessage: "The recent message will be like this...",
    time: "00:00",
  },
  {
    id: "4",
    name: "Sarah Wilson",
    lastMessage: "The recent message will be like this...",
    time: "00:00",
  },
  {
    id: "5",
    name: "David Brown",
    lastMessage: "The recent message will be like this...",
    time: "00:00",
  },
  {
    id: "6",
    name: "Emma Davis",
    lastMessage: "The recent message will be like this...",
    time: "00:00",
  },
  {
    id: "7",
    name: "Alex Miller",
    lastMessage: "The recent message will be like this...",
    time: "00:00",
  },
  {
    id: "8",
    name: "Lisa Anderson",
    lastMessage: "The recent message will be like this...",
    time: "00:00",
  },
];

export default function ConversationsScreen() {
  const colorScheme = useColorScheme();
  const [searchText, setSearchText] = useState("");
  const [filteredConversations, setFilteredConversations] = useState(MOCK_CONVERSATIONS);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);

  const handleSearch = (text: string) => {
    setSearchText(text);
    if (text.trim() === "") {
      setFilteredConversations(MOCK_CONVERSATIONS);
    } else {
      const filtered = MOCK_CONVERSATIONS.filter(
        (conversation) =>
          conversation.name.toLowerCase().includes(text.toLowerCase()) ||
          conversation.lastMessage.toLowerCase().includes(text.toLowerCase())
      );
      setFilteredConversations(filtered);
    }
  };

  const handleClear = () => {
    setSearchText("");
    setFilteredConversations(MOCK_CONVERSATIONS);
  };

  const renderConversation = ({ item }: { item: Conversation }) => (
    <ConversationItem
      conversation={item}
      onPress={() => {
        // Handle conversation press - navigate to chat screen
        console.log("Navigate to chat with", item.name);
      }}
    />
  );

  const renderSeparator = () => (
    <View className="h-px bg-gray-200 dark:bg-gray-700 ml-16" />
  );

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      <StatusBar
        barStyle={colorScheme === "dark" ? "light-content" : "dark-content"}
        backgroundColor={colorScheme === "dark" ? "#000000" : "#FFFFFF"}
      />

      <Header 
        title="Conversations" 
        onMenuPress={() => setIsSidebarVisible(true)}
      />

      <View className="px-4 py-2">
        <SearchInput
          placeholder="Search..."
          value={searchText}
          onSearch={handleSearch}
          onClear={handleClear}
          className="mx-0"
        />
      </View>

      <FlatList
        data={filteredConversations}
        renderItem={renderConversation}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={renderSeparator}
        showsVerticalScrollIndicator={false}
        className="pb-5"
      />

      {/* Sidebar Overlay */}
      <Sidebar
        isVisible={isSidebarVisible}
        onClose={() => setIsSidebarVisible(false)}
      />
    </SafeAreaView>
  );
}