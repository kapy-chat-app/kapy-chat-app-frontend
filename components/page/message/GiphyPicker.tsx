// components/page/message/GiphyPicker.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Modal,
  StyleSheet,
  Dimensions,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useGiphy, type RichMediaDTO } from "@/hooks/message/useGiphy";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const ITEM_SIZE = (SCREEN_WIDTH - 48) / 2; // 2 columns with padding

interface GiphyPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (richMedia: RichMediaDTO, type: "gif" | "sticker") => void;
  type?: "gif" | "sticker";
}

export const GiphyPicker: React.FC<GiphyPickerProps> = ({
  visible,
  onClose,
  onSelect,
  type: initialType = "gif",
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<"gif" | "sticker">(initialType);
  const [items, setItems] = useState<any[]>([]);
  const [offset, setOffset] = useState(0);
  
  const { actualTheme } = useTheme();
  const { t } = useLanguage();
  const isDark = actualTheme === "dark";
  
  const {
    loading,
    error,
    searchGifs,
    searchStickers,
    getTrendingGifs,
    getTrendingStickers,
    giphyToRichMedia,
  } = useGiphy();

  // Load initial trending content
  useEffect(() => {
    if (visible) {
      loadTrending();
    }
  }, [visible, selectedType]);

  const loadTrending = async () => {
    try {
      const result =
        selectedType === "gif"
          ? await getTrendingGifs(25, 0)
          : await getTrendingStickers(25, 0);

      if (result) {
        setItems(result.items);
        setOffset(result.pagination.offset + result.pagination.count);
      }
    } catch (err) {
      console.error("Error loading trending:", err);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadTrending();
      return;
    }

    try {
      const result =
        selectedType === "gif"
          ? await searchGifs(searchQuery, 25, 0)
          : await searchStickers(searchQuery, 25, 0);

      if (result) {
        setItems(result.items);
        setOffset(result.pagination.offset + result.pagination.count);
      }
    } catch (err) {
      console.error("Error searching:", err);
    }
  };

  const loadMore = async () => {
    if (loading) return;

    try {
      const result = searchQuery.trim()
        ? selectedType === "gif"
          ? await searchGifs(searchQuery, 25, offset)
          : await searchStickers(searchQuery, 25, offset)
        : selectedType === "gif"
          ? await getTrendingGifs(25, offset)
          : await getTrendingStickers(25, offset);

      if (result && result.items.length > 0) {
        setItems((prev) => [...prev, ...result.items]);
        setOffset(result.pagination.offset + result.pagination.count);
      }
    } catch (err) {
      console.error("Error loading more:", err);
    }
  };

  const handleSelect = (item: any) => {
    const richMedia = giphyToRichMedia(item, selectedType);
    onSelect(richMedia, selectedType);
    onClose();
  };

  const handleTypeChange = (type: "gif" | "sticker") => {
    setSelectedType(type);
    setSearchQuery("");
    setItems([]);
    setOffset(0);
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[
        styles.gridItem,
        { height: ITEM_SIZE },
      ]}
      onPress={() => handleSelect(item)}
    >
      <Image
        source={{
          uri: item.images.fixed_width?.url || item.images.original.url,
        }}
        style={styles.gridImage}
        resizeMode="cover"
      />
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View>
      {/* Type Selector */}
      <View style={styles.typeSelector}>
        <TouchableOpacity
          style={[
            styles.typeButton,
            selectedType === "gif" && styles.typeButtonActive,
            isDark && styles.typeButtonDark,
            selectedType === "gif" && styles.typeButtonActiveDark,
          ]}
          onPress={() => handleTypeChange("gif")}
        >
          <Text
            style={[
              styles.typeButtonText,
              selectedType === "gif" && styles.typeButtonTextActive,
              isDark && styles.typeButtonTextDark,
            ]}
          >
            GIF
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.typeButton,
            selectedType === "sticker" && styles.typeButtonActive,
            isDark && styles.typeButtonDark,
            selectedType === "sticker" && styles.typeButtonActiveDark,
          ]}
          onPress={() => handleTypeChange("sticker")}
        >
          <Text
            style={[
              styles.typeButtonText,
              selectedType === "sticker" && styles.typeButtonTextActive,
              isDark && styles.typeButtonTextDark,
            ]}
          >
            Sticker
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View
          style={[
            styles.searchBar,
            isDark ? styles.searchBarDark : styles.searchBarLight,
          ]}
        >
          <Ionicons
            name="search"
            size={20}
            color={isDark ? "#9ca3af" : "#6b7280"}
            style={styles.searchIcon}
          />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            placeholder={`Search ${selectedType}s...`}
            placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
            style={[
              styles.searchInput,
              isDark ? styles.textWhite : styles.textBlack,
            ]}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery("");
                loadTrending();
              }}
            >
              <Ionicons
                name="close-circle"
                size={20}
                color={isDark ? "#6b7280" : "#9ca3af"}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.container,
          isDark ? styles.containerDark : styles.containerLight,
        ]}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            isDark ? styles.headerDark : styles.headerLight,
          ]}
        >
          <Text
            style={[
              styles.headerTitle,
              isDark ? styles.textWhite : styles.textBlack,
            ]}
          >
            {selectedType === "gif" ? "Choose GIF" : "Choose Sticker"}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons
              name="close"
              size={28}
              color={isDark ? "#fff" : "#000"}
            />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            loading ? (
              <View style={styles.emptyContainer}>
                <ActivityIndicator size="large" color="#f97316" />
              </View>
            ) : error ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="alert-circle" size={48} color="#ef4444" />
                <Text
                  style={[
                    styles.emptyText,
                    isDark ? styles.textWhite : styles.textBlack,
                  ]}
                >
                  {error}
                </Text>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons
                  name="images-outline"
                  size={48}
                  color={isDark ? "#6b7280" : "#9ca3af"}
                />
                <Text
                  style={[
                    styles.emptyText,
                    isDark ? styles.textGray : styles.textGrayLight,
                  ]}
                >
                  No {selectedType}s found
                </Text>
              </View>
            )
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loading && items.length > 0 ? (
              <View style={styles.loadingFooter}>
                <ActivityIndicator size="small" color="#f97316" />
              </View>
            ) : null
          }
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerLight: {
    backgroundColor: "#ffffff",
  },
  containerDark: {
    backgroundColor: "#000000",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    paddingTop: Platform.OS === "ios" ? 60 : 16,
  },
  headerLight: {
    borderBottomColor: "#e5e7eb",
  },
  headerDark: {
    borderBottomColor: "#374151",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  closeButton: {
    padding: 4,
  },
  typeSelector: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
  },
  typeButtonDark: {
    backgroundColor: "#1f2937",
  },
  typeButtonActive: {
    backgroundColor: "#f97316",
  },
  typeButtonActiveDark: {
    backgroundColor: "#f97316",
  },
  typeButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6b7280",
  },
  typeButtonTextDark: {
    color: "#9ca3af",
  },
  typeButtonTextActive: {
    color: "#ffffff",
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  searchBarLight: {
    backgroundColor: "#f3f4f6",
  },
  searchBarDark: {
    backgroundColor: "#1f2937",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  row: {
    paddingHorizontal: 16,
    justifyContent: "space-between",
  },
  gridItem: {
    width: ITEM_SIZE,
    marginBottom: 8,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#f3f4f6",
  },
  gridImage: {
    width: "100%",
    height: "100%",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
  },
  loadingFooter: {
    paddingVertical: 20,
    alignItems: "center",
  },
  textWhite: {
    color: "#ffffff",
  },
  textBlack: {
    color: "#000000",
  },
  textGray: {
    color: "#6b7280",
  },
  textGrayLight: {
    color: "#9ca3af",
  },
});