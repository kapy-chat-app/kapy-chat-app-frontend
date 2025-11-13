import { Friend, useFriendsList } from "@/hooks/friend/useFriends";
import { useConversationActions, useGroupMembers } from "@/hooks/message/useMessageInfo";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";

export default function AddMemberScreen() {
  const params = useLocalSearchParams();
  const conversationId = params.id as string;

  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredUsers, setFilteredUsers] = useState<(Friend & { isInGroup?: boolean })[]>([]);
  const [adding, setAdding] = useState(false);

  const { actualTheme } = useTheme();
  const { t } = useLanguage();
  const isDark = actualTheme === "dark";

  const { friends, loading: loadingFriends, loadFriends } = useFriendsList();
  const { members, loading: loadingMembers, loadMembers } = useGroupMembers(conversationId);
  const { addParticipants } = useConversationActions();

  // Load friends và members khi component mount
  useEffect(() => {
    loadFriends(1);
    loadMembers(); // Thêm dòng này để load members
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lọc danh sách + đánh dấu đã trong group
  useEffect(() => {
    if (!friends || loadingMembers) return;

    let available = friends.map((f) => {
      const isInGroup = members.some((m) => m.clerkId === f.clerkId);
      return { ...f, isInGroup };
    });

    if (searchQuery.trim()) {
      available = available.filter(
        (f) =>
          f.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.username.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredUsers(available);
  }, [friends, searchQuery, members, loadingMembers]);

  const toggleUserSelection = (clerkId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(clerkId)
        ? prev.filter((id) => id !== clerkId)
        : [...prev, clerkId]
    );
  };

  const handleAdd = async () => {
    if (selectedUsers.length === 0) return;
    
    try {
      setAdding(true);
      const result = await addParticipants(conversationId, selectedUsers);
      
      if (result.success) {
        Alert.alert(t('success'), t('message.addMembers.success'));
        router.back();
      } else {
        Alert.alert(t('error'), result.error || t('message.failed'));
      }
    } catch (error) {
      Alert.alert(t('error'), t('message.addMembers.error'));
    } finally {
      setAdding(false);
    }
  };

  const renderUserItem = ({ item }: { item: Friend & { isInGroup?: boolean } }) => {
    const isSelected = selectedUsers.includes(item.clerkId);
    const isDisabled = item.isInGroup;

    return (
      <TouchableOpacity
        disabled={isDisabled}
        className={`flex-row items-center px-4 py-3 border-b ${isDark ? 'border-gray-800' : 'border-gray-100'} 
          ${isDisabled ? "opacity-50" : ""}`}
        onPress={() => toggleUserSelection(item.clerkId)}
      >
        {/* Avatar */}
        <View className="relative">
          {item.avatar ? (
            <Image
              source={{ uri: item.avatar }}
              className="w-12 h-12 rounded-full"
            />
          ) : (
            <View className={`w-12 h-12 rounded-full ${isDark ? 'bg-gray-800' : 'bg-gray-200'} justify-center items-center`}>
              <Ionicons
                name="person"
                size={24}
                color={isDark ? "#9CA3AF" : "#6B7280"}
              />
            </View>
          )}
        </View>

        {/* Info */}
        <View className="flex-1 ml-3">
          <Text className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {item.full_name}
          </Text>
          <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            @{item.username}
          </Text>
        </View>

        {/* Checkbox / Label */}
        {isDisabled ? (
          <View className={`px-3 py-1 rounded-full ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
            <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {t('message.addMembers.alreadyInGroup')}
            </Text>
          </View>
        ) : (
          <View
            className={`w-6 h-6 rounded-full border-2 justify-center items-center ${
              isSelected
                ? "bg-orange-500 border-orange-500"
                : `border-${isDark ? 'gray-600' : 'gray-300'} bg-transparent`
            }`}
          >
            {isSelected && <Ionicons name="checkmark" size={16} color="white" />}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const loading = loadingFriends || loadingMembers;

  return (
    <SafeAreaView className={`flex-1 ${isDark ? 'bg-black' : 'bg-white'}`}>
      {/* Header */}
      <View className={`flex-row items-center justify-between px-4 py-3 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons
            name="arrow-back"
            size={24}
            color={isDark ? "#F97316" : "#1F2937"}
          />
        </TouchableOpacity>
        <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {t('message.addMembers.title')}
        </Text>
        <TouchableOpacity
          onPress={handleAdd}
          disabled={selectedUsers.length === 0 || adding}
        >
          <Text
            className={`text-base font-semibold ${
              selectedUsers.length === 0 || adding
                ? `text-${isDark ? 'gray-600' : 'gray-400'}`
                : "text-orange-500"
            }`}
          >
            {adding ? t('loading') : t('message.addMembers.add')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Selected count */}
      {selectedUsers.length > 0 && (
        <View className={`px-4 py-2 ${isDark ? 'bg-orange-900/20' : 'bg-orange-50'}`}>
          <Text className={`text-sm ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>
            {t('message.addMembers.selected', { count: selectedUsers.length })}
          </Text>
        </View>
      )}

      {/* Search */}
      <View className={`px-4 py-3 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
        <TextInput
          placeholder={t('message.addMembers.searchPlaceholder')}
          placeholderTextColor={isDark ? "#9CA3AF" : "#6B7280"}
          value={searchQuery}
          onChangeText={setSearchQuery}
          className={`rounded-full px-4 py-2 text-base ${isDark ? 'text-white bg-gray-900' : 'text-gray-900 bg-gray-100'}`}
        />
      </View>

      {/* Danh sách */}
      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#F97316" />
          <Text className={`text-${isDark ? 'gray-400' : 'gray-500'} mt-2`}>
            {t('message.addMembers.loading')}
          </Text>
        </View>
      ) : filteredUsers.length === 0 ? (
        <View className="flex-1 justify-center items-center px-8">
          <Ionicons 
            name="people-outline" 
            size={64} 
            color={isDark ? "#4B5563" : "#9CA3AF"} 
          />
          <Text className={`text-${isDark ? 'gray-400' : 'gray-500'} mt-4 text-center`}>
            {searchQuery.trim() 
              ? t('message.addMembers.noFriendsFound') 
              : t('message.addMembers.allInGroup')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.clerkId}
          renderItem={renderUserItem}
        />
      )}
    </SafeAreaView>
  );
}