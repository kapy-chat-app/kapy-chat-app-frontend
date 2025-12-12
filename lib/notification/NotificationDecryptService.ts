// lib/notification/NotificationDecryptService.ts
import { nativeEncryptionService } from "@/lib/encryption/NativeEncryptionService";
import * as Notifications from "expo-notifications";

interface EncryptedNotificationData {
  type: 'message';
  conversationId: string;
  messageId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  messageType: string;
  conversationType: 'private' | 'group';
  hasAttachments: boolean;
  encryptedContent?: string;
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
   * ✅ Giải mã và hiển thị notification với nội dung thực
   * Được gọi khi app nhận notification ở background/foreground
   */
  async decryptAndShowNotification(
    notification: Notifications.Notification,
    getToken: () => Promise<string | null>
  ): Promise<void> {
    const data = notification.request.content.data as EncryptedNotificationData;

    console.log('🔐 ========================================');
    console.log('🔐 Attempting to decrypt notification...');
    console.log('🔐 Message Type:', data.messageType);
    console.log('🔐 Has encrypted content:', !!data.encryptedContent);

    // Nếu không phải text message hoặc không có encrypted content
    if (data.messageType !== 'text' || !data.encryptedContent) {
      console.log('🔐 ℹ️ No decryption needed, showing original notification');
      return;
    }

    try {
      // ✅ Giải mã tin nhắn
      const decryptedContent = await this.decryptMessageContent(
        data.senderId,
        data.encryptedContent,
        data.encryptionMetadata,
        getToken
      );

      console.log('🔐 ✅ Decryption successful');
      console.log('🔐 Preview:', decryptedContent.substring(0, 50));

      // ✅ Tạo local notification mới với nội dung đã giải mã
      await this.showDecryptedNotification({
        title: data.conversationType === 'group'
          ? notification.request.content.title || 'Group Chat'
          : data.senderName,
        body: this.formatMessagePreview(decryptedContent),
        conversationId: data.conversationId,
        messageId: data.messageId,
        data: data,
      });

      // ✅ Dismiss notification cũ (có nội dung mã hóa)
      await Notifications.dismissNotificationAsync(
        notification.request.identifier
      );

      console.log('🔐 ✅ Notification updated with decrypted content');
      console.log('🔐 ========================================');
    } catch (error) {
      console.error('🔐 ========================================');
      console.error('🔐 ❌ Failed to decrypt notification:', error);
      console.error('🔐 ========================================');
      // Keep original notification if decryption fails
    }
  }

  /**
   * 🔓 Giải mã nội dung tin nhắn
   */
  private async decryptMessageContent(
    senderId: string,
    encryptedContent: string,
    encryptionMetadata: any,
    getToken: () => Promise<string | null>
  ): Promise<string> {
    const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

    try {
      // Parse encrypted content
      let iv: string;
      let authTag: string;
      let data: string;

      try {
        const parsed = JSON.parse(encryptedContent);
        iv = parsed.iv || encryptionMetadata?.iv;
        authTag = parsed.authTag || encryptionMetadata?.authTag || parsed.data;
        data = parsed.data || parsed.encryptedContent || encryptedContent;
      } catch {
        // If not JSON, treat as raw encrypted string
        iv = encryptionMetadata?.iv || '';
        authTag = encryptionMetadata?.authTag || '';
        data = encryptedContent;
      }

      if (!iv || !authTag || !data) {
        throw new Error('Missing encryption parameters');
      }

      // Fetch sender's public key
      const token = await getToken();
      if (!token) {
        throw new Error("Authentication token not available");
      }

      const response = await fetch(`${API_BASE_URL}/api/keys/${senderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to get sender key");
      }

      // Decrypt using native service
      const decrypted = await nativeEncryptionService.decryptMessage(
        data,
        iv,
        authTag,
        result.data.publicKey
      );

      return decrypted;
    } catch (error) {
      console.error('❌ Decryption failed:', error);
      throw error;
    }
  }

  /**
   * 📱 Hiển thị notification với nội dung đã giải mã
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
          type: 'message',
          conversationId,
          messageId,
          senderId: data.senderId,
          senderName: data.senderName,
          senderAvatar: data.senderAvatar,
          messageType: data.messageType,
          decrypted: true, // ⭐ Flag để biết đã decrypt
        },
        sound: 'message.wav',
      },
      trigger: null, // Show immediately
    });
  }

  /**
   * 📝 Format message preview cho notification
   */
  private formatMessagePreview(content: string): string {
    const maxLength = 100;
    if (content.length <= maxLength) {
      return content;
    }
    return content.substring(0, maxLength) + '...';
  }

  /**
   * 🔍 Check if notification needs decryption
   */
  needsDecryption(data: any): boolean {
    return (
      data.type === 'message' &&
      data.messageType === 'text' &&
      !!data.encryptedContent &&
      !data.decrypted // Chưa được decrypt
    );
  }
}

export default NotificationDecryptService.getInstance();