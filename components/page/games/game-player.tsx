// src/components/game/GamePlayer.tsx

import { useLanguage } from "@/contexts/LanguageContext";
import { Game } from "@/hooks/games/use-games";
import { Ionicons } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

interface GamePlayerProps {
  game: Game;
  gameUrl: string;
  onClose: () => void;
  isDark?: boolean;
}

export const GamePlayer: React.FC<GamePlayerProps> = ({
  game,
  gameUrl,
  onClose,
  isDark = false,
}) => {
  const { t } = useLanguage();
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const handleReload = () => {
    setLoadError(false);
    setLoading(true);
    webViewRef.current?.reload();
  };

  const handleError = () => {
    setLoadError(true);
    setLoading(false);
    Alert.alert(
      t("game.error.title" as any), // ✅ Dịch
      t("game.player.checkConnection" as any), // ✅ Dịch
      [
        { text: t("game.player.retry" as any), onPress: handleReload }, // ✅ Dịch
        { text: t("game.player.close" as any), onPress: onClose }, // ✅ Dịch
      ]
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, isDark && styles.containerDark]}
      edges={["top"]}
    >
      {/* Header - không đổi */}
      <View style={[styles.header, isDark && styles.headerDark]}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={28} color={isDark ? "#fff" : "#333"} />
        </TouchableOpacity>

        <Text
          style={[styles.title, isDark && styles.titleDark]}
          numberOfLines={1}
        >
          {game.title}
        </Text>

        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleReload} style={styles.actionButton}>
            <Ionicons
              name="refresh"
              size={24}
              color={isDark ? "#fff" : "#333"}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* WebView */}
      <View style={styles.gameContainer}>
        {!loadError && (
          <WebView
            ref={webViewRef}
            source={{ uri: gameUrl }}
            style={styles.webview}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={handleError}
            onHttpError={handleError}
            startInLoadingState={true}
            allowsBackForwardNavigationGestures={false}
            mixedContentMode="always"
          />
        )}

        {/* Loading Overlay */}
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#F57206" />
            <Text style={styles.loadingText}>
              {t("game.player.loadingGame" as any)} {/* ✅ Dịch */}
            </Text>
          </View>
        )}

        {/* Error State */}
        {loadError && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={64} color="#DC143C" />
            <Text style={styles.errorText}>
              {t("game.player.failedToLoad" as any)} {/* ✅ Dịch */}
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleReload}>
              <Text style={styles.retryText}>
                {t("game.player.retry" as any)} {/* ✅ Dịch */}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  containerDark: {
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  closeButton: {
    padding: 4,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginHorizontal: 12,
    textAlign: "center",
  },
  titleDark: {
    color: "#fff",
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    padding: 4,
  },
  gameContainer: {
    flex: 1,
    position: "relative",
    backgroundColor: "#000",
  },
  webview: {
    flex: 1,
    backgroundColor: "#000",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.8)",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#fff",
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
    marginTop: 16,
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
});
