import Header from "@/components/shared/Header";
import Sidebar from "@/components/shared/Sidebar";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StatusBar,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Delay render để navigation context được khởi tạo hoàn toàn
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 150);

    return () => clearTimeout(timer);
  }, []);

  // Loading screen với styling đơn giản để tránh NativeWind
  if (!isReady) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center',
        backgroundColor: isDark ? '#000000' : '#FFFFFF'
      }}>
        <ActivityIndicator size="large" color="#f97316" />
        <Text style={{ 
          marginTop: 16, 
          color: isDark ? '#9CA3AF' : '#6B7280' 
        }}>
          Loading...
        </Text>
      </View>
    );
  }

  // Render component chính với NativeWind sau khi navigation context sẵn sàng
  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={isDark ? "#000000" : "#FFFFFF"}
      />

      <Header title="Home" onMenuPress={() => setIsSidebarVisible(true)} />

      <View className="flex-1 justify-center items-center px-5">
        <Text className="text-2xl font-bold text-center text-black dark:text-white">
          Home Screen
        </Text>
        <Text className="text-base text-center mt-4 text-gray-600 dark:text-gray-400">
          Welcome to your home page
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