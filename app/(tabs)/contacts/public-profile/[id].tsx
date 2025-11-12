import Header from "@/components/shared/Header";
import Sidebar from "@/components/shared/Sidebar";
import Button from "@/components/ui/Button";
import MenuDropdown from "@/components/ui/MenuDropdown";
import { useFriendRequests, useBlockedUsers } from "@/hooks/friend/useFriends";
import { usePublicProfile } from "@/hooks/friend/usePublicProfile";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState, useMemo } from "react";
import {
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  Modal,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Block Reason Modal Component
const BlockReasonModal = ({ 
  visible, 
  onCancel, 
  onConfirm, 
  onSkip, 
  isLoading 
}: {
  visible: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
  onSkip: () => void;
  isLoading: boolean;
}) => {
  const [reason, setReason] = useState("");
  const { actualTheme } = useTheme();
  const { t } = useLanguage();
  const isDark = actualTheme === "dark";

  useEffect(() => {
    if (!visible) {
      setReason("");
    }
  }, [visible]);

  const handleConfirm = () => {
    onConfirm(reason.trim());
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      statusBarTranslucent={true}
      onRequestClose={onCancel}
    >
      <View className="flex-1 justify-center items-center bg-black/50 px-4">
        <View className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6 w-full max-w-sm`}>
          <Text className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-black'}`}>
            {t('publicProfile.block.reasonTitle')}
          </Text>
          
          <Text className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {t('publicProfile.block.reasonDescription')}
          </Text>
          
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder={t('publicProfile.block.reasonPlaceholder')}
            placeholderTextColor="#9CA3AF"
            className={`border rounded-lg p-3 mb-6 min-h-[80px] ${
              isDark 
                ? 'border-gray-600 text-white bg-gray-700' 
                : 'border-gray-300 text-black bg-white'
            }`}
            multiline={true}
            numberOfLines={3}
            maxLength={500}
            textAlignVertical="top"
            editable={!isLoading}
            autoFocus={false}
            blurOnSubmit={false}
            returnKeyType="default"
          />
          
          <View className="flex-row space-x-3">
            <TouchableOpacity
              onPress={onCancel}
              disabled={isLoading}
              className={`flex-1 rounded-lg py-3 ${
                isLoading 
                  ? isDark ? "bg-gray-700" : "bg-gray-100"
                  : isDark ? "bg-gray-600" : "bg-gray-200"
              }`}
            >
              <Text className={`text-center font-medium ${
                isLoading 
                  ? "text-gray-400" 
                  : isDark ? "text-gray-200" : "text-gray-700"
              }`}>
                {t('cancel')}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={onSkip}
              disabled={isLoading}
              className={`flex-1 rounded-lg py-3 ${
                isLoading 
                  ? isDark ? "bg-gray-700" : "bg-gray-100"
                  : isDark ? "bg-orange-900" : "bg-orange-100"
              }`}
            >
              <Text className={`text-center font-medium ${
                isLoading 
                  ? "text-gray-400" 
                  : isDark ? "text-orange-400" : "text-orange-600"
              }`}>
                {isLoading ? t('publicProfile.block.blocking') : t('publicProfile.block.skip')}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={handleConfirm}
              disabled={isLoading}
              className={`flex-1 rounded-lg py-3 ${
                isLoading 
                  ? isDark ? "bg-gray-700" : "bg-gray-100"
                  : "bg-red-500"
              }`}
            >
              <Text className={`text-center font-medium ${
                isLoading 
                  ? "text-gray-400" 
                  : "text-white"
              }`}>
                {isLoading ? t('publicProfile.block.blocking') : t('publicProfile.block.block')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

BlockReasonModal.displayName = 'BlockReasonModal';

const PublicProfileScreen = () => {
  const { actualTheme } = useTheme();
  const { t } = useLanguage();
  const isDark = actualTheme === "dark";
  
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showBlockReasonModal, setShowBlockReasonModal] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);

  const { id } = useLocalSearchParams<{ id: string }>();
  
  const publicProfileHook = usePublicProfile();
  const friendRequestsHook = useFriendRequests();
  const blockedUsersHook = useBlockedUsers();
  
  const { profile, loading, error, getUserProfile, clearError, clearProfile } = publicProfileHook;
  const { sendFriendRequest, respondToRequest } = friendRequestsHook;
  const { blockUser } = blockedUsersHook;

  const getAvatarSource = useCallback(() => {
    if (profile?.avatar && profile.avatar.trim() !== "") {
      return { uri: profile.avatar };
    }
    return require("@/assets/images/default-avatar.png");
  }, [profile?.avatar]);

  const handleMenuPress = useCallback(() => {
    setIsSidebarVisible(true);
  }, []);

  const handleSidebarClose = useCallback(() => {
    setIsSidebarVisible(false);
  }, []);

  const handleBackPress = useCallback(() => {
    clearProfile();
    clearError();
    router.back();
  }, [clearProfile, clearError]);

  useEffect(() => {
    if (id && typeof id === 'string') {
      getUserProfile(id);
    }
  }, [id]);

  const onRefresh = useCallback(async () => {
    if (!id || typeof id !== 'string') return;

    setRefreshing(true);
    try {
      await getUserProfile(id);
    } finally {
      setRefreshing(false);
    }
  }, [id, getUserProfile]);

  const handleSendFriendRequest = useCallback(async () => {
    if (!profile || !id) return;

    const result = await sendFriendRequest(profile.id);
    if (result.success) {
      Alert.alert(t('success'), t('publicProfile.friendRequest.success'));
      await getUserProfile(id as string);
    } else {
      Alert.alert(t('error'), result.error || t('publicProfile.friendRequest.failed'));
    }
  }, [profile, id, sendFriendRequest, getUserProfile, t]);

  const handleAcceptRequest = useCallback(async () => {
    if (!profile || !id) return;

    const result = await respondToRequest("request-id", "accept");
    if (result.success) {
      Alert.alert(t('success'), t('publicProfile.friendRequest.accepted'));
      await getUserProfile(id as string);
    } else {
      Alert.alert(t('error'), result.error || t('publicProfile.friendRequest.acceptFailed'));
    }
  }, [profile, id, respondToRequest, getUserProfile, t]);

  const handleMessage = useCallback(() => {
    if (!profile) return;
    router.push(`/conversations/${profile.id}`);
  }, [profile]);

  const handleBlock = useCallback(async () => {
    if (!profile) return;

    Alert.alert(
      t('publicProfile.block.confirmTitle'),
      t('publicProfile.block.confirmMessage', { name: profile.full_name }),
      [
        {
          text: t('cancel'),
          style: "cancel"
        },
        {
          text: t('publicProfile.block.block'),
          style: "destructive",
          onPress: () => {
            setShowBlockReasonModal(true);
          }
        }
      ]
    );
  }, [profile, t]);

  const handleBlockConfirm = useCallback(async (reason: string) => {
    if (!profile) return;

    setIsBlocking(true);
    try {
      const result = await blockUser(profile.id, reason || undefined);
      
      if (result.success) {
        setShowBlockReasonModal(false);
        
        Alert.alert(
          t('success'), 
          result.message || t('publicProfile.block.success'),
          [
            {
              text: t('ok'),
              onPress: () => {
                router.back();
              }
            }
          ]
        );
      } else {
        Alert.alert(t('error'), result.error || t('publicProfile.block.failed'));
      }
    } catch (error) {
      console.error("Block error:", error);
      Alert.alert(t('error'), t('publicProfile.block.unexpectedError'));
    } finally {
      setIsBlocking(false);
    }
  }, [profile, blockUser, t]);

  const handleBlockSkipReason = useCallback(async () => {
    if (!profile) return;

    setIsBlocking(true);
    try {
      const result = await blockUser(profile.id);
      
      if (result.success) {
        setShowBlockReasonModal(false);
        
        Alert.alert(
          t('success'), 
          result.message || t('publicProfile.block.success'),
          [
            {
              text: t('ok'),
              onPress: () => {
                router.back();
              }
            }
          ]
        );
      } else {
        Alert.alert(t('error'), result.error || t('publicProfile.block.failed'));
      }
    } catch (error) {
      console.error("Block error:", error);
      Alert.alert(t('error'), t('publicProfile.block.unexpectedError'));
    } finally {
      setIsBlocking(false);
    }
  }, [profile, blockUser, t]);

  const handleCancelBlock = useCallback(() => {
    setShowBlockReasonModal(false);
  }, []);

  const handleShare = useCallback(() => {
    Alert.alert(t('publicProfile.title'), t('publicProfile.share.info'));
  }, [t]);

  const handleReport = useCallback(() => {
    if (!profile) return;
    Alert.alert(t('success'), t('publicProfile.report.success'));
  }, [profile, t]);

  const friendRequestMenuOptions = useMemo(() => {
    if (!profile || profile.friendshipStatus !== "pending") return [];
    
    return [
      {
        id: 'accept',
        title: t('publicProfile.actions.acceptRequest'),
        icon: 'checkmark-circle-outline' as keyof typeof Ionicons.glyphMap,
        onPress: handleAcceptRequest,
      },
      {
        id: 'decline',
        title: t('publicProfile.actions.declineRequest'),
        icon: 'close-circle-outline' as keyof typeof Ionicons.glyphMap,
        onPress: () => {
          Alert.alert(t('publicProfile.title'), t('publicProfile.friendRequest.declineInfo'));
        },
        destructive: true,
      },
    ];
  }, [profile, handleAcceptRequest, t]);

  const profileMenuOptions = useMemo(() => {
    if (!profile) return [];
    
    const baseOptions = [
      {
        id: 'share',
        title: t('publicProfile.actions.shareProfile'),
        icon: 'share-outline' as keyof typeof Ionicons.glyphMap,
        onPress: handleShare,
      },
      {
        id: 'report',
        title: t('publicProfile.actions.reportUser'),
        icon: 'flag-outline' as keyof typeof Ionicons.glyphMap,
        onPress: handleReport,
        destructive: false,
      },
    ];

    if (profile.friendshipStatus !== "blocked") {
      baseOptions.push({
        id: 'block',
        title: t('publicProfile.actions.blockUser'),
        icon: 'ban-outline' as keyof typeof Ionicons.glyphMap,
        onPress: handleBlock,
        destructive: true,
      });
    }

    return baseOptions;
  }, [profile, handleShare, handleReport, handleBlock, t]);

  const formatDate = useCallback((date: Date | undefined) => {
    if (!date) return "Unknown";
    return new Date(date).toLocaleDateString();
  }, []);

  const getStatusColor = useCallback(() => {
    if (!profile) return isDark ? "#9CA3AF" : "#6B7280";
    return profile.is_online ? "#10B981" : isDark ? "#9CA3AF" : "#6B7280";
  }, [profile, isDark]);

  const getStatusText = useCallback(() => {
    if (!profile) return t('publicProfile.offline');
    if (profile.is_online) return t('publicProfile.online');
    if (profile.last_seen) {
      const lastSeen = new Date(profile.last_seen);
      const now = new Date();
      const diffInHours = Math.floor(
        (now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60)
      );

      if (diffInHours < 1) return t('publicProfile.recentlyOnline');
      if (diffInHours < 24) return t('publicProfile.hoursAgo', { hours: diffInHours });
      return t('publicProfile.daysAgo', { days: Math.floor(diffInHours / 24) });
    }
    return t('publicProfile.offline');
  }, [profile, t]);

  const InfoRow = useMemo(() => {
    const InfoRowComponent = React.memo(({
      label,
      value,
      icon,
    }: {
      label: string;
      value: string;
      icon?: string;
    }) => (
      <View className={`flex-row items-center justify-between py-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <View className="flex-row items-center">
          {icon && (
            <Ionicons
              name={icon as any}
              size={18}
              color={isDark ? "#9CA3AF" : "#6B7280"}
              style={{ marginRight: 12 }}
            />
          )}
          <Text className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {label}
          </Text>
        </View>
        <Text
          className={`text-right flex-1 ml-4 ${isDark ? "text-white" : "text-black"}`}
        >
          {value}
        </Text>
      </View>
    ));
    
    InfoRowComponent.displayName = 'InfoRow';
    return InfoRowComponent;
  }, [isDark]);

  const ActionButtons = useMemo(() => {
    const ActionButtonsComponent = React.memo(() => {
      if (!profile) return null;

      if (profile.friendshipStatus === "blocked") {
        return (
          <View className="px-4 mt-6">
            <View className={`rounded-lg p-4 ${isDark ? 'bg-red-900' : 'bg-red-100'}`}>
              <Text className={`text-center font-medium ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                {t('publicProfile.blocked.title')}
              </Text>
              <Text className={`text-center text-sm mt-1 ${isDark ? 'text-red-500' : 'text-red-500'}`}>
                {t('publicProfile.blocked.message')}
              </Text>
            </View>
          </View>
        );
      }

      return (
        <View className="flex-row gap-3 px-4 mt-6">
          {profile.friendshipStatus === "none" && (
            <Button
              title={t('publicProfile.actions.addFriend')}
              onPress={handleSendFriendRequest}
              variant="primary"
              style={{ flex: 1 }}
            />
          )}

          {profile.friendshipStatus === "sent" && (
            <View className={`flex-1 rounded-lg p-3 ${isDark ? 'bg-orange-900' : 'bg-orange-100'}`}>
              <Text className={`text-center font-medium ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>
                {t('publicProfile.actions.requestSent')}
              </Text>
            </View>
          )}

          {profile.friendshipStatus === "pending" && (
            <View className="flex-1">
              <MenuDropdown
                options={friendRequestMenuOptions}
                triggerIcon="person-add"
                triggerSize={18}
                triggerColor={isDark ? "#10B981" : "#059669"}
                style={{
                  backgroundColor: isDark ? "#065F46" : "#D1FAE5",
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 1,
                }}
              />
            </View>
          )}

          {profile.friendshipStatus === "accepted" && (
            <Button
              title={t('publicProfile.actions.message')}
              onPress={handleMessage}
              variant="primary"
              style={{ flex: 1 }}
            />
          )}

          <MenuDropdown
            options={profileMenuOptions}
            triggerIcon="ellipsis-horizontal"
            triggerSize={20}
            triggerColor={isDark ? "#9CA3AF" : "#6B7280"}
            style={{
              backgroundColor: isDark ? "#374151" : "#F3F4F6",
              paddingVertical: 8,
              paddingHorizontal: 8,
              borderRadius: 6,
            }}
          />
        </View>
      );
    });

    ActionButtonsComponent.displayName = 'ActionButtons';
    return ActionButtonsComponent;
  }, [profile, handleSendFriendRequest, friendRequestMenuOptions, handleMessage, profileMenuOptions, isDark, t]);

  if (loading && !profile) {
    return (
      <SafeAreaView className={`flex-1 ${isDark ? "bg-black" : "bg-white"}`}>
        <Header
          title={t('publicProfile.title')}
          onMenuPress={handleMenuPress}
          onBackPress={handleBackPress}
          showBackButton={true}
        />
        <View className="flex-1 justify-center items-center">
          <Text className={`text-lg ${isDark ? "text-white" : "text-black"}`}>
            {t('publicProfile.loading')}
          </Text>
        </View>
        <Sidebar
          isVisible={isSidebarVisible}
          onClose={handleSidebarClose}
        />
      </SafeAreaView>
    );
  }

  if (error || !profile) {
    return (
      <SafeAreaView className={`flex-1 ${isDark ? "bg-black" : "bg-white"}`}>
        <Header
          title={t('publicProfile.title')}
          onMenuPress={handleMenuPress}
          onBackPress={handleBackPress}
          showBackButton={true}
        />
        <View className="flex-1 justify-center items-center px-4">
          <Ionicons
            name="alert-circle"
            size={64}
            color={isDark ? "#EF4444" : "#DC2626"}
          />
          <Text
            className={`text-lg font-medium mt-4 ${isDark ? "text-white" : "text-black"}`}
          >
            {t('publicProfile.notFound')}
          </Text>
          <Text
            className={`text-center mt-2 ${isDark ? "text-gray-400" : "text-gray-600"}`}
          >
            {error || t('publicProfile.notFoundDescription')}
          </Text>
          <Button
            title={t('publicProfile.tryAgain')}
            onPress={() => id && getUserProfile(id as string)}
            variant="primary"
            style={{ marginTop: 16 }}
          />
        </View>
        <Sidebar
          isVisible={isSidebarVisible}
          onClose={handleSidebarClose}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className={`flex-1 ${isDark ? "bg-black" : "bg-white"}`}>
      <Header
        title={t('publicProfile.title')}
        onMenuPress={handleMenuPress}
        onBackPress={handleBackPress}
        showBackButton={true}
      />

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Profile Header */}
        <View className={`${isDark ? "bg-gray-900" : "bg-gray-50"} pb-6`}>
          {profile.cover_photo && (
            <View className="h-40 w-full">
              <Image
                source={{ uri: profile.cover_photo }}
                className="w-full h-full"
                resizeMode="cover"
              />
            </View>
          )}

          <View className="items-center pt-6">
            <View className={`w-32 h-32 rounded-full overflow-hidden border-4 ${isDark ? 'bg-gray-600 border-gray-800' : 'bg-gray-300 border-white'}`}>
              <Image
                source={getAvatarSource()}
                className="w-full h-full"
                resizeMode="cover"
              />
            </View>

            <Text
              className={`text-2xl font-bold mt-6 ${isDark ? "text-white" : "text-black"}`}
            >
              {profile.full_name}
            </Text>
            <Text
              className={`text-base ${isDark ? "text-gray-400" : "text-gray-600"}`}
            >
              @{profile.username}
            </Text>

            <View className="flex-row items-center mt-2">
              <View
                className="w-2 h-2 rounded-full mr-2"
                style={{ backgroundColor: getStatusColor() }}
              />
              <Text
                className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}
              >
                {getStatusText()}
              </Text>
            </View>

            {profile.canViewProfile && profile.bio && (
              <Text
                className={`text-center mt-3 px-6 leading-5 ${isDark ? "text-gray-300" : "text-gray-700"}`}
              >
                {profile.bio}
              </Text>
            )}

            <View className="flex-row mt-4 space-x-6">
              <View className="items-center">
                <Text
                  className={`text-lg font-bold ${isDark ? "text-white" : "text-black"}`}
                >
                  {profile.friendsCount}
                </Text>
                <Text
                  className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}
                >
                  {t('publicProfile.friends')}
                </Text>
              </View>
              <View className="items-center">
                <Text
                  className={`text-lg font-bold ${isDark ? "text-white" : "text-black"}`}
                >
                  {profile.mutualFriendsCount}
                </Text>
                <Text
                  className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}
                >
                  {t('publicProfile.mutual')}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <ActionButtons />

        {profile.canViewProfile && profile.friendshipStatus !== "blocked" && (
          <View className="px-4 py-6">
            <Text
              className={`text-lg font-semibold mb-4 ${isDark ? "text-white" : "text-black"}`}
            >
              {t('publicProfile.information')}
            </Text>

            {profile.location && (
              <InfoRow
                label={t('publicProfile.location')}
                value={profile.location}
                icon="location-outline"
              />
            )}

            {profile.website && (
              <InfoRow
                label={t('publicProfile.website')}
                value={profile.website}
                icon="globe-outline"
              />
            )}

            {profile.status && (
              <InfoRow
                label={t('publicProfile.status')}
                value={profile.status}
                icon="radio-outline"
              />
            )}
          </View>
        )}

        {(!profile.canViewProfile || profile.friendshipStatus === "blocked") && (
          <View className="px-4 py-8">
            <View className={`rounded-lg p-6 items-center ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
              <Ionicons
                name={profile.friendshipStatus === "blocked" ? "ban" : "lock-closed"}
                size={48}
                color={isDark ? "#9CA3AF" : "#6B7280"}
              />
              <Text
                className={`text-center mt-4 font-medium ${isDark ? "text-white" : "text-black"}`}
              >
                {profile.friendshipStatus === "blocked" 
                  ? t('publicProfile.blocked.title')
                  : t('publicProfile.private.title')
                }
              </Text>
              <Text
                className={`text-center mt-2 ${isDark ? "text-gray-400" : "text-gray-600"}`}
              >
                {profile.friendshipStatus === "blocked" 
                  ? t('publicProfile.blocked.message')
                  : t('publicProfile.private.message')
                }
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      <BlockReasonModal
        visible={showBlockReasonModal}
        onCancel={handleCancelBlock}
        onConfirm={handleBlockConfirm}
        onSkip={handleBlockSkipReason}
        isLoading={isBlocking}
      />

      <Sidebar
        isVisible={isSidebarVisible}
        onClose={handleSidebarClose}
      />
    </SafeAreaView>
  );
};

PublicProfileScreen.displayName = "PublicProfileScreen";

export default PublicProfileScreen;