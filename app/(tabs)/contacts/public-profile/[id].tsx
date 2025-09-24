import Header from "@/components/shared/Header";
import Sidebar from "@/components/shared/Sidebar";
import Button from "@/components/ui/Button";
import MenuDropdown from "@/components/ui/MenuDropdown";
import { useFriendRequests, useBlockedUsers } from "@/hooks/friend/useFriends";
import { usePublicProfile } from "@/hooks/friend/usePublicProfile";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState, useMemo, useRef } from "react";
import {
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
  Modal,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Block Reason Modal Component - Completely isolated
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
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  // Reset reason when modal closes
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
        <View className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-sm">
          <Text className="text-lg font-semibold mb-4 text-black dark:text-white">
            Block Reason (Optional)
          </Text>
          
          <Text className="text-gray-600 dark:text-gray-400 text-sm mb-4">
            Why are you blocking this user? This will help us improve the platform.
          </Text>
          
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Enter reason (optional)..."
            placeholderTextColor="#9CA3AF"
            className="border border-gray-300 dark:border-gray-600 rounded-lg p-3 mb-6 text-black dark:text-white dark:bg-gray-700 min-h-[80px]"
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
                  ? "bg-gray-100 dark:bg-gray-700" 
                  : "bg-gray-200 dark:bg-gray-600"
              }`}
            >
              <Text className={`text-center font-medium ${
                isLoading 
                  ? "text-gray-400" 
                  : "text-gray-700 dark:text-gray-200"
              }`}>
                Cancel
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={onSkip}
              disabled={isLoading}
              className={`flex-1 rounded-lg py-3 ${
                isLoading 
                  ? "bg-gray-100 dark:bg-gray-700" 
                  : "bg-orange-100 dark:bg-orange-900"
              }`}
            >
              <Text className={`text-center font-medium ${
                isLoading 
                  ? "text-gray-400" 
                  : "text-orange-600 dark:text-orange-400"
              }`}>
                {isLoading ? "Blocking..." : "Skip"}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={handleConfirm}
              disabled={isLoading}
              className={`flex-1 rounded-lg py-3 ${
                isLoading 
                  ? "bg-gray-100 dark:bg-gray-700" 
                  : "bg-red-500"
              }`}
            >
              <Text className={`text-center font-medium ${
                isLoading 
                  ? "text-gray-400" 
                  : "text-white"
              }`}>
                {isLoading ? "Blocking..." : "Block"}
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
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Block reason modal states - simplified
  const [showBlockReasonModal, setShowBlockReasonModal] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);

  const { id } = useLocalSearchParams<{ id: string }>();
  
  // Get stable references from hooks
  const publicProfileHook = usePublicProfile();
  const friendRequestsHook = useFriendRequests();
  const blockedUsersHook = useBlockedUsers();
  
  const { profile, loading, error, getUserProfile, clearError, clearProfile } = publicProfileHook;
  const { sendFriendRequest, respondToRequest } = friendRequestsHook;
  const { blockUser, unblockUser } = blockedUsersHook;

  // Function to get avatar source
  const getAvatarSource = useCallback(() => {
    if (profile?.avatar && profile.avatar.trim() !== "") {
      return { uri: profile.avatar };
    }
    return require("@/assets/images/default-avatar.png");
  }, [profile?.avatar]);

  // Memoize stable handlers
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

  // Load profile only when id changes
  useEffect(() => {
    if (id && typeof id === 'string') {
      getUserProfile(id);
    }
  }, [id]);

  // Refresh handler
  const onRefresh = useCallback(async () => {
    if (!id || typeof id !== 'string') return;

    setRefreshing(true);
    try {
      await getUserProfile(id);
    } finally {
      setRefreshing(false);
    }
  }, [id, getUserProfile]);

  // Friend request handlers
  const handleSendFriendRequest = useCallback(async () => {
    if (!profile || !id) return;

    const result = await sendFriendRequest(profile.id);
    if (result.success) {
      Alert.alert("Success", "Friend request sent successfully");
      await getUserProfile(id as string);
    } else {
      Alert.alert("Error", result.error || "Failed to send friend request");
    }
  }, [profile, id, sendFriendRequest, getUserProfile]);

  const handleAcceptRequest = useCallback(async () => {
    if (!profile || !id) return;

    const result = await respondToRequest("request-id", "accept");
    if (result.success) {
      Alert.alert("Success", "Friend request accepted");
      await getUserProfile(id as string);
    } else {
      Alert.alert("Error", result.error || "Failed to accept request");
    }
  }, [profile, id, respondToRequest, getUserProfile]);

  const handleMessage = useCallback(() => {
    if (!profile) return;
    router.push(`/conversations/${profile.id}`);
  }, [profile]);

  // Cross-platform block handler
  const handleBlock = useCallback(async () => {
    if (!profile) return;

    Alert.alert(
      "Block User",
      `Are you sure you want to block ${profile.full_name}? They will no longer be able to contact you or see your profile.`,
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Block",
          style: "destructive",
          onPress: () => {
            setShowBlockReasonModal(true);
          }
        }
      ]
    );
  }, [profile]);

  // Block user with reason
  const handleBlockConfirm = useCallback(async (reason: string) => {
    if (!profile) return;

    setIsBlocking(true);
    try {
      console.log("Blocking user:", profile.id, "with reason:", reason);
      
      const result = await blockUser(profile.id, reason || undefined);
      
      console.log("Block result:", result);
      
      if (result.success) {
        setShowBlockReasonModal(false);
        
        Alert.alert(
          "Success", 
          result.message || "User blocked successfully",
          [
            {
              text: "OK",
              onPress: () => {
                router.back();
              }
            }
          ]
        );
      } else {
        Alert.alert("Error", result.error || "Failed to block user");
      }
    } catch (error) {
      console.error("Block error:", error);
      Alert.alert("Error", "An unexpected error occurred while blocking user");
    } finally {
      setIsBlocking(false);
    }
  }, [profile, blockUser]);

  // Block without reason
  const handleBlockSkipReason = useCallback(async () => {
    if (!profile) return;

    setIsBlocking(true);
    try {
      console.log("Blocking user without reason:", profile.id);
      
      const result = await blockUser(profile.id);
      
      console.log("Block result:", result);
      
      if (result.success) {
        setShowBlockReasonModal(false);
        
        Alert.alert(
          "Success", 
          result.message || "User blocked successfully",
          [
            {
              text: "OK",
              onPress: () => {
                router.back();
              }
            }
          ]
        );
      } else {
        Alert.alert("Error", result.error || "Failed to block user");
      }
    } catch (error) {
      console.error("Block error:", error);
      Alert.alert("Error", "An unexpected error occurred while blocking user");
    } finally {
      setIsBlocking(false);
    }
  }, [profile, blockUser]);

  // Cancel block modal
  const handleCancelBlock = useCallback(() => {
    setShowBlockReasonModal(false);
  }, []);

  const handleShare = useCallback(() => {
    console.log("Share profile:", profile?.id);
    Alert.alert("Info", "Share functionality not implemented yet");
  }, [profile]);

  const handleReport = useCallback(() => {
    if (!profile) return;
    console.log("Report user:", profile.id);
    Alert.alert("Success", "User reported successfully");
  }, [profile]);

  // Friend request menu options for pending requests
  const friendRequestMenuOptions = useMemo(() => {
    if (!profile || profile.friendshipStatus !== "pending") return [];
    
    return [
      {
        id: 'accept',
        title: 'Accept Request',
        icon: 'checkmark-circle-outline' as keyof typeof Ionicons.glyphMap,
        onPress: handleAcceptRequest,
      },
      {
        id: 'decline',
        title: 'Decline Request',
        icon: 'close-circle-outline' as keyof typeof Ionicons.glyphMap,
        onPress: () => {
          console.log("Decline friend request");
          Alert.alert("Info", "Decline functionality not implemented yet");
        },
        destructive: true,
      },
    ];
  }, [profile, handleAcceptRequest]);

  // Menu options for the profile dropdown
  const profileMenuOptions = useMemo(() => {
    if (!profile) return [];
    
    const baseOptions = [
      {
        id: 'share',
        title: 'Share Profile',
        icon: 'share-outline' as keyof typeof Ionicons.glyphMap,
        onPress: handleShare,
      },
      {
        id: 'report',
        title: 'Report User',
        icon: 'flag-outline' as keyof typeof Ionicons.glyphMap,
        onPress: handleReport,
        destructive: false,
      },
    ];

    if (profile.friendshipStatus !== "blocked") {
      baseOptions.push({
        id: 'block',
        title: 'Block User',
        icon: 'ban-outline' as keyof typeof Ionicons.glyphMap,
        onPress: handleBlock,
        destructive: true,
      });
    }

    return baseOptions;
  }, [profile, handleShare, handleReport, handleBlock]);

  // Utility functions  
  const formatDate = useCallback((date: Date | undefined) => {
    if (!date) return "Unknown";
    return new Date(date).toLocaleDateString();
  }, []);

  const getStatusColor = useCallback(() => {
    if (!profile) return isDark ? "#9CA3AF" : "#6B7280";
    return profile.is_online ? "#10B981" : isDark ? "#9CA3AF" : "#6B7280";
  }, [profile, isDark]);

  const getStatusText = useCallback(() => {
    if (!profile) return "Offline";
    if (profile.is_online) return "Online";
    if (profile.last_seen) {
      const lastSeen = new Date(profile.last_seen);
      const now = new Date();
      const diffInHours = Math.floor(
        (now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60)
      );

      if (diffInHours < 1) return "Recently online";
      if (diffInHours < 24) return `${diffInHours}h ago`;
      return `${Math.floor(diffInHours / 24)}d ago`;
    }
    return "Offline";
  }, [profile]);

  // InfoRow component
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
      <View className="flex-row items-center justify-between py-4 border-b border-gray-200 dark:border-gray-700">
        <View className="flex-row items-center">
          {icon && (
            <Ionicons
              name={icon as any}
              size={18}
              color={isDark ? "#9CA3AF" : "#6B7280"}
              style={{ marginRight: 12 }}
            />
          )}
          <Text className="text-gray-600 dark:text-gray-400 text-sm font-medium">
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

  // Action buttons component
  const ActionButtons = useMemo(() => {
    const ActionButtonsComponent = React.memo(() => {
      if (!profile) return null;

      if (profile.friendshipStatus === "blocked") {
        return (
          <View className="px-4 mt-6">
            <View className="bg-red-100 dark:bg-red-900 rounded-lg p-4">
              <Text className="text-red-600 dark:text-red-400 text-center font-medium">
                User is blocked
              </Text>
              <Text className="text-red-500 dark:text-red-500 text-center text-sm mt-1">
                You have blocked this user
              </Text>
            </View>
          </View>
        );
      }

      return (
        <View className="flex-row gap-3 px-4 mt-6">
          {profile.friendshipStatus === "none" && (
            <Button
              title="Add Friend"
              onPress={handleSendFriendRequest}
              variant="primary"
              style={{ flex: 1 }}
            />
          )}

          {profile.friendshipStatus === "sent" && (
            <View className="flex-1 bg-orange-100 dark:bg-orange-900 rounded-lg p-3">
              <Text className="text-orange-600 dark:text-orange-400 text-center font-medium">
                Request Sent
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
              title="Message"
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
  }, [profile, handleSendFriendRequest, friendRequestMenuOptions, handleMessage, profileMenuOptions, isDark]);

  // Render block modal directly without memo to prevent re-rendering issues
  const renderBlockReasonModal = () => {
    return null; // We'll use the external component instead
  };

  // Loading state
  if (loading && !profile) {
    return (
      <SafeAreaView className={`flex-1 ${isDark ? "bg-black" : "bg-white"}`}>
        <Header
          title="Profile"
          onMenuPress={handleMenuPress}
          onBackPress={handleBackPress}
          showBackButton={true}
        />
        <View className="flex-1 justify-center items-center">
          <Text className={`text-lg ${isDark ? "text-white" : "text-black"}`}>
            Loading profile...
          </Text>
        </View>
        <Sidebar
          isVisible={isSidebarVisible}
          onClose={handleSidebarClose}
        />
      </SafeAreaView>
    );
  }

  // Error state
  if (error || !profile) {
    return (
      <SafeAreaView className={`flex-1 ${isDark ? "bg-black" : "bg-white"}`}>
        <Header
          title="Profile"
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
            Profile not found
          </Text>
          <Text
            className={`text-center mt-2 ${isDark ? "text-gray-400" : "text-gray-600"}`}
          >
            {error || "The user profile could not be loaded"}
          </Text>
          <Button
            title="Try Again"
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
        title="Profile"
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
          {/* Cover Photo */}
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
            {/* Avatar */}
            <View className="w-32 h-32 rounded-full overflow-hidden bg-gray-300 dark:bg-gray-600 border-4 border-white dark:border-gray-800">
              <Image
                source={getAvatarSource()}
                className="w-full h-full"
                resizeMode="cover"
              />
            </View>

            {/* Name and Username */}
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

            {/* Status */}
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

            {/* Bio */}
            {profile.canViewProfile && profile.bio && (
              <Text
                className={`text-center mt-3 px-6 leading-5 ${isDark ? "text-gray-300" : "text-gray-700"}`}
              >
                {profile.bio}
              </Text>
            )}

            {/* Stats */}
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
                  Friends
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
                  Mutual
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <ActionButtons />

        {/* Profile Information */}
        {profile.canViewProfile && profile.friendshipStatus !== "blocked" && (
          <View className="px-4 py-6">
            <Text
              className={`text-lg font-semibold mb-4 ${isDark ? "text-white" : "text-black"}`}
            >
              Information
            </Text>

            {profile.location && (
              <InfoRow
                label="Location"
                value={profile.location}
                icon="location-outline"
              />
            )}

            {profile.website && (
              <InfoRow
                label="Website"
                value={profile.website}
                icon="globe-outline"
              />
            )}

            {profile.status && (
              <InfoRow
                label="Status"
                value={profile.status}
                icon="radio-outline"
              />
            )}
          </View>
        )}

        {/* Privacy Message */}
        {(!profile.canViewProfile || profile.friendshipStatus === "blocked") && (
          <View className="px-4 py-8">
            <View className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6 items-center">
              <Ionicons
                name={profile.friendshipStatus === "blocked" ? "ban" : "lock-closed"}
                size={48}
                color={isDark ? "#9CA3AF" : "#6B7280"}
              />
              <Text
                className={`text-center mt-4 ${isDark ? "text-white" : "text-black"} font-medium`}
              >
                {profile.friendshipStatus === "blocked" 
                  ? "This user is blocked" 
                  : "This profile is private"
                }
              </Text>
              <Text
                className={`text-center mt-2 ${isDark ? "text-gray-400" : "text-gray-600"}`}
              >
                {profile.friendshipStatus === "blocked" 
                  ? "You have blocked this user and cannot see their profile" 
                  : "Send a friend request to see more details"
                }
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Block Reason Modal - External Component */}
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