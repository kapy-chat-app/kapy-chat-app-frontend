// app/(tabs)/emotion/index.tsx
import { EmotionCard } from "@/components/page/emotion/EmotionCard";
import { FilterModal } from "@/components/page/emotion/FilterModal";
import { StatsOverview } from "@/components/page/emotion/StatsOverview";
import { useEmotion } from "@/hooks/ai/useEmotion";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function EmotionScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
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
  } = useEmotion({ days: 30 });

  const [showFilters, setShowFilters] = useState(false);
  const [selectedTab, setSelectedTab] = useState<"history" | "stats">("history");

  // ============================================
  // HANDLE DELETE
  // ============================================
  const handleDelete = async (emotionId: string) => {
    Alert.alert(
      "Xác nhận xóa",
      "Bạn có chắc chắn muốn xóa phân tích cảm xúc này?",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: async () => {
            const result = await deleteEmotion(emotionId);
            if (result.success) {
              Alert.alert("Thành công", "Đã xóa phân tích cảm xúc");
            } else {
              Alert.alert("Lỗi", result.error || "Không thể xóa");
            }
          },
        },
      ]
    );
  };

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
        <Text className="text-base mt-3 text-gray-400 dark:text-gray-500">
          Chưa có dữ liệu cảm xúc
        </Text>
      </View>
    );
  };

  // ============================================
  // ERROR STATE
  // ============================================
  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-black">
        <View className="flex-1 justify-center items-center p-5">
          <Ionicons name="alert-circle" size={64} color="#DC143C" />
          <Text className="text-base text-red-600 mt-4 text-center">
            {error}
          </Text>
          <TouchableOpacity
            className="mt-5 px-6 py-3 bg-[#F57206] rounded-lg"
            onPress={refresh}
          >
            <Text className="text-white text-base font-semibold">Thử lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ============================================
  // MAIN RENDER
  // ============================================
  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-black">
      {/* Header */}
      <View className="flex-row justify-between items-center px-4 py-3 border-b bg-white dark:bg-black border-gray-200 dark:border-gray-800">
        <Text className="text-2xl font-bold text-gray-900 dark:text-white">
          Cảm xúc của tôi
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
      <View className="flex-row border-b bg-white dark:bg-black border-gray-200 dark:border-gray-800">
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
                : "text-gray-600 dark:text-gray-400"
            }`}
          >
            Lịch sử ({total})
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
                : "text-gray-600 dark:text-gray-400"
            }`}
          >
            Thống kê
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
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={refresh}
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
              onRefresh={refresh}
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