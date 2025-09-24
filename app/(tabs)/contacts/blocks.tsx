import { BlockedUserItem } from "@/components/page/friend/BlockedUserItem";
import Header from "@/components/shared/Header";
import SearchInput from "@/components/ui/SearchInput";
import { BlockedUser, useBlockedUsers } from "@/hooks/friend/useFriends";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const BlocksScreen = () => {
  const {
    blockedUsers,
    loading,
    error,
    totalCount,
    loadBlockedUsers,
    unblockUser,
    clearError,
  } = useBlockedUsers();
  const router = useRouter();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [unblockingUsers, setUnblockingUsers] = useState<Set<string>>(
    new Set()
  );
  const [hasSearched, setHasSearched] = useState(false); // Track nếu đã từng search

  // Load initial data một lần duy nhất
  useEffect(() => {
    loadBlockedUsers(1, "");
  }, []); // Empty dependency array

  // Chỉ handle search với debounce - không load initial data
  useEffect(() => {
    if (!hasSearched) return; // Skip nếu chưa từng search
    
    const timeoutId = setTimeout(async () => {
      setCurrentPage(1);
      setHasMore(true);
      
      const result = await loadBlockedUsers(1, searchQuery);
      
      if (result.success && result.data) {
        setHasMore(result.data.blockedUsers.length < result.data.totalCount);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, hasSearched]);

  // Update hasMore khi data thay đổi
  useEffect(() => {
    if (blockedUsers.length >= 0) {
      setHasMore(blockedUsers.length < totalCount);
    }
  }, [blockedUsers.length, totalCount]);

  // Handle search input change
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    if (query.trim() !== "" || hasSearched) {
      setHasSearched(true);
    }
  }, [hasSearched]);

  // Handle manual search trigger (if SearchInput has separate onSearch)
  const handleSearchSubmit = useCallback((query: string) => {
    setSearchQuery(query);
    setHasSearched(true);
    setCurrentPage(1);
    setHasMore(true);
    loadBlockedUsers(1, query);
  }, []);

  const handleLoadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;

    setLoadingMore(true);
    const nextPage = currentPage + 1;

    try {
      const result = await loadBlockedUsers(nextPage, searchQuery);

      if (result.success && result.data) {
        setCurrentPage(nextPage);

        // Check if we have more data to load
        const totalLoaded =
          blockedUsers.length + result.data.blockedUsers.length;
        setHasMore(totalLoaded < result.data.totalCount);
      }
    } catch (error) {
      console.error("Error loading more blocked users:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [
    loading,
    loadingMore,
    hasMore,
    currentPage,
    searchQuery,
    blockedUsers.length,
  ]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setCurrentPage(1);
    setHasMore(true);

    try {
      const result = await loadBlockedUsers(1, searchQuery);
      if (result.success && result.data) {
        setHasMore(result.data.blockedUsers.length < result.data.totalCount);
      }
    } finally {
      setRefreshing(false);
    }
  }, [searchQuery]);

  const handleUnblockUser = useCallback(
    async (userId: string) => {
      // Add user to unblocking set to show loading state
      setUnblockingUsers((prev) => new Set(prev).add(userId));

      try {
        const result = await unblockUser(userId);

        if (result.success) {
          Alert.alert(
            "Success",
            result.message || "User unblocked successfully"
          );
          // Update totalCount after successful unblock
          // The user is already removed from the list by the hook
        } else {
          Alert.alert("Error", result.error || "Failed to unblock user");
        }
      } catch (error) {
        Alert.alert("Error", "An unexpected error occurred");
      } finally {
        // Remove user from unblocking set
        setUnblockingUsers((prev) => {
          const newSet = new Set(prev);
          newSet.delete(userId);
          return newSet;
        });
      }
    },
    [unblockUser]
  );

  const handleViewProfile = useCallback((userId: string) => {
    router.push(`/(tabs)/contacts/public-profile/${userId}`);
  }, [router]);

  const handleBackPress = useCallback(() => {
    router.back();
  }, [router]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    setHasSearched(false);
    setCurrentPage(1);
    setHasMore(true);
    loadBlockedUsers(1, "");
  }, []);

  // Memoize render functions to prevent unnecessary re-renders
  const renderBlockedUserItem = useCallback(
    ({ item }: { item: BlockedUser }) => (
      <BlockedUserItem
        blockedUser={item}
        onUnblock={handleUnblockUser}
        isUnblocking={unblockingUsers.has(item.id)}
        onPress={() => handleViewProfile(item.id)}
      />
    ),
    [handleUnblockUser, handleViewProfile, unblockingUsers]
  );

  const renderListFooter = useMemo(() => {
    if (!loadingMore) return null;

    return (
      <View className="py-4 items-center">
        <ActivityIndicator size="small" color="#FF8C42" />
        <Text className="text-gray-500 text-sm mt-2">Loading more...</Text>
      </View>
    );
  }, [loadingMore]);

  const renderEmptyState = useMemo(() => {
    if (loading && blockedUsers.length === 0) return null;

    return (
      <View className="flex-1 items-center justify-center py-16">
        <Ionicons name="ban-outline" size={64} color="#9CA3AF" />
        <Text className="text-gray-500 text-lg font-medium mt-4">
          {searchQuery ? "No blocked users found" : "No blocked users"}
        </Text>
        <Text className="text-gray-400 text-sm mt-2 text-center px-8">
          {searchQuery
            ? "Try adjusting your search terms"
            : "Users you block will appear here"}
        </Text>
      </View>
    );
  }, [loading, searchQuery, blockedUsers.length]);

  // Clear error when component unmounts or error changes
  useEffect(() => {
    if (error) {
      const timeoutId = setTimeout(() => {
        clearError();
      }, 5000);
      return () => clearTimeout(timeoutId);
    }
  }, [error, clearError]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-black">
      {/* Header */}
      <Header
        title="Blocked Users"
        showBackButton={true}
        onBackPress={handleBackPress}
      />

      {/* Search Bar */}
      <SearchInput
        placeholder="Search blocked users..."
        value={searchQuery}
        onChangeText={handleSearchChange}
        onSearch={handleSearchSubmit}
        onClear={handleClearSearch}
        style={{ marginHorizontal: 16, marginBottom: 16 }}
      />

      {/* Error Message */}
      {error && (
        <View className="bg-red-50 dark:bg-red-900/20 px-4 py-3 border-b border-red-200 dark:border-red-800">
          <View className="flex-row items-center">
            <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
            <Text className="text-red-600 dark:text-red-400 text-sm ml-2 flex-1">
              {error}
            </Text>
          </View>
        </View>
      )}

      {/* Loading State */}
      {loading && blockedUsers.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FF8C42" />
          <Text className="text-gray-500 mt-4">Loading blocked users...</Text>
        </View>
      ) : (
        <FlatList
          data={blockedUsers}
          renderItem={renderBlockedUserItem}
          keyExtractor={(item) => item.id}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={["#FF8C42"]}
              tintColor="#FF8C42"
            />
          }
          ListFooterComponent={renderListFooter}
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={
            blockedUsers.length === 0
              ? { flexGrow: 1 }
              : { paddingBottom: 20, paddingTop: 8 }
          }
        />
      )}
    </SafeAreaView>
  );
};

export default BlocksScreen;