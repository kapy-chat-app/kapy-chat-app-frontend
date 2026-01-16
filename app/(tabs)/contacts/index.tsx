import { AlphabetIndex } from "@/components/page/friend/AlphabetIndex";
import { FriendListItem } from "@/components/page/friend/FriendListItem";
import { FriendRequestCard } from "@/components/page/friend/FriendRequestCard";
import { TabHeader } from "@/components/page/friend/TabHeader";
import Header from "@/components/shared/Header";
import Sidebar from "@/components/shared/Sidebar";
import Button from "@/components/ui/Button";
import SearchInput from "@/components/ui/SearchInput";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  Friend,
  User,
  useFriendRequests,
  useFriendSearch,
  useFriendsList,
  useBlockedUsers,
} from "@/hooks/friend/useFriends";
import { useSocket } from "@/hooks/message/useSocket";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  SectionList,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Toast notification component for realtime events
const ToastNotification = ({
  message,
  visible,
  onHide,
  type = "info",
}: {
  message: string;
  visible: boolean;
  onHide: () => void;
  type?: "info" | "success" | "warning";
}) => {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === "dark";

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(onHide, 3000);
      return () => clearTimeout(timer);
    }
  }, [visible, onHide]);

  if (!visible) return null;

  const bgColor = {
    info: isDark ? "bg-blue-900" : "bg-blue-100",
    success: isDark ? "bg-green-900" : "bg-green-100",
    warning: isDark ? "bg-orange-900" : "bg-orange-100",
  }[type];

  const textColor = {
    info: isDark ? "text-blue-200" : "text-blue-800",
    success: isDark ? "text-green-200" : "text-green-800",
    warning: isDark ? "text-orange-200" : "text-orange-800",
  }[type];

  return (
    <View
      className={`absolute top-4 left-4 right-4 ${bgColor} rounded-lg p-4 shadow-lg z-50`}
    >
      <Text className={`${textColor} text-center font-medium`}>{message}</Text>
    </View>
  );
};

