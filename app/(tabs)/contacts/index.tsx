import { AlphabetIndex } from "@/components/page/friend/AlphabetIndex";
import { FriendListItem } from "@/components/page/friend/FriendListItem";
import { FriendRequestCard } from "@/components/page/friend/FriendRequestCard";
import { TabHeader } from "@/components/page/friend/TabHeader";
import Header from "@/components/shared/Header";
import Sidebar from "@/components/shared/Sidebar";
import Button from "@/components/ui/Button";
import SearchInput from "@/components/ui/SearchInput";
import {
  Friend,
  useFriendRequests,
  useFriendSearch,
  useFriendsList,
} from "@/hooks/friend/useFriends";
import { useRouter } from "expo-router";
import React, { useMemo, useState, useCallback } from "react";
import {
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  SectionList,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const FriendsScreen = () => {
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const {
    searchResults,
    loading: searchLoading,
    searchUsers,
  } = useFriendSearch();
  
  const { 
    requests, 
    sendFriendRequest, 
    respondToRequest,
    loadFriendRequests 
  } = useFriendRequests();
  
  const { friends, loading: friendsLoading, loadFriends } = useFriendsList();

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

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      searchUsers(query);
    }
  }, [searchUsers]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadFriends(),
        loadFriendRequests()
      ]);
    } catch (error) {
      console.error("Error refreshing:", error);
    } finally {
      setRefreshing(false);
    }
  }, [loadFriends, loadFriendRequests]);

  const handleAcceptRequest = useCallback(async (requestId: string) => {
    const result = await respondToRequest(requestId, "accept");
    if (result.success) {
      Alert.alert("Success", "Friend request accepted!");
      // Reload both friends list and requests
      loadFriends();
      loadFriendRequests();
    } else {
      Alert.alert("Error", result.error || "Failed to accept request");
    }
  }, [respondToRequest, loadFriends, loadFriendRequests]);

  const handleDeclineRequest = useCallback(async (requestId: string) => {
    Alert.alert(
      "Decline Request",
      "Are you sure you want to decline this friend request?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Decline",
          style: "destructive",
          onPress: async () => {
            const result = await respondToRequest(requestId, "decline");
            if (result.success) {
              // Reload requests after decline
              loadFriendRequests();
            } else {
              Alert.alert("Error", result.error || "Failed to decline request");
            }
          },
        },
      ]
    );
  }, [respondToRequest, loadFriendRequests]);

  const handleSendFriendRequest = useCallback(async (userId: string) => {
    const result = await sendFriendRequest(userId);
    Alert.alert(
      result.success ? "Success" : "Error", 
      result.message || result.error || "Unknown error"
    );
  }, [sendFriendRequest]);

  const handleViewAllRequests = useCallback(() => {
    router.push('/contacts/requests');
  }, []);

  const handleMenuPress = useCallback(() => {
    setIsSidebarVisible(true);
  }, []);

  const handleSidebarClose = useCallback(() => {
    setIsSidebarVisible(false);
  }, []);

  const renderFriendItem = useCallback(({ item }: { item: Friend }) => (
    <FriendListItem
      friend={item}
      onPress={() => {
        router.push(`contacts/public-profile/${item.id}`)
      }}
      onMenuPress={() => {
        // Show friend menu options
        Alert.alert(item.full_name, "Choose an action", [
          { text: "View Profile", onPress: () => console.log("View profile") },
          { text: "Message", onPress: () => console.log("Message") },
          {
            text: "Block",
            style: "destructive",
            onPress: () => console.log("Block"),
          },
          { text: "Cancel", style: "cancel" },
        ]);
      }}
    />
  ), []);

  const renderSectionHeader = useCallback(({ section }: { section: { title: string } }) => (
    <View className="bg-gray-100 dark:bg-gray-900 px-4 py-2">
      <Text className="text-gray-900 dark:text-white font-semibold text-lg">
        {section.title}
      </Text>
    </View>
  ), []);

  // Show search results when searching
  if (searchQuery.trim()) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-black">
        <Header title="Friends" onMenuPress={handleMenuPress} />

        <SearchInput
          placeholder="Search friends..."
          onSearch={handleSearch}
          style={{ marginHorizontal: 16, marginBottom: 16 }}
        />

        <ScrollView className="flex-1">
          {searchLoading ? (
            <View className="flex-1 justify-center items-center py-8">
              <Text className="text-gray-500">Searching...</Text>
            </View>
          ) : searchResults.length > 0 ? (
            searchResults.map((user) => (
              <TouchableOpacity
                onPress={()=>router.push(`/contacts/public-profile/${user.id}`)}
                key={user.id}
                className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-2 mx-4 shadow-sm"
              >
                <View className="flex-row items-center">
                  <Image
                    source={{
                      uri: user.avatar || "https://via.placeholder.com/50",
                    }}
                    className="w-12 h-12 rounded-full"
                  />
                  <View className="flex-1 ml-3">
                    <Text className="text-gray-900 dark:text-white font-semibold">
                      {user.full_name}
                    </Text>
                    <Text className="text-gray-500 text-sm">
                      @{user.username} • {user.mutualFriendsCount} mutual
                      friends
                    </Text>
                  </View>

                  {user.friendshipStatus === "none" && (
                    <Button
                      title="Add Friend"
                      onPress={() => handleSendFriendRequest(user.id)}
                      variant="primary"
                      size="small"
                    />
                  )}
                  {user.friendshipStatus === "sent" && (
                    <Text className="text-orange-500 text-sm">Sent</Text>
                  )}
                  {user.friendshipStatus === "accepted" && (
                    <Text className="text-green-500 text-sm">Friends</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View className="flex-1 justify-center items-center py-8">
              <Text className="text-gray-500">No users found</Text>
            </View>
          )}
        </ScrollView>

        <Sidebar
          isVisible={isSidebarVisible}
          onClose={handleSidebarClose}
        />
      </SafeAreaView>
    );
  }

  // Main friends screen
  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-black">
      <Header title="Friends" onMenuPress={handleMenuPress} />

      <SearchInput
        placeholder="Search friends..."
        onSearch={handleSearch}
        style={{ marginHorizontal: 16, marginBottom: 16 }}
      />

      {/* Friend Requests Section */}
      {requests.length > 0 && (
        <>
          <TabHeader
            leftText="Friend requests"
            rightText="All requests"
            rightAction={handleViewAllRequests}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-4"
          >
            {requests.map((request) => (
              <View key={request.id} className="w-80">
                <FriendRequestCard
                  request={request}
                  onAccept={handleAcceptRequest}
                  onDecline={handleDeclineRequest}
                />
              </View>
            ))}
          </ScrollView>
        </>
      )}

      {/* My Friends Section */}
      <View className="flex-1">
        <TabHeader
          leftText={`My friends (${friends.length})`}
          rightText="See all"
          rightAction={() => {
            // Navigate to all friends screen
            router
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
          />

          {alphabet.length > 0 && (
            <AlphabetIndex
              alphabet={alphabet}
              onLetterPress={(letter) => {
                // Scroll to section
                console.log("Scroll to:", letter);
              }}
            />
          )}
        </View>
      </View>

      <Sidebar
        isVisible={isSidebarVisible}
        onClose={handleSidebarClose}
      />
    </SafeAreaView>
  );
};

// Set display name for debugging
FriendsScreen.displayName = 'FriendsScreen';

export default FriendsScreen;