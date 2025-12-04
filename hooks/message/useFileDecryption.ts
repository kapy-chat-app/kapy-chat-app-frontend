// hooks/message/useFileDecryption.ts - FORCE FILE FOR ALL VIDEOS

import { nativeEncryptionService } from "@/lib/encryption/NativeEncryptionService";
import { useAuth } from "@clerk/clerk-expo";
import { useCallback, useRef } from "react";
import { Buffer } from "buffer";
import * as FileSystem from "expo-file-system/legacy";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

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
      presignedUrl?: string
    ): Promise<string> => {
      // Check cache first
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

        // Check if this is a fileId (not base64 data)
        const isFileId = !encryptedDataOrFileId.includes("/") && 
                        encryptedDataOrFileId.length < 100;
        
        if (isFileId) {
          console.log("📥 Downloading encrypted file:", fileId);

          // ✅ Use presigned URL if provided
          if (presignedUrl) {
            console.log("🔑 Using presigned URL from caller");
            console.log("📥 Downloading from S3...");
            
            const s3Response = await fetch(presignedUrl, {
              method: 'GET',
            });

            if (!s3Response.ok) {
              console.error("❌ S3 download failed:", s3Response.status);
              throw new Error(`S3 download failed: ${s3Response.status}`);
            }

            // Convert blob to base64
            const blob = await s3Response.blob();
            const reader = new FileReader();
            
            encryptedBase64 = await new Promise<string>((resolve, reject) => {
              reader.onloadend = () => {
                const base64data = reader.result as string;
                const base64String = base64data.split(',')[1];
                resolve(base64String);
              };
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });

            console.log("✅ Downloaded from S3:", {
              fileId,
              size: `${(encryptedBase64.length / 1024 / 1024).toFixed(2)} MB (base64)`,
            });
          } else {
            // Fetch presigned URL ourselves
            console.log("🔑 Fetching presigned URL...");
            
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

            const fetchedPresignedUrl = downloadInfo.data.downloadUrl;
            console.log("✅ Got presigned URL");

            // Download from S3
            console.log("📥 Downloading from S3...");
            const s3Response = await fetch(fetchedPresignedUrl, {
              method: 'GET',
            });

            if (!s3Response.ok) {
              throw new Error(`S3 download failed: ${s3Response.status}`);
            }

            const blob = await s3Response.blob();
            const reader = new FileReader();
            
            encryptedBase64 = await new Promise<string>((resolve, reject) => {
              reader.onloadend = () => {
                const base64data = reader.result as string;
                const base64String = base64data.split(',')[1];
                resolve(base64String);
              };
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });

            console.log("✅ Downloaded from S3");
          }
        }

        // Get sender's public key
        console.log("🔑 Fetching sender's public key...");
        const keyResponse = await fetch(
          `${API_BASE_URL}/api/keys/${senderUserId}`, 
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!keyResponse.ok) {
          throw new Error(`Failed to get sender key: ${keyResponse.status}`);
        }

        const keyResult = await keyResponse.json();
        if (!keyResult.success) {
          throw new Error(keyResult.error || "Failed to get sender key");
        }

        const senderKeyBase64 = keyResult.data.publicKey;

        // Decrypt file
        console.log("🔓 Decrypting file:", fileId);
        const decryptedBuffer = await nativeEncryptionService.decryptFile(
          encryptedBase64,
          iv,
          authTag,
          senderKeyBase64
        );

        const decryptedSize = decryptedBuffer.length;
        const decryptedSizeMB = (decryptedSize / 1024 / 1024).toFixed(2);
        console.log("✅ Decrypted:", {
          fileId,
          size: `${decryptedSizeMB} MB`,
          mimeType,
        });

        let resultUri: string;

        const isVideo = mimeType.startsWith("video/");
        const isAudio = mimeType.startsWith("audio/");

        // ✅ CRITICAL FIX: ALWAYS save video/audio to file (never data URI)
        if (isVideo || isAudio) {
          console.log(`💾 Saving ${isVideo ? 'video' : 'audio'} to file (required for ExoPlayer)...`);
          
          let baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
          
          if (!baseDir) {
            throw new Error("❌ No FileSystem directory available - cannot play video/audio");
          }

          const decryptedDir = `${baseDir}decrypted/`;
          const dirInfo = await FileSystem.getInfoAsync(decryptedDir);
          
          if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(decryptedDir, { 
              intermediates: true 
            });
            console.log("📁 Created decrypted directory");
          }

          const extension = getExtensionFromMimeType(mimeType);
          const tempFileName = `${fileId}_${Date.now()}.${extension}`;
          const tempFilePath = `${decryptedDir}${tempFileName}`;

          console.log("💾 Writing to:", tempFilePath);

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

          const savedSizeMB = ((fileInfo as any).size / 1024 / 1024).toFixed(2);
          console.log("✅ File saved:", {
            path: tempFilePath,
            size: `${savedSizeMB} MB`,
          });

          resultUri = tempFilePath;
        } 
        // For images - can use data URI (smaller size OK)
        else {
          console.log("✅ Using data URI for image");
          const base64Data = decryptedBuffer.toString("base64");
          resultUri = `data:${mimeType};base64,${base64Data}`;
        }

        decryptedUrisRef.current.set(fileId, resultUri);
        
        console.log("🎉 File decryption complete:", {
          fileId,
          uriType: resultUri.startsWith('file://') ? 'FILE' : 
                   resultUri.startsWith('data:') ? 'DATA_URI' : 'UNKNOWN',
        });
        
        return resultUri;
        
      } catch (error) {
        console.error("❌ Failed to decrypt file:", fileId);
        console.error("   Error:", error);
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
          console.log("✅ Deleted decrypted folder");
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