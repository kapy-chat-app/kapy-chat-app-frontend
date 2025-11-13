// components/page/message/SearchMessage.tsx
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSearchMessages } from "@/hooks/message/useMessageInfo";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";

interface SearchMessagesProps {
  conversationId: string;
  onMessagePress: (messageId: string) => void;
}

export default function SearchMessages({
  conversationId,
  onMessagePress,
}: SearchMessagesProps) {
  const { actualTheme } = useTheme();
  const { t } = useLanguage();
  const isDark = actualTheme === "dark";
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
            <Text key={index} className={`bg-orange-200 dark:bg-orange-900 text-orange-900 dark:text-orange-200 font-semibold`}>
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
        className={`p-3 rounded-xl mb-3 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}
        onPress={() => onMessagePress(item._id)}
      >
        <View className="flex-row justify-between items-center mb-2">
          <Text className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {item.sender?.full_name || t('message.unknownUser')}
          </Text>
          <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {format(new Date(item.created_at), "dd/MM/yyyy HH:mm", {
              locale: vi,
            })}
          </Text>
        </View>
        <View>
          <Text className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'} leading-5`}>
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
            <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'} ml-1`}>
              {item.attachments.length} {t('message.attachment.files')}
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
          <Text className={`text-base ${isDark ? 'text-gray-600' : 'text-gray-400'} mt-4 text-center`}>
            {t('message.info.searchPlaceholder')}
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
          <Text className={`text-base ${isDark ? 'text-gray-600' : 'text-gray-400'} mt-4 text-center`}>
            {t('message.info.noResults')}
          </Text>
        </View>
      );
    }

    return null;
  };

  return (
    <View className={`flex-1 ${isDark ? 'bg-black' : 'bg-white'}`}>
      <View className={`flex-row items-center m-4 px-3 rounded-xl h-11 ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
        <Ionicons
          name="search"
          size={20}
          color={isDark ? "#9CA3AF" : "#6B7280"}
          style={{ marginRight: 8 }}
        />
        <TextInput
          className={`flex-1 text-base ${isDark ? 'text-white' : 'text-gray-900'}`}
          placeholder={t('message.info.searchMessages')}
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