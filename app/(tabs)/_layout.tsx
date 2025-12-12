import { useLanguage } from "@/contexts/LanguageContext";
import { useNotification } from "@/contexts/NotificationContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useEffect } from "react";

export default function TabLayout() {
  const { actualTheme } = useTheme();
  const { t } = useLanguage();
  const isDark = actualTheme === "dark";

  const colors = {
    light: {
      tabBar: "#F8F8F8",
      active: "#FF8C42",
      inactive: "#8E8E93",
    },
    dark: {
      tabBar: "#1C1C1E",
      active: "#FF8C42",
      inactive: "#8E8E93",
    },
  };

  const currentColors = isDark ? colors.dark : colors.light;
  const { registerForPushNotifications } = useNotification();
  const { userId, isLoaded, isSignedIn } = useAuth(); // ✅ Clerk only provides userId, isLoaded, isSignedIn

  useEffect(() => {
    console.log("🔔 ========================================");
    console.log("🔔 TabLayout useEffect triggered");
    console.log("🔔 isLoaded:", isLoaded);
    console.log("🔔 isSignedIn:", isSignedIn);
    console.log("🔔 userId:", userId);
    console.log("🔔 ========================================");

    // Đăng ký push notifications khi user đã login
    if (isLoaded && isSignedIn && userId) {
      console.log("🔔 ✅ User is logged in, registering push notifications...");
      console.log("🔔 User ID:", userId);
      registerForPushNotifications();
    } else {
      console.log("🔔 ❌ User not ready yet");
      console.log("🔔 - isLoaded:", isLoaded);
      console.log("🔔 - isSignedIn:", isSignedIn);
      console.log("🔔 - userId:", userId);
    }
  }, [userId, isLoaded, isSignedIn, registerForPushNotifications]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: currentColors.tabBar,
          borderTopWidth: 0,
          paddingBottom: 20,
          paddingTop: 10,
          height: 80,
        },
        tabBarActiveTintColor: currentColors.active,
        tabBarInactiveTintColor: currentColors.inactive,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "500",
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t("tabs.home"),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="conversations"
        options={{
          title: t("tabs.conversations"),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "chatbubbles" : "chatbubbles-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="contacts"
        options={{
          title: t("tabs.contacts"),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "people" : "people-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="emotion"
        options={{
          title: t("tabs.emotion"),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "sparkles" : "sparkles-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="ai-chat"
        options={{
          title: t("tabs.ai"),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "sparkles" : "sparkles-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="setting"
        options={{
          title: t("tabs.setting"),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "settings" : "settings-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}