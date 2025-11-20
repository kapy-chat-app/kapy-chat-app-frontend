// lib/encryption/ChunkedEncryptionService.ts
// Chunked encryption for large files (video, documents, etc.) with progress tracking

import { Buffer } from "buffer";
import CryptoJS from "crypto-js";
import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";

global.Buffer = Buffer;

// =============================================
// TYPES & INTERFACES
// =============================================

export interface ChunkInfo {
  index: number;
  iv: string;
  authTag: string;
  encryptedData: string;
  originalSize: number;
  encryptedSize: number;
}

export interface ChunkedEncryptionResult {
  fileId: string;
  fileName: string;
  fileType: string;
  totalChunks: number;
  originalSize: number;
  encryptedSize: number;
  chunks: ChunkInfo[];
  masterIv: string;
  masterAuthTag: string;
}

export interface EncryptionProgress {
  phase: 'reading' | 'encrypting' | 'finalizing';
  currentChunk: number;
  totalChunks: number;
  percentage: number;
  bytesProcessed: number;
  totalBytes: number;
}

export type ProgressCallback = (progress: EncryptionProgress) => void;

// =============================================
// CONSTANTS
// =============================================

const CHUNK_SIZE = 512 * 1024; // 512KB per chunk - balance between memory and performance
const LARGE_FILE_THRESHOLD = 5 * 1024 * 1024; // 5MB - files larger than this use chunked encryption
const ENCRYPTION_KEY_STORE = "e2ee_encryption_key";

// =============================================
// CHUNKED ENCRYPTION SERVICE
// =============================================

export class ChunkedEncryptionService {
  private keyCache: string | null = null;

  /**
   * Get encryption key from secure storage
   */
  private async getEncryptionKey(): Promise<string> {
    if (this.keyCache) {
      return this.keyCache;
    }

    const key = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORE);
    if (!key) {
      throw new Error("Encryption key not found. Please initialize E2EE first.");
    }

