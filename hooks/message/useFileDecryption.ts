// hooks/message/useFileDecryption.ts - FIXED for Expo SDK 52+
import { nativeEncryptionService } from "@/lib/encryption/NativeEncryptionService";
import { useAuth } from "@clerk/clerk-expo";
import { useCallback, useRef } from "react";
import { Buffer } from "buffer";
// ✅ FIXED: Import from legacy for SDK 52+
import * as FileSystem from "expo-file-system/legacy";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

const TEMP_FILE_THRESHOLD = 1 * 1024 * 1024; // 1MB

export const useFileDecryption = () => {
  const { getToken } = useAuth();
  const decryptedUrisRef = useRef<Map<string, string>>(new Map());

  const getExtensionFromMimeType = (mimeType: string): string => {
    const mimeToExt: Record<string, string> = {
      "video/mp4": "mp4",
      "video/quicktime": "mov",
      "video/x-msvideo": "avi",
      "video/webm": "webm",
      "audio/mpeg": "mp3",
      "audio/mp4": "m4a",
      "audio/wav": "wav",
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/gif": "gif",
      "application/pdf": "pdf",
    };
    return mimeToExt[mimeType] || "bin";
  };

  const getDecryptedUri = useCallback(
    async (
      encryptedDataOrFileId: string,
      iv: string,
      authTag: string,
      senderUserId: string,
      fileId: string,
      fileType?: string
    ): Promise<string> => {
      const cached = decryptedUrisRef.current.get(fileId);
      if (cached) {
        console.log("✅ Using cached decrypted URI for:", fileId);
        return cached;
      }

      try {
        let encryptedBase64 = encryptedDataOrFileId;
        let mimeType = fileType || "application/octet-stream";

        const token = await getToken();
        if (!token) {
          throw new Error("No auth token available");
        }

        // Download from server if fileId
        const isFileId = !encryptedDataOrFileId.includes("/") && 
                        encryptedDataOrFileId.length < 100;
        
        if (isFileId) {
          console.log("📥 Downloading encrypted file:", fileId);

          const response = await fetch(
            `${API_BASE_URL}/api/files/download/${fileId}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          if (!response.ok) {
            throw new Error(`Download failed: ${response.status}`);
          }

          const result = await response.json();
          if (!result.success) {
            throw new Error(result.error || "Download failed");
          }

          encryptedBase64 = result.data.encryptedData;
          
          const serverMimeType = result.data.file_type || result.data.fileType;
          if (!fileType && serverMimeType) {
            mimeType = serverMimeType;
          }

          console.log("✅ Downloaded:", {
            fileId,
            size: `${(encryptedBase64.length / 1024 / 1024).toFixed(2)} MB`,
            mimeType,
          });
        }

        // Get sender's public key
        const keyResponse = await fetch(`${API_BASE_URL}/api/keys/${senderUserId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!keyResponse.ok) {
          throw new Error(`Failed to get sender key: ${keyResponse.status}`);
        }

        const keyResult = await keyResponse.json();
        if (!keyResult.success) {
          throw new Error(keyResult.error || "Failed to get sender key");
        }

        const senderKeyBase64 = keyResult.data.publicKey;

        // Decrypt
        console.log("🔓 Decrypting file:", fileId);
        const decryptedBuffer = await nativeEncryptionService.decryptFile(
          encryptedBase64,
          iv,
          authTag,
          senderKeyBase64
        );

        const decryptedSize = decryptedBuffer.length;
        console.log("✅ Decrypted:", {
          fileId,
          size: `${(decryptedSize / 1024 / 1024).toFixed(2)} MB`,
          mimeType,
        });

        let resultUri: string;

        const isVideo = mimeType.startsWith("video/");
        const isLargeFile = decryptedSize > TEMP_FILE_THRESHOLD;

        if (isVideo || isLargeFile) {
          // Try cacheDirectory first, then documentDirectory
          let baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
          
          if (!baseDir) {
            console.error("❌ No FileSystem directory available");
            // Fallback to data URI
            const base64Data = decryptedBuffer.toString("base64");
            resultUri = `data:${mimeType};base64,${base64Data}`;
            console.log("⚠️ Using data URI as fallback");
          } else {
            // Create decrypted folder
            const decryptedDir = `${baseDir}decrypted/`;
            const dirInfo = await FileSystem.getInfoAsync(decryptedDir);
            if (!dirInfo.exists) {
              await FileSystem.makeDirectoryAsync(decryptedDir, { intermediates: true });
            }

            const extension = getExtensionFromMimeType(mimeType);
            const tempFileName = `${fileId}_${Date.now()}.${extension}`;
            const tempFilePath = `${decryptedDir}${tempFileName}`;

            console.log("💾 Saving to temp file:", tempFilePath);

            const base64Data = decryptedBuffer.toString("base64");
            
            await FileSystem.writeAsStringAsync(
              tempFilePath,
              base64Data,
              { encoding: FileSystem.EncodingType.Base64 }
            );

            // Verify file
            const fileInfo = await FileSystem.getInfoAsync(tempFilePath);
            if (!fileInfo.exists) {
              throw new Error("Failed to write temp file");
            }

            console.log("✅ Temp file saved:", {
              path: tempFilePath,
              size: (fileInfo as any).size,
            });

            resultUri = tempFilePath;
          }
        } else {
          // For small files, use data URI
          const base64Data = decryptedBuffer.toString("base64");
          resultUri = `data:${mimeType};base64,${base64Data}`;
          console.log("✅ Data URI created for small file");
        }

        decryptedUrisRef.current.set(fileId, resultUri);
        return resultUri;
      } catch (error) {
        console.error("❌ Failed to decrypt file:", fileId, error);
        throw error;
      }
    },
    [getToken]
  );

  const clearCache = useCallback(async () => {
    const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
    if (baseDir) {
      const decryptedDir = `${baseDir}decrypted/`;
      try {
        const dirInfo = await FileSystem.getInfoAsync(decryptedDir);
        if (dirInfo.exists) {
          await FileSystem.deleteAsync(decryptedDir, { idempotent: true });
          console.log("🗑️ Deleted decrypted folder");
        }
      } catch (e) {
        // Ignore
      }
    }
    
    decryptedUrisRef.current.clear();
    console.log("🧹 Cache cleared");
  }, []);

  return {
    getDecryptedUri,
    clearCache,
  };
};