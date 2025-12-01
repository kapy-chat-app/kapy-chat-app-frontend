// contexts/NotificationContext.tsx - UPDATED WITH DECRYPTION
import NotificationService from "@/lib/notification/NotificationService";
import NotificationDecryptService from "@/lib/notification/NotificationDecryptService";
import { PushNotificationData } from "@/types/notification.types";
import { useAuth } from "@clerk/clerk-expo";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

interface NotificationContextType {
  expoPushToken: string | undefined;
  notification: Notifications.Notification | undefined;
  registerForPushNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [expoPushToken, setExpoPushToken] = useState<string | undefined>();
  const [notification, setNotification] = useState<
    Notifications.Notification | undefined
  >();

  const notificationListener = useRef<Notifications.EventSubscription | null>(
    null
  );
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  const router = useRouter();
  const { userId, getToken } = useAuth();

  useEffect(() => {
    console.log("📩 NotificationProvider mounted");
    console.log("📩 Current userId:", userId);

    // ✅ Lắng nghe khi nhận thông báo (app đang mở hoặc background)
    notificationListener.current =
      Notifications.addNotificationReceivedListener(async (notification) => {
        console.log("📩 ========================================");
        console.log("📩 Nhận thông báo:", notification);
        console.log("📩 Title:", notification.request.content.title);
        console.log("📩 Body:", notification.request.content.body);
        console.log("📩 Data:", notification.request.content.data);
        console.log("📩 ========================================");
        
        setNotification(notification);

        // ✅ DECRYPT NOTIFICATION nếu cần
        const data = notification.request.content.data as any;
        if (NotificationDecryptService.needsDecryption(data)) {
          console.log("🔐 Notification needs decryption, processing...");
          await NotificationDecryptService.decryptAndShowNotification(
            notification,
            getToken
          );
        } else {
          // Handle như bình thường nếu không cần decrypt
          handleNotificationReceived(notification);
        }
      });

    // Lắng nghe khi user tap vào thông báo
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        console.log("👆 ========================================");
        console.log("👆 User tap thông báo:", response);
        console.log("👆 Data:", response.notification.request.content.data);
        console.log("👆 ========================================");
        handleNotificationResponse(response);
      });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [userId, getToken]);

  const registerForPushNotifications = async () => {
    try {
      console.log("🔔 ========================================");
      console.log("🔔 Bắt đầu đăng ký push notifications...");
      console.log("🔔 Current userId from Clerk:", userId);

      if (!userId) {
        console.log("🔔 ❌ No userId available, cannot register");
        console.log("🔔 ========================================");
        return;
      }

      const token = await NotificationService.registerForPushNotifications();
      console.log("🔔 Push token nhận được:", token);

      if (token) {
        setExpoPushToken(token);

        console.log("🔔 Đang gửi token lên server...");
        console.log("🔔 User ID:", userId);
        console.log("🔔 Token:", token);

        await NotificationService.sendPushTokenToServer(token, userId, getToken);

        console.log("🔔 ✅ Token đã được gửi lên server thành công!");
      } else {
        console.log("🔔 ❌ Không nhận được push token");
      }

      console.log("🔔 ========================================");
    } catch (error) {
      console.error("🔔 ========================================");
      console.error("🔔 ❌ Lỗi khi đăng ký push notifications:", error);
      console.error("🔔 ========================================");
    }
  };

  const handleNotificationReceived = (
    notification: Notifications.Notification
  ) => {
    const data = notification.request.content
      .data as Partial<PushNotificationData>;

    if (!data.type) {
      console.warn("⚠️ Invalid notification data - missing type:", data);
      return;
    }

    console.log("📩 Processing notification type:", data.type);

    switch (data.type) {
      case "message":
        console.log("💬 Tin nhắn mới từ:", data.senderName);
        break;

      case "call":
        console.log("📞 Cuộc gọi đến từ:", data.senderName);
        break;

      case "friend_request":
        console.log("👋 Lời mời kết bạn từ:", data.senderName);
        break;
    }
  };

  const handleNotificationResponse = (
    response: Notifications.NotificationResponse
  ) => {
    const data = response.notification.request.content
      .data as Partial<PushNotificationData>;

    if (!data.type) {
      console.warn("⚠️ Invalid notification response data:", data);
      return;
    }

    console.log("👆 Navigating based on notification type:", data.type);

    // Navigate đến màn hình tương ứng
    switch (data.type) {
      case "message":
        if (data.chatId) {
          console.log("🚀 Navigating to chat:", data.chatId);
          router.push(`/(app)/chat/${data.chatId}`);
        } else {
          console.warn("⚠️ Message notification missing chatId");
        }
        break;

      case "call":
        if (data.callId) {
          console.log("🚀 Navigating to call:", data.callId);
          router.push({
            pathname: "/(app)/call/incoming",
            params: {
              callId: data.callId,
              callerId: data.senderId || "",
              callerName: data.senderName || "",
            },
          });
        } else {
          console.warn("⚠️ Call notification missing callId");
        }
        break;

      case "friend_request":
        console.log("🚀 Navigating to friend requests");
        router.push("/(app)/friends/requests");
        break;
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        expoPushToken,
        notification,
        registerForPushNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error(
      "useNotification must be used within a NotificationProvider"
    );
  }
  return context;
}