    this.keyCache = key;
    return key;
  }

  /**
   * Get MIME type from filename
   */
  private getMimeType(fileName: string): string {
    const ext = fileName.split(".").pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      // Video
      mp4: "video/mp4",
      mov: "video/quicktime",
      avi: "video/x-msvideo",
      mkv: "video/x-matroska",
      webm: "video/webm",
      m4v: "video/x-m4v",
      "3gp": "video/3gpp",
      // Audio
      mp3: "audio/mpeg",
      wav: "audio/wav",
      m4a: "audio/mp4",
      aac: "audio/aac",
      ogg: "audio/ogg",
      flac: "audio/flac",
      // Images
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
      heic: "image/heic",
      // Documents
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ppt: "application/vnd.ms-powerpoint",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      txt: "text/plain",
      // Archives
      zip: "application/zip",
      rar: "application/x-rar-compressed",
      "7z": "application/x-7z-compressed",
      tar: "application/x-tar",
      gz: "application/gzip",
    };
    return mimeTypes[ext || ""] || "application/octet-stream";
  }

  /**
   * Check if file should use chunked encryption
   */
  async shouldUseChunkedEncryption(fileUri: string): Promise<boolean> {
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) {
      throw new Error("File not found: " + fileUri);
    }
    const fileSize = (fileInfo as any).size || 0;
    return fileSize > LARGE_FILE_THRESHOLD;
  }

  /**
   * Get file size
   */
  async getFileSize(fileUri: string): Promise<number> {
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) {
      throw new Error("File not found: " + fileUri);
    }
    return (fileInfo as any).size || 0;
  }

  /**
   * Encrypt a large file in chunks with progress tracking
   */
  async encryptFileChunked(
    fileUri: string,
    fileName: string,
    onProgress?: ProgressCallback
  ): Promise<ChunkedEncryptionResult> {
    try {
      const encryptionKey = await this.getEncryptionKey();
      const keyHash = CryptoJS.SHA256(encryptionKey).toString(CryptoJS.enc.Hex);
      console.log("🔑 ENCRYPT with key SHA256:", keyHash);

      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!fileInfo.exists) {
        throw new Error("File not found: " + fileUri);
      }

      const fileSize = (fileInfo as any).size || 0;
      const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
      const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const fileType = this.getMimeType(fileName);

      console.log(`📦 Encrypting ${fileName}`);
      console.log(`   Size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Chunks: ${totalChunks}`);
      console.log(`   Type: ${fileType}`);

      // Read entire file first (expo-file-system doesn't support position/length well)
      onProgress?.({
        phase: 'reading',
        currentChunk: 0,
        totalChunks,
        percentage: 0,
        bytesProcessed: 0,
        totalBytes: fileSize,
      });

      console.log("📖 Reading file...");
      const fullBase64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      console.log("✅ File read complete");

      // Process in chunks
      const chunks: ChunkInfo[] = [];
      let totalEncryptedSize = 0;
      const aesKey = CryptoJS.SHA256(encryptionKey);

      // Calculate chunk positions in base64
      // Base64 encodes 3 bytes into 4 characters
      const base64ChunkSize = Math.ceil((CHUNK_SIZE * 4) / 3);

      for (let i = 0; i < totalChunks; i++) {
        const start = i * base64ChunkSize;
        const end = Math.min(start + base64ChunkSize, fullBase64.length);
        const chunkBase64 = fullBase64.substring(start, end);

        // Report progress - encrypting phase
        onProgress?.({
          phase: 'encrypting',
          currentChunk: i + 1,
          totalChunks,
          percentage: 10 + ((i / totalChunks) * 85), // 10-95%
          bytesProcessed: Math.min((i + 1) * CHUNK_SIZE, fileSize),
          totalBytes: fileSize,
        });

        // Generate IV for this chunk
        const ivArray = await Crypto.getRandomBytesAsync(16);
        const iv = CryptoJS.lib.WordArray.create(ivArray as any);

        // Parse chunk data
        const plaintext = CryptoJS.enc.Base64.parse(chunkBase64);

        // Encrypt chunk - use setTimeout to prevent UI freeze
        const encrypted = await new Promise<CryptoJS.lib.CipherParams>((resolve) => {
          setTimeout(() => {
            const result = CryptoJS.AES.encrypt(plaintext, aesKey, {
              iv: iv,
              mode: CryptoJS.mode.CBC,
              padding: CryptoJS.pad.Pkcs7,
            });
            resolve(result);
          }, 1);
        });

        const encryptedBase64 = encrypted.ciphertext.toString(CryptoJS.enc.Base64);

        // Generate auth tag for this chunk (includes index for ordering)
        const hmacInput = `${encryptionKey}:${fileId}:${i}:${encryptedBase64}`;
        const authTag = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          hmacInput
        );

        // Calculate original size for this chunk
        const originalChunkSize = Math.ceil(chunkBase64.length * 3 / 4);

        const chunkInfo: ChunkInfo = {
          index: i,
          iv: Buffer.from(ivArray).toString("base64"),
          authTag,
          encryptedData: encryptedBase64,
          originalSize: originalChunkSize,
          encryptedSize: encryptedBase64.length,
        };

        chunks.push(chunkInfo);
        totalEncryptedSize += encryptedBase64.length;

        console.log(`✅ Chunk ${i + 1}/${totalChunks} encrypted`);
      }

      // Generate master auth tag for entire file
      const chunkAuthTags = chunks.map(c => c.authTag).join(":");
      const masterHmacInput = `${encryptionKey}:${fileId}:master:${chunkAuthTags}`;
      const masterAuthTag = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        masterHmacInput
      );

      // Generate master IV (for metadata)
      const masterIvArray = await Crypto.getRandomBytesAsync(16);
      const masterIv = Buffer.from(masterIvArray).toString("base64");

      // Report progress - finalizing
      onProgress?.({
        phase: 'finalizing',
        currentChunk: totalChunks,
        totalChunks,
        percentage: 100,
        bytesProcessed: fileSize,
        totalBytes: fileSize,
      });

      const result: ChunkedEncryptionResult = {
        fileId,
        fileName,
        fileType,
        totalChunks,
        originalSize: fileSize,
        encryptedSize: totalEncryptedSize,
        chunks,
        masterIv,
        masterAuthTag,
      };

      console.log(`✅ File encryption complete`);
      console.log(`   Original: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Encrypted: ${(totalEncryptedSize / 1024 / 1024).toFixed(2)} MB`);

      return result;
    } catch (error) {
      console.error("❌ Chunked encryption failed:", error);
      throw error;
    }
  }

  /**
   * Decrypt a chunked encrypted file
   */
  async decryptFileChunked(
    encryptedResult: ChunkedEncryptionResult,
    senderKey: string,
    onProgress?: ProgressCallback
  ): Promise<Uint8Array> {
    try {
      console.log(`🔓 Decrypting ${encryptedResult.fileName}`);
      console.log(`   Chunks: ${encryptedResult.totalChunks}`);

      const keyHash = CryptoJS.SHA256(senderKey).toString(CryptoJS.enc.Hex);
      console.log("🔑 DECRYPT with sender key SHA256:", keyHash);

      // Verify master auth tag
      const chunkAuthTags = encryptedResult.chunks.map(c => c.authTag).join(":");
      const expectedMasterHmac = `${senderKey}:${encryptedResult.fileId}:master:${chunkAuthTags}`;
      const expectedMasterAuth = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        expectedMasterHmac
      );

      if (expectedMasterAuth !== encryptedResult.masterAuthTag) {
        throw new Error("Master auth tag mismatch - file integrity check failed");
      }

      console.log("✅ Master auth tag verified");

      const aesKey = CryptoJS.SHA256(senderKey);
      const decryptedChunks: string[] = [];

      for (const chunk of encryptedResult.chunks) {
        onProgress?.({
          phase: 'encrypting', // reuse for decrypting
          currentChunk: chunk.index + 1,
          totalChunks: encryptedResult.totalChunks,
          percentage: ((chunk.index + 1) / encryptedResult.totalChunks) * 100,
          bytesProcessed: chunk.index * CHUNK_SIZE,
          totalBytes: encryptedResult.originalSize,
        });

        // Verify chunk auth tag
        const expectedHmac = `${senderKey}:${encryptedResult.fileId}:${chunk.index}:${chunk.encryptedData}`;
        const expectedAuth = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          expectedHmac
        );

        if (expectedAuth !== chunk.authTag) {
          throw new Error(`Chunk ${chunk.index} auth tag mismatch`);
        }

        // Decrypt chunk
        const decrypted = CryptoJS.AES.decrypt(
          { ciphertext: CryptoJS.enc.Base64.parse(chunk.encryptedData) } as any,
          aesKey,
          {
            iv: CryptoJS.enc.Base64.parse(chunk.iv),
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7,
          }
        );

        const decryptedBase64 = decrypted.toString(CryptoJS.enc.Base64);
        if (!decryptedBase64) {
          throw new Error(`Chunk ${chunk.index} decryption failed`);
        }

        decryptedChunks.push(decryptedBase64);
        console.log(`✅ Chunk ${chunk.index + 1}/${encryptedResult.totalChunks} decrypted`);
      }

      // Combine all chunks
      const fullBase64 = decryptedChunks.join('');
      const result = new Uint8Array(Buffer.from(fullBase64, "base64"));

      console.log(`✅ File decryption complete: ${result.length} bytes`);

      return result;
    } catch (error) {
      console.error("❌ Chunked decryption failed:", error);
      throw error;
    }
  }

  /**
   * Clear key cache
   */
  clearCache(): void {
    this.keyCache = null;
  }
}

// Export singleton instance
export const chunkedEncryptionService = new ChunkedEncryptionService();