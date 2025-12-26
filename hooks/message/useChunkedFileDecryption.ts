// hooks/message/useChunkedFileDecryption.ts - ABSOLUTE FINAL VERSION
// ✅ Fixed symmetricKey scope issue
// ✅ Use MY master key to decrypt (symmetric key was encrypted with MY public key)

import { useAuth as useAuthDecrypt } from "@clerk/clerk-expo";
import * as FileSystem from "expo-file-system/legacy";
import { useCallback as useCallbackDecrypt, useRef } from "react";
import { NativeEncryptionBridge } from "@/lib/encryption/NativeEncryptionBridge";
import * as SecureStore from 'expo-secure-store';

const API_BASE_URL_DECRYPT = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";
const ENCRYPTION_KEY_STORE = "e2ee_master_key";

export interface ChunkedFileMetadata {
  fileId: string;
  fileName: string;
  fileType: string;
  chunks: ChunkInfoDecrypt[];
  totalChunks: number;
  masterIv?: string;
  masterAuthTag?: string;
  iv?: string;
  authTag?: string;
  originalSize: number;
  encryptedSize: number;
  recipientKeys?: Array<{
    userId: string;
    encryptedSymmetricKey: string;
    keyIv: string;
    keyAuthTag: string;
  }>;
}

export interface ChunkInfoDecrypt {
  index: number;
  iv: string;
  authTag: string;
  gcmAuthTag: string;
  offset: number;
  size: number;
  encryptedSize: number;
  originalSize: number;
}

