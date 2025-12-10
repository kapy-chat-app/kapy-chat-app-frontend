// lib/notification/NotificationDecryptService.ts
import { nativeEncryptionService } from "@/lib/encryption/NativeEncryptionService";
import * as Notifications from "expo-notifications";

interface EncryptedNotificationData {
  type: "message";
  conversationId: string;
  messageId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  messageType: string;
  conversationType: "private" | "group";
  hasAttachments: boolean;

  // encrypted payload
  encryptedContent?: string;

  // fallback metadata (backend may send separately)
  encryptionMetadata?: {
    iv?: string;
    authTag?: string;
  };

  gifUrl?: string;
}

class NotificationDecryptService {
  private static instance: NotificationDecryptService;

  private constructor() {}

  static getInstance(): NotificationDecryptService {
    if (!NotificationDecryptService.instance) {
      NotificationDecryptService.instance = new NotificationDecryptService();
    }
    return NotificationDecryptService.instance;
  }

  /**
   * 🔐 Giải mã và hiển thị notification đã được decrypt
   */
  async decryptAndShowNotification(
    notification: Notifications.Notification,
    getToken: () => Promise<string | null>
  ): Promise<void> {
    const data = notification.request.content.data as EncryptedNotificationData;

    console.log("🔐 ========================================");
    console.log("🔐 Attempting to decrypt notification...");
    console.log("🔐 Message Type:", data.messageType);
    console.log("🔐 Has encrypted content:", !!data.encryptedContent);

    // Không phải text hoặc không có encrypted content → bỏ qua
    if (data.messageType !== "text" || !data.encryptedContent) {
      console.log("🔐 ℹ️ No decryption needed, showing original notification");
      return;
    }

    try {
      // 🔓 Decrypt
      const decryptedContent = await this.decryptMessageContent(
        data.conversationId,
        data.messageId,
        data.encryptedContent,
        data.encryptionMetadata,
        getToken
      );

      console.log("🔐 ✅ Decryption successful");
      console.log("🔐 Preview:", decryptedContent.substring(0, 50));

      // 🔔 Show decrypted notification
      await this.showDecryptedNotification({
        title:
          data.conversationType === "group"
            ? notification.request.content.title || "Group Chat"
            : data.senderName,
        body: this.formatMessagePreview(decryptedContent),
        conversationId: data.conversationId,
        messageId: data.messageId,
        data: data,
      });

      // Remove the encrypted version
      await Notifications.dismissNotificationAsync(
        notification.request.identifier
      );

      console.log("🔐 ✅ Notification updated with decrypted content");
      console.log("🔐 ========================================");
    } catch (error) {
      console.error("🔐 ========================================");
      console.error("🔐 ❌ Failed to decrypt notification:", error);
      console.error("🔐 ========================================");
      // keep the original encrypted notification
    }
  }

  /**
   * 🔓 Giải mã nội dung tin nhắn
   */
  private async decryptMessageContent(
    conversationId: string,
    messageId: string,
    encryptedContent: string,
    encryptionMetadata: any,
    getToken: () => Promise<string | null>
  ): Promise<string> {
    const API_BASE_URL =
      process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

    try {
      let iv: string | undefined;
      let authTag: string | undefined;
      let ciphertext: string | undefined;

      // ----- 1) Parse chính xác encryptedContent -----
      try {
        const parsed = JSON.parse(encryptedContent);

        iv = parsed.iv || encryptionMetadata?.iv;
        authTag = parsed.authTag || encryptionMetadata?.authTag;

        ciphertext =
          parsed.data ||
          parsed.ciphertext ||
          parsed.encrypted ||
          parsed.encryptedContent;
      } catch {
        // Không phải JSON → dùng metadata + encryptedContent
        iv = encryptionMetadata?.iv;
        authTag = encryptionMetadata?.authTag;
        ciphertext = encryptedContent;
      }

      // ----- 2) Validate -----
      if (!iv) throw new Error("Missing IV");
      if (!authTag) throw new Error("Missing authTag");
      if (!ciphertext) throw new Error("Missing encrypted data");

      console.log("🔐 Parsed notification payload:", {
        iv,
        authTag,
        ciphertext_len: ciphertext.length,
      });

      // ----- 3) Fetch correct decryption key (IMPORTANT) -----
      // ❗❗ Đây KHÔNG phải sender public key.
      // Bạn phải dùng endpoint cho per-conversation/per-message key.
      const token = await getToken();
      if (!token) throw new Error("Auth token not found");

      const url = `${API_BASE_URL}/api/messages/${conversationId}/${messageId}/decrypt-key`;

      console.log("🔐 Fetching key from:", url);

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to get decryption key");
      }

      const decryptionKey = result.data.key; // AES key đã được backend chuẩn bị

      if (!decryptionKey) throw new Error("Missing decryption key");

      // ----- 4) Native decrypt -----
      const decrypted = await nativeEncryptionService.decryptMessage(
        ciphertext,
        iv,
        authTag,
        decryptionKey
      );

      return decrypted;
    } catch (error) {
      console.error("❌ Decryption failed:", error);
      throw error;
    }
  }

  /**
   * 🔔 Hiển thị notification đã decrypt
   */
  private async showDecryptedNotification({
    title,
    body,
    conversationId,
    messageId,
    data,
  }: {
    title: string;
    body: string;
    conversationId: string;
    messageId: string;
    data: EncryptedNotificationData;
  }): Promise<void> {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: {
          type: "message",
          conversationId,
          messageId,
          senderId: data.senderId,
          senderName: data.senderName,
          senderAvatar: data.senderAvatar,
          messageType: data.messageType,
          decrypted: true,
        },
        sound: "message.wav",
      },
      trigger: null,
    });
  }

  /**
   * 📝 Format preview
   */
  private formatMessagePreview(content: string): string {
    const maxLength = 100;
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + "...";
  }

  /**
   * 🔍 Check if notification needs decrypt
   */
  needsDecryption(data: any): boolean {
    return (
      data.type === "message" &&
      data.messageType === "text" &&
      !!data.encryptedContent &&
      !data.decrypted
    );
  }
}

export default NotificationDecryptService.getInstance();
