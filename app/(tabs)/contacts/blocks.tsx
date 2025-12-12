import Header from "@/components/shared/Header";
import Sidebar from "@/components/shared/Sidebar";
import Button from "@/components/ui/Button";
import { useBlockedUsers } from "@/hooks/friend/useFriends";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import React, { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface BlockedUser {
  id: string;
  full_name: string;
  username: string;
  avatar?: string;
  blocked_at: Date;
  block_reason?: string;
}

const BlockedUsersScreen = () => {
  const { actualTheme } = useTheme();
  const { t } = useLanguage();
  const isDark = actualTheme === 'dark';
  
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const router = useRouter();
  const { blockedUsers, loading, unblockUser, loadBlockedUsers } = useBlockedUsers();

  const handleMenuPress = useCallback(() => {
    setIsSidebarVisible(true);
  }, []);

  const handleSidebarClose = useCallback(() => {
    setIsSidebarVisible(false);
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadBlockedUsers();
    } catch (error) {
      console.error("Error refreshing:", error);
    } finally {
      setRefreshing(false);
    }
  }, [loadBlockedUsers]);

  const handleUnblock = useCallback(async (user: BlockedUser) => {
    Alert.alert(
      t('friends.blocked.title'),
      t('friends.blocked.confirm', { name: user.full_name }),
      [
        {
          text: t('friends.blocked.cancel'),
          style: "cancel",
        },
        {
          text: t('friends.blocked.unblock'),
          style: "destructive",
          onPress: async () => {
            const result = await unblockUser(user.id);
            if (result.success) {
              Alert.alert(t('success'), t('blockedUsers.unblockSuccess'));
              loadBlockedUsers();
            } else {
              Alert.alert(t('error'), result.error || t('blockedUsers.unblockFailed'));
            }
          },
        },
      ]
    );
  }, [unblockUser, loadBlockedUsers, t]);

  const formatDate = useCallback((date: Date) => {
    return new Date(date).toLocaleDateString();
  }, []);

  const renderBlockedUser = useCallback(({ item }: { item: BlockedUser }) => (
    <View className={`mx-4 mb-3 p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
      <View className="flex-row items-center">
        <Image
          source={{
            uri: item.avatar || "https://via.placeholder.com/50",
          }}
          className="w-12 h-12 rounded-full"
        />
        
        <View className="flex-1 ml-3">
          <Text className={`font-semibold text-base ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {item.full_name}
          </Text>
          <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            @{item.username}
          </Text>
          <Text className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            {t('friends.blocked.on', { date: formatDate(item.blocked_at) })}
          </Text>
          {item.block_reason && (
            <Text className={`text-xs mt-1 italic ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              {t('friends.blocked.reason', { reason: item.block_reason })}
            </Text>
          )}
        </View>

        <Button
          title={t('friends.blocked.unblock')}
          onPress={() => handleUnblock(item)}
          variant="secondary"
          size="small"
        />
      </View>
    </View>
  ), [isDark, handleUnblock, formatDate, t]);

  const renderEmptyState = useCallback(() => (
    <View className="flex-1 justify-center items-center px-8 py-12">
      <Ionicons
        name="ban"
        size={64}
        color={isDark ? "#6B7280" : "#9CA3AF"}
      />
      <Text className={`text-xl font-semibold mt-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
        {t('blockedUsers.empty')}
      </Text>
      <Text className={`text-center mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
        {t('blockedUsers.emptyDescription')}
      </Text>
    </View>
  ), [isDark, t]);

  return (
    <SafeAreaView className={`flex-1 ${isDark ? 'bg-black' : 'bg-gray-50'}`}>
      <Header 
        title={t('blockedUsers.title')} 
        onMenuPress={handleMenuPress}
        showBackButton={true}
        onBackPress={() => router.back()}
      />

      <FlatList
        data={blockedUsers}
        renderItem={renderBlockedUser}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ 
          paddingTop: 16,
          flexGrow: 1 
        }}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#FF8C42"
          />
        }
      />

      <Sidebar
        isVisible={isSidebarVisible}
        onClose={handleSidebarClose}
      />
    </SafeAreaView>
  );
};

BlockedUsersScreen.displayName = 'BlockedUsersScreen';

export default BlockedUsersScreen;