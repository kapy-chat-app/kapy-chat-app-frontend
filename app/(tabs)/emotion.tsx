// app/(tabs)/emotion/index.tsx - UPDATED WITH COUNSELOR
import { EmotionCard } from "@/components/page/emotion/EmotionCard";
import { EmotionCounselorCard } from "@/components/page/emotion/EmotionCounselorCard";
import { FilterModal } from "@/components/page/emotion/FilterModal";
import { StatsOverview } from "@/components/page/emotion/StatsOverview";
import { useEmotion, EmotionCounselingData } from "@/hooks/ai/useEmotion";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Ionicons } from "@expo/vector-icons";
import React, { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function EmotionScreen() {
  const { actualTheme } = useTheme();
  const { t } = useLanguage();
  const isDark = actualTheme === 'dark';
  
  const {
    emotions,
    stats,
    loading,
    statsLoading,
    error,
    hasMore,
    total,
    filters,
    updateFilters,
    clearFilters,
    refresh,
    loadMore,
    deleteEmotion,
    chartData,
    averageScoresArray,
    topEmotion,
    emotionsByContext,
    getEmotionCounseling, // ✅ NEW
  } = useEmotion({ days: 30 });

  const [showFilters, setShowFilters] = useState(false);
  const [selectedTab, setSelectedTab] = useState<"history" | "stats">("history");

  // ✅ NEW: Counseling states
  const [counselingData, setCounselingData] = useState<EmotionCounselingData | null>(null);
  const [counselingLoading, setCounselingLoading] = useState(false);

  // ============================================
  // ✅ LOAD COUNSELING DATA
  // ============================================
  const loadCounseling = useCallback(async () => {
    setCounselingLoading(true);
    try {
      const result = await getEmotionCounseling(7); // Last 7 days
      if (result.success && result.data) {
        setCounselingData(result.data);
      } else {
        console.error('Failed to load counseling:', result.error);
      }
    } catch (error) {
      console.error('Error loading counseling:', error);
    } finally {
      setCounselingLoading(false);
    }
  }, [getEmotionCounseling]);

  // ✅ Load counseling on mount
  useEffect(() => {
    loadCounseling();
  }, []);

  // ============================================
  // HANDLE DELETE
  // ============================================
  const handleDelete = async (emotionId: string) => {
    Alert.alert(
      t('emotion.delete.confirmTitle'),
      t('emotion.delete.confirmMessage'),
      [
        { text: t('cancel'), style: "cancel" },
        {
          text: t('emotion.delete.confirmTitle'),
          style: "destructive",
          onPress: async () => {
            const result = await deleteEmotion(emotionId);
            if (result.success) {
              Alert.alert(t('success'), t('emotion.delete.success'));
              // ✅ Refresh counseling after delete
              loadCounseling();
            } else {
              Alert.alert(t('error'), result.error || t('emotion.delete.failed'));
            }
          },
        },
      ]
    );
  };

  // ============================================
  // ✅ HANDLE REFRESH (includes counseling)
  // ============================================
  const handleRefresh = useCallback(() => {
    refresh();
    loadCounseling();
  }, [refresh, loadCounseling]);

  // ============================================
  // RENDER EMPTY STATE
  // ============================================
  const renderEmptyState = () => {
    if (loading) {
      return (
        <View className="flex-1 justify-center items-center py-10">
          <ActivityIndicator size="large" color="#F57206" />
        </View>
      );
    }

    return (
      <View className="flex-1 justify-center items-center py-16">
        <Ionicons
          name="emotions-outline"
          size={64}
          color={isDark ? "#666" : "#ccc"}
        />
        <Text className={`text-base mt-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          {t('emotion.empty')}
        </Text>
      </View>
    );
  };

  // ============================================
  // ERROR STATE
  // ============================================
  if (error) {
    return (
      <SafeAreaView className={`flex-1 ${isDark ? 'bg-black' : 'bg-gray-50'}`}>
        <View className="flex-1 justify-center items-center p-5">
          <Ionicons name="alert-circle" size={64} color="#DC143C" />
          <Text className="text-base text-red-600 mt-4 text-center">
            {error}
          </Text>
          <TouchableOpacity
            className="mt-5 px-6 py-3 bg-[#F57206] rounded-lg"
            onPress={handleRefresh}
          >
            <Text className="text-white text-base font-semibold">{t('emotion.tryAgain')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ============================================
  // MAIN RENDER
  // ============================================
  return (
    <SafeAreaView className={`flex-1 ${isDark ? 'bg-black' : 'bg-gray-50'}`}>
      {/* Header */}
      <View className={`flex-row justify-between items-center px-4 py-3 border-b ${isDark ? 'bg-black border-gray-800' : 'bg-white border-gray-200'}`}>
        <Text className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {t('emotion.title')}
        </Text>

        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={() => setShowFilters(true)}
            className="p-1"
          >
            <Ionicons
              name="filter"
              size={24}
              color={isDark ? "#fff" : "#333"}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View className={`flex-row border-b ${isDark ? 'bg-black border-gray-800' : 'bg-white border-gray-200'}`}>
        <TouchableOpacity
          className={`flex-1 py-3 items-center border-b-2 ${
            selectedTab === "history"
              ? "border-[#F57206]"
              : "border-transparent"
          }`}
          onPress={() => setSelectedTab("history")}
        >
          <Text
            className={`text-base font-medium ${
              selectedTab === "history"
                ? "text-[#F57206] font-semibold"
                : isDark ? "text-gray-400" : "text-gray-600"
            }`}
          >
            {t('emotion.tabs.history')} ({total})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className={`flex-1 py-3 items-center border-b-2 ${
            selectedTab === "stats" ? "border-[#F57206]" : "border-transparent"
          }`}
          onPress={() => setSelectedTab("stats")}
        >
          <Text
            className={`text-base font-medium ${
              selectedTab === "stats"
                ? "text-[#F57206] font-semibold"
                : isDark ? "text-gray-400" : "text-gray-600"
            }`}
          >
            {t('emotion.tabs.stats')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {selectedTab === "history" ? (
        <FlatList
          data={emotions}
          renderItem={({ item }) => (
            <EmotionCard item={item} onDelete={handleDelete} />
          )}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ paddingBottom: 16 }}
          // ✅ ADD COUNSELOR CARD AS HEADER
          ListHeaderComponent={
            <EmotionCounselorCard
              loading={counselingLoading}
              data={counselingData}
              onRefresh={loadCounseling}
            />
          }
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={handleRefresh}
              colors={["#F57206"]}
              tintColor="#F57206"
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={renderEmptyState()}
          ListFooterComponent={
            hasMore && !loading ? (
              <View className="py-5 items-center">
                <ActivityIndicator size="small" color="#F57206" />
              </View>
            ) : null
          }
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={statsLoading}
              onRefresh={handleRefresh}
              colors={["#F57206"]}
              tintColor="#F57206"
            />
          }
        >
          <StatsOverview
            stats={stats}
            loading={statsLoading}
            chartData={chartData}
            averageScoresArray={averageScoresArray}
            topEmotion={topEmotion}
            emotionsByContext={emotionsByContext}
          />
        </ScrollView>
      )}

      {/* Filter Modal */}
      <FilterModal
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        updateFilters={updateFilters}
        clearFilters={clearFilters}
      />
    </SafeAreaView>
  );
}