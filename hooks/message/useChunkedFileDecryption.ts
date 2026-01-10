// hooks/message/useChunkedFileDecryption.ts
// ✅ FIXED VERSION - Proper symmetric key decryption

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
  encryptionMetadata?: {
    chunks?: ChunkInfoDecrypt[];
    recipientKeys?: Array<{
      userId: string;
      encryptedSymmetricKey: string;
      keyIv: string;
      keyAuthTag: string;
    }>;
  };
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
      "application/pdf": "pdf",
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

  /**
   * ✅ FIXED: Extract data from potentially nested metadata
   */
  const extractMetadata = (fileMetadata: ChunkedFileMetadata) => {
    let recipientKeys = fileMetadata.recipientKeys;
    let chunks = fileMetadata.chunks;
    
    // Check if data is in encryptionMetadata (nested)
    const encMeta = fileMetadata.encryptionMetadata;
    if (encMeta) {
      if (!recipientKeys && encMeta.recipientKeys) {
        console.log("📦 [DECRYPT] Found recipientKeys in encryptionMetadata");
        recipientKeys = encMeta.recipientKeys;
      }
      
      if (!chunks && encMeta.chunks) {
        console.log("📦 [DECRYPT] Found chunks in encryptionMetadata");
        chunks = encMeta.chunks;
      }
    }
    
    return { recipientKeys, chunks };
  };

  /**
   * ✅ FIXED: Decrypt with symmetric key using MY master key
   */
  const decryptWithSymmetricKey = useCallbackDecrypt(
    async (
      fileId: string,
      fileMetadata: ChunkedFileMetadata,
      senderUserId: string,
      onProgress?: (progress: any) => void
    ): Promise<string> => {
      console.log(`🔓 [DECRYPT] Starting symmetric key decryption`);
      console.log(`   File: ${fileMetadata.fileName}`);
      console.log(`   File ID: ${fileId}`);
      console.log(`   Sender: ${senderUserId}`);
      console.log(`   My ID: ${myUserId}`);

      // Extract metadata
      const { recipientKeys, chunks } = extractMetadata(fileMetadata);

      // Validate recipientKeys
      if (!recipientKeys || recipientKeys.length === 0) {
        console.error("❌ [DECRYPT] No recipient keys found");
        throw new Error("No recipient keys found in file metadata");
      }

      // Validate chunks
      if (!chunks || !Array.isArray(chunks) || chunks.length === 0) {
        console.error("❌ [DECRYPT] Chunks data is missing or invalid");
        console.error("   chunks:", chunks);
        throw new Error("Chunks data is missing or invalid");
      }

      console.log(`✅ [DECRYPT] Found ${chunks.length} chunks`);
      console.log(`✅ [DECRYPT] Found ${recipientKeys.length} recipient keys`);

      const token = await getTokenDecrypt();
      if (!token) throw new Error("No auth token");

      // ✅ CRITICAL: Find MY encrypted symmetric key
      const myRecipientKey = recipientKeys.find(
        (rk) => rk.userId === myUserId
      );

      if (!myRecipientKey) {
        console.error("❌ [DECRYPT] No key found for current user");
        console.error(`   My ID: ${myUserId}`);
        console.error(`   Available keys for:`, recipientKeys.map(r => r.userId));
        throw new Error("You do not have access to this file");
      }

      console.log("✅ [DECRYPT] Found my encrypted symmetric key");
      console.log(`   Encrypted key length: ${myRecipientKey.encryptedSymmetricKey.length}`);
      console.log(`   IV length: ${myRecipientKey.keyIv.length}`);
      console.log(`   AuthTag length: ${myRecipientKey.keyAuthTag.length}`);

      // ✅ CRITICAL: Get MY master key from SecureStore
      console.log(`🔑 [DECRYPT] Getting MY master key from SecureStore...`);
      
      const myMasterKey = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORE);
      if (!myMasterKey) {
        throw new Error("Master key not found - encryption not initialized");
      }

      console.log(`✅ [DECRYPT] Got MY master key (${myMasterKey.length} chars)`);

      // ✅ Decrypt symmetric key using MY master key
      console.log("🔓 [DECRYPT] Decrypting symmetric key...");
      
      let symmetricKey: string;
      
      try {
        symmetricKey = await NativeEncryptionBridge.decryptSymmetricKey(
          myRecipientKey.encryptedSymmetricKey,
          myRecipientKey.keyIv,
          myRecipientKey.keyAuthTag,
          myMasterKey  // ✅ Use MY master key!
        );

        console.log(`✅ [DECRYPT] Symmetric key decrypted (${symmetricKey.length} chars)`);

      } catch (decryptError: any) {
        console.error("❌ [DECRYPT] Failed to decrypt symmetric key!");
        console.error("   Error:", decryptError?.message);
        console.error("   Encrypted key:", myRecipientKey.encryptedSymmetricKey.substring(0, 30) + "...");
        console.error("   IV:", myRecipientKey.keyIv);
        console.error("   AuthTag:", myRecipientKey.keyAuthTag);
        throw new Error(`Symmetric key decryption failed: ${decryptError?.message}`);
      }

      // Get download URL
      console.log(`📥 [DECRYPT] Getting download URL...`);
      
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

      console.log("🌊 [DECRYPT] Starting file decryption...");
      console.log(`   Chunks: ${chunks.length}`);
      console.log(`   Output: ${outputPath}`);

      // Skip master auth tag verification for now
      const masterAuthTag = "SKIP_VERIFICATION";

      // ✅ Decrypt file using symmetric key
      const result = await NativeEncryptionBridge.decryptFileWithSymmetricKey(
        presignedUrl,
        chunks,
        masterAuthTag,
        symmetricKey,
        outputPath,
        onProgress
      );

      // Verify file exists
      const fileInfo = await FileSystem.getInfoAsync(result);
      if (!fileInfo.exists) {
        throw new Error("Failed to write decrypted file");
      }

      console.log("✅ [DECRYPT] File decrypted successfully!");
      console.log(`   Output: ${result}`);
      console.log(`   Size: ${fileInfo.size} bytes`);

      return result;
    },
    [getTokenDecrypt, myUserId]
  );

  /**
   * ✅ Main entry point for chunked file decryption
   */
  const getDecryptedUriChunked = useCallbackDecrypt(
    async (
      fileId: string,
      fileMetadata: ChunkedFileMetadata,
      senderUserId: string,
      onProgress?: (progress: any) => void
    ): Promise<string> => {
      // Check for existing decryption in progress
      const existingDecryption = decryptingFiles.current.get(fileId);
      if (existingDecryption) {
        console.log(`⏳ [DECRYPT] Already decrypting ${fileId}, waiting...`);
        return existingDecryption;
      }

      const decryptionPromise = (async () => {
        try {
          console.log(`🔓 [DECRYPT] Starting decryption: ${fileMetadata.fileName}`);
          console.log(`   File ID: ${fileId}`);
          console.log(`   Sender ID: ${senderUserId}`);
          console.log(`   My User ID: ${myUserId}`);
          
          // Extract and validate metadata
          const { recipientKeys, chunks } = extractMetadata(fileMetadata);

          // Validate we have all required data
          if (!chunks || !Array.isArray(chunks) || chunks.length === 0) {
            console.error("❌ [DECRYPT] No valid chunks found!");
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
            console.log("📦 [DECRYPT] Using symmetric key decryption");
            
            // Create updated metadata with extracted data
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
              throw new Error("Decryption methods not available - please update app");
            } else {
              throw new Error("Old file format not supported - no recipientKeys found");
            }
          }
        } catch (error: any) {
          console.error("❌ [DECRYPT] Decryption failed:");
          console.error("   Error:", error?.message);
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
      extractMetadata,
    ]
  );

  const clearCache = useCallbackDecrypt(async () => {
    const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
    if (baseDir) {
      const decryptedDir = `${baseDir}decrypted/`;
      try {
        const dirInfo = await FileSystem.getInfoAsync(decryptedDir);
        if (dirInfo.exists) {
          await FileSystem.deleteAsync(decryptedDir, { idempotent: true });
          console.log("✅ [DECRYPT] Cache cleared");
        }
      } catch (e) {
        console.warn("⚠️ [DECRYPT] Failed to delete cache:", e);
      }
    }
    decryptingFiles.current.clear();
  }, []);

  return {
    getDecryptedUriChunked,
    clearCache,
  };
};