export const useChunkedFileDecryption = () => {
  const { getToken: getTokenDecrypt, userId: myUserId } = useAuthDecrypt();
  const decryptingFiles = useRef<Map<string, Promise<string>>>(new Map());

  const getExtensionFromMimeType = (mimeType: string): string => {
    const mimeToExt: Record<string, string> = {
      "video/mp4": "mp4",
      "video/quicktime": "mov",
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/gif": "gif",
      "audio/mpeg": "mp3",
      "audio/mp4": "m4a",
    };
    return mimeToExt[mimeType] || "bin";
  };

  const hasNewMethods = useCallbackDecrypt(() => {
    try {
      return (
        typeof NativeEncryptionBridge.decryptSymmetricKey === 'function' &&
        typeof NativeEncryptionBridge.decryptFileWithSymmetricKey === 'function'
      );
    } catch {
      return false;
    }
  }, []);

  const decryptWithSymmetricKey = useCallbackDecrypt(
    async (
      fileId: string,
      fileMetadata: ChunkedFileMetadata,
      senderUserId: string,
      onProgress?: (progress: any) => void
    ): Promise<string> => {
      console.log(`🔓 [DECRYPT] Using NEW decryption flow (symmetric key)`);
      console.log(`   File: ${fileMetadata.fileName}`);
      console.log(`   Sender: ${senderUserId}`);
      console.log(`   My ID: ${myUserId}`);

      if (!fileMetadata.recipientKeys || fileMetadata.recipientKeys.length === 0) {
        throw new Error("No recipient keys found in file metadata");
      }

      // ✅ Validate chunks
      if (!fileMetadata.chunks || !Array.isArray(fileMetadata.chunks)) {
        console.error("❌ [DECRYPT] chunks is null or not array:", fileMetadata.chunks);
        throw new Error("Chunks data is missing or invalid");
      }

      if (fileMetadata.chunks.length === 0) {
        console.error("❌ [DECRYPT] chunks array is empty");
        throw new Error("Chunks array is empty");
      }

      console.log(`✅ [DECRYPT] Found ${fileMetadata.chunks.length} chunks`);

      const token = await getTokenDecrypt();
      if (!token) throw new Error("No auth token");

      // Find my encrypted symmetric key
      const myRecipientKey = fileMetadata.recipientKeys.find(
        (rk) => rk.userId === myUserId
      );

      if (!myRecipientKey) {
        console.error("❌ [DECRYPT] Cannot decrypt - no key for current user");
        console.error(`   My ID: ${myUserId}`);
        console.error(`   Available keys for:`, fileMetadata.recipientKeys.map(r => r.userId));
        throw new Error("You do not have access to this file");
      }

      console.log("✅ [DECRYPT] Found my encrypted symmetric key");
      console.log(`   Encrypted key: ${myRecipientKey.encryptedSymmetricKey.substring(0, 30)}...`);
      console.log(`   IV: ${myRecipientKey.keyIv}`);
      console.log(`   AuthTag: ${myRecipientKey.keyAuthTag}`);

      // ✅ CRITICAL FIX: Get MY master key (not sender's!)
      // The symmetric key was encrypted with MY public key by sender
      // So I need MY private key (master key) to decrypt it
      console.log(`🔑 [DECRYPT] Getting MY master key from SecureStore...`);
      
      const myMasterKey = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORE);
      if (!myMasterKey) {
        throw new Error("Master key not found - encryption not initialized");
      }

      console.log("✅ [DECRYPT] Got MY master key");
      console.log(`   My master key length: ${myMasterKey.length}`);

      // ✅ FIX SCOPE ISSUE: Declare symmetricKey OUTSIDE try block
      console.log("🔓 [DECRYPT] Decrypting symmetric key with MY master key...");
      
      let symmetricKey: string;
      
      try {
        symmetricKey = await NativeEncryptionBridge.decryptSymmetricKey(
          myRecipientKey.encryptedSymmetricKey,
          myRecipientKey.keyIv,
          myRecipientKey.keyAuthTag,
          myMasterKey  // ✅ MY master key! (same as used in encryption)
        );

        console.log("✅ [DECRYPT] Symmetric key decrypted successfully!");
        console.log(`   Symmetric key length: ${symmetricKey.length}`);

      } catch (decryptError: any) {
        console.error("❌ [DECRYPT] Failed to decrypt symmetric key!");
        console.error("   Error type:", decryptError?.constructor?.name || "Unknown");
        console.error("   Error message:", decryptError?.message || "Unknown error");
        console.error("   Encrypted key:", myRecipientKey.encryptedSymmetricKey.substring(0, 50));
        console.error("   IV:", myRecipientKey.keyIv);
        console.error("   AuthTag:", myRecipientKey.keyAuthTag);
        console.error("   My master key length:", myMasterKey.length);
        throw new Error(`Symmetric key decryption failed: ${decryptError?.message || "Unknown error"}`);
      }

      // ✅ At this point, symmetricKey is definitely defined
      console.log(`📥 [DECRYPT] Getting download URL for file ${fileId}...`);
      
      const downloadResponse = await fetch(
        `${API_BASE_URL_DECRYPT}/api/files/download/${fileId}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!downloadResponse.ok) {
        throw new Error(`Failed to get download URL: ${downloadResponse.status}`);
      }

      const downloadData = await downloadResponse.json();
      if (!downloadData.success || !downloadData.data?.downloadUrl) {
        throw new Error("Invalid download response");
      }

      const presignedUrl = downloadData.data.downloadUrl;
      console.log("✅ [DECRYPT] Got presigned URL");

      // Prepare output path
      const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      if (!baseDir) throw new Error("No FileSystem directory available");

      const decryptedDir = `${baseDir}decrypted/`;
      const dirInfo = await FileSystem.getInfoAsync(decryptedDir);

      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(decryptedDir, { intermediates: true });
      }

      const extension = getExtensionFromMimeType(fileMetadata.fileType);
      const tempFileName = `${fileId}_${Date.now()}.${extension}`;
      const outputPath = `${decryptedDir}${tempFileName}`;

      console.log("🌊 [DECRYPT] Streaming file decryption...");
      console.log(`   Source: ${presignedUrl.substring(0, 50)}...`);
      console.log(`   Chunks: ${fileMetadata.chunks.length}`);
      console.log(`   Output: ${outputPath}`);
      console.log(`   Symmetric key available: ${!!symmetricKey}`); // Debug log

      const masterAuthTag = "SKIP_MASTER_AUTH_TAG_VERIFICATION";

      // ✅ symmetricKey is now accessible here!
      const result = await NativeEncryptionBridge.decryptFileWithSymmetricKey(
        presignedUrl,
        fileMetadata.chunks,
        masterAuthTag,
        symmetricKey,  // ✅ This should work now!
        outputPath,
        onProgress
      );

      // Verify file exists
      const fileInfo = await FileSystem.getInfoAsync(result);
      if (!fileInfo.exists) {
        throw new Error("Failed to write decrypted file");
      }

      console.log("✅ [DECRYPT] File decrypted successfully!");
      console.log(`   Output path: ${result}`);
      console.log(`   File size: ${fileInfo.size} bytes`);

      return result;
    },
    [getTokenDecrypt, myUserId, API_BASE_URL_DECRYPT]
  );

  const getDecryptedUriChunked = useCallbackDecrypt(
    async (
      fileId: string,
      fileMetadata: ChunkedFileMetadata,
      senderUserId: string,
      onProgress?: (progress: any) => void
    ): Promise<string> => {
      const existingDecryption = decryptingFiles.current.get(fileId);
      if (existingDecryption) {
        console.log(`⏳ [DECRYPT] Already decrypting ${fileId}, sharing promise...`);
        return existingDecryption;
      }

      const decryptionPromise = (async () => {
        try {
          console.log(`🔓 [DECRYPT] Starting decryption: ${fileMetadata.fileName}`);
          console.log(`   File ID: ${fileId}`);
          console.log(`   Sender ID: ${senderUserId}`);
          console.log(`   My User ID: ${myUserId}`);
          
          // ✅ Extract both recipientKeys AND chunks from encryptionMetadata
          let recipientKeys = fileMetadata.recipientKeys;
          let chunks = fileMetadata.chunks;
          
          // Check if data is in encryptionMetadata (nested)
          const encMeta = (fileMetadata as any).encryptionMetadata;
          if (encMeta) {
            if (!recipientKeys && encMeta.recipientKeys) {
              console.log("📦 [DECRYPT] Found recipientKeys in encryptionMetadata (nested)");
              recipientKeys = encMeta.recipientKeys;
            }
            
            // ✅ CRITICAL: Get chunks from encryptionMetadata
            if (!chunks && encMeta.chunks) {
              console.log("📦 [DECRYPT] Found chunks in encryptionMetadata (nested)");
              chunks = encMeta.chunks;
            }
          }

          // ✅ Validate we have all required data
          if (!chunks || !Array.isArray(chunks) || chunks.length === 0) {
            console.error("❌ [DECRYPT] No valid chunks found!");
            console.error("   fileMetadata.chunks:", fileMetadata.chunks);
            console.error("   encryptionMetadata.chunks:", encMeta?.chunks);
            throw new Error("Chunks data is missing");
          }

          const hasRecipientKeys = recipientKeys && 
                                   Array.isArray(recipientKeys) &&
                                   recipientKeys.length > 0;

          console.log("🔍 [DECRYPT] Validation:");
          console.log(`   hasRecipientKeys: ${hasRecipientKeys}`);
          console.log(`   chunks count: ${chunks.length}`);
          console.log(`   hasNewMethods: ${hasNewMethods()}`);

          if (hasRecipientKeys && hasNewMethods()) {
            console.log("📦 [DECRYPT] NEW file format detected (hybrid encryption)");
            
            // Create updated metadata with all data at top level
            const updatedMetadata: ChunkedFileMetadata = {
              ...fileMetadata,
              recipientKeys,
              chunks,
            };
            
            return await decryptWithSymmetricKey(
              fileId,
              updatedMetadata,
              senderUserId,
              onProgress
            );
          } else {
            if (!hasNewMethods()) {
              console.log("⚠️ [DECRYPT] NEW methods not available - cannot decrypt");
              throw new Error("Decryption methods not available - please update app");
            } else {
              console.log("📦 [DECRYPT] OLD file format detected (no recipientKeys)");
              throw new Error("Old file format not supported - please re-upload");
            }
          }
        } catch (error: any) {
          console.error("❌ [DECRYPT] Decryption failed:");
          console.error("   Error type:", error?.constructor?.name || "Unknown");
          console.error("   Error message:", error?.message || "Unknown error");
          console.error("   Stack:", error?.stack);
          throw error;
        } finally {
          decryptingFiles.current.delete(fileId);
        }
      })();

      decryptingFiles.current.set(fileId, decryptionPromise);
      return decryptionPromise;
    },
    [
      getTokenDecrypt,
      myUserId,
      hasNewMethods,
      decryptWithSymmetricKey,
    ]
  );

  return {
    getDecryptedUriChunked,
    clearCache: async () => {
      const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      if (baseDir) {
        const decryptedDir = `${baseDir}decrypted/`;
        try {
          const dirInfo = await FileSystem.getInfoAsync(decryptedDir);
          if (dirInfo.exists) {
            await FileSystem.deleteAsync(decryptedDir, { idempotent: true });
          }
        } catch (e) {
          console.warn("⚠️ Failed to delete cache:", e);
        }
      }
      decryptingFiles.current.clear();
    },
  };
};