// app/(tabs)/conversations/[id]/info.tsx
import MediaGallery from "@/components/page/message/MediaGallery";
import SearchMessages from "@/components/page/message/SearchMessage";
import { useConversationActions, useGroupMembers } from "@/hooks/message/useMessageInfo";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  Alert,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
  ActivityIndicator,
  Modal,
  FlatList,
} from "react-native";
import * as ImagePicker from 'expo-image-picker';
import { useUser } from "@clerk/clerk-expo";
import { SafeAreaView } from "react-native-safe-area-context";

type TabType = "info" | "media" | "search" | "members";
type MediaType = "image" | "video" | "file" | "audio";

export default function MessageInfoScreen() {
  const params = useLocalSearchParams();
  const conversationId = params.id as string;
  const conversationType = params.type as "private" | "group";
  const conversationName = params.name as string;
  const conversationAvatar = params.avatar as string;
  const participantCount = parseInt(params.participantCount as string) || 2;

  const { user } = useUser();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const [activeTab, setActiveTab] = useState<TabType>("info");
  const [mediaType, setMediaType] = useState<MediaType>("image");
  const [showMemberMenu, setShowMemberMenu] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [currentAvatar, setCurrentAvatar] = useState(conversationAvatar);

  const { 
    loading, 
    deleteConversation, 
    leaveGroup,
    updateGroupAvatar,
    removeParticipant,
    transferAdmin,
  } = useConversationActions();

  const {
    members,
    admin,
    loading: membersLoading,
    loadMembers,
    refresh: refreshMembers,
  } = useGroupMembers(conversationId);

  const isGroupChat = conversationType === "group";
  const isAdmin = admin?.clerkId === user?.id;

  useEffect(() => {
    if (isGroupChat && activeTab === "members") {
      loadMembers();
    }
  }, [isGroupChat, activeTab]);

  const handleDeleteConversation = () => {
    Alert.alert(
      "Xóa đoạn hội thoại",
      "Bạn có chắc chắn muốn xóa đoạn hội thoại này? Tin nhắn sẽ chỉ bị xóa ở phía bạn.",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: async () => {
            const result = await deleteConversation(conversationId);
            if (result.success) {
              Alert.alert("Thành công", "Đã xóa đoạn hội thoại");
              router.replace("/(tabs)/conversations");
            } else {
              Alert.alert(
                "Lỗi",
                result.error || "Không thể xóa đoạn hội thoại"
              );
            }
          },
        },
      ]
    );
  };

  const handleLeaveGroup = () => {
    Alert.alert("Rời khỏi nhóm", "Bạn có chắc chắn muốn rời khỏi nhóm này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Rời nhóm",
        style: "destructive",
        onPress: async () => {
          const result = await leaveGroup(conversationId);
          if (result.success) {
            Alert.alert("Thành công", "Đã rời khỏi nhóm");
            router.replace("/(tabs)/conversations");
          } else {
            Alert.alert("Lỗi", result.error || "Không thể rời nhóm");
          }
        },
      },
    ]);
  };

  const handleChangeAvatar = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Lỗi', 'Cần cấp quyền truy cập thư viện ảnh');
        return;
      }

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        
        Alert.alert(
          "Xác nhận",
          "Bạn có muốn thay đổi ảnh đại diện nhóm?",
          [
            { text: "Hủy", style: "cancel" },
            {
              text: "Đồng ý",
              onPress: async () => {
                const updateResult = await updateGroupAvatar(conversationId, imageUri);
                if (updateResult.success) {
                  Alert.alert("Thành công", "Đã cập nhật ảnh đại diện nhóm");
                  setCurrentAvatar(updateResult.data?.avatar?.url || imageUri);
                  refreshMembers();
                } else {
                  Alert.alert("Lỗi", updateResult.error || "Không thể cập nhật ảnh");
                }
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert("Lỗi", "Không thể chọn ảnh");
    }
  };

  const handleRemoveMember = (member: any) => {
    Alert.alert(
      "Xóa thành viên",
      `Bạn có chắc chắn muốn xóa ${member.full_name} khỏi nhóm?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: async () => {
            const result = await removeParticipant(conversationId, member.clerkId);
            if (result.success) {
              Alert.alert("Thành công", "Đã xóa thành viên");
              refreshMembers();
            } else {
              Alert.alert("Lỗi", result.error || "Không thể xóa thành viên");
            }
          },
        },
      ]
    );
  };

  const handleTransferAdmin = (member: any) => {
    Alert.alert(
      "Chuyển quyền quản trị viên",
      `Bạn có chắc chắn muốn chuyển quyền quản trị viên cho ${member.full_name}?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Chuyển",
          onPress: async () => {
            const result = await transferAdmin(conversationId, member.clerkId);
            if (result.success) {
              Alert.alert("Thành công", "Đã chuyển quyền quản trị viên");
              refreshMembers();
            } else {
              Alert.alert("Lỗi", result.error || "Không thể chuyển quyền");
            }
          },
        },
      ]
    );
  };

  const handleAddMembers = () => {
    router.push(`/message/info/add-members/${conversationId}`);
  };

  const handleMessagePress = (messageId: string) => {
    router.push({
      pathname: `/message/${conversationId}`,
      params: {
        scrollToMessageId: messageId,
      },
    });
  };

  const renderHeader = () => (
    <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
      <TouchableOpacity className="p-1" onPress={() => router.back()}>
        <Ionicons
          name="arrow-back"
          size={24}
          color={isDark ? "#F97316" : "#1F2937"}
        />
      </TouchableOpacity>
      <Text className="text-lg font-semibold text-gray-900 dark:text-white">
        Thông tin
      </Text>
      <View className="w-6" />
    </View>
  );

  const renderProfileSection = () => (
    <View className="items-center py-6 bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800">
      <TouchableOpacity 
        onPress={isGroupChat && isAdmin ? handleChangeAvatar : undefined}
        disabled={loading}
        className="mb-4 relative"
      >
        {currentAvatar ? (
          <Image source={{ uri: currentAvatar }} className="w-24 h-24 rounded-full" />
        ) : (
          <View className="w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-900 justify-center items-center">
            <Ionicons
              name={isGroupChat ? "people" : "person"}
              size={48}
              color={isDark ? "#4B5563" : "#6B7280"}
            />
          </View>
        )}
        {isGroupChat && isAdmin && (
          <View className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-orange-500 justify-center items-center border-2 border-white dark:border-black">
            <Ionicons name="camera" size={16} color="white" />
          </View>
        )}
        {loading && (
          <View className="absolute inset-0 bg-black/50 rounded-full justify-center items-center">
            <ActivityIndicator color="white" />
          </View>
        )}
      </TouchableOpacity>

      <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        {conversationName || "Unnamed"}
      </Text>
      
      {conversationType === "private" ? (
        <TouchableOpacity className="px-6 py-2 bg-orange-500 rounded-full">
          <Text className="text-white text-sm font-semibold">Xem trang cá nhân</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity onPress={() => setActiveTab("members")}>
          <Text className="text-sm text-gray-500 dark:text-gray-400">
            {members.length || participantCount} thành viên
          </Text>
        </TouchableOpacity>
      )}

      <View className="flex-row justify-around w-full mt-6 px-8">
        <TouchableOpacity 
          className="items-center"
          onPress={() => setActiveTab("search")}
        >
          <View className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-900 justify-center items-center mb-2">
            <Ionicons
              name="search"
              size={24}
              color={isDark ? "#F97316" : "#3B82F6"}
            />
          </View>
          <Text className="text-xs text-gray-700 dark:text-gray-300 text-center">
            Tìm kiếm
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity className="items-center">
          <View className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-900 justify-center items-center mb-2">
            <Ionicons
              name="notifications-off"
              size={24}
              color={isDark ? "#F97316" : "#3B82F6"}
            />
          </View>
          <Text className="text-xs text-gray-700 dark:text-gray-300 text-center">
            Tắt thông báo
          </Text>
        </TouchableOpacity>
        
        {isGroupChat && (
          <TouchableOpacity 
            className="items-center"
            onPress={handleAddMembers}
          >
            <View className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-900 justify-center items-center mb-2">
              <Ionicons
                name="person-add"
                size={24}
                color={isDark ? "#F97316" : "#3B82F6"}
              />
            </View>
            <Text className="text-xs text-gray-700 dark:text-gray-300 text-center">
              Thêm thành viên
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderTabs = () => (
    <View className="flex-row bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800">
      <TouchableOpacity
        className={`flex-1 py-4 items-center border-b-2 ${
          activeTab === "info" ? "border-orange-500" : "border-transparent"
        }`}
        onPress={() => setActiveTab("info")}
      >
        <Text
          className={`text-base font-medium ${
            activeTab === "info"
              ? "text-orange-500 font-semibold"
              : "text-gray-500 dark:text-gray-400"
          }`}
        >
          Thông tin
        </Text>
      </TouchableOpacity>

      {isGroupChat && (
        <TouchableOpacity
          className={`flex-1 py-4 items-center border-b-2 ${
            activeTab === "members" ? "border-orange-500" : "border-transparent"
          }`}
          onPress={() => setActiveTab("members")}
        >
          <Text
            className={`text-base font-medium ${
              activeTab === "members"
                ? "text-orange-500 font-semibold"
                : "text-gray-500 dark:text-gray-400"
            }`}
          >
            Thành viên
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        className={`flex-1 py-4 items-center border-b-2 ${
          activeTab === "media" ? "border-orange-500" : "border-transparent"
        }`}
        onPress={() => setActiveTab("media")}
      >
        <Text
          className={`text-base font-medium ${
            activeTab === "media"
              ? "text-orange-500 font-semibold"
              : "text-gray-500 dark:text-gray-400"
          }`}
        >
          Media
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        className={`flex-1 py-4 items-center border-b-2 ${
          activeTab === "search" ? "border-orange-500" : "border-transparent"
        }`}
        onPress={() => setActiveTab("search")}
      >
        <Text
          className={`text-base font-medium ${
            activeTab === "search"
              ? "text-orange-500 font-semibold"
              : "text-gray-500 dark:text-gray-400"
          }`}
        >
          Tìm kiếm
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderInfoTab = () => (
    <ScrollView className="flex-1">
      {/* Thêm section mới cho cài đặt nhóm nếu là admin */}
      {isGroupChat && isAdmin && (
        <View className="bg-white dark:bg-black mt-3 py-3">
          <TouchableOpacity 
            className="flex-row items-center px-4 py-3.5 bg-white dark:bg-black border-b border-gray-100 dark:border-gray-900"
            onPress={handleChangeAvatar}
            disabled={loading}
          >
            <Ionicons
              name="camera"
              size={24}
              color={isDark ? "#F97316" : "#3B82F6"}
            />
            <Text className="flex-1 text-base text-gray-900 dark:text-white ml-4">
              Đổi ảnh đại diện nhóm
            </Text>
            {loading ? (
              <ActivityIndicator size="small" color="#F97316" />
            ) : (
              <Ionicons
                name="chevron-forward"
                size={20}
                color={isDark ? "#4B5563" : "#6B7280"}
              />
            )}
          </TouchableOpacity>

          <TouchableOpacity className="flex-row items-center px-4 py-3.5 bg-white dark:bg-black border-b border-gray-100 dark:border-gray-900">
            <Ionicons
              name="create"
              size={24}
              color={isDark ? "#F97316" : "#3B82F6"}
            />
            <Text className="flex-1 text-base text-gray-900 dark:text-white ml-4">
              Đổi tên nhóm
            </Text>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={isDark ? "#4B5563" : "#6B7280"}
            />
          </TouchableOpacity>
        </View>
      )}

      <View className="bg-white dark:bg-black mt-3 py-3">
        <TouchableOpacity className="flex-row items-center px-4 py-3.5 bg-white dark:bg-black border-b border-gray-100 dark:border-gray-900">
          <Ionicons
            name="notifications"
            size={24}
            color={isDark ? "#F97316" : "#3B82F6"}
          />
          <Text className="flex-1 text-base text-gray-900 dark:text-white ml-4">
            Thông báo
          </Text>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={isDark ? "#4B5563" : "#6B7280"}
          />
        </TouchableOpacity>

        <TouchableOpacity className="flex-row items-center px-4 py-3.5 bg-white dark:bg-black border-b border-gray-100 dark:border-gray-900">
          <Ionicons
            name="pin"
            size={24}
            color={isDark ? "#F97316" : "#3B82F6"}
          />
          <Text className="flex-1 text-base text-gray-900 dark:text-white ml-4">
            Ghim
          </Text>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={isDark ? "#4B5563" : "#6B7280"}
          />
        </TouchableOpacity>

        <TouchableOpacity className="flex-row items-center px-4 py-3.5 bg-white dark:bg-black border-b border-gray-100 dark:border-gray-900">
          <Ionicons
            name="share-social"
            size={24}
            color={isDark ? "#F97316" : "#3B82F6"}
          />
          <Text className="flex-1 text-base text-gray-900 dark:text-white ml-4">
            Chia sẻ thông tin liên hệ
          </Text>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={isDark ? "#4B5563" : "#6B7280"}
          />
        </TouchableOpacity>
      </View>

      <View className="bg-white dark:bg-black mt-3 py-3">
        {conversationType === "private" ? (
          <TouchableOpacity
            className="flex-row items-center px-4 py-3.5 bg-white dark:bg-black border-b border-gray-100 dark:border-gray-900"
            onPress={handleDeleteConversation}
            disabled={loading}
          >
            <Ionicons name="trash" size={24} color="#EF4444" />
            <Text className="flex-1 text-base text-red-500 ml-4">
              Xóa đoạn hội thoại
            </Text>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={isDark ? "#4B5563" : "#6B7280"}
            />
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              className="flex-row items-center px-4 py-3.5 bg-white dark:bg-black border-b border-gray-100 dark:border-gray-900"
              onPress={handleLeaveGroup}
              disabled={loading}
            >
              <Ionicons name="exit" size={24} color="#EF4444" />
              <Text className="flex-1 text-base text-red-500 ml-4">
                Rời khỏi nhóm
              </Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={isDark ? "#4B5563" : "#6B7280"}
              />
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-row items-center px-4 py-3.5 bg-white dark:bg-black border-b border-gray-100 dark:border-gray-900"
              onPress={handleDeleteConversation}
              disabled={loading}
            >
              <Ionicons name="trash" size={24} color="#EF4444" />
              <Text className="flex-1 text-base text-red-500 ml-4">
                Xóa đoạn hội thoại
              </Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={isDark ? "#4B5563" : "#6B7280"}
              />
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity className="flex-row items-center px-4 py-3.5 bg-white dark:bg-black border-b border-gray-100 dark:border-gray-900">
          <Ionicons name="ban" size={24} color="#EF4444" />
          <Text className="flex-1 text-base text-red-500 ml-4">Chặn</Text>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={isDark ? "#4B5563" : "#6B7280"}
          />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderMembersTab = () => {
    if (membersLoading) {
      return (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#F97316" />
          <Text className="text-gray-500 dark:text-gray-400 mt-4">
            Đang tải danh sách thành viên...
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={members}
        keyExtractor={(item) => item.clerkId}
        contentContainerClassName="py-2"
        renderItem={({ item }) => (
          <TouchableOpacity
            className="flex-row items-center px-4 py-3 bg-white dark:bg-black border-b border-gray-100 dark:border-gray-900"
            onPress={() => {
              if (isAdmin && !item.isCurrentUser) {
                setSelectedMember(item);
                setShowMemberMenu(true);
              }
            }}
          >
            <View className="relative">
              {item.avatar ? (
                <Image
                  source={{ uri: item.avatar }}
                  className="w-12 h-12 rounded-full"
                />
              ) : (
                <View className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-800 justify-center items-center">
                  <Ionicons name="person" size={24} color={isDark ? "#9CA3AF" : "#6B7280"} />
                </View>
              )}
              {item.is_online && (
                <View className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-black" />
              )}
            </View>

            <View className="flex-1 ml-3">
              <View className="flex-row items-center">
                <Text className="text-base font-semibold text-gray-900 dark:text-white">
                  {item.full_name}
                </Text>
                {item.isAdmin && (
                  <View className="ml-2 px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 rounded">
                    <Text className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                      Admin
                    </Text>
                  </View>
                )}
                {item.isCurrentUser && (
                  <View className="ml-2 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 rounded">
                    <Text className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                      Bạn
                    </Text>
                  </View>
                )}
              </View>
              <Text className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                @{item.username} • {item.messageCount} tin nhắn
              </Text>
            </View>

            {isAdmin && !item.isCurrentUser && (
              <Ionicons
                name="ellipsis-horizontal"
                size={20}
                color={isDark ? "#9CA3AF" : "#6B7280"}
              />
            )}
          </TouchableOpacity>
        )}
        ListHeaderComponent={
          isAdmin ? (
            <TouchableOpacity
              className="flex-row items-center px-4 py-3 bg-orange-50 dark:bg-orange-900/20 border-b border-orange-100 dark:border-orange-900"
              onPress={handleAddMembers}
            >
              <View className="w-12 h-12 rounded-full bg-orange-500 justify-center items-center">
                <Ionicons name="person-add" size={24} color="white" />
              </View>
              <Text className="flex-1 ml-3 text-base font-semibold text-orange-600 dark:text-orange-400">
                Thêm thành viên
              </Text>
            </TouchableOpacity>
          ) : null
        }
      />
    );
  };

  const renderMediaTab = () => (
    <View className="flex-1">
      <View className="flex-row px-4 py-3 bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800">
        {(["image", "video", "file", "audio"] as MediaType[]).map((type) => (
          <TouchableOpacity
            key={type}
            className={`px-4 py-2 mr-2 rounded-full ${
              mediaType === type ? "bg-orange-500" : "bg-gray-100 dark:bg-gray-900"
            }`}
            onPress={() => setMediaType(type)}
          >
            <Text
              className={`text-sm font-medium ${
                mediaType === type
                  ? "text-white"
                  : "text-gray-700 dark:text-gray-300"
              }`}
            >
              {type === "image" && "Ảnh"}
              {type === "video" && "Video"}
              {type === "file" && "Tệp"}
              {type === "audio" && "Âm thanh"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <MediaGallery conversationId={conversationId} type={mediaType} />
    </View>
  );

  const renderSearchTab = () => (
    <SearchMessages
      conversationId={conversationId}
      onMessagePress={handleMessagePress}
    />
  );

  const renderMemberMenu = () => (
    <Modal
      visible={showMemberMenu}
      transparent
      animationType="fade"
      onRequestClose={() => setShowMemberMenu(false)}
    >
      <TouchableOpacity
        className="flex-1 bg-black/50 justify-end"
        activeOpacity={1}
        onPress={() => setShowMemberMenu(false)}
      >
        <View className="bg-white dark:bg-gray-900 rounded-t-3xl">
          <View className="items-center py-4 border-b border-gray-200 dark:border-gray-800">
            <View className="w-12 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mb-3" />
            {selectedMember && (
              <>
                {selectedMember.avatar ? (
                  <Image
                    source={{ uri: selectedMember.avatar }}
                    className="w-16 h-16 rounded-full mb-2"
                  />
                ) : (
                  <View className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-800 justify-center items-center mb-2">
                    <Ionicons name="person" size={32} color={isDark ? "#9CA3AF" : "#6B7280"} />
                  </View>
                )}
                <Text className="text-lg font-bold text-gray-900 dark:text-white">
                  {selectedMember.full_name}
                </Text>
                <Text className="text-sm text-gray-500 dark:text-gray-400">
                  @{selectedMember.username}
                </Text>
              </>
            )}
          </View>

          <View className="py-2">
            {selectedMember && !selectedMember.isAdmin && (
              <TouchableOpacity
                className="flex-row items-center px-6 py-4 border-b border-gray-100 dark:border-gray-800"
                onPress={() => {
                  setShowMemberMenu(false);
                  handleTransferAdmin(selectedMember);
                }}
              >
                <Ionicons name="shield-checkmark" size={24} color="#3B82F6" />
                <Text className="flex-1 ml-4 text-base text-gray-900 dark:text-white">
                  Chuyển quyền quản trị viên
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              className="flex-row items-center px-6 py-4 border-b border-gray-100 dark:border-gray-800"
              onPress={() => {
                setShowMemberMenu(false);
                if (selectedMember) {
                  handleRemoveMember(selectedMember);
                }
              }}
            >
              <Ionicons name="person-remove" size={24} color="#EF4444" />
              <Text className="flex-1 ml-4 text-base text-red-500">
                Xóa khỏi nhóm
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-row items-center px-6 py-4"
              onPress={() => setShowMemberMenu(false)}
            >
              <Ionicons name="close-circle" size={24} color={isDark ? "#9CA3AF" : "#6B7280"} />
              <Text className="flex-1 ml-4 text-base text-gray-700 dark:text-gray-300">
                Hủy
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      {renderHeader()}
      {renderProfileSection()}
      {renderTabs()}
      {activeTab === "info" && renderInfoTab()}
      {activeTab === "members" && renderMembersTab()}
      {activeTab === "media" && renderMediaTab()}
      {activeTab === "search" && renderSearchTab()}
      {renderMemberMenu()}
    </SafeAreaView>
  );
}