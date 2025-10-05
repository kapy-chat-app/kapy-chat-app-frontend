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
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AddMemberScreen() {
  const params = useLocalSearchParams();
  const conversationId = params.id as string;

  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredUsers, setFilteredUsers] = useState<(Friend & { isInGroup?: boolean })[]>([]);
  const [adding, setAdding] = useState(false);

  const { friends, loading: loadingFriends, loadFriends } = useFriendsList();
  const { members, loading: loadingMembers, loadMembers } = useGroupMembers(conversationId);
  const { addParticipants } = useConversationActions();

  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

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
        Alert.alert("Thành công", "Đã thêm thành viên vào nhóm");
        router.back();
      } else {
        Alert.alert("Lỗi", result.error || "Không thể thêm thành viên");
      }
    } catch (error) {
      Alert.alert("Lỗi", "Đã xảy ra lỗi khi thêm thành viên");
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
        className={`flex-row items-center px-4 py-3 border-b border-gray-100 dark:border-gray-800 
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
            <View className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-800 justify-center items-center">
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
          <Text className="text-base font-semibold text-gray-900 dark:text-white">
            {item.full_name}
          </Text>
          <Text className="text-sm text-gray-500 dark:text-gray-400">
            @{item.username}
          </Text>
        </View>

        {/* Checkbox / Label */}
        {isDisabled ? (
          <View className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full">
            <Text className="text-xs text-gray-500 dark:text-gray-400">
              Đã trong nhóm
            </Text>
          </View>
        ) : (
          <View
            className={`w-6 h-6 rounded-full border-2 justify-center items-center ${
              isSelected
                ? "bg-orange-500 border-orange-500"
                : "bg-transparent border-gray-300 dark:border-gray-600"
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
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons
            name="arrow-back"
            size={24}
            color={isDark ? "#F97316" : "#1F2937"}
          />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-900 dark:text-white">
          Thêm thành viên
        </Text>
        <TouchableOpacity
          onPress={handleAdd}
          disabled={selectedUsers.length === 0 || adding}
        >
          <Text
            className={`text-base font-semibold ${
              selectedUsers.length === 0 || adding
                ? "text-gray-400 dark:text-gray-600"
                : "text-orange-500"
            }`}
          >
            {adding ? "..." : "Thêm"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Selected count */}
      {selectedUsers.length > 0 && (
        <View className="px-4 py-2 bg-orange-50 dark:bg-orange-900/20">
          <Text className="text-sm text-orange-600 dark:text-orange-400">
            Đã chọn {selectedUsers.length} người
          </Text>
        </View>
      )}

      {/* Search */}
      <View className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <TextInput
          placeholder="Tìm kiếm bạn bè"
          placeholderTextColor={isDark ? "#9CA3AF" : "#6B7280"}
          value={searchQuery}
          onChangeText={setSearchQuery}
          className="bg-gray-100 dark:bg-gray-900 rounded-full px-4 py-2 text-base text-gray-900 dark:text-white"
        />
      </View>

      {/* Danh sách */}
      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#F97316" />
          <Text className="text-gray-500 dark:text-gray-400 mt-2">
            Đang tải danh sách...
          </Text>
        </View>
      ) : filteredUsers.length === 0 ? (
        <View className="flex-1 justify-center items-center px-8">
          <Ionicons 
            name="people-outline" 
            size={64} 
            color={isDark ? "#4B5563" : "#9CA3AF"} 
          />
          <Text className="text-gray-500 dark:text-gray-400 mt-4 text-center">
            {searchQuery.trim() 
              ? "Không tìm thấy bạn bè nào" 
              : "Tất cả bạn bè đã có trong nhóm"}
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