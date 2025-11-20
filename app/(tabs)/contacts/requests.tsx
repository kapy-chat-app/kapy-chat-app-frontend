import { FriendRequestCard } from "@/components/page/friend/FriendRequestCard";
import Header from "@/components/shared/Header";
import Sidebar from "@/components/shared/Sidebar";
import SearchInput from "@/components/ui/SearchInput";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useFriendRequests, FriendRequest } from "@/hooks/friend/useFriends";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  RefreshControl,
  Text,
  View,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const RequestsScreen = () => {
  const { actualTheme } = useTheme();
  const { t } = useLanguage();
  const isDark = actualTheme === "dark";

  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const {
    requests,
    loading,
    loadFriendRequests,
    respondToRequest,
    requestCount,
  } = useFriendRequests();

  // Load initial data
  useEffect(() => {
    loadFriendRequests("received");
  }, [loadFriendRequests]);

  // Filter requests based on search query
  const filteredRequests = useMemo(() => {
    if (!searchQuery.trim()) {
      return requests;
    }
    
    const query = searchQuery.toLowerCase().trim();
    return requests.filter(
      (request) =>
        request.requester.full_name.toLowerCase().includes(query) ||
        request.requester.username.toLowerCase().includes(query)
    );
  }, [requests, searchQuery]);

  const handleMenuPress = useCallback(() => {
    setIsSidebarVisible(true);
  }, []);

  const handleSidebarClose = useCallback(() => {
    setIsSidebarVisible(false);
  }, []);

  const handleBackPress = useCallback(() => {
    router.back();
  }, []);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    try {
      await loadFriendRequests("received");
    } catch (error) {
      console.error("Error refreshing:", error);
    } finally {
      setRefreshing(false);
    }
  }, [loadFriendRequests]);

  // Lazy loading - load more when reaching end
  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore || loading) return;

    setLoadingMore(true);
    try {
      // Simulate pagination - in real app, you'd pass page number to API
      const nextPage = page + 1;
      setPage(nextPage);
      
      // If no more data, set hasMore to false
      // This should be based on actual API response
      if (requests.length >= requestCount) {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error loading more:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, loading, page, requests.length, requestCount]);

  const handleAcceptRequest = useCallback(
    async (requestId: string) => {
      const result = await respondToRequest(requestId, "accept");
      if (result.success) {
        // Reload requests để cập nhật UI
        await loadFriendRequests("received");
      } else {
        Alert.alert(
          t("error"),
          result.error || t("friends.requests.acceptFailed")
        );
      }
    },
    [respondToRequest, loadFriendRequests, t]
  );

  const handleDeclineRequest = useCallback(
    async (requestId: string) => {
      const result = await respondToRequest(requestId, "decline");
      if (result.success) {
        // Reload requests để cập nhật UI
        await loadFriendRequests("received");
      } else {
        Alert.alert(
          t("error"),
          result.error || t("friends.requests.declineFailed")
        );
      }
    },
    [respondToRequest, loadFriendRequests, t]
  );

  const renderRequestItem = useCallback(
    ({ item }: { item: FriendRequest }) => (
      <FriendRequestCard
        request={item}
        onAccept={handleAcceptRequest}
        onDecline={handleDeclineRequest}
      />
    ),
    [handleAcceptRequest, handleDeclineRequest]
  );

  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;
    
    return (
      <View className="py-4 items-center">
        <ActivityIndicator size="small" color="#FF8C42" />
      </View>
    );
  }, [loadingMore]);

  const renderEmpty = useCallback(() => {
    if (loading) return null;

    return (
      <View className="flex-1 justify-center items-center py-20">
        <Ionicons
          name="people-outline"
          size={64}
          color={isDark ? "#4B5563" : "#9CA3AF"}
        />
        <Text
          className={`text-lg font-medium mt-4 ${
            isDark ? "text-white" : "text-gray-900"
          }`}
        >
          {searchQuery.trim()
            ? t("requests.noResults")
            : t("requests.empty")}
        </Text>
        <Text
          className={`text-sm mt-2 text-center px-8 ${
            isDark ? "text-gray-400" : "text-gray-500"
          }`}
        >
          {searchQuery.trim()
            ? t("requests.noResultsDescription")
            : t("requests.emptyDescription")}
        </Text>
      </View>
    );
  }, [loading, isDark, searchQuery, t]);

  const keyExtractor = useCallback((item: FriendRequest) => item.id, []);

  return (
    <SafeAreaView className={`flex-1 ${isDark ? "bg-black" : "bg-gray-50"}`}>
      <Header
        title={t("requests.title")}
        onMenuPress={handleMenuPress}
        onBackPress={handleBackPress}
        showBackButton={true}
      />

      {/* Search Input */}
      <SearchInput
        placeholder={t("requests.searchPlaceholder")}
        onSearch={handleSearch}
        style={{ marginHorizontal: 16, marginBottom: 16 }}
      />

      {/* Request Count */}
      {!searchQuery.trim() && requestCount > 0 && (
        <View className="px-4 mb-3">
          <Text
            className={`text-sm font-medium ${
              isDark ? "text-gray-400" : "text-gray-600"
            }`}
          >
            {t("requests.count", { count: requestCount })}
          </Text>
        </View>
      )}

      {/* Search Results Count */}
      {searchQuery.trim() && (
        <View className="px-4 mb-3">
          <Text
            className={`text-sm font-medium ${
              isDark ? "text-gray-400" : "text-gray-600"
            }`}
          >
            {t("requests.resultsCount", { count: filteredRequests.length })}
          </Text>
        </View>
      )}

      {/* Loading State */}
      {loading && !refreshing && requests.length === 0 ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#FF8C42" />
          <Text
            className={`text-lg mt-4 ${isDark ? "text-white" : "text-black"}`}
          >
            {t("loading")}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredRequests}
          renderItem={renderRequestItem}
          keyExtractor={keyExtractor}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#FF8C42"
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={
            filteredRequests.length === 0 ? { flex: 1 } : { paddingBottom: 20 }
          }
        />
      )}

      <Sidebar isVisible={isSidebarVisible} onClose={handleSidebarClose} />
    </SafeAreaView>
  );
};

RequestsScreen.displayName = "RequestsScreen";

export default RequestsScreen;