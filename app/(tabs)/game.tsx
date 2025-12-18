// app/(tabs)/game/index.tsx

import { GamePlayer } from "@/components/page/games/game-player";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Game, useGames } from "@/hooks/games/use-games";
import { getThumbnail } from "@/utils/get-game-thumbnails";
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 48) / 2;

export default function GameScreen() {
  const { actualTheme } = useTheme();
  const { t } = useLanguage();
  const { userId } = useAuth();
  const isDark = actualTheme === "dark";

  // ============================================
  // USE GAMES HOOK
  // ============================================
  const {
    games,
    categories,
    loading,
    refreshing,
    error,
    selectedCategory,
    refresh,
    changeCategory,
    playGame,
  } = useGames();

  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [gameUrl, setGameUrl] = useState<string>("");
  const [loadingGame, setLoadingGame] = useState(false);

  // ============================================
  // HANDLE GAME PRESS
  // ============================================
  const handleGamePress = async (game: Game) => {
    try {
      setLoadingGame(true);

      const embedUrl = await playGame(game.slug, userId || undefined);

      if (!embedUrl) {
        throw new Error(t("game.loadError" as any)); // ✅ Dịch
      }

      setGameUrl(embedUrl);
      setSelectedGame(game);
    } catch (error: any) {
      console.error("Failed to load game:", error);
      Alert.alert(
        t("error"), // ✅ Dịch
        error.message || t("game.error.loadFailed" as any) // ✅ Dịch
      );
    } finally {
      setLoadingGame(false);
    }
  };

  // ============================================
  // CLOSE GAME
  // ============================================
  const handleCloseGame = () => {
    setSelectedGame(null);
    setGameUrl("");
  };

  // ============================================
  // RENDER GAME CARD
  // ============================================
  const renderGameCard = ({ item }: { item: Game }) => (
    <TouchableOpacity
      style={[styles.card, { width: CARD_WIDTH }, isDark && styles.cardDark]}
      onPress={() => handleGamePress(item)}
      activeOpacity={0.7}
    >
      <Image
        source={getThumbnail(item.slug)}
        style={styles.thumbnail}
        resizeMode="cover"
      />

      <View style={styles.content}>
        <Text
          style={[styles.title, isDark && styles.titleDark]}
          numberOfLines={1}
        >
          {item.title}
        </Text>

        <Text
          style={[styles.description, isDark && styles.descriptionDark]}
          numberOfLines={2}
        >
          {item.description}
        </Text>

        <View style={styles.footer}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{item.category}</Text>
          </View>

          <View style={styles.stats}>
            <Ionicons name="star" size={14} color="#FFD700" />
            <Text style={[styles.rating, isDark && styles.ratingDark]}>
              {item.rating.toFixed(1)}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  // ============================================
  // RENDER CATEGORY FILTER
  // ============================================
  const renderCategoryFilter = () => (
    <View style={styles.categoryContainer}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={categories}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.categoryChip,
              selectedCategory === item && styles.categoryChipActive,
              isDark && styles.categoryChipDark,
              selectedCategory === item &&
                isDark &&
                styles.categoryChipActiveDark,
            ]}
            onPress={() => changeCategory(item)}
          >
            <Text
              style={[
                selectedCategory === item && styles.categoryTextActive,
                isDark && styles.categoryTextDark,
                selectedCategory === item &&
                  isDark &&
                  styles.categoryTextActiveDark,
              ]}
            >
              {item.charAt(0).toUpperCase() + item.slice(1)}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );

  // ============================================
  // RENDER EMPTY STATE
  // ============================================
  const renderEmptyState = () => {
    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#F57206" />
          <Text style={styles.loadingText}>
            {t("game.loading" as any)} {/* ✅ Dịch */}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Ionicons
          name="game-controller-outline"
          size={64}
          color={isDark ? "#666" : "#ccc"}
        />
        <Text style={[styles.emptyText, isDark && styles.emptyTextDark]}>
          {t("game.empty" as any)} {/* ✅ Dịch */}
        </Text>
      </View>
    );
  };

  // ============================================
  // ERROR STATE
  // ============================================
  if (error) {
    return (
      <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#DC143C" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refresh}>
            <Text style={styles.retryText}>
              {t("game.tryAgain" as any)} {/* ✅ Dịch */}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ============================================
  // MAIN RENDER
  // ============================================
  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      {/* Header */}
      <View style={[styles.header, isDark && styles.headerDark]}>
        <Text style={[styles.headerTitle, isDark && styles.headerTitleDark]}>
          {t("tabs.game" as any) || "🎮 Games"}
        </Text>

        <TouchableOpacity onPress={refresh} disabled={loading}>
          <Ionicons
            name="refresh"
            size={24}
            color={loading ? "#999" : isDark ? "#fff" : "#333"}
          />
        </TouchableOpacity>
      </View>

      {/* Category Filter */}
      {categories.length > 0 && renderCategoryFilter()}

      {/* Games List */}
      <FlatList
        data={games}
        renderItem={renderGameCard}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            colors={["#F57206"]}
            tintColor="#F57206"
          />
        }
        ListEmptyComponent={renderEmptyState()}
      />

      {/* Game Player Modal */}
      {selectedGame && gameUrl && (
        <Modal
          visible={true}
          animationType="slide"
          onRequestClose={handleCloseGame}
        >
          <GamePlayer
            game={selectedGame}
            gameUrl={gameUrl}
            onClose={handleCloseGame}
            isDark={isDark}
          />
        </Modal>
      )}

      {/* Loading Overlay */}
      {loadingGame && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#F57206" />
          <Text style={styles.loadingText}>
            {t("game.loadingGame" as any)} {/* ✅ Dịch */}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

// ============================================
// STYLES
// ============================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  containerDark: {
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    backgroundColor: "#fff",
  },
  headerDark: {
    backgroundColor: "#000",
    borderBottomColor: "#333",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  headerTitleDark: {
    color: "#fff",
  },
  categoryContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
    marginRight: 8,
  },
  categoryChipDark: {
    backgroundColor: "#222",
  },
  categoryChipActive: {
    backgroundColor: "#F57206",
    color: "#666",
  },
  categoryChipActiveDark: {
    backgroundColor: "#F57206",
    color: "#666",
  },
  categoryText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#fff",
  },
  categoryTextDark: {
    color: "#ccc",
  },
  categoryTextActive: {
    color: "#fff",
  },
  categoryTextActiveDark: {
    color: "#fff",
  },
  listContent: {
    padding: 16,
  },
  row: {
    justifyContent: "space-between",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardDark: {
    backgroundColor: "#1a1a1a",
  },
  thumbnail: {
    width: "100%",
    height: 120,
    backgroundColor: "#f0f0f0",
  },
  content: {
    padding: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  titleDark: {
    color: "#fff",
  },
  description: {
    fontSize: 12,
    color: "#666",
    marginBottom: 8,
    lineHeight: 16,
  },
  descriptionDark: {
    color: "#aaa",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  categoryBadge: {
    backgroundColor: "#F57206",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  stats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  rating: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  ratingDark: {
    color: "#aaa",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: "#999",
    marginTop: 12,
  },
  emptyTextDark: {
    color: "#666",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: "#DC143C",
    marginTop: 12,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "#F57206",
    borderRadius: 8,
  },
  retryText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#fff",
    fontSize: 16,
    marginTop: 12,
  },
});
