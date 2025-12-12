// lib/encryption/UnifiedEncryptionService.ts
// ✅ FIXED VERSION - Non-blocking verification with proper error handling

import { Platform } from "react-native";
import {
  NativeCacheBridge,
  NativeEncryptionBridge,
} from "./NativeEncryptionBridge";

export class UnifiedEncryptionService {
  // 🔥 Always use native encryption on BOTH platforms
  private static useNative = NativeEncryptionBridge.isAvailable();

  /**
   * Initialize encryption
   */
  static async initialize(): Promise<void> {
    if (!this.useNative) {
      console.warn("❌ Native encryption module NOT available");
      throw new Error("NativeEncryptionBridge is required but not available");
    }

    console.log("🔐 Using PURE NATIVE encryption");
  }

  // ============================================
  // TEXT ENCRYPTION
  // ============================================

  /**
   * Encrypt text
   */
  static async encryptMessage(
    message: string,
    keyBase64: string
  ): Promise<{
    encryptedContent: string;
    encryptionMetadata: { iv: string; authTag: string };
  }> {
    if (!this.useNative) {
      throw new Error("Native encryption is required");
    }

    const result = await NativeEncryptionBridge.encryptMessage(
      message,
      keyBase64
    );

    return {
      encryptedContent: JSON.stringify({
        iv: result.iv,
        authTag: result.authTag,
        data: result.encryptedContent,
      }),
      encryptionMetadata: { iv: result.iv, authTag: result.authTag },
    };
  }

  /**
   * Decrypt text
   */
  static async decryptMessage(
    encryptedContent: string,
    iv: string,
    authTag: string,
    senderKeyBase64: string
  ): Promise<string> {
    if (!this.useNative) {
      throw new Error("Native encryption is required");
    }

    return await NativeEncryptionBridge.decryptMessage(
      encryptedContent,
      iv,
      authTag,
      senderKeyBase64
    );
  }

  // ============================================
  // FILE ENCRYPTION (PURE NATIVE)
  // ============================================

  /**
   * Encrypt file using native streaming
   */
  static async encryptFile(
    fileUri: string,
    fileName: string,
    keyBase64: string,
    onProgress?: (progress: any) => void
  ) {
    if (!this.useNative) {
      throw new Error("Native encryption is required");
    }

    const result = await NativeEncryptionBridge.encryptFileStreaming(
      fileUri,
      fileName,
      keyBase64,
      onProgress
    );

    return {
      encryptedBase64: result.encryptedBase64,
      metadata: {
        iv: result.iv,
        authTag: result.authTag,
        original_size: result.originalSize,
        encrypted_size: result.encryptedSize,
        file_name: result.fileName,
        file_type: this.getMimeType(fileName),
      },
    };
  }

  /**
   * Decrypt file (URL-stream, local-stream, or direct)
   */
  static async decryptFile(
    encryptedBase64OrUrl: string,
    iv: string,
    authTag: string,
    senderKeyBase64: string,
    outputPath: string,
    chunks?: any[],
    onProgress?: (progress: any) => void
  ): Promise<string> {
    if (!this.useNative) {
      throw new Error("Native encryption is required");
    }

    // 💧 TRUE STREAMING: remote URL + chunks
    if (
      chunks &&
      chunks.length > 1 &&
      encryptedBase64OrUrl.startsWith("http")
    ) {
      return await NativeEncryptionBridge.decryptFileStreamingFromUrl(
        encryptedBase64OrUrl,
        chunks,
        authTag,
        senderKeyBase64,
        outputPath,
        onProgress
      );
    }

    // ⚡ NATIVE STREAMING (local base64 + chunks)
    if (chunks && chunks.length > 1) {
      return await NativeEncryptionBridge.decryptFileStreaming(
        encryptedBase64OrUrl,
        chunks,
        authTag,
        senderKeyBase64,
        outputPath,
        onProgress
      );
    }

    // 🔥 Direct decrypt (small files)
    const estimatedSize = encryptedBase64OrUrl.length * 0.75;
    if (estimatedSize < 500 * 1024) {
      return await NativeEncryptionBridge.decryptFileDirect(
        encryptedBase64OrUrl,
        iv,
        authTag,
        senderKeyBase64,
        outputPath
      );
    }

    // Never fallback to JS again
    throw new Error("Missing chunks for large file decryption");
  }

  // ============================================
  // CACHE (FIXED WITH NON-BLOCKING VERIFICATION)
  // ============================================

