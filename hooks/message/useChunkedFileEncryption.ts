// hooks/message/useChunkedFileEncryption.ts - FIXED: Pass recipientKeys to native

import { NativeEncryptionBridge } from "@/lib/encryption/NativeEncryptionBridge";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useCallback } from "react";
import { NativeModules } from "react-native";
import { useEncryption } from "./useEncryption";

const { KapyEncryption } = NativeModules;
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

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
  const { getToken } = useAuth();
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
    [getToken, API_BASE_URL]
  );

  const getParticipantKeys = useCallback(
    async (participantIds: string[]): Promise<Map<string, string>> => {
      const token = await getToken();
      if (!token) throw new Error("No auth token");

      console.log(`🔑 [ENCRYPT] Fetching ${participantIds.length} public keys...`);

      const keyMap = new Map<string, string>();

      await Promise.all(
        participantIds.map(async (clerkId) => {
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
    [getToken, API_BASE_URL]
  );

  /**
   * ✅ FIXED: Pass recipientKeys as JSON string to native method
   */
  const encryptAndUploadFileNew = useCallback(
    async (
      fileUri: string,
      fileName: string,
      conversationId: string,
      options?: { onProgress?: (progress: any) => void }
    ): Promise<StreamingUploadResult> => {
      console.log("🚀 [ENCRYPT] Starting OPTIMIZED NATIVE upload flow");
      console.log(`   File: ${fileName}`);
      console.log(`   URI: ${fileUri}`);

      const token = await getToken();
      if (!token) throw new Error("No auth token");

      // STEP 1: Get participants
      console.log("👥 [ENCRYPT] STEP 1: Getting participants...");
      const participantIds = await getConversationParticipants(conversationId);
      console.log(`✅ [ENCRYPT] Got ${participantIds.length} participants`);

      // STEP 2: Get public keys
      console.log("🔑 [ENCRYPT] STEP 2: Getting public keys...");
      const participantKeys = await getParticipantKeys(participantIds);
      console.log(`✅ [ENCRYPT] Got ${participantKeys.size} keys`);

      // STEP 3: Generate symmetric key
      console.log("🔐 [ENCRYPT] STEP 3: Generating symmetric key...");
      const symmetricKey = await NativeEncryptionBridge.generateSymmetricKey();
      console.log("✅ [ENCRYPT] Symmetric key generated");
      console.log(`   Key length: ${symmetricKey.length}`);

      // STEP 4: Encrypt symmetric key for each participant
      console.log(
        `🔐 [ENCRYPT] STEP 4: Encrypting symmetric key for ${participantKeys.size} recipients...`
      );

      const recipientKeys = await Promise.all(
        Array.from(participantKeys.entries()).map(
          async ([userId, publicKey]) => {
            const encryptedKey = await NativeEncryptionBridge.encryptSymmetricKey(
              symmetricKey,
              publicKey
            );

            console.log(`✅ [ENCRYPT] Key encrypted for: ${userId.substring(0, 10)}...`);

            return {
              userId,
              encryptedSymmetricKey: encryptedKey.encryptedSymmetricKey,
              keyIv: encryptedKey.keyIv,
              keyAuthTag: encryptedKey.keyAuthTag,
            };
          }
        )
      );

      console.log(`✅ [ENCRYPT] Encrypted symmetric key for ${recipientKeys.length} recipients`);

      // STEP 5: Check native method
      console.log("🔍 [ENCRYPT] STEP 5: Checking native method availability...");
      console.log(`   KapyEncryption module:`, !!KapyEncryption);
      console.log(
        `   Has method:`,
        !!KapyEncryption?.encryptAndUploadFileStreamingWithSymmetricKey
      );

      if (!KapyEncryption?.encryptAndUploadFileStreamingWithSymmetricKey) {
        console.error("❌ [ENCRYPT] Native method NOT AVAILABLE!");
        throw new Error("Native upload method not available - rebuild app");
      }

      // ✅ STEP 6: Call native method WITH recipientKeys
      console.log("🚀 [ENCRYPT] STEP 6: Calling NATIVE encrypt + upload...");
      console.log(`   📦 Passing ${recipientKeys.length} recipientKeys to native`);
      console.log("   ⚠️ IF YOU SEE JS LOGS BELOW, NATIVE FAILED!");
      console.log("   ✅ IF YOU SEE KOTLIN LOGS, NATIVE WORKING!");

      let result;
      try {
        // ✅ CRITICAL FIX: Pass recipientKeys as 6th parameter (JSON string)
        result = await KapyEncryption.encryptAndUploadFileStreamingWithSymmetricKey(
          fileUri,              // 1. File URI
          fileName,             // 2. File name
          conversationId,       // 3. Conversation ID
          symmetricKey,         // 4. Symmetric key (base64)
          JSON.stringify(recipientKeys), // 5. ✅ recipientKeys as JSON string
          token                 // 6. Auth token
        );

        console.log("✅ [ENCRYPT] Native method returned!");
        console.log("   Result keys:", Object.keys(result || {}));
        console.log(`   File ID: ${result.fileId}`);
        console.log(`   Message ID: ${result.messageId}`);

      } catch (nativeError) {
        console.error("❌ [ENCRYPT] Native method FAILED:", nativeError);
        console.error("   Error type:", nativeError.constructor.name);
        console.error("   Error message:", nativeError.message);
        throw nativeError;
      }

      console.log("🎉 [ENCRYPT] COMPLETE!");
      console.log(`   Upload time: ${result.uploadTimeSeconds?.toFixed(1)}s`);
      console.log(`   Avg speed: ~${result.avgSpeedMBps}MB/s`);
      console.log(`   Recipients saved: ${recipientKeys.length}`);

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
        recipientKeys, // ✅ Return recipientKeys for reference
      };
    },
    [getToken, getConversationParticipants, getParticipantKeys, API_BASE_URL]
  );

  /**
   * ⚠️ FALLBACK: JS upload (old method)
   */
  const encryptAndUploadFileNewFallback = useCallback(
    async (
      fileUri: string,
      fileName: string,
      conversationId: string,
      options?: { onProgress?: (progress: any) => void }
    ): Promise<StreamingUploadResult> => {
      console.log("🔄 [FALLBACK] Using JS upload method");

      const token = await getToken();
      if (!token) throw new Error("No auth token");

      const participantIds = await getConversationParticipants(conversationId);
      const participantKeys = await getParticipantKeys(participantIds);

      const symmetricKey = await NativeEncryptionBridge.generateSymmetricKey();

      const recipientKeys = await Promise.all(
        Array.from(participantKeys.entries()).map(
          async ([userId, publicKey]) => {
            const encryptedKey = await NativeEncryptionBridge.encryptSymmetricKey(
              symmetricKey,
              publicKey
            );
            return {
              userId,
              encryptedSymmetricKey: encryptedKey.encryptedSymmetricKey,
              keyIv: encryptedKey.keyIv,
              keyAuthTag: encryptedKey.keyAuthTag,
            };
          }
        )
      );

      const encryptedFile = await NativeEncryptionBridge.encryptFileWithSymmetricKey(
        fileUri,
        fileName,
        symmetricKey,
        options?.onProgress
      );

      const initResponse = await fetch(
        `${API_BASE_URL}/api/conversations/${conversationId}/files/init-streaming-upload`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            fileName,
            fileSize: encryptedFile.encryptedSize,
            totalChunks: encryptedFile.totalChunks,
            fileType: getMimeType(fileName),
          }),
        }
      );

      if (!initResponse.ok) {
        throw new Error(`Failed to initialize upload: ${initResponse.status}`);
      }

      const initResult = await initResponse.json();
      const { uploadId, uploadUrls } = initResult;

      const chunkETags: string[] = [];
      const encryptedData = Buffer.from(encryptedFile.encryptedBase64, "base64");

      let offset = 0;
      for (let i = 0; i < encryptedFile.chunks.length; i++) {
        const chunk = encryptedFile.chunks[i];
        const chunkData = encryptedData.slice(offset, offset + chunk.encryptedSize);
        offset += chunk.encryptedSize;

        const uploadResponse = await fetch(uploadUrls[i], {
          method: "PUT",
          headers: { "Content-Type": "application/octet-stream" },
          body: chunkData,
        });

        if (!uploadResponse.ok) {
          throw new Error(`Failed to upload chunk ${i}: ${uploadResponse.status}`);
        }

        const etag = uploadResponse.headers.get("ETag")?.replace(/"/g, "") || `chunk-${i}`;
        chunkETags.push(etag);
      }

      const finalizeResponse = await fetch(
        `${API_BASE_URL}/api/conversations/${conversationId}/files/finalize-streaming-upload`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            uploadId,
            chunks: chunkETags,
            metadata: {
              iv: encryptedFile.iv,
              authTag: encryptedFile.authTag,
              original_size: encryptedFile.originalSize,
              encrypted_size: encryptedFile.encryptedSize,
              file_name: fileName,
              file_type: getMimeType(fileName),
              chunks: encryptedFile.chunks,
              recipientKeys, // ✅ Include recipientKeys
            },
          }),
        }
      );

      if (!finalizeResponse.ok) {
        throw new Error(`Failed to finalize upload: ${finalizeResponse.status}`);
      }

      const finalizeResult = await finalizeResponse.json();

      return {
        fileId: finalizeResult.fileId,
        messageId: finalizeResult.messageId,
        masterIv: encryptedFile.iv,
        masterAuthTag: encryptedFile.authTag,
        chunks: encryptedFile.chunks,
        totalChunks: encryptedFile.totalChunks,
        originalSize: encryptedFile.originalSize,
        encryptedSize: encryptedFile.encryptedSize,
        fileName,
        recipientKeys,
      };
    },
    [getToken, getConversationParticipants, getParticipantKeys, API_BASE_URL]
  );

  const encryptAndUploadFile = useCallback(
    async (
      fileUri: string,
      fileName: string,
      conversationId: string,
      recipientId?: string,
      options?: { onProgress?: (progress: any) => void }
    ): Promise<StreamingUploadResult> => {
      if (!isInitialized) {
        throw new Error("E2EE not initialized");
      }

      try {
        if (hasNewMethods()) {
          console.log("✨ [ENCRYPT] Using NEW hybrid encryption flow");
          return await encryptAndUploadFileNew(fileUri, fileName, conversationId, options);
        } else {
          throw new Error("Old encryption flow not supported");
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