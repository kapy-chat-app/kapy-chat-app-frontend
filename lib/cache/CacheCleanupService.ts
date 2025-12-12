// lib/cache/CacheCleanupService.ts - AUTO CLEANUP
import * as FileSystem from 'expo-file-system/legacy';

export class CacheCleanupService {
  private static cleanupInterval: NodeJS.Timeout | null = null;

  /**
   * ✅ Start automatic cleanup (run every 6 hours)
   */
  static startAutoCleanup(daysOld: number = 7): void {
    if (this.cleanupInterval) {
      console.log('⚠️ [CACHE] Auto-cleanup already running');
      return;
    }

    console.log(`✅ [CACHE] Starting auto-cleanup (${daysOld} days old)`);
    
    // Run immediately
    this.cleanOldFiles(daysOld);

    // Then every 6 hours
    this.cleanupInterval = setInterval(() => {
      this.cleanOldFiles(daysOld);
    }, 6 * 60 * 60 * 1000);
  }

  /**
   * ✅ Stop automatic cleanup
   */
  static stopAutoCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('✅ [CACHE] Stopped auto-cleanup');
    }
  }

  /**
   * ✅ Delete decrypted files older than X days
   */
  static async cleanOldFiles(daysOld: number = 7): Promise<void> {
    try {
      console.log(`🧹 [CACHE] Cleaning files older than ${daysOld} days...`);

      const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      if (!baseDir) {
        console.warn('⚠️ [CACHE] No base directory available');
        return;
      }

      const decryptedDir = `${baseDir}decrypted/`;
      const dirInfo = await FileSystem.getInfoAsync(decryptedDir);
      
      if (!dirInfo.exists) {
        console.log('📭 [CACHE] No decrypted folder found');
        return;
      }

      const files = await FileSystem.readDirectoryAsync(decryptedDir);
      const now = Date.now();
      const maxAge = daysOld * 24 * 60 * 60 * 1000;

      let deletedCount = 0;
      let deletedSize = 0;

      for (const file of files) {
        const filePath = `${decryptedDir}${file}`;
        
        try {
          const fileInfo = await FileSystem.getInfoAsync(filePath);
          
          if (fileInfo.exists) {
            const fileAge = now - ((fileInfo as any).modificationTime || 0);
            
            if (fileAge > maxAge) {
              const fileSize = (fileInfo as any).size || 0;
              await FileSystem.deleteAsync(filePath, { idempotent: true });
              deletedCount++;
              deletedSize += fileSize;
            }
          }
        } catch (error) {
          console.warn(`⚠️ [CACHE] Failed to delete ${file}:`, error);
        }
      }

      if (deletedCount > 0) {
        console.log(
          `✅ [CACHE] Cleaned ${deletedCount} files (${this.formatBytes(deletedSize)})`
        );
      } else {
        console.log('✅ [CACHE] No old files to clean');
      }
    } catch (error) {
      console.error('❌ [CACHE] Failed to clean old files:', error);
    }
  }

  /**
   * ✅ Get total cache size
   */
  static async getCacheSize(): Promise<number> {
    try {
      const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      if (!baseDir) return 0;

      const decryptedDir = `${baseDir}decrypted/`;
      const dirInfo = await FileSystem.getInfoAsync(decryptedDir);
      
      if (!dirInfo.exists) return 0;

      const files = await FileSystem.readDirectoryAsync(decryptedDir);
      let totalSize = 0;

      for (const file of files) {
        try {
          const filePath = `${decryptedDir}${file}`;
          const fileInfo = await FileSystem.getInfoAsync(filePath);
          
          if (fileInfo.exists) {
            totalSize += (fileInfo as any).size || 0;
          }
        } catch (error) {
          // Skip files that can't be accessed
        }
      }

      return totalSize;
    } catch (error) {
      console.error('❌ [CACHE] Failed to get cache size:', error);
      return 0;
    }
  }

  /**
   * ✅ Get cache statistics
   */
  static async getCacheStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    oldestFile: Date | null;
    newestFile: Date | null;
  }> {
    try {
      const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      if (!baseDir) {
        return { totalFiles: 0, totalSize: 0, oldestFile: null, newestFile: null };
      }

      const decryptedDir = `${baseDir}decrypted/`;
      const dirInfo = await FileSystem.getInfoAsync(decryptedDir);
      
      if (!dirInfo.exists) {
        return { totalFiles: 0, totalSize: 0, oldestFile: null, newestFile: null };
      }

      const files = await FileSystem.readDirectoryAsync(decryptedDir);
      let totalSize = 0;
      let oldestTime = Infinity;
      let newestTime = 0;

      for (const file of files) {
        try {
          const filePath = `${decryptedDir}${file}`;
          const fileInfo = await FileSystem.getInfoAsync(filePath);
          
          if (fileInfo.exists) {
            const size = (fileInfo as any).size || 0;
            const mtime = (fileInfo as any).modificationTime || 0;

            totalSize += size;
            if (mtime < oldestTime) oldestTime = mtime;
            if (mtime > newestTime) newestTime = mtime;
          }
        } catch (error) {
          // Skip files that can't be accessed
        }
      }

      return {
        totalFiles: files.length,
        totalSize,
        oldestFile: oldestTime < Infinity ? new Date(oldestTime) : null,
        newestFile: newestTime > 0 ? new Date(newestTime) : null,
      };
    } catch (error) {
      console.error('❌ [CACHE] Failed to get cache stats:', error);
      return { totalFiles: 0, totalSize: 0, oldestFile: null, newestFile: null };
    }
  }

  /**
   * ✅ Clear entire cache
   */
  static async clearAllCache(): Promise<void> {
    try {
      console.log('🗑️ [CACHE] Clearing all cache...');

      const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      if (!baseDir) {
        console.warn('⚠️ [CACHE] No base directory available');
        return;
      }

      const decryptedDir = `${baseDir}decrypted/`;
      const dirInfo = await FileSystem.getInfoAsync(decryptedDir);
      
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(decryptedDir, { idempotent: true });
        console.log('✅ [CACHE] All cache cleared');
      } else {
        console.log('📭 [CACHE] No cache to clear');
      }
    } catch (error) {
      console.error('❌ [CACHE] Failed to clear cache:', error);
    }
  }

  /**
   * ✅ Format bytes to human readable
   */
  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * ✅ Log cache statistics
   */
  static async logStats(): Promise<void> {
    const stats = await this.getCacheStats();
    console.log('\n📊 [CACHE] Statistics:');
    console.log(`   Files: ${stats.totalFiles}`);
    console.log(`   Size: ${this.formatBytes(stats.totalSize)}`);
    console.log(`   Oldest: ${stats.oldestFile?.toLocaleString() || 'N/A'}`);
    console.log(`   Newest: ${stats.newestFile?.toLocaleString() || 'N/A'}`);
  }
}

/**
 * ✅ USAGE EXAMPLE:
 * 
 * // In your App.tsx or main layout:
 * 
 * import { CacheCleanupService } from '@/lib/cache/CacheCleanupService';
 * 
 * useEffect(() => {
 *   // Start auto-cleanup on app start
 *   CacheCleanupService.startAutoCleanup(7); // Clean files older than 7 days
 * 
 *   return () => {
 *     // Stop on unmount
 *     CacheCleanupService.stopAutoCleanup();
 *   };
 * }, []);
 * 
 * // Manual cleanup:
 * await CacheCleanupService.cleanOldFiles(3); // Clean files older than 3 days
 * 
 * // Check cache size:
 * const size = await CacheCleanupService.getCacheSize();
 * console.log(`Cache: ${CacheCleanupService.formatBytes(size)}`);
 * 
 * // View stats:
 * await CacheCleanupService.logStats();
 * 
 * // Clear all:
 * await CacheCleanupService.clearAllCache();
 */