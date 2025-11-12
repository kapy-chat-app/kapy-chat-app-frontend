import Header from "@/components/shared/Header";
import Sidebar from "@/components/shared/Sidebar";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StatusBar, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";

export default function HomeScreen() {
  const { actualTheme } = useTheme();
  const { t } = useLanguage();
  const isDark = actualTheme === "dark";

  // Log theme để debug
  useEffect(() => {
    console.log("Theme changed to:", actualTheme, "isDark:", isDark);
  }, [actualTheme]);

  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Delay render để navigation context được khởi tạo hoàn toàn
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 150);

    return () => clearTimeout(timer);
  }, []);

  // Loading screen với NativeWind
  if (!isReady) {
    return (
      <View
        className={`flex-1 justify-center items-center ${isDark ? "bg-black" : "bg-white"}`}
      >
        <ActivityIndicator size="large" color="#f97316" />
        <Text className={`mt-4 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
          {t("loading")}
        </Text>
      </View>
    );
  }

  // Render component chính - Force background rõ hơn bằng style fallback nếu NativeWind fail
  return (
    <SafeAreaView
      className="flex-1 bg-white dark:bg-black"
      style={{ backgroundColor: isDark ? "#000000" : "#FFFFFF" }} // Fallback inline style
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={isDark ? "#000000" : "#FFFFFF"}
      />

      <Header title={t("home")} onMenuPress={() => setIsSidebarVisible(true)} />

      <View
        className="flex-1 justify-center items-center px-5 bg-white dark:bg-black"
        style={{ backgroundColor: isDark ? "#000000" : "#FFFFFF" }} // Fallback cho content
      >
        <Text className="text-2xl font-bold text-center text-black dark:text-white mb-4">
          {t("homeScreen.title")}
        </Text>
        <Text className="text-base text-center text-gray-600 dark:text-gray-400">
          {t("homeScreen.welcome")}
        </Text>
      </View>

      {/* Sidebar Overlay */}
      <Sidebar
        isVisible={isSidebarVisible}
        onClose={() => setIsSidebarVisible(false)}
      />
    </SafeAreaView>
  );
}