const FriendsScreen = () => {
  const { actualTheme } = useTheme();
  const { t } = useLanguage();
  const isDark = actualTheme === "dark";
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "info" as "info" | "success" | "warning",
  });

  // Optimistic state for search results
  const [optimisticSearchResults, setOptimisticSearchResults] = useState<User[]>([]);
  // Loading states for individual actions
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);

  const router = useRouter();
  
  // ✨ NEW: Get onlineUsers from socket for real-time status
  const { socket, onlineUsers } = useSocket();

  const {
    searchResults,
    loading: searchLoading,
    searchUsers,
  } = useFriendSearch();

  const {
    requests,
    requestCount,
    sendFriendRequest,
    respondToRequest,
    loadFriendRequests,
    cancelRequest,
    sentRequests,
  } = useFriendRequests();

  const {
    friends,
    loading: friendsLoading,
    loadFriends,
    totalCount,
    removeFriend,
  } = useFriendsList();

  const { blockUser } = useBlockedUsers();

  // ✨ Log online users for debugging
  useEffect(() => {
    console.log("👥 Online users in FriendsScreen:", onlineUsers.length);
    onlineUsers.forEach(u => {
      console.log(`  - ${u.userId} (${u.profile?.full_name || 'Unknown'})`);
    });
  }, [onlineUsers]);

  // Sync optimistic state with actual search results
  useEffect(() => {
    setOptimisticSearchResults(searchResults);
  }, [searchResults]);

  // Load sent requests when component mounts
  useEffect(() => {
    loadFriendRequests("all");
  }, [loadFriendRequests]);

  // Show toast notification
  const showToast = useCallback(
    (message: string, type: "info" | "success" | "warning" = "info") => {
      setToast({ visible: true, message, type });
    },
    []
  );

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  // Socket event listeners for toast notifications
  useEffect(() => {
    if (!socket) return;

    // Friend request received
    const handleFriendRequestReceived = (data: any) => {
      showToast(
        t("friends.notifications.requestReceived", {
          name: data.requester_name,
        }),
        "info"
      );
      loadFriendRequests("all");
    };

    // Friend request accepted
    const handleFriendRequestAccepted = (data: any) => {
      showToast(
        t("friends.notifications.requestAccepted", {
          name: data.new_friend_name,
        }),
        "success"
      );
      loadFriends();
      loadFriendRequests("all");
    };

    // Friend request declined
    const handleFriendRequestDeclined = (data: any) => {
      showToast(
        t("friends.notifications.requestDeclined", {
          name: data.declined_by_name,
        }),
        "warning"
      );
    };

    // Friend request cancelled
    const handleFriendRequestCancelled = (data: any) => {
      showToast(
        t("friends.notifications.requestCancelled", {
          name: data.cancelled_by_name,
        }),
        "warning"
      );
      loadFriendRequests("all");
    };

    // Friend removed
    const handleFriendRemoved = (data: any) => {
      const name = data.removed_by_name || data.removed_user_name;
      showToast(t("friends.notifications.friendRemoved", { name }), "warning");
      loadFriends();
    };

    // Friend blocked
    const handleFriendBlocked = (data: any) => {
      loadFriends();
    };

    // Friend online status changed
    const handleFriendStatusChanged = (data: any) => {
      console.log(`👤 Friend status changed in FriendsScreen: ${data.friend_id} - ${data.status}`);
      // SectionList will auto re-render thanks to extraData={onlineUsers}
    };

    // Register socket listeners
    socket.on("friendRequestReceived", handleFriendRequestReceived);
    socket.on("friendRequestAccepted", handleFriendRequestAccepted);
    socket.on("friendRequestDeclined", handleFriendRequestDeclined);
    socket.on("friendRequestCancelled", handleFriendRequestCancelled);
    socket.on("friendRemoved", handleFriendRemoved);
    socket.on("friendBlocked", handleFriendBlocked);
    socket.on("friendStatusChanged", handleFriendStatusChanged);

    // Cleanup
    return () => {
      socket.off("friendRequestReceived", handleFriendRequestReceived);
      socket.off("friendRequestAccepted", handleFriendRequestAccepted);
      socket.off("friendRequestDeclined", handleFriendRequestDeclined);
      socket.off("friendRequestCancelled", handleFriendRequestCancelled);
      socket.off("friendRemoved", handleFriendRemoved);
      socket.off("friendBlocked", handleFriendBlocked);
      socket.off("friendStatusChanged", handleFriendStatusChanged);
    };
  }, [socket, showToast, t, loadFriends, loadFriendRequests]);

  // Group friends alphabetically
  const groupedFriends = useMemo(() => {
    const groups: { [key: string]: Friend[] } = {};

    friends.forEach((friend) => {
      const firstLetter = friend.full_name.charAt(0).toUpperCase();
      if (!groups[firstLetter]) {
        groups[firstLetter] = [];
      }
      groups[firstLetter].push(friend);
    });

    return Object.keys(groups)
      .sort()
      .map((letter) => ({
        title: letter,
        data: groups[letter],
      }));
  }, [friends]);

  const alphabet = useMemo(() => {
    return Array.from(
      new Set(friends.map((f) => f.full_name.charAt(0).toUpperCase()))
    ).sort();
  }, [friends]);

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (query.trim()) {
        searchUsers(query);
      }
    },
    [searchUsers]
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadFriends(), loadFriendRequests("all")]);
    } catch (error) {
      console.error("Error refreshing:", error);
    } finally {
      setRefreshing(false);
    }
  }, [loadFriends, loadFriendRequests]);

  // Optimistic accept request
  const handleAcceptRequest = useCallback(
    async (requestId: string) => {
      const result = await respondToRequest(requestId, "accept");
      if (result.success) {
        await Promise.all([loadFriends(), loadFriendRequests("all")]);
      } else {
        Alert.alert(
          t("error"),
          result.error || t("friends.requests.acceptFailed")
        );
      }
    },
    [respondToRequest, loadFriends, loadFriendRequests, t]
  );

  // Optimistic decline request - no confirm alert
  const handleDeclineRequest = useCallback(
    async (requestId: string) => {
      const result = await respondToRequest(requestId, "decline");
      if (result.success) {
        await loadFriendRequests("all");
      } else {
        Alert.alert(
          t("error"),
          result.error || t("friends.requests.declineFailed")
        );
      }
    },
    [respondToRequest, loadFriendRequests, t]
  );

  // Optimistic send friend request with immediate UI update
  const handleSendFriendRequest = useCallback(
    async (userId: string) => {
      // Optimistic update - change status immediately
      setLoadingUserId(userId);
      setOptimisticSearchResults((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, friendshipStatus: "sent" as const } : user
        )
      );

      const result = await sendFriendRequest(userId);
      
      setLoadingUserId(null);
      
      if (result.success) {
        // Reload sent requests to get the request ID
        await loadFriendRequests("all");
      } else {
        // Rollback on error
        setOptimisticSearchResults((prev) =>
          prev.map((user) =>
            user.id === userId ? { ...user, friendshipStatus: "none" as const } : user
          )
        );
        Alert.alert(t("error"), result.error || t("friends.unknownError"));
      }
    },
    [sendFriendRequest, loadFriendRequests, t]
  );

  // Optimistic cancel friend request with immediate UI update
  const handleCancelFriendRequest = useCallback(
    async (userId: string) => {
      // Find the request ID from sentRequests
      const sentRequest = sentRequests.find((req: any) => {
        return req.recipient?.id === userId;
      });

      if (!sentRequest) {
        Alert.alert(t("error"), t("publicProfile.cancelRequest.notFound"));
        return;
      }

      const requestId = sentRequest.id;

      // Optimistic update - change status immediately
      setLoadingUserId(userId);
      setOptimisticSearchResults((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, friendshipStatus: "none" as const } : user
        )
      );

      const result = await cancelRequest(requestId);
      
      setLoadingUserId(null);
      
      if (result.success) {
        // Reload sent requests
        await loadFriendRequests("all");
      } else {
        // Rollback on error
        setOptimisticSearchResults((prev) =>
          prev.map((user) =>
            user.id === userId ? { ...user, friendshipStatus: "sent" as const } : user
          )
        );
        Alert.alert(t("error"), result.error || t("publicProfile.cancelRequest.failed"));
      }
    },
    [sentRequests, cancelRequest, loadFriendRequests, t]
  );

  // Optimistic unfriend - no confirm alert
  const handleUnfriend = useCallback(
    async (friend: Friend) => {
      const result = await removeFriend(friend.id);
      if (result.success) {
        showToast(
          t("friends.unfriend.success", { name: friend.full_name }),
          "success"
        );
        await loadFriends();
      } else {
        Alert.alert(
          t("error"),
          result.error || t("friends.unfriend.failed")
        );
      }
    },
    [removeFriend, loadFriends, showToast, t]
  );

  // Optimistic block - no confirm alert
  const handleBlockFriend = useCallback(
    async (friend: Friend) => {
      const result = await blockUser(friend.id);
      if (result.success) {
        showToast(
          t("friends.block.success", { name: friend.full_name }),
          "warning"
        );
        await loadFriends();
      } else {
        Alert.alert(
          t("error"),
          result.error || t("friends.block.failed")
        );
      }
    },
    [blockUser, loadFriends, showToast, t]
  );

  const handleViewAllRequests = useCallback(() => {
    router.push("/contacts/requests");
  }, [router]);

  const handleMenuPress = useCallback(() => {
    setIsSidebarVisible(true);
  }, []);

  const handleSidebarClose = useCallback(() => {
    setIsSidebarVisible(false);
  }, []);

  const renderFriendItem = useCallback(
    ({ item }: { item: Friend }) => (
      <FriendListItem
        friend={item}
        onPress={() => {
          router.push(`contacts/public-profile/${item.id}`);
        }}
        onMessage={() => router.push(`/conversations/${item.clerkId}`)}
        onUnfriend={() => handleUnfriend(item)}
        onBlock={() => handleBlockFriend(item)}
      />
    ),
    [router, handleUnfriend, handleBlockFriend]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: { title: string } }) => (
      <View className={`px-4 py-2 ${isDark ? "bg-gray-900" : "bg-gray-100"}`}>
        <Text
          className={`font-semibold text-lg ${isDark ? "text-white" : "text-gray-900"}`}
        >
          {section.title}
        </Text>
      </View>
    ),
    [isDark]
  );

  // Show search results when searching
  if (searchQuery.trim()) {
    return (
      <SafeAreaView className={`flex-1 ${isDark ? "bg-black" : "bg-gray-50"}`}>
        <Header title={t("friends.title")} onMenuPress={handleMenuPress}  showFloatingRec={true}/>

        <SearchInput
          placeholder={t("friends.searchPlaceholder")}
          onSearch={handleSearch}
          style={{ marginHorizontal: 16, marginBottom: 16 }}
        />

        <ScrollView className="flex-1">
          {searchLoading ? (
            <View className="flex-1 justify-center items-center py-8">
              <ActivityIndicator size="large" color="#FF8C42" />
              <Text
                className={`text-lg mt-4 ${isDark ? "text-white" : "text-black"}`}
              >
                {t("friends.searching")}
              </Text>
            </View>
          ) : optimisticSearchResults.length > 0 ? (
            optimisticSearchResults.map((user) => (
              <TouchableOpacity
                onPress={() =>
                  router.push(`/contacts/public-profile/${user.id}`)
                }
                key={user.id}
                className={`p-4 mb-2 mx-4 rounded-lg shadow-sm ${isDark ? "bg-gray-800" : "bg-white"}`}
              >
                <View className="flex-row items-center">
                  <Image
                    source={{
                      uri: user.avatar || "https://via.placeholder.com/50",
                    }}
                    className="w-12 h-12 rounded-full"
                  />
                  <View className="flex-1 ml-3">
                    <Text
                      className={`font-semibold ${isDark ? "text-white" : "text-gray-900"}`}
                    >
                      {user.full_name}
                    </Text>
                    <Text
                      className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}
                    >
                      @{user.username} •{" "}
                      {t("friends.labels.mutual", {
                        count: user.mutualFriendsCount,
                      })}
                    </Text>
                  </View>

                  {/* Add Friend Button */}
                  {user.friendshipStatus === "none" && (
                    <Button
                      title={t("friends.addFriend")}
                      onPress={() => handleSendFriendRequest(user.id)}
                      variant="primary"
                      size="small"
                      loading={loadingUserId === user.id}
                      disabled={loadingUserId === user.id}
                    />
                  )}

                  {/* Cancel Request Button */}
                  {user.friendshipStatus === "sent" && (
                    <Button
                      title={t("publicProfile.actions.cancelRequest")}
                      onPress={() => handleCancelFriendRequest(user.id)}
                      variant="outline"
                      size="small"
                      loading={loadingUserId === user.id}
                      disabled={loadingUserId === user.id}
                    />
                  )}

                  {/* Already Friends Badge */}
                  {user.friendshipStatus === "accepted" && (
                    <View className={`px-3 py-1.5 rounded-full ${isDark ? "bg-green-900" : "bg-green-100"}`}>
                      <Text
                        className={`text-sm font-medium ${isDark ? "text-green-400" : "text-green-600"}`}
                      >
                        {t("friends.friends")}
                      </Text>
                    </View>
                  )}

                  {/* Pending Request Badge */}
                  {user.friendshipStatus === "pending" && (
                    <View className={`px-3 py-1.5 rounded-full ${isDark ? "bg-blue-900" : "bg-blue-100"}`}>
                      <Text
                        className={`text-sm font-medium ${isDark ? "text-blue-400" : "text-blue-600"}`}
                      >
                        {t("friends.requests.title")}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View className="flex-1 justify-center items-center py-8">
              <Text
                className={`text-lg ${isDark ? "text-white" : "text-black"}`}
              >
                {t("friends.noUsersFound")}
              </Text>
            </View>
          )}
        </ScrollView>

        <Sidebar isVisible={isSidebarVisible} onClose={handleSidebarClose} />

        <ToastNotification
          message={toast.message}
          visible={toast.visible}
          onHide={hideToast}
          type={toast.type}
        />
      </SafeAreaView>
    );
  }

  // Main friends screen
  return (
    <SafeAreaView className={`flex-1 ${isDark ? "bg-black" : "bg-gray-50"}`}>
      <Header title={t("friends.title")} onMenuPress={handleMenuPress} />

      <SearchInput
        placeholder={t("friends.searchPlaceholder")}
        onSearch={handleSearch}
        style={{ marginHorizontal: 16, marginBottom: 16 }}
      />

      {/* Friend Requests Section - Fixed height */}
      {requests.length > 0 && (
        <View className="mb-3">
          <TabHeader
            leftText={`${t("friends.requests.title")} (${requestCount})`}
            rightText={t("friends.requests.all")}
            rightAction={handleViewAllRequests}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ maxHeight: 160 }}
            contentContainerStyle={{ paddingRight: 16 }}
          >
            {requests.map((request) => (
              <View key={request.id} style={{ width: 320 }}>
                <FriendRequestCard
                  request={request}
                  onAccept={handleAcceptRequest}
                  onDecline={handleDeclineRequest}
                />
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* My Friends Section */}
      <View className="flex-1">
        <TabHeader
          leftText={t("friends.myFriends", { count: totalCount })}
          rightText={t("friends.seeAll")}
          rightAction={() => {
            router.push("/contacts/all-friends");
          }}
        />

        <View className="flex-1 relative">
          <SectionList
            sections={groupedFriends}
            keyExtractor={(item) => item.id}
            renderItem={renderFriendItem}
            renderSectionHeader={renderSectionHeader}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor="#FF8C42"
              />
            }
            showsVerticalScrollIndicator={false}
            className="flex-1"
            // ✨ NEW: Force re-render when online users change
            extraData={onlineUsers}
          />

          {alphabet.length > 0 && (
            <AlphabetIndex
              alphabet={alphabet}
              onLetterPress={(letter) => {
                console.log("Scroll to:", letter);
              }}
            />
          )}
        </View>
      </View>

      <Sidebar isVisible={isSidebarVisible} onClose={handleSidebarClose} />

      <ToastNotification
        message={toast.message}
        visible={toast.visible}
        onHide={hideToast}
        type={toast.type}
      />
    </SafeAreaView>
  );
};

FriendsScreen.displayName = "FriendsScreen";

export default FriendsScreen;