// hooks/message/useFileEncryption.ts - FIXED: Pass recipient info for shared secret

import { simpleEncryptionService } from "@/lib/encryption/EncryptionService";
import { useAuth } from "@clerk/clerk-expo";
import { useCallback, useMemo } from "react";
import { useEncryption } from "./useEncryption";

export const useFileEncryption = () => {
  const { isInitialized } = useEncryption();
  const { getToken, userId } = useAuth();

  const API_BASE_URL = useMemo(
    () => process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000",
    []
  );

  // Helper: Get MIME type from file name
  const getMimeType = (fileName: string): string => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
      pdf: "application/pdf",
      mp4: "video/mp4",
      mp3: "audio/mpeg",
      wav: "audio/wav",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      zip: "application/zip",
      rar: "application/x-rar-compressed",
    };
    return mimeTypes[ext || ""] || "application/octet-stream";
  };

  /**
   * ✅ FIXED: Encrypt file with recipient info for proper shared secret
   */
  const encryptFile = useCallback(
    async (
      fileUri: string,
      fileName: string,
      recipientUserId?: string // ✅ NEW: Optional recipient for shared secret
    ): Promise<{
      encryptedBase64: string;
      metadata: {
        iv: string;
        authTag: string;
        original_size: number;
        encrypted_size: number;
        file_name: string;
        file_type: string;
      };
    }> => {
      if (!isInitialized) {
        throw new Error("E2EE not initialized");
      }

      try {
        console.log("🔒 Encrypting file:", fileName);

        const token = await getToken();
        if (!token) {
          throw new Error("Authentication token not available");
        }

        // ✅ Pass recipient info for shared secret derivation
        const encryptionResult = await simpleEncryptionService.encryptFile(
          fileUri,
          fileName,
          recipientUserId,
          API_BASE_URL,
          token
        );

        const mimeType = getMimeType(fileName);

        console.log("✅ File encrypted successfully:", {
          fileName,
          mimeType,
          originalSize: encryptionResult.metadata.original_size,
          encryptedSize: encryptionResult.metadata.encrypted_size,
          hasRecipient: !!recipientUserId,
        });

        return {
          encryptedBase64: encryptionResult.encryptedBase64,
          metadata: {
            iv: encryptionResult.metadata.iv,
            authTag: encryptionResult.metadata.authTag,
            original_size: encryptionResult.metadata.original_size,
            encrypted_size: encryptionResult.metadata.encrypted_size,
            file_name: fileName,
            file_type: mimeType,
          },
        };
      } catch (error) {
        console.error("❌ File encryption failed:", error);
        throw error;
      }
    },
    [isInitialized, getToken, API_BASE_URL]
  );

  const decryptFile = useCallback(
    async (
      encryptedBase64: string,
      iv: string,
      authTag: string,
      senderUserId: string
    ): Promise<Buffer> => {
      if (!isInitialized) {
        throw new Error("E2EE not initialized");
      }

      try {
        console.log("🔓 Decrypting file from sender:", senderUserId);

        const token = await getToken();
        if (!token) {
          throw new Error("Authentication token not available");
        }

        const metadata = { iv, authTag };

        const decryptedUint8Array = await simpleEncryptionService.decryptFile(
          encryptedBase64,
          metadata,
          senderUserId,
          API_BASE_URL,
          token
        );

        const decryptedBuffer = Buffer.from(decryptedUint8Array);

        console.log("✅ File decrypted successfully:", {
          size: decryptedBuffer.length,
        });

        return decryptedBuffer;
      } catch (error) {
        console.error("❌ File decryption failed:", error);
        throw error;
      }
    },
    [isInitialized, getToken, API_BASE_URL]
  );

  return {
    encryptFile,
    decryptFile,
    isInitialized,
    isReady: isInitialized,
  };
};