// hooks/message/useFileEncryption.ts - FIXED: Verify key sync before encrypt

import { simpleEncryptionService } from "@/lib/encryption/EncryptionService";
import { useAuth } from "@clerk/clerk-expo";
import { useCallback, useMemo } from "react";
import { useEncryption } from "./useEncryption";
import CryptoJS from "crypto-js";

export const useFileEncryption = () => {
  const { isInitialized } = useEncryption();
  const { getToken, userId } = useAuth();

  const API_BASE_URL = useMemo(
    () => process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000",
    []
  );

  // ✅ Helper: Get MIME type from file name
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
   * ✅ NEW: Verify that local key matches server key
   */
  const verifyKeySync = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;

    try {
      const token = await getToken();
      if (!token) return false;

      // Get local key
      const localKey = await simpleEncryptionService.getPublicKey();
      const localKeyHash = CryptoJS.SHA256(localKey).toString(CryptoJS.enc.Hex);

      // Get key from server
      const response = await fetch(`${API_BASE_URL}/api/keys/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const result = await response.json();
      if (!result.success) {
        console.error("❌ Failed to fetch server key");
        return false;
      }

      const serverKey = result.data.publicKey;
      const serverKeyHash = CryptoJS.SHA256(serverKey).toString(CryptoJS.enc.Hex);

      const match = localKey === serverKey;

      console.log("🔍 KEY SYNC CHECK");
      console.log("Local key hash:", localKeyHash);
      console.log("Server key hash:", serverKeyHash);
      console.log("Match:", match ? "✅" : "❌");

      return match;
    } catch (error) {
      console.error("❌ Key sync verification failed:", error);
      return false;
    }
  }, [userId, getToken, API_BASE_URL]);

  /**
   * ✅ FIXED: Verify and re-upload key if needed before encrypting
   */
  const encryptFile = useCallback(
    async (
      fileUri: string,
      fileName: string
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

        // ✅ CRITICAL: Verify key sync before encrypting
        console.log("🔍 Verifying key synchronization...");
        const isKeySynced = await verifyKeySync();

        if (!isKeySynced) {
          console.warn("⚠️ Keys not synced! Re-uploading key to server...");
          
          // Re-upload key to ensure sync
          await simpleEncryptionService.uploadKeysToServer(
            API_BASE_URL,
            token
          );

          // Verify again
          const isSyncedNow = await verifyKeySync();
          if (!isSyncedNow) {
            throw new Error("Failed to sync encryption key with server");
          }

          console.log("✅ Key re-uploaded and verified");
        } else {
          console.log("✅ Keys already synced");
        }

        // ✅ Now encrypt file (key is guaranteed to be synced)
        const encryptionResult = await simpleEncryptionService.encryptFile(
          fileUri,
          fileName
        );

        // ✅ Determine MIME type from file name
        const mimeType = getMimeType(fileName);

        console.log("✅ File encrypted successfully:", {
          fileName,
          mimeType,
          originalSize: encryptionResult.metadata.original_size,
          encryptedSize: encryptionResult.metadata.encrypted_size,
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
    [isInitialized, getToken, verifyKeySync, API_BASE_URL]
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

        // ✅ Convert Uint8Array to Buffer
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
    verifyKeySync, // ✅ Export for debugging
  };
};