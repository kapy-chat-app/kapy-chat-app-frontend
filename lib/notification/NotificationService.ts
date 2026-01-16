// lib/notification/NotificationService.ts - UPDATED with FCM Token for Android
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// ⭐ CRITICAL: Cấu hình để hiển thị notification ngay cả khi app đang mở
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as any;

    // For call notifications, ALWAYS show with max priority
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

  /**
   * ⭐ UPDATED: Get push token - FCM for Android, Expo for iOS
   */
 private async getPushToken(): Promise<string | undefined> {
  try {
    console.log("📱 Getting Expo push token...");

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;

    console.log("📱 ProjectId:", projectId);

    if (!projectId) {
      console.error(
        "❌ Missing EAS projectId. Check app.json -> expo.extra.eas.projectId"
      );
      return undefined;
    }

    const expoPushToken = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    console.log("✅ Expo Push Token obtained:", expoPushToken.data);
    return expoPushToken.data;
  } catch (error) {
    console.error("❌ Error getting Expo push token:", error);
    return undefined;
  }
}

  /**
   * ⭐ Register for push notifications
   * Returns FCM token (Android) or Expo token (iOS)
   */
  async registerForPushNotifications(): Promise<string | undefined> {
    console.log("📱 Starting push notification registration...");
    console.log("📱 Platform:", Platform.OS);
    console.log("📱 Device:", Device.isDevice ? "Physical" : "Simulator");

    // Check if running on physical device
    if (!Device.isDevice) {
      console.log("⚠️ Must use physical device for push notifications (not simulator)");
      return undefined;
    }

    // ⭐ STEP 1: Create notification channels (Android only)
    if (Platform.OS === "android") {
      console.log("📱 Creating Android notification channels...");

      // Default channel
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });

      // Messages channel
      await Notifications.setNotificationChannelAsync("messages", {
        name: "Tin nhắn",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        sound: "message.wav",
        enableVibrate: true,
        showBadge: true,
      });

      // ⭐ CRITICAL: Calls channel - MUST match CallNotificationModule.kt
      await Notifications.setNotificationChannelAsync("incoming_calls", {
        name: "Cuộc gọi đến",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 200, 500, 200, 500],
        sound: "ringtone.wav", // Must exist in android/app/src/main/res/raw/
        enableVibrate: true,
        showBadge: true,
        enableLights: true,
        lightColor: "#FF0000",
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
        audioAttributes: {
          usage: Notifications.AndroidAudioUsage.NOTIFICATION_RINGTONE,
          contentType: Notifications.AndroidAudioContentType.SONIFICATION,
          flags: {
            enforceAudibleAlert: true,
            audibilityEnforced: true,
          },
        },
      });

      // Friend requests channel
      await Notifications.setNotificationChannelAsync("friend_requests", {
        name: "Lời mời kết bạn",
        importance: Notifications.AndroidImportance.DEFAULT,
      });

      console.log("✅ Android notification channels created");
    }

    // ⭐ STEP 2: Request permissions
    console.log("📋 Requesting notification permissions...");
    
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      console.log("⚠️ Permission not granted yet, requesting...");
      
      const permissionRequest = Platform.OS === "ios"
        ? {
            ios: {
              allowAlert: true,
              allowSound: true,
              allowBadge: true,
              allowCriticalAlerts: true, // For call notifications
            },
          }
        : {};

      const { status } = await Notifications.requestPermissionsAsync(permissionRequest);
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("❌ Push notification permission DENIED by user");
      return undefined;
    }

    console.log("✅ Notification permissions granted");

    // ⭐ STEP 3: Get push token (FCM for Android, Expo for iOS)
    const token = await this.getPushToken();

    if (!token) {
      console.error("❌ Failed to obtain push token");
      return undefined;
    }

    console.log("✅ Push token registration complete");
    return token;
  }

  /**
   * Send push token to backend
   */
  async sendPushTokenToServer(
    token: string,
    userId: string,
    getToken: () => Promise<string | null>
  ): Promise<void> {
    try {
      console.log("📤 Sending push token to server...");
      console.log("👤 User ID:", userId);
      console.log("📱 Token type:", token.startsWith("ExponentPushToken[") ? "Expo" : "FCM");

      const authToken = await getToken();

      if (!authToken) {
        console.error("❌ No auth token available");
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
            tokenType: token.startsWith("ExponentPushToken[") ? "expo" : "fcm",
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("❌ Server error:", errorData);
        throw new Error(`Failed to send push token: ${response.status}`);
      }

      const data = await response.json();
      console.log("✅ Push token sent successfully:", data);
    } catch (error) {
      console.error("❌ Error sending token to server:", error);
      throw error;
    }
  }

  /**
   * Remove push token from server
   */
  async removePushToken(
    userId: string,
    getToken: () => Promise<string | null>
  ): Promise<void> {
    try {
      console.log("🗑️ Removing push token from server...");
      
      const authToken = await getToken();

      if (!authToken) {
        console.error("❌ No auth token for token removal");
        return;
      }

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/push-token`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        console.log("✅ Push token removed from server");
      } else {
        console.error("❌ Failed to remove token:", response.status);
      }
    } catch (error) {
      console.error("❌ Error removing token:", error);
    }
  }

  /**
   * Get badge count
   */
  async getBadgeCount(): Promise<number> {
    return await Notifications.getBadgeCountAsync();
  }

  /**
   * Set badge count
   */
  async setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
  }

  /**
   * Clear all notifications
   */
  async clearAllNotifications(): Promise<void> {
    await Notifications.dismissAllNotificationsAsync();
    console.log("✅ All notifications cleared");
  }

  /**
   * Clear call notifications specifically
   */
  async clearCallNotifications(): Promise<void> {
    try {
      const notifications = await Notifications.getPresentedNotificationsAsync();
      
      let clearedCount = 0;
      for (const notification of notifications) {
        const data = notification.request.content.data as any;
        if (data.type === "call") {
          await Notifications.dismissNotificationAsync(
            notification.request.identifier
          );
          clearedCount++;
        }
      }
      
      if (clearedCount > 0) {
        console.log(`✅ Cleared ${clearedCount} call notification(s)`);
      }
    } catch (error) {
      console.error("❌ Error clearing call notifications:", error);
    }
  }

  /**
   * Check if we have notification permissions
   */
  async hasPermissions(): Promise<boolean> {
    const { status } = await Notifications.getPermissionsAsync();
    return status === "granted";
  }

  /**
   * Get current notification settings
   */
  async getNotificationSettings() {
    const permissions = await Notifications.getPermissionsAsync();
    const badgeCount = await this.getBadgeCount();
    const channels = Platform.OS === "android" 
      ? await Notifications.getNotificationChannelsAsync()
      : [];

    return {
      permissions,
      badgeCount,
      channels,
      platform: Platform.OS,
      isDevice: Device.isDevice,
    };
  }
}

export default NotificationService.getInstance();