  /**
   * ✅ Save messages with validation and NON-BLOCKING verification
   */
  static async saveMessages(messages: any[]): Promise<void> {
    if (!messages || messages.length === 0) {
      console.log("⚠️ [UNIFIED] No messages to save");
      return;
    }

    console.log(`💾 [UNIFIED] saveMessages: ${messages.length} messages`);

    try {
      // Validate each message
      const validated = messages.map((msg, index) => {
        if (!msg._id || !msg.conversation_id) {
          throw new Error(`Message at index ${index} missing required fields`);
        }

        // Validate JSON fields
        const validateJson = (
          field: string,
          value: string | undefined,
          defaultValue: string = "[]"
        ) => {
          if (!value) return defaultValue;
          try {
            JSON.parse(value);
            return value;
          } catch (e) {
            console.warn(
              `⚠️ [UNIFIED] Invalid ${field} for ${msg._id}, using default`
            );
            return defaultValue;
          }
        };

        return {
          _id: msg._id,
          conversation_id: msg.conversation_id,
          sender_id: msg.sender_id || "",
          sender_name: msg.sender_name || "Unknown",
          sender_avatar: msg.sender_avatar || null,
          content: msg.content || "",
          type: msg.type || "text",
          attachments_json: validateJson(
            "attachments_json",
            msg.attachments_json
          ),
          reactions_json: validateJson("reactions_json", msg.reactions_json),
          read_by_json: validateJson("read_by_json", msg.read_by_json),
          reply_to_json: msg.reply_to_json
            ? validateJson("reply_to_json", msg.reply_to_json, "null")
            : null,
          metadata_json: msg.metadata_json
            ? validateJson("metadata_json", msg.metadata_json, "null")
            : null,
          rich_media_json: msg.rich_media_json
            ? validateJson("rich_media_json", msg.rich_media_json, "null")
            : null,
          is_edited: msg.is_edited ? 1 : 0,
          created_at: Math.floor(msg.created_at),
          updated_at: Math.floor(msg.updated_at),
        };
      });

      console.log(`✅ [UNIFIED] Validated ${validated.length} messages`);

      // Log first message
      if (validated.length > 0) {
        const first = validated[0];
        const atts = JSON.parse(first.attachments_json);

        console.log(`📦 [UNIFIED] First message:`, {
          _id: first._id,
          conversation_id: first.conversation_id,
          type: first.type,
          hasContent: !!first.content,
          attachmentCount: atts.length,
          firstHasUri: atts[0]?.decryptedUri ? true : false,
        });

        if (atts.length > 0 && atts[0].decryptedUri) {
          console.log(
            `📎 [UNIFIED] First attachment URI: ${atts[0].decryptedUri.substring(0, 60)}...`
          );
        }
      }

      // Call native bridge
      if (NativeCacheBridge.isAvailable()) {
        console.log(`📲 [UNIFIED] Calling native cache...`);
        await NativeCacheBridge.saveMessages(validated);
        console.log(`✅ [UNIFIED] Native save completed`);

        // ✅ NEW FIX: Non-blocking background verification
        // Don't block or throw errors - just log warnings
        setTimeout(async () => {
          try {
            console.log(`🔍 [UNIFIED] Background verification...`);
            const conversationId = validated[0].conversation_id;

            const verifyResult = await NativeCacheBridge.getMessages(
              conversationId,
              Math.min(validated.length, 5), // Only verify first 5
              undefined
            );

            const verifiedCount = verifyResult?.length || 0;
            console.log(
              `📊 [UNIFIED] Background verify: ${verifiedCount}/${Math.min(validated.length, 5)} messages readable`
            );

            if (verifiedCount === 0) {
              console.warn(
                `⚠️ [UNIFIED] WARNING: Verification found 0 messages (may be timing issue)`
              );
            } else if (verifyResult && verifyResult.length > 0) {
              const firstVerified = verifyResult[0];
              const atts = JSON.parse(firstVerified.attachments_json || "[]");

              if (atts.length > 0 && atts[0].decryptedUri) {
                console.log(`✅ [UNIFIED] Verified attachment URI preserved`);
              } else if (atts.length > 0) {
                console.warn(
                  `⚠️ [UNIFIED] WARNING: Attachment URI may be missing`
                );
              }
            }
          } catch (e) {
            console.warn(`⚠️ [UNIFIED] Background verification failed:`, e);
          }
        }, 500); // Wait 500ms for DB to settle
      } else {
        throw new Error("NativeCacheBridge not available");
      }
    } catch (error) {
      console.error("❌ [UNIFIED] saveMessages error:", error);
      if (error instanceof Error) {
        console.error("  Error:", error.message);
        console.error("  Stack:", error.stack);
      }
      throw error;
    }
  }

  /**
   * ✅ Get messages from cache
   */
  static async getMessages(
    conversationId: string,
    limit: number,
    beforeTimestamp?: number
  ): Promise<any[]> {
    console.log(
      `📥 [UNIFIED] getMessages: conversation=${conversationId}, limit=${limit}`
    );

    try {
      if (!conversationId) {
        throw new Error("conversationId is required");
      }

      let messages: any[] = [];

      if (NativeCacheBridge.isAvailable()) {
        messages = await NativeCacheBridge.getMessages(
          conversationId,
          limit,
          beforeTimestamp
        );
      } else {
        console.warn("⚠️ [UNIFIED] NativeCacheBridge not available");
        return [];
      }

      console.log(`✅ [UNIFIED] Retrieved ${messages.length} messages`);

      if (messages.length > 0) {
        const first = messages[0];
        const atts = JSON.parse(first.attachments_json || "[]");

        console.log(`📦 [UNIFIED] First message:`, {
          _id: first._id,
          hasContent: !!first.content,
          attachmentCount: atts.length,
          firstHasUri: atts[0]?.decryptedUri ? true : false,
        });
      }

      return messages;
    } catch (error) {
      console.error("❌ [UNIFIED] getMessages error:", error);
      return [];
    }
  }

  /**
   * ✅ Update attachment URI
   */
  static async updateAttachmentUri(
    messageId: string,
    attachmentId: string,
    decryptedUri: string
  ): Promise<void> {
    console.log(
      `🔗 [UNIFIED] updateAttachmentUri: msg=${messageId}, att=${attachmentId}`
    );
    console.log(`   URI: ${decryptedUri.substring(0, 60)}...`);

    try {
      if (!messageId || !attachmentId || !decryptedUri) {
        throw new Error("Missing required parameters");
      }

      if (NativeCacheBridge.isAvailable()) {
        await NativeCacheBridge.updateAttachmentUri(
          messageId,
          attachmentId,
          decryptedUri
        );
        console.log(`✅ [UNIFIED] Attachment URI updated`);
      } else {
        throw new Error("NativeCacheBridge not available");
      }
    } catch (error) {
      console.error("❌ [UNIFIED] updateAttachmentUri error:", error);
      throw error;
    }
  }

  /**
   * ✅ Get conversation metadata from SQLite
   */
  static async getConversationMeta(conversationId: string): Promise<{
    conversation_id: string;
    last_sync_time: number;
    total_cached: number;
    last_message_id?: string;
  } | null> {
    console.log(`📊 [UNIFIED] getConversationMeta: ${conversationId}`);

    try {
      if (!conversationId) {
        throw new Error("conversationId is required");
      }

      if (NativeCacheBridge.isAvailable()) {
        const meta =
          await NativeCacheBridge.getConversationMeta(conversationId);

        if (meta) {
          console.log(`✅ [UNIFIED] Found metadata in native SQLite`);
        } else {
          console.log(`📊 [UNIFIED] No metadata in native SQLite`);
        }

        return meta;
      } else {
        console.warn("⚠️ [UNIFIED] NativeCacheBridge not available");
        return null;
      }
    } catch (error) {
      console.error("❌ [UNIFIED] getConversationMeta error:", error);
      return null;
    }
  }

  /**
   * ✅ Update conversation metadata in SQLite
   */
  static async updateConversationMeta(
    conversationId: string,
    lastSyncTime: number,
    totalCached: number,
    lastMessageId?: string
  ): Promise<void> {
    console.log(`📊 [UNIFIED] updateConversationMeta: ${conversationId}`);

    try {
      if (!conversationId) {
        throw new Error("conversationId is required");
      }

      if (NativeCacheBridge.isAvailable()) {
        await NativeCacheBridge.updateConversationMeta(
          conversationId,
          lastSyncTime,
          totalCached,
          lastMessageId
        );
        console.log(`✅ [UNIFIED] Metadata saved to native SQLite`);
      } else {
        throw new Error("NativeCacheBridge not available");
      }
    } catch (error) {
      console.error("❌ [UNIFIED] updateConversationMeta error:", error);
      throw error;
    }
  }

  /**
   * ✅ Clear conversation cache
   */
  static async clearConversation(conversationId: string): Promise<void> {
    console.log(`🗑️ [UNIFIED] clearConversation: ${conversationId}`);

    try {
      if (!conversationId) {
        throw new Error("conversationId is required");
      }

      if (NativeCacheBridge.isAvailable()) {
        await NativeCacheBridge.clearConversation(conversationId);
        console.log(`✅ [UNIFIED] Conversation cache cleared`);
      } else {
        throw new Error("NativeCacheBridge not available");
      }
    } catch (error) {
      console.error("❌ [UNIFIED] clearConversation error:", error);
      throw error;
    }
  }

  /**
   * ✅ Clear all cache
   */
  static async clearAll(): Promise<void> {
    console.log(`🧹 [UNIFIED] clearAll called`);

    try {
      if (
        NativeCacheBridge.isAvailable() &&
        typeof NativeCacheBridge.clearAll === "function"
      ) {
        await NativeCacheBridge.clearAll();
        console.log(`✅ [UNIFIED] All cache cleared`);
      } else {
        console.warn(`⚠️ [UNIFIED] clearAll not available in native bridge`);
      }
    } catch (error) {
      console.error("❌ [UNIFIED] clearAll error:", error);
      // Don't throw - best effort
    }
  }

  // ============================================
  // UTILITIES
  // ============================================

  private static getMimeType(fileName: string): string {
    const ext = fileName.split(".").pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      mp4: "video/mp4",
      mov: "video/quicktime",
      mp3: "audio/mpeg",
      m4a: "audio/mp4",
      pdf: "application/pdf",
    };
    return mimeTypes[ext || ""] || "application/octet-stream";
  }

  static getPerformanceInfo() {
    return {
      platform: Platform.OS,
      useNative: this.useNative,
      speedMultiplier: NativeEncryptionBridge.getPerformanceMultiplier(),
    };
  }
}
