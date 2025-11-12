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
  View,
  ActivityIndicator,
  Modal,
  FlatList,
} from "react-native";
import * as ImagePicker from 'expo-image-picker';
import { useUser } from "@clerk/clerk-expo";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";

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
  const { actualTheme } = useTheme();
  const { t } = useLanguage();
  const isDark = actualTheme === "dark";

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
      t('message.actions.deleteTitle'),
      t('message.actions.deleteMessage'),
      [
        { text: t('cancel'), style: "cancel" },
        {
          text: t('message.actions.deleteForMe'),
          style: "destructive",
          onPress: async () => {
            const result = await deleteConversation(conversationId);
            if (result.success) {
              Alert.alert(t('success'), t('message.actions.deleteSuccess'));
              router.replace("/(tabs)/conversations");
            } else {
              Alert.alert(
                t('error'),
                result.error || t('message.failed')
              );
            }
          },
        },
      ]
    );
  };

  const handleLeaveGroup = () => {
    Alert.alert(t('message.actions.leaveGroup'), t('message.actions.leaveGroupConfirm'), [
      { text: t('cancel'), style: "cancel" },
      {
        text: t('message.actions.leaveGroup'),
        style: "destructive",
        onPress: async () => {
          const result = await leaveGroup(conversationId);
          if (result.success) {
            Alert.alert(t('success'), t('message.actions.leaveGroupSuccess'));
            router.replace("/(tabs)/conversations");
          } else {
            Alert.alert(t('error'), result.error || t('message.failed'));
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
        Alert.alert(t('error'), t('message.attachment.mediaPermission'));
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
          t('message.attachment.confirm'),
          t('message.attachment.changeAvatarConfirm'),
          [
            { text: t('cancel'), style: "cancel" },
            {
              text: t('ok'),
              onPress: async () => {
                const updateResult = await updateGroupAvatar(conversationId, imageUri);
                if (updateResult.success) {
                  Alert.alert(t('success'), t('message.attachment.avatarUpdated'));
                  setCurrentAvatar(updateResult.data?.avatar?.url || imageUri);
                  refreshMembers();
                } else {
                  Alert.alert(t('error'), updateResult.error || t('message.failed'));
                }
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert(t('error'), t('message.attachment.pickFailed'));
    }
  };

  const handleRemoveMember = (member: any) => {
    Alert.alert(
      t('message.actions.removeMember'),
      t('message.actions.removeMemberConfirm', { name: member.full_name }),
      [
        { text: t('cancel'), style: "cancel" },
        {
          text: t('message.actions.remove'),
          style: "destructive",
          onPress: async () => {
            const result = await removeParticipant(conversationId, member.clerkId);
            if (result.success) {
              Alert.alert(t('success'), t('message.actions.removeSuccess'));
              refreshMembers();
            } else {
              Alert.alert(t('error'), result.error || t('message.failed'));
            }
          },
        },
      ]
    );
  };

  const handleTransferAdmin = (member: any) => {
    Alert.alert(
      t('message.actions.transferAdmin'),
      t('message.actions.transferAdminConfirm', { name: member.full_name }),
      [
        { text: t('cancel'), style: "cancel" },
        {
          text: t('message.actions.transfer'),
          onPress: async () => {
            const result = await transferAdmin(conversationId, member.clerkId);
            if (result.success) {
              Alert.alert(t('success'), t('message.actions.transferSuccess'));
              refreshMembers();
            } else {
              Alert.alert(t('error'), result.error || t('message.failed'));
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
    <View className={`flex-row items-center justify-between px-4 py-3 border-b ${isDark ? 'border-gray-800 bg-black' : 'border-gray-200 bg-white'}`}>
      <TouchableOpacity className="p-1" onPress={() => router.back()}>
        <Ionicons
          name="arrow-back"
          size={24}
          color={isDark ? "#F97316" : "#1F2937"}
        />
      </TouchableOpacity>
      <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
        {t('message.info.title')}
      </Text>
      <View className="w-6" />
    </View>
  );

  const renderProfileSection = () => (
    <View className={`items-center py-6 ${isDark ? 'bg-black border-b border-gray-800' : 'bg-white border-b border-gray-200'}`}>
      <TouchableOpacity 
        onPress={isGroupChat && isAdmin ? handleChangeAvatar : undefined}
        disabled={loading}
        className="mb-4 relative"
      >
        {currentAvatar ? (
          <Image source={{ uri: currentAvatar }} className="w-24 h-24 rounded-full" />
        ) : (
          <View className={`w-24 h-24 rounded-full ${isDark ? 'bg-gray-900' : 'bg-gray-100'} justify-center items-center`}>
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

      <Text className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} mb-2`}>
        {conversationName || t('message.info.unnamed')}
      </Text>
      
      {conversationType === "private" ? (
        <TouchableOpacity className="px-6 py-2 bg-orange-500 rounded-full">
          <Text className="text-white text-sm font-semibold">{t('message.info.viewProfile')}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity onPress={() => setActiveTab("members")}>
          <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {members.length || participantCount} {t('message.members')}
          </Text>
        </TouchableOpacity>
      )}

      <View className="flex-row justify-around w-full mt-6 px-8">
        <TouchableOpacity 
          className="items-center"
          onPress={() => setActiveTab("search")}
        >
          <View className={`w-14 h-14 rounded-full ${isDark ? 'bg-gray-900' : 'bg-gray-100'} justify-center items-center mb-2`}>
            <Ionicons
              name="search"
              size={24}
              color={isDark ? "#F97316" : "#3B82F6"}
            />
          </View>
          <Text className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'} text-center`}>
            {t('message.info.search')}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity className="items-center">
          <View className={`w-14 h-14 rounded-full ${isDark ? 'bg-gray-900' : 'bg-gray-100'} justify-center items-center mb-2`}>
            <Ionicons
              name="notifications-off"
              size={24}
              color={isDark ? "#F97316" : "#3B82F6"}
            />
          </View>
          <Text className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'} text-center`}>
            {t('message.info.muteNotifications')}
          </Text>
        </TouchableOpacity>
        
        {isGroupChat && (
          <TouchableOpacity 
            className="items-center"
            onPress={handleAddMembers}
          >
            <View className={`w-14 h-14 rounded-full ${isDark ? 'bg-gray-900' : 'bg-gray-100'} justify-center items-center mb-2`}>
              <Ionicons
                name="person-add"
                size={24}
                color={isDark ? "#F97316" : "#3B82F6"}
              />
            </View>
            <Text className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'} text-center`}>
              {t('message.info.addMembers')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderTabs = () => (
    <View className={`flex-row ${isDark ? 'bg-black border-b border-gray-800' : 'bg-white border-b border-gray-200'}`}>
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
              : isDark ? "text-gray-400" : "text-gray-500"
          }`}
        >
          {t('message.info.tabInfo')}
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
                : isDark ? "text-gray-400" : "text-gray-500"
            }`}
          >
            {t('message.info.tabMembers')}
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
              : isDark ? "text-gray-400" : "text-gray-500"
          }`}
        >
          {t('message.info.tabMedia')}
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
              : isDark ? "text-gray-400" : "text-gray-500"
          }`}
        >
          {t('message.info.tabSearch')}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderInfoTab = () => (
    <ScrollView className="flex-1">
      {/* Thêm section mới cho cài đặt nhóm nếu là admin */}
      {isGroupChat && isAdmin && (
        <View className={`mt-3 py-3 ${isDark ? 'bg-black' : 'bg-white'}`}>
          <TouchableOpacity 
            className={`flex-row items-center px-4 py-3.5 ${isDark ? 'bg-black border-b border-gray-900' : 'bg-white border-b border-gray-100'}`}
            onPress={handleChangeAvatar}
            disabled={loading}
          >
            <Ionicons
              name="camera"
              size={24}
              color={isDark ? "#F97316" : "#3B82F6"}
            />
            <Text className={`flex-1 text-base ${isDark ? 'text-white' : 'text-gray-900'} ml-4`}>
              {t('message.info.changeGroupAvatar')}
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

          <TouchableOpacity className={`flex-row items-center px-4 py-3.5 ${isDark ? 'bg-black border-b border-gray-900' : 'bg-white border-b border-gray-100'}`}>
            <Ionicons
              name="create"
              size={24}
              color={isDark ? "#F97316" : "#3B82F6"}
            />
            <Text className={`flex-1 text-base ${isDark ? 'text-white' : 'text-gray-900'} ml-4`}>
              {t('message.info.changeGroupName')}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={isDark ? "#4B5563" : "#6B7280"}
            />
          </TouchableOpacity>
        </View>
      )}

      <View className={`mt-3 py-3 ${isDark ? 'bg-black' : 'bg-white'}`}>
        <TouchableOpacity className={`flex-row items-center px-4 py-3.5 ${isDark ? 'bg-black border-b border-gray-900' : 'bg-white border-b border-gray-100'}`}>
          <Ionicons
            name="notifications"
            size={24}
            color={isDark ? "#F97316" : "#3B82F6"}
          />
          <Text className={`flex-1 text-base ${isDark ? 'text-white' : 'text-gray-900'} ml-4`}>
            {t('message.info.notifications')}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={isDark ? "#4B5563" : "#6B7280"}
          />
        </TouchableOpacity>

        <TouchableOpacity className={`flex-row items-center px-4 py-3.5 ${isDark ? 'bg-black border-b border-gray-900' : 'bg-white border-b border-gray-100'}`}>
          <Ionicons
            name="pin"
            size={24}
            color={isDark ? "#F97316" : "#3B82F6"}
          />
          <Text className={`flex-1 text-base ${isDark ? 'text-white' : 'text-gray-900'} ml-4`}>
            {t('message.info.pin')}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={isDark ? "#4B5563" : "#6B7280"}
          />
        </TouchableOpacity>

        <TouchableOpacity className={`flex-row items-center px-4 py-3.5 ${isDark ? 'bg-black border-b border-gray-900' : 'bg-white border-b border-gray-100'}`}>
          <Ionicons
            name="share-social"
            size={24}
            color={isDark ? "#F97316" : "#3B82F6"}
          />
          <Text className={`flex-1 text-base ${isDark ? 'text-white' : 'text-gray-900'} ml-4`}>
            {t('message.info.shareContact')}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={isDark ? "#4B5563" : "#6B7280"}
          />
        </TouchableOpacity>
      </View>

      <View className={`mt-3 py-3 ${isDark ? 'bg-black' : 'bg-white'}`}>
        {conversationType === "private" ? (
          <TouchableOpacity
            className={`flex-row items-center px-4 py-3.5 ${isDark ? 'bg-black border-b border-gray-900' : 'bg-white border-b border-gray-100'}`}
            onPress={handleDeleteConversation}
            disabled={loading}
          >
            <Ionicons name="trash" size={24} color="#EF4444" />
            <Text className="flex-1 text-base text-red-500 ml-4">
              {t('message.actions.deleteConversation')}
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
              className={`flex-row items-center px-4 py-3.5 ${isDark ? 'bg-black border-b border-gray-900' : 'bg-white border-b border-gray-100'}`}
              onPress={handleLeaveGroup}
              disabled={loading}
            >
              <Ionicons name="exit" size={24} color="#EF4444" />
              <Text className="flex-1 text-base text-red-500 ml-4">
                {t('message.actions.leaveGroup')}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={isDark ? "#4B5563" : "#6B7280"}
              />
            </TouchableOpacity>
            <TouchableOpacity
              className={`flex-row items-center px-4 py-3.5 ${isDark ? 'bg-black border-b border-gray-900' : 'bg-white border-b border-gray-100'}`}
              onPress={handleDeleteConversation}
              disabled={loading}
            >
              <Ionicons name="trash" size={24} color="#EF4444" />
              <Text className="flex-1 text-base text-red-500 ml-4">
                {t('message.actions.deleteConversation')}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={isDark ? "#4B5563" : "#6B7280"}
              />
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity className={`flex-row items-center px-4 py-3.5 ${isDark ? 'bg-black border-b border-gray-900' : 'bg-white border-b border-gray-100'}`}>
          <Ionicons name="ban" size={24} color="#EF4444" />
          <Text className="flex-1 text-base text-red-500 ml-4">{t('message.info.block')}</Text>
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
          <Text className={`text-gray-500 ${isDark ? 'text-gray-400' : ''} mt-4`}>
            {t('message.info.loadingMembers')}
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
            className={`flex-row items-center px-4 py-3 ${isDark ? 'bg-black border-b border-gray-900' : 'bg-white border-b border-gray-100'}`}
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
                <View className={`w-12 h-12 rounded-full ${isDark ? 'bg-gray-800' : 'bg-gray-200'} justify-center items-center`}>
                  <Ionicons name="person" size={24} color={isDark ? "#9CA3AF" : "#6B7280"} />
                </View>
              )}
              {item.is_online && (
                <View className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-black" />
              )}
            </View>

            <View className="flex-1 ml-3">
              <View className="flex-row items-center">
                <Text className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {item.full_name}
                </Text>
                {item.isAdmin && (
                  <View className={`ml-2 px-2 py-0.5 rounded ${isDark ? 'bg-orange-900/30' : 'bg-orange-100'}`}>
                    <Text className={`text-xs font-medium ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>
                      {t('message.info.admin')}
                    </Text>
                  </View>
                )}
                {item.isCurrentUser && (
                  <View className={`ml-2 px-2 py-0.5 rounded ${isDark ? 'bg-blue-900/30' : 'bg-blue-100'}`}>
                    <Text className={`text-xs font-medium ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                      {t('message.info.you')}
                    </Text>
                  </View>
                )}
              </View>
              <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} mt-0.5`}>
                @{item.username} • {item.messageCount} {t('message.info.messages')}
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
              className={`flex-row items-center px-4 py-3 border-b ${isDark ? 'bg-orange-900/20 border-orange-900' : 'bg-orange-50 border-orange-100'}`}
              onPress={handleAddMembers}
            >
              <View className="w-12 h-12 rounded-full bg-orange-500 justify-center items-center">
                <Ionicons name="person-add" size={24} color="white" />
              </View>
              <Text className={`flex-1 ml-3 text-base font-semibold ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>
                {t('message.info.addMembers')}
              </Text>
            </TouchableOpacity>
          ) : null
        }
      />
    );
  };

  const renderMediaTab = () => (
    <View className="flex-1">
      <View className={`flex-row px-4 py-3 ${isDark ? 'bg-black border-b border-gray-800' : 'bg-white border-b border-gray-200'}`}>
        {(["image", "video", "file", "audio"] as MediaType[]).map((type) => (
          <TouchableOpacity
            key={type}
            className={`px-4 py-2 mr-2 rounded-full ${
              mediaType === type ? "bg-orange-500" : isDark ? "bg-gray-900" : "bg-gray-100"
            }`}
            onPress={() => setMediaType(type)}
          >
            <Text
              className={`text-sm font-medium ${
                mediaType === type
                  ? "text-white"
                  : isDark ? "text-gray-300" : "text-gray-700"
              }`}
            >
              {t(`message.info.media.${type}`)}
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
        <View className={`${isDark ? 'bg-gray-900' : 'bg-white'} rounded-t-3xl`}>
          <View className={`items-center py-4 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
            <View className={`w-12 h-1 ${isDark ? 'bg-gray-700' : 'bg-gray-300'} rounded-full mb-3`} />
            {selectedMember && (
              <>
                {selectedMember.avatar ? (
                  <Image
                    source={{ uri: selectedMember.avatar }}
                    className="w-16 h-16 rounded-full mb-2"
                  />
                ) : (
                  <View className={`w-16 h-16 rounded-full ${isDark ? 'bg-gray-800' : 'bg-gray-200'} justify-center items-center mb-2`}>
                    <Ionicons name="person" size={32} color={isDark ? "#9CA3AF" : "#6B7280"} />
                  </View>
                )}
                <Text className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {selectedMember.full_name}
                </Text>
                <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  @{selectedMember.username}
                </Text>
              </>
            )}
          </View>

          <View className="py-2">
            {selectedMember && !selectedMember.isAdmin && (
              <TouchableOpacity
                className={`flex-row items-center px-6 py-4 border-b ${isDark ? 'border-gray-800' : 'border-gray-100'}`}
                onPress={() => {
                  setShowMemberMenu(false);
                  handleTransferAdmin(selectedMember);
                }}
              >
                <Ionicons name="shield-checkmark" size={24} color="#3B82F6" />
                <Text className={`flex-1 ml-4 text-base ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {t('message.actions.transferAdmin')}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              className={`flex-row items-center px-6 py-4 border-b ${isDark ? 'border-gray-800' : 'border-gray-100'}`}
              onPress={() => {
                setShowMemberMenu(false);
                if (selectedMember) {
                  handleRemoveMember(selectedMember);
                }
              }}
            >
              <Ionicons name="person-remove" size={24} color="#EF4444" />
              <Text className="flex-1 ml-4 text-base text-red-500">
                {t('message.actions.removeFromGroup')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className={`flex-row items-center px-6 py-4 ${isDark ? 'border-gray-800' : 'border-gray-100'}`}
              onPress={() => setShowMemberMenu(false)}
            >
              <Ionicons name="close-circle" size={24} color={isDark ? "#9CA3AF" : "#6B7280"} />
              <Text className={`flex-1 ml-4 text-base ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {t('cancel')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <SafeAreaView className={`flex-1 ${isDark ? 'bg-black' : 'bg-white'}`}>
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