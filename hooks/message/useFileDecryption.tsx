// hooks/message/useFileDecryption.ts - FIXED: Now correctly calls decryptFile with metadata { iv, authTag }

import { simpleEncryptionService } from "@/lib/encryption/EncryptionService";
import { useAuth } from "@clerk/clerk-expo";
import { useCallback, useRef } from "react";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

export const useFileDecryption = () => {
  const { getToken } = useAuth();
  const decryptedUrisRef = useRef<Map<string, string>>(new Map());

  const getDecryptedUri = useCallback(
    async (
      encryptedDataOrFileId: string,
      iv: string,
      authTag: string,
      senderUserId: string,
      fileId: string
    ): Promise<string> => {
      const cached = decryptedUrisRef.current.get(fileId);
      if (cached) {
        console.log("✅ Using cached decrypted URI for:", fileId);
        return cached;
      }

      try {
        let encryptedBase64 = encryptedDataOrFileId;
        let mimeType = "image/jpeg"; // Default fallback

        // ✅ Download from server if fileId (short ID, not base64 data)
        if (
          !encryptedDataOrFileId.includes("/") &&
          encryptedDataOrFileId.length < 100
        ) {
          console.log("📥 Downloading encrypted file from server:", fileId);

          const token = await getToken();
          if (!token) {
            throw new Error("No auth token available");
          }

          const response = await fetch(
            `${API_BASE_URL}/api/files/download/${fileId}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          if (!response.ok) {
            throw new Error(`Failed to download file: ${response.status}`);
          }

          const result = await response.json();
          if (!result.success) {
            throw new Error(result.error || "Download failed");
          }

          encryptedBase64 = result.data.encryptedData;
          // ✅ Use original MIME type from backend
          mimeType =
            result.data.file_type || result.data.fileType || "image/jpeg";

          console.log("✅ File downloaded from server:", {
            size: encryptedBase64.length,
            type: mimeType,
          });
        }

        console.log("🔓 Decrypting file:", fileId);
        console.log("🔓 Using MIME type:", mimeType);

        const token = await getToken();
        if (!token) {
          throw new Error("No auth token");
        }

        // FIXED: Create metadata object and call decryptFile with correct params (5 args: encrypted, metadata, sender, api, token)
        const metadata = { iv, authTag };
        const decryptedBuffer = await simpleEncryptionService.decryptFile(
          encryptedBase64,
          metadata,
          senderUserId,
          API_BASE_URL,
          token
        );

        // ✅ Create data URI with correct MIME type
        const base64Data = Buffer.from(decryptedBuffer).toString("base64");
        const dataUri = `data:${mimeType};base64,${base64Data}`;

        console.log("✅ Created data URI:", {
          fileId,
          mimeType,
          dataLength: dataUri.length,
          preview: dataUri.substring(0, 100) + "...",
        });

        // ✅ Cache the data URI
        decryptedUrisRef.current.set(fileId, dataUri);

        console.log("✅ File decrypted and cached");
        return dataUri;
      } catch (error) {
        console.error("❌ Failed to decrypt file:", error);
        throw error;
      }
    },
    [getToken]
  );

  const clearCache = useCallback(() => {
    decryptedUrisRef.current.clear();
    console.log("🧹 Decryption cache cleared");
  }, []);

  return {
    getDecryptedUri,
    clearCache,
  };
};
