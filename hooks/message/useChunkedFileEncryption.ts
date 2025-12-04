// hooks/message/useChunkedFileEncryption.ts - TOKEN REFRESH FIX
import {
  ChunkedUploadProgress,
  chunkedUploadService,
} from "@/lib/encryption/ChunkedUploadService";
import {
  EncryptionProgress,
  nativeEncryptionService,
} from "@/lib/encryption/NativeEncryptionService";
import { useAuth } from "@clerk/clerk-expo";
import { useCallback, useState } from "react";
import { useEncryption } from "./useEncryption";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

export interface FileEncryptionOptions {
  onProgress?: (progress: EncryptionProgress | ChunkedUploadProgress) => void;
}

export interface EncryptedFileResult {
  encryptedBase64?: string; // For small files
  encryptedFileId?: string; // For large files (chunked upload)
  metadata: {
    iv: string;
    authTag: string;
    original_size: number;
    encrypted_size: number;
    file_name: string;
    file_type: string;
    chunks?: number;
  };
  isLargeFile: boolean;
  originalFileName: string;
  originalFileType: string;
  localUri: string;
}

export { ChunkedUploadProgress, EncryptionProgress };

export const useChunkedFileEncryption = () => {
  const { isInitialized } = useEncryption();
  const { getToken } = useAuth();
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [progress, setProgress] = useState<
    EncryptionProgress | ChunkedUploadProgress | null
  >(null);

  /**
   * ✅ ENHANCED: Encrypt and upload file with TOKEN REFRESH after encryption
   */
  const encryptFile = useCallback(
    async (
      fileUri: string,
      fileName: string,
      conversationId: string,
      recipientUserId?: string,
      options?: FileEncryptionOptions
    ): Promise<EncryptedFileResult> => {
      console.log("\n" + "=".repeat(60));
      console.log("🔒 [encryptFile] START");
      console.log("=".repeat(60));
      
      if (!isInitialized) {
        throw new Error("E2EE not initialized");
      }

      setIsEncrypting(true);
      setProgress(null);

      try {
        // ✅ STEP 1: Get file size
        console.log("📊 [STEP 1] Getting file size...");
        const fileSize = await nativeEncryptionService.getFileSize(fileUri);
        const fileSizeMB = fileSize / 1024 / 1024;
        
        console.log(`📦 File Info:`);
        console.log(`   Name: ${fileName}`);
        console.log(`   URI: ${fileUri}`);
        console.log(`   Size: ${fileSizeMB.toFixed(2)} MB (${fileSize} bytes)`);
        console.log(`   ConversationId: ${conversationId}`);
        console.log(`   RecipientId: ${recipientUserId || 'N/A'}`);

        // ✅ STEP 2: Check threshold
        console.log("\n📊 [STEP 2] Checking upload strategy...");
        const THRESHOLD_MB = 8;
        const THRESHOLD_BYTES = THRESHOLD_MB * 1024 * 1024;
        const isLargeFile = chunkedUploadService.shouldUseChunkedUpload(fileSize);

        console.log(`⚙️ Threshold: ${THRESHOLD_MB} MB (${THRESHOLD_BYTES} bytes)`);
        console.log(`⚙️ File size: ${fileSize} bytes`);
        console.log(`⚙️ Is larger than threshold? ${fileSize > THRESHOLD_BYTES}`);
        console.log(`⚙️ shouldUseChunkedUpload() returned: ${isLargeFile}`);
        console.log(`⚙️ Will use: ${isLargeFile ? "🚀 CHUNKED" : "📤 DIRECT"} upload`);

        // ✅ STEP 3: Route to correct method
        if (isLargeFile) {
          console.log("\n" + "=".repeat(60));
          console.log("🚀 [CHUNKED UPLOAD PATH]");
          console.log("=".repeat(60));

          // ✅ Pass getToken callback to service for token refresh
          const progressHandler = (p: ChunkedUploadProgress) => {
            console.log(`📊 Upload Progress: ${p.phase} - ${p.percentage}%`);
            setProgress(p);
            options?.onProgress?.(p);
          };

          console.log("📤 Calling chunkedUploadService.uploadEncryptedFile()...");
          const result = await chunkedUploadService.uploadEncryptedFile(
            fileUri,
            fileName,
            conversationId,
            getToken, // ✅ PASS getToken CALLBACK instead of token string
            progressHandler
          );

          console.log("\n✅ [CHUNKED UPLOAD COMPLETE]");
          console.log(`   Encrypted File ID: ${result.encryptedFileId}`);
          console.log(`   Total Chunks: ${result.metadata.chunks}`);
          console.log(`   Encrypted Size: ${(result.metadata.encrypted_size / 1024 / 1024).toFixed(2)} MB`);
          console.log("=".repeat(60) + "\n");

          return {
            encryptedFileId: result.encryptedFileId,
            metadata: result.metadata,
            isLargeFile: true,
            originalFileName: fileName,
            originalFileType: result.metadata.file_type,
            localUri: fileUri,
          };
        } else {
          console.log("\n" + "=".repeat(60));
          console.log("📤 [DIRECT UPLOAD PATH]");
          console.log("=".repeat(60));

          const progressHandler = (p: EncryptionProgress) => {
            console.log(`📊 Encryption Progress: ${p.phase} - ${p.percentage}%`);
            setProgress(p);
            options?.onProgress?.(p);
          };

          console.log("🔒 Calling nativeEncryptionService.encryptFile()...");
          const result = await nativeEncryptionService.encryptFile(
            fileUri,
            fileName,
            progressHandler
          );

          console.log("\n✅ [DIRECT ENCRYPTION COMPLETE]");
          console.log(`   Encrypted Size: ${(result.metadata.encrypted_size / 1024 / 1024).toFixed(2)} MB`);
          console.log(`   Base64 Length: ${result.encryptedBase64.length} chars`);
          console.log("=".repeat(60) + "\n");

          return {
            encryptedBase64: result.encryptedBase64,
            metadata: result.metadata,
            isLargeFile: false,
            originalFileName: fileName,
            originalFileType: result.metadata.file_type,
            localUri: fileUri,
          };
        }
      } catch (error) {
        console.error("\n" + "❌".repeat(30));
        console.error("❌ [encryptFile] ERROR");
        console.error("❌".repeat(30));
        console.error(error);
        console.error("❌".repeat(30) + "\n");
        throw error;
      } finally {
        setIsEncrypting(false);
      }
    },
    [isInitialized, getToken]
  );

  /**
   * Encrypt multiple files
   */
  const encryptFiles = useCallback(
    async (
      files: { uri: string; name: string; mimeType?: string }[],
      conversationId: string,
      recipientUserId?: string,
      onOverallProgress?: (
        current: number,
        total: number,
        fileName: string
      ) => void
    ): Promise<EncryptedFileResult[]> => {
      console.log(`\n📦 Encrypting ${files.length} files...`);
      const results: EncryptedFileResult[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`\n📁 File ${i + 1}/${files.length}: ${file.name}`);
        onOverallProgress?.(i + 1, files.length, file.name);

        const result = await encryptFile(
          file.uri,
          file.name,
          conversationId,
          recipientUserId
        );

        results.push(result);
      }

      console.log(`\n✅ All ${files.length} files encrypted successfully\n`);
      return results;
    },
    [encryptFile]
  );

  /**
   * Reset progress state
   */
  const resetProgress = useCallback(() => {
    setProgress(null);
    setIsEncrypting(false);
  }, []);

  return {
    encryptFile,
    encryptFiles,
    resetProgress,
    isEncrypting,
    progress,
    isReady: isInitialized,
  };
};