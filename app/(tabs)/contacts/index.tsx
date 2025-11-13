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
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
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
  const { actualTheme } = useTheme();
  const { t } = useLanguage();
  const isDark = actualTheme === 'dark';
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
      Alert.alert(t('success'), t('friends.request.accepted'));
      loadFriends();
      loadFriendRequests();
    } else {
      Alert.alert(t('error'), result.error || t('friends.request.acceptFailed'));
    }
  }, [respondToRequest, loadFriends, loadFriendRequests, t]);

  const handleDeclineRequest = useCallback(async (requestId: string) => {
    Alert.alert(
      t('friends.request.declineTitle'),
      t('friends.request.declineMessage'),
      [
        { text: t('cancel'), style: "cancel" },
        {
          text: t('friends.request.decline'),
          style: "destructive",
          onPress: async () => {
            const result = await respondToRequest(requestId, "decline");
            if (result.success) {
              loadFriendRequests();
            } else {
              Alert.alert(t('error'), result.error || t('friends.request.declineFailed'));
            }
          },
        },
      ]
    );
  }, [respondToRequest, loadFriendRequests, t]);

  const handleSendFriendRequest = useCallback(async (userId: string) => {
    const result = await sendFriendRequest(userId);
    Alert.alert(
      result.success ? t('success') : t('error'), 
      result.message || result.error || t('friends.unknownError')
    );
  }, [sendFriendRequest, t]);

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
        Alert.alert(item.full_name, t('friends.menu.title'), [
          { text: t('friends.menu.viewProfile'), onPress: () => console.log("View profile") },
          { text: t('friends.menu.message'), onPress: () => console.log("Message") },
          {
            text: t('friends.menu.block'),
            style: "destructive",
            onPress: () => console.log("Block"),
          },
          { text: t('cancel'), style: "cancel" },
        ]);
      }}
    />
  ), [t, router]);

  const renderSectionHeader = useCallback(({ section }: { section: { title: string } }) => (
    <View className={`px-4 py-2 ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
      <Text className={`font-semibold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>
        {section.title}
      </Text>
    </View>
  ), [isDark]);

  // Show search results when searching
  if (searchQuery.trim()) {
    return (
      <SafeAreaView className={`flex-1 ${isDark ? 'bg-black' : 'bg-gray-50'}`}>
        <Header title={t('friends.title')} onMenuPress={handleMenuPress} />

        <SearchInput
          placeholder={t('friends.searchPlaceholder')}
          onSearch={handleSearch}
          style={{ marginHorizontal: 16, marginBottom: 16 }}
        />

        <ScrollView className="flex-1">
          {searchLoading ? (
            <View className="flex-1 justify-center items-center py-8">
              <Text className={`text-lg ${isDark ? "text-white" : "text-black"}`}>
                {t('friends.searching')}
              </Text>
            </View>
          ) : searchResults.length > 0 ? (
            searchResults.map((user) => (
              <TouchableOpacity
                onPress={()=>router.push(`/contacts/public-profile/${user.id}`)}
                key={user.id}
                className={`p-4 mb-2 mx-4 rounded-lg shadow-sm ${isDark ? 'bg-gray-800' : 'bg-white'}`}
              >
                <View className="flex-row items-center">
                  <Image
                    source={{
                      uri: user.avatar || "https://via.placeholder.com/50",
                    }}
                    className="w-12 h-12 rounded-full"
                  />
                  <View className="flex-1 ml-3">
                    <Text className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {user.full_name}
                    </Text>
                    <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      @{user.username} • {t('friends.labels.mutual', { count: user.mutualFriendsCount })}
                    </Text>
                  </View>

                  {user.friendshipStatus === "none" && (
                    <Button
                      title={t('friends.addFriend')}
                      onPress={() => handleSendFriendRequest(user.id)}
                      variant="primary"
                      size="small"
                    />
                  )}
                  {user.friendshipStatus === "sent" && (
                    <Text className={`text-sm ${isDark ? 'text-orange-400' : 'text-orange-500'}`}>{t('friends.sent')}</Text>
                  )}
                  {user.friendshipStatus === "accepted" && (
                    <Text className={`text-sm ${isDark ? 'text-green-400' : 'text-green-500'}`}>{t('friends.friends')}</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View className="flex-1 justify-center items-center py-8">
              <Text className={`text-lg ${isDark ? "text-white" : "text-black"}`}>
                {t('friends.noUsersFound')}
              </Text>
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
    <SafeAreaView className={`flex-1 ${isDark ? 'bg-black' : 'bg-gray-50'}`}>
      <Header title={t('friends.title')} onMenuPress={handleMenuPress} />

      <SearchInput
        placeholder={t('friends.searchPlaceholder')}
        onSearch={handleSearch}
        style={{ marginHorizontal: 16, marginBottom: 16 }}
      />

      {/* Friend Requests Section - Fixed height */}
      {requests.length > 0 && (
        <View className="mb-3">
          <TabHeader
            leftText={t('friends.requests.title')}
            rightText={t('friends.requests.all')}
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
          leftText={t('friends.myFriends', { count: friends.length })}
          rightText={t('friends.seeAll')}
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

FriendsScreen.displayName = 'FriendsScreen';

export default FriendsScreen;