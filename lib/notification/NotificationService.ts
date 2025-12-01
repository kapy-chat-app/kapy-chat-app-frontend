// lib/notification/NotificationService.ts - ENHANCED for Full Screen Calls
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// ⭐ CRITICAL: Cấu hình để hiển thị notification ngay cả khi app đang mở
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as any;

    // For call notifications, ALWAYS show
    if (data.type === "call" && data.action === "incoming_call") {
      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
      };
    }

    // For other notifications
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    };
  },
});

export class NotificationService {
  private static instance: NotificationService;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async registerForPushNotifications(): Promise<string | undefined> {
    let token: string | undefined;

    if (Platform.OS === "android") {
      // ⭐ Default channel
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });

      // ⭐ Messages channel
      await Notifications.setNotificationChannelAsync("messages", {
        name: "Tin nhắn",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        sound: "message.wav",
        enableVibrate: true,
        showBadge: true,
      });

      // ⭐ CRITICAL: Calls channel with MAXIMUM priority
      await Notifications.setNotificationChannelAsync("calls", {
        name: "Cuộc gọi",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 200, 500, 200, 500],
        sound: "ringtone.wav",
        enableVibrate: true,
        showBadge: true,
        enableLights: true,
        lightColor: "#FF0000",
        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
        // ⭐ Audio settings for ringtone-like behavior
        audioAttributes: {
          usage: Notifications.AndroidAudioUsage.NOTIFICATION_RINGTONE,
          contentType: Notifications.AndroidAudioContentType.SONIFICATION,
          flags: {
            enforceAudibleAlert: true,
            audibilityEnforced: true,
          },
        },
      });

      // ⭐ Friend requests channel
      await Notifications.setNotificationChannelAsync("friend_requests", {
        name: "Lời mời kết bạn",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    // iOS specific configuration
    if (Platform.OS === "ios") {
      // Request critical alerts permission for calls
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowSound: true,
          allowBadge: true,
          allowCriticalAlerts: true, // For call notifications
        },
      });

      if (status !== "granted") {
        console.log("❌ iOS notification permissions not granted");
      }
    }

    if (Device.isDevice) {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowSound: true,
            allowBadge: true,
            allowCriticalAlerts: true,
          },
        });
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.log("❌ Không thể lấy quyền thông báo!");
        return undefined;
      }

      const projectId = Constants.expoConfig?.extra?.eas?.projectId;

      token = (
        await Notifications.getExpoPushTokenAsync({
          projectId,
        })
      ).data;

      console.log("✅ Push token:", token);
    } else {
      console.log("⚠️ Phải sử dụng thiết bị thật để nhận thông báo");
    }

    return token;
  }

  async sendPushTokenToServer(
    token: string,
    userId: string,
    getToken: () => Promise<string | null>
  ): Promise<void> {
    try {
      console.log("🔐 Sending push token to server...");
      console.log("🔐 User ID:", userId);

      const authToken = await getToken();

      if (!authToken) {
        console.error("🔐 ❌ No auth token available");
        throw new Error("No authentication token");
      }

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/push-token`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pushToken: token,
            platform: Platform.OS,
            deviceName: Device.deviceName || "Unknown Device",
            deviceId: Constants.sessionId || "unknown",
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("🔐 ❌ Server error:", errorData);
        throw new Error("Failed to send push token");
      }

      const data = await response.json();
      console.log("🔐 ✅ Token sent successfully:", data);
    } catch (error) {
      console.error("🔐 ❌ Error sending token:", error);
      throw error;
    }
  }

  async removePushToken(
    userId: string,
    getToken: () => Promise<string | null>
  ): Promise<void> {
    try {
      const authToken = await getToken();

      if (!authToken) {
        console.error("🔐 ❌ No auth token for removal");
        return;
      }

      await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/push-token`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
      });

      console.log("✅ Token removed from server");
    } catch (error) {
      console.error("❌ Error removing token:", error);
    }
  }

  async getBadgeCount(): Promise<number> {
    return await Notifications.getBadgeCountAsync();
  }

  async setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
  }

  async clearAllNotifications(): Promise<void> {
    await Notifications.dismissAllNotificationsAsync();
  }

  // ⭐ NEW: Clear call notifications specifically
  async clearCallNotifications(): Promise<void> {
    const notifications = await Notifications.getPresentedNotificationsAsync();

    for (const notification of notifications) {
      const data = notification.request.content.data as any;
      if (data.type === "call") {
        await Notifications.dismissNotificationAsync(
          notification.request.identifier
        );
      }
    }
  }
}

export default NotificationService.getInstance();
