// components/page/message/SearchMessage.tsx
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { useSearchMessages } from "@/hooks/message/useMessageInfo";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

interface SearchMessagesProps {
  conversationId: string;
  onMessagePress: (messageId: string) => void;
}

export default function SearchMessages({
  conversationId,
  onMessagePress,
}: SearchMessagesProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const [searchText, setSearchText] = useState("");
  const { results, loading, hasMore, search, loadMore, reset } =
    useSearchMessages(conversationId);

  const handleSearch = () => {
    if (searchText.trim()) {
      search(searchText.trim());
    }
  };

  const handleClear = () => {
    setSearchText("");
    reset();
  };

  const highlightText = (text: string, query: string) => {
    if (!query || !text) return <Text>{text}</Text>;

    const parts = text.split(new RegExp(`(${query})`, "gi"));
    return (
      <Text>
        {parts.map((part, index) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <Text key={index} className="bg-orange-200 dark:bg-orange-900 text-orange-900 dark:text-orange-200 font-semibold">
              {part}
            </Text>
          ) : (
            <Text key={index}>{part}</Text>
          )
        )}
      </Text>
    );
  };

  const renderSearchResult = ({ item }: { item: any }) => {
    return (
      <TouchableOpacity
        className="bg-gray-50 dark:bg-gray-900 p-3 rounded-xl mb-3"
        onPress={() => onMessagePress(item._id)}
      >
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-sm font-semibold text-gray-900 dark:text-white">
            {item.sender?.full_name || "Unknown"}
          </Text>
          <Text className="text-xs text-gray-500 dark:text-gray-400">
            {format(new Date(item.created_at), "dd/MM/yyyy HH:mm", {
              locale: vi,
            })}
          </Text>
        </View>
        <View>
          <Text className="text-sm text-gray-700 dark:text-gray-300 leading-5">
            {highlightText(item.content || "", searchText)}
          </Text>
        </View>
        {item.attachments && item.attachments.length > 0 && (
          <View className="flex-row items-center mt-2">
            <Ionicons
              name="attach"
              size={14}
              color={isDark ? "#9CA3AF" : "#6B7280"}
            />
            <Text className="text-xs text-gray-600 dark:text-gray-400 ml-1">
              {item.attachments.length} tệp đính kèm
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderFooter = () => {
    if (!loading) return null;
    return (
      <View className="p-5 items-center">
        <ActivityIndicator size="small" color={isDark ? "#F97316" : "#3B82F6"} />
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading && results.length === 0) {
      return (
        <View className="flex-1 justify-center items-center py-15">
          <ActivityIndicator size="large" color={isDark ? "#F97316" : "#3B82F6"} />
        </View>
      );
    }

    if (!searchText) {
      return (
        <View className="flex-1 justify-center items-center py-15">
          <Ionicons
            name="search-outline"
            size={64}
            color={isDark ? "#4B5563" : "#D1D5DB"}
          />
          <Text className="text-base text-gray-400 dark:text-gray-600 mt-4 text-center">
            Nhập từ khóa để tìm kiếm tin nhắn
          </Text>
        </View>
      );
    }

    if (results.length === 0) {
      return (
        <View className="flex-1 justify-center items-center py-15">
          <Ionicons
            name="search-outline"
            size={64}
            color={isDark ? "#4B5563" : "#D1D5DB"}
          />
          <Text className="text-base text-gray-400 dark:text-gray-600 mt-4 text-center">
            Không tìm thấy kết quả
          </Text>
        </View>
      );
    }

    return null;
  };

  return (
    <View className="flex-1 bg-white dark:bg-black">
      <View className="flex-row items-center bg-gray-100 dark:bg-gray-900 m-4 px-3 rounded-xl h-11">
        <Ionicons
          name="search"
          size={20}
          color={isDark ? "#9CA3AF" : "#6B7280"}
          style={{ marginRight: 8 }}
        />
        <TextInput
          className="flex-1 text-base text-gray-900 dark:text-white"
          placeholder="Tìm kiếm tin nhắn..."
          placeholderTextColor={isDark ? "#6B7280" : "#9CA3AF"}
          value={searchText}
          onChangeText={setSearchText}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={handleClear} className="p-1">
            <Ionicons
              name="close-circle"
              size={20}
              color={isDark ? "#9CA3AF" : "#6B7280"}
            />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={results}
        renderItem={renderSearchResult}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16 }}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}