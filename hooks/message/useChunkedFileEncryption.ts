// hooks/message/useChunkedFileEncryption.ts
// ✅ FIXED VERSION - Proper symmetric key encryption for all participants

import { NativeEncryptionBridge } from "@/lib/encryption/NativeEncryptionBridge";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useCallback } from "react";
import { NativeModules } from "react-native";
import { useEncryption } from "./useEncryption";
import * as SecureStore from 'expo-secure-store';

const { KapyEncryption } = NativeModules;
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";
const ENCRYPTION_KEY_STORE = "e2ee_master_key";

export interface StreamingUploadResult {
  fileId: string;
  messageId: string;
  masterIv: string;
  masterAuthTag: string;
  chunks: ChunkInfo[];
  totalChunks: number;
  originalSize: number;
  encryptedSize: number;
  fileName: string;
  skipMessageCreation?: boolean;
  recipientKeys?: {
    userId: string;
    encryptedSymmetricKey: string;
    keyIv: string;
    keyAuthTag: string;
  }[];
}

export interface ChunkInfo {
  index: number;
  iv: string;
  authTag: string;
  gcmAuthTag: string;
  originalSize: number;
  encryptedSize: number;
}

export const useChunkedFileEncryption = () => {
  const { isInitialized } = useEncryption();
  const { getToken, userId: myUserId } = useAuth();
  const { user } = useUser();

  const hasNewMethods = useCallback(() => {
    try {
      return (
        typeof NativeEncryptionBridge.generateSymmetricKey === "function" &&
        typeof NativeEncryptionBridge.encryptSymmetricKey === "function" &&
        typeof NativeEncryptionBridge.encryptFileWithSymmetricKey === "function"
      );
    } catch {
      return false;
    }
  }, []);

  /**
   * ✅ Get all conversation participants
   */
  const getConversationParticipants = useCallback(
    async (conversationId: string): Promise<string[]> => {
      try {
        const token = await getToken();
        if (!token) throw new Error("No auth token");

        console.log("👥 [ENCRYPT] Getting conversation participants...");

        const convResponse = await fetch(
          `${API_BASE_URL}/api/conversations/${conversationId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!convResponse.ok) {
          throw new Error(`Failed to fetch conversation: ${convResponse.status}`);
        }

        const convResult = await convResponse.json();
        const participants = convResult.data.participants || [];
        const participantIds = participants.map((p: any) => p.clerkId);

        console.log(`✅ [ENCRYPT] Found ${participantIds.length} participants`);

        return participantIds;
      } catch (error) {
        console.error("❌ [ENCRYPT] getConversationParticipants error:", error);
        throw error;
      }
    },
    [getToken]
  );

  /**
   * ✅ FIXED: Get master keys for all participants
   * Each user's "public key" is actually their master key uploaded to server
   */
  const getParticipantKeys = useCallback(
    async (participantIds: string[]): Promise<Map<string, string>> => {
      const token = await getToken();
      if (!token) throw new Error("No auth token");

      console.log(`🔑 [ENCRYPT] Fetching ${participantIds.length} master keys...`);

      const keyMap = new Map<string, string>();

      // ✅ For MY key, get from local SecureStore (most reliable)
      const myMasterKey = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORE);
      if (myMasterKey && myUserId) {
        keyMap.set(myUserId, myMasterKey);
        console.log(`✅ [ENCRYPT] Got MY key from SecureStore`);
      }

      // Get other participants' keys from server
      await Promise.all(
        participantIds.map(async (clerkId) => {
          // Skip if it's my own key (already got from SecureStore)
          if (clerkId === myUserId) {
            return;
          }

          try {
            const keyResponse = await fetch(
              `${API_BASE_URL}/api/keys/${clerkId}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );

            if (!keyResponse.ok) {
              console.warn(`⚠️ [ENCRYPT] No key for user: ${clerkId}`);
              return;
            }

            const keyResult = await keyResponse.json();
            if (keyResult.success && keyResult.data?.publicKey) {
              keyMap.set(clerkId, keyResult.data.publicKey);
              console.log(`✅ [ENCRYPT] Got key for: ${clerkId.substring(0, 10)}...`);
            }
          } catch (error) {
            console.error(`❌ [ENCRYPT] Failed to get key for ${clerkId}:`, error);
          }
        })
      );

      console.log(`✅ [ENCRYPT] Retrieved ${keyMap.size}/${participantIds.length} keys`);

      if (keyMap.size === 0) {
        throw new Error("No recipient keys found");
      }

      return keyMap;
    },
    [getToken, myUserId]
  );

  /**
   * ✅ MAIN FUNCTION: Encrypt and upload file with symmetric key
   */
  const encryptAndUploadFileNew = useCallback(
    async (
      fileUri: string,
      fileName: string,
      conversationId: string,
      options?: { onProgress?: (progress: any) => void }
    ): Promise<StreamingUploadResult> => {
      console.log("🚀 [ENCRYPT] Starting file upload with E2EE");
      console.log(`   File: ${fileName}`);
      console.log(`   URI: ${fileUri}`);
      console.log(`   Conversation: ${conversationId}`);

      const token = await getToken();
      if (!token) throw new Error("No auth token");

      // STEP 1: Get participants
      console.log("👥 [ENCRYPT] STEP 1: Getting participants...");
      const participantIds = await getConversationParticipants(conversationId);
      console.log(`✅ [ENCRYPT] Got ${participantIds.length} participants`);

      // STEP 2: Get master keys for all participants
      console.log("🔑 [ENCRYPT] STEP 2: Getting master keys...");
      const participantKeys = await getParticipantKeys(participantIds);
      console.log(`✅ [ENCRYPT] Got ${participantKeys.size} keys`);

      // STEP 3: Generate random symmetric key for file encryption
      console.log("🔐 [ENCRYPT] STEP 3: Generating symmetric key...");
      const symmetricKey = await NativeEncryptionBridge.generateSymmetricKey();
      console.log(`✅ [ENCRYPT] Symmetric key generated (${symmetricKey.length} chars)`);

      // STEP 4: Encrypt symmetric key for EACH participant
      // Each participant will decrypt using their own master key
      console.log(`🔐 [ENCRYPT] STEP 4: Encrypting symmetric key for ${participantKeys.size} recipients...`);

      const recipientKeys = await Promise.all(
        Array.from(participantKeys.entries()).map(
          async ([userId, masterKey]) => {
            try {
              const encryptedKey = await NativeEncryptionBridge.encryptSymmetricKey(
                symmetricKey,
                masterKey  // Encrypt with recipient's master key
              );

              console.log(`✅ [ENCRYPT] Key encrypted for: ${userId.substring(0, 10)}...`);

              return {
                userId,
                encryptedSymmetricKey: encryptedKey.encryptedSymmetricKey,
                keyIv: encryptedKey.keyIv,
                keyAuthTag: encryptedKey.keyAuthTag,
              };
            } catch (error) {
              console.error(`❌ [ENCRYPT] Failed to encrypt key for ${userId}:`, error);
              throw error;
            }
          }
        )
      );

      console.log(`✅ [ENCRYPT] Encrypted symmetric key for ${recipientKeys.length} recipients`);

      // STEP 5: Check native method availability
      console.log("🔍 [ENCRYPT] STEP 5: Checking native method...");
      
      if (!KapyEncryption?.encryptAndUploadFileStreamingWithSymmetricKey) {
        console.error("❌ [ENCRYPT] Native method NOT AVAILABLE!");
        throw new Error("Native upload method not available - rebuild app");
      }

      // STEP 6: Call native method to encrypt file and upload
      console.log("🚀 [ENCRYPT] STEP 6: Calling NATIVE encrypt + upload...");
      console.log(`   📦 Passing ${recipientKeys.length} recipientKeys`);

      let result;
      try {
        result = await KapyEncryption.encryptAndUploadFileStreamingWithSymmetricKey(
          fileUri,
          fileName,
          conversationId,
          symmetricKey,
          JSON.stringify(recipientKeys),
          API_BASE_URL,
          token
        );

        console.log("✅ [ENCRYPT] Native method completed!");
        console.log(`   File ID: ${result.fileId}`);
        console.log(`   Message ID: ${result.messageId}`);
        console.log(`   Upload time: ${result.uploadTimeSeconds?.toFixed(1)}s`);

      } catch (nativeError: any) {
        console.error("❌ [ENCRYPT] Native method FAILED:", nativeError);
        console.error("   Error message:", nativeError.message);
        throw nativeError;
      }

      console.log("🎉 [ENCRYPT] COMPLETE!");

      return {
        fileId: result.fileId,
        messageId: result.messageId,
        masterIv: "",
        masterAuthTag: result.masterAuthTag,
        chunks: result.chunks,
        totalChunks: result.totalChunks,
        originalSize: result.originalSize,
        encryptedSize: result.encryptedSize,
        fileName,
        recipientKeys,
        skipMessageCreation: true,  // Message already created by backend
      };
    },
    [getToken, getConversationParticipants, getParticipantKeys, myUserId]
  );

  /**
   * ✅ Public API
   */
  const encryptAndUploadFile = useCallback(
    async (
      fileUri: string,
      fileName: string,
      conversationId: string,
      recipientId?: string,  // Deprecated, not used anymore
      options?: { onProgress?: (progress: any) => void }
    ): Promise<StreamingUploadResult> => {
      if (!isInitialized) {
        throw new Error("E2EE not initialized");
      }

      try {
        if (hasNewMethods()) {
          console.log("✨ [ENCRYPT] Using hybrid E2EE encryption");
          return await encryptAndUploadFileNew(fileUri, fileName, conversationId, options);
        } else {
          throw new Error("Native encryption methods not available");
        }
      } catch (error) {
        console.error("❌ [ENCRYPT] Error:", error);
        throw error;
      }
    },
    [isInitialized, hasNewMethods, encryptAndUploadFileNew]
  );

  return {
    encryptFile: encryptAndUploadFile,
    encryptAndUploadFile,
    isReady: isInitialized,
    isStreamingAvailable: () => !!KapyEncryption?.encryptAndUploadFileStreaming,
    hasNewEncryption: hasNewMethods(),
  };
};

function getMimeType(fileName: string): string {
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