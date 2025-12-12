// hooks/message/useFileDecryption.ts - UPDATED WITH UnifiedEncryptionService
import { UnifiedEncryptionService } from "@/lib/encryption/UnifiedEncryptionService";
import { useAuth } from "@clerk/clerk-expo";
import { useCallback, useRef } from "react";
import * as FileSystem from "expo-file-system/legacy";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

// Helper: Convert blob to base64
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result as string;
      const base64String = base64data.split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

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
    fileType?: string,
    presignedUrl?: string,
    chunks?: any[] // ✅ ADD THIS
  ): Promise<string> => {
    // Check cache first
    const cached = decryptedUrisRef.current.get(fileId);
    if (cached) {
      console.log("✅ Using cached decrypted URI for:", fileId);
      return cached;
    }

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("No auth token available");
      }

      // ✅ Get sender's public key FIRST
      console.log("🔑 Fetching sender's public key...");
      const keyResponse = await fetch(
        `${API_BASE_URL}/api/keys/${senderUserId}`, 
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!keyResponse.ok) {
        throw new Error(`Failed to get sender key: ${keyResponse.status}`);
      }

      const keyResult = await keyResponse.json();
      if (!keyResult.success) {
        throw new Error(keyResult.error || "Failed to get sender key");
      }

      const senderKeyBase64 = keyResult.data.publicKey;

      // ✅ Prepare output path
      const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      if (!baseDir) {
        throw new Error("No FileSystem directory available");
      }

      const decryptedDir = `${baseDir}decrypted/`;
      const dirInfo = await FileSystem.getInfoAsync(decryptedDir);
      
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(decryptedDir, { 
          intermediates: true 
        });
      }

      const mimeType = fileType || "application/octet-stream";
      const extension = getExtensionFromMimeType(mimeType);
      const tempFileName = `${fileId}_${Date.now()}.${extension}`;
      const outputPath = `${decryptedDir}${tempFileName}`;

      // ✅ FIX: Check if we have presignedUrl
      let encryptedDataSource = encryptedDataOrFileId;

      const isFileId = !encryptedDataOrFileId.includes("/") && 
                      encryptedDataOrFileId.length < 100;

      if (isFileId) {
        if (presignedUrl) {
          // ✅ USE PRESIGNED URL DIRECTLY - NO DOWNLOAD!
          console.log("🌊 [DECRYPT] Using presigned URL for TRUE STREAMING");
          encryptedDataSource = presignedUrl; // ✅ Pass URL, not base64!
        } else {
          // Get presigned URL from server
          const downloadInfoResponse = await fetch(
            `${API_BASE_URL}/api/files/download/${fileId}`,
            {
              method: 'GET',
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          if (!downloadInfoResponse.ok) {
            throw new Error(`Failed to get download URL: ${downloadInfoResponse.status}`);
          }

          const downloadInfo = await downloadInfoResponse.json();
          
          if (!downloadInfo.success) {
            throw new Error(downloadInfo.error || "Failed to get download URL");
          }

          encryptedDataSource = downloadInfo.data.downloadUrl; // ✅ Use URL!
        }
      }

      // ✅ Call UnifiedEncryptionService with URL or base64
      console.log("🔓 Decrypting file with UnifiedEncryptionService...");
      
      const resultUri = await UnifiedEncryptionService.decryptFile(
        encryptedDataSource, // ✅ Can be URL or base64
        iv,
        authTag,
        senderKeyBase64,
        outputPath,
        chunks // ✅ Pass chunks if available
      );

      console.log("✅ Decryption complete:", {
        fileId,
        uriType: resultUri.startsWith('file://') ? 'FILE' : 'DATA_URI',
      });

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
    console.log("🧹 Clearing decryption cache...");
    
    const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
    if (baseDir) {
      const decryptedDir = `${baseDir}decrypted/`;
      try {
        const dirInfo = await FileSystem.getInfoAsync(decryptedDir);
        if (dirInfo.exists) {
          await FileSystem.deleteAsync(decryptedDir, { idempotent: true });
        }
      } catch (e) {
        console.warn("⚠️ Failed to delete decrypted folder:", e);
      }
    }
    
    decryptedUrisRef.current.clear();
    console.log("✅ Cache cleared");
  }, []);

  return {
    getDecryptedUri,
    clearCache,
  };
};