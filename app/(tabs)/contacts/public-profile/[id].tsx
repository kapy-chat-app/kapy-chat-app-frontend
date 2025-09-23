import Header from "@/components/shared/Header";
import Sidebar from "@/components/shared/Sidebar";
import Button from "@/components/ui/Button";
import BackButton from "@/components/ui/BackButton";
import MenuDropdown from "@/components/ui/MenuDropdown"; // Add this import
import { useFriendRequests, useBlockedUsers } from "@/hooks/friend/useFriends"; // Add useBlockedUsers
import { usePublicProfile } from "@/hooks/friend/usePublicProfile";
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
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const PublicProfileScreen = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { id } = useLocalSearchParams<{ id: string }>();
  
  // Get stable references from hooks
  const publicProfileHook = usePublicProfile();
  const friendRequestsHook = useFriendRequests();
  const blockedUsersHook = useBlockedUsers(); // Add this hook
  
  const { profile, loading, error, getUserProfile, clearError, clearProfile } = publicProfileHook;
  const { sendFriendRequest, respondToRequest } = friendRequestsHook;
  const { blockUser, unblockUser } = blockedUsersHook; // Destructure block functions

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

  // Load profile only when id changes, using stable function
  useEffect(() => {
    if (id && typeof id === 'string') {
      // Only clear and load if it's a different user
      getUserProfile(id);
    }
  }, [id]); // Remove getUserProfile from dependencies

  // Refresh handler with stable dependencies
  const onRefresh = useCallback(async () => {
    if (!id || typeof id !== 'string') return;

    setRefreshing(true);
    try {
      await getUserProfile(id);
    } finally {
      setRefreshing(false);
    }
  }, [id]); // Remove getUserProfile from dependencies

  // Friend request handlers with stable dependencies
  const handleSendFriendRequest = useCallback(async () => {
    if (!profile || !id) return;

    const result = await sendFriendRequest(profile.id);
    if (result.success) {
      Alert.alert("Success", "Friend request sent successfully");
      // Refresh profile to get updated friendship status
      await getUserProfile(id as string);
    } else {
      Alert.alert("Error", result.error || "Failed to send friend request");
    }
  }, [profile, id, sendFriendRequest]); // Remove getUserProfile from dependencies

  const handleAcceptRequest = useCallback(async () => {
    if (!profile || !id) return;

    const result = await respondToRequest("request-id", "accept");
    if (result.success) {
      Alert.alert("Success", "Friend request accepted");
      await getUserProfile(id as string);
    } else {
      Alert.alert("Error", result.error || "Failed to accept request");
    }
  }, [profile, id, respondToRequest]); // Remove getUserProfile from dependencies

  const handleMessage = useCallback(() => {
    if (!profile) return;
    router.push(`/conversations/${profile.id}`);
  }, [profile]);

  // Updated block handler with confirmation dialog and reason input
  const handleBlock = useCallback(async () => {
    if (!profile) return;

    // Show confirmation dialog with reason input
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
          onPress: async () => {
            // Optional: Ask for block reason
            Alert.prompt(
              "Block Reason (Optional)",
              "Would you like to provide a reason for blocking this user?",
              [
                {
                  text: "Skip",
                  onPress: async () => {
                    const result = await blockUser(profile.id);
                    if (result.success) {
                      Alert.alert("Success", "User blocked successfully", [
                        {
                          text: "OK",
                          onPress: () => {
                            // Go back since user is now blocked
                            router.back();
                          }
                        }
                      ]);
                    } else {
                      Alert.alert("Error", result.error || "Failed to block user");
                    }
                  }
                },
                {
                  text: "Block with Reason",
                  onPress: async (reason) => {
                    const result = await blockUser(profile.id, reason || undefined);
                    if (result.success) {
                      Alert.alert("Success", "User blocked successfully", [
                        {
                          text: "OK",
                          onPress: () => {
                            // Go back since user is now blocked
                            router.back();
                          }
                        }
                      ]);
                    } else {
                      Alert.alert("Error", result.error || "Failed to block user");
                    }
                  }
                }
              ],
              "plain-text",
              "",
              "default"
            );
          }
        }
      ]
    );
  }, [profile, blockUser]);

  const handleShare = useCallback(() => {
    // Implement share profile functionality
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
          // Handle decline request
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

    // Only show block option if user is not already blocked
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

  // Memoized utility functions  
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

  // Memoized InfoRow component
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

  // Memoized Action buttons component
  const ActionButtons = useMemo(() => {
    const ActionButtonsComponent = React.memo(() => {
      if (!profile) return null;

      // Don't show action buttons if user is blocked
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
          {/* Add Friend Button */}
          {profile.friendshipStatus === "none" && (
            <Button
              title="Add Friend"
              onPress={handleSendFriendRequest}
              variant="primary"
              style={{ flex: 1 }}
            />
          )}

          {/* Request Sent Status */}
          {profile.friendshipStatus === "sent" && (
            <View className="flex-1 bg-orange-100 dark:bg-orange-900 rounded-lg p-3">
              <Text className="text-orange-600 dark:text-orange-400 text-center font-medium">
                Request Sent
              </Text>
            </View>
          )}

          {/* Pending Friend Request - Use MenuDropdown */}
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

          {/* Message Button for Friends */}
          {profile.friendshipStatus === "accepted" && (
            <Button
              title="Message"
              onPress={handleMessage}
              variant="primary"
              style={{ flex: 1 }}
            />
          )}

          {/* Profile Menu Dropdown */}
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
              {profile.avatar ? (
                <Image
                  source={{ uri: profile.avatar }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              ) : (
                <View className="w-full h-full justify-center items-center">
                  <Ionicons
                    name="person"
                    size={60}
                    color={isDark ? "#9CA3AF" : "#6B7280"}
                  />
                </View>
              )}
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

      <Sidebar
        isVisible={isSidebarVisible}
        onClose={handleSidebarClose}
      />
    </SafeAreaView>
  );
};

// Set display name for debugging
PublicProfileScreen.displayName = "PublicProfileScreen";

export default PublicProfileScreen;