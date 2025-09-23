import Header from "@/components/shared/Header";
import Sidebar from "@/components/shared/Sidebar";
import React, { useState } from "react";
import { Text, useColorScheme, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function DiscoverScreen() {
  const colorScheme = useColorScheme();
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      <Header 
        title="Discover" 
        onMenuPress={() => setIsSidebarVisible(true)}
      />
      <View className="flex-1 justify-center items-center">
        <Text className="text-lg font-semibold text-black dark:text-white">
          Discover Screen
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