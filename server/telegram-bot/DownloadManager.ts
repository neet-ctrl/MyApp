import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { createWriteStream } from 'fs';

interface DownloadOptions {
  outputPath: string;
  filename?: string;
  maxRetries?: number;
  timeout?: number;
  headers?: Record<string, string>;
  progressCallback?: (progress: DownloadProgress) => void;
  resumeDownload?: boolean;
  downloadId?: string;
  onPartialProgress?: (info: { downloadId: string; downloadedBytes: number; totalBytes?: number; filePath: string; status: 'downloading' | 'paused' | 'completed' | 'failed' }) => void;
  onStatusChange?: (info: { downloadId: string; status: 'downloading' | 'resuming' | 'paused' | 'completed' | 'failed'; error?: string }) => void;
}

interface DownloadProgress {
  percentage: number;
  downloaded: number;
  total: number;
  speed: number;
  eta: number;
}

interface DownloadResult {
  success: boolean;
  filePath?: string;
  error?: string;
  size?: number;
}

export class DownloadManager {
  private activeDownloads: Map<string, {
    url: string;
    outputPath: string;
    startTime: number;
    resumeFromByte?: number;
    totalSize?: number;
    abortController: AbortController;
    writeStream: fs.WriteStream;
  }> = new Map();
  private downloadPaths: Map<string, string> = new Map();

  constructor() {
    this.initializePathMappings();
  }

  private initializePathMappings(): void {
    // Define download paths based on file types/patterns
    this.downloadPaths.set('video', 'downloads/video');
    this.downloadPaths.set('audio', 'downloads/audio');
    this.downloadPaths.set('image', 'downloads/images');
    this.downloadPaths.set('document', 'downloads/documents');
    this.downloadPaths.set('archive', 'downloads/archives');
    this.downloadPaths.set('default', 'downloads/misc');
  }

  async downloadDirectUrl(url: string, options: DownloadOptions): Promise<DownloadResult> {
    try {
      console.log('🌐 Starting direct URL download:', url);

      const downloadId = options.downloadId || this.generateDownloadId();
      const filename = options.filename || this.extractFilenameFromUrl(url);
      const outputPath = path.join(options.outputPath, filename);

      // Ensure directory exists
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Check for resumable download
      let resumeFromByte = 0;
      if (options.resumeDownload && fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath);
        resumeFromByte = stats.size;
        console.log(`📥 Resuming download from byte ${resumeFromByte}`);
      }

      // Start download (with resume support)
      const result = await this.performDownload(url, outputPath, options, downloadId, resumeFromByte);
      
      return result;

    } catch (error) {
      console.error('❌ Direct download error:', error);
      return {
        success: false,
        error: (error as Error).message || 'Unknown error'
      };
    }
  }

  private async performDownload(
    url: string, 
    outputPath: string, 
    options: DownloadOptions, 
    downloadId: string,
    resumeFromByte: number = 0
  ): Promise<DownloadResult> {
    
    const maxRetries = options.maxRetries || 3;
    const timeout = options.timeout || 300000; // 5 minutes

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📥 Download attempt ${attempt}/${maxRetries} for: ${path.basename(outputPath)}`);
        if (resumeFromByte > 0) {
          console.log(`📥 Resuming from byte ${resumeFromByte}`);
        }

        // Prepare headers for range request (resumable download)
        const headers: Record<string, string> = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          ...options.headers
        };

        // Add Range header for resumable download
        if (resumeFromByte > 0) {
          headers['Range'] = `bytes=${resumeFromByte}-`;
        }

        const abortController = new AbortController();
        
        const response = await axios({
          method: 'GET',
          url: url,
          responseType: 'stream',
          timeout: timeout,
          signal: abortController.signal,
          headers
        });

        // Handle resume response codes
        if (resumeFromByte > 0 && response.status === 200) {
          // Server doesn't support range requests, restart from beginning
          console.log('⚠️ Server does not support range requests, restarting download');
          if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
          }
          resumeFromByte = 0;
        }

        const contentLength = parseInt(response.headers['content-length'] || '0');
        const totalSize = resumeFromByte > 0 ? resumeFromByte + contentLength : contentLength;
        let downloadedSize = resumeFromByte;
        let lastProgressUpdate = Date.now();

        // Create write stream (append mode for resume)
        const writeStream = resumeFromByte > 0 
          ? createWriteStream(outputPath, { flags: 'a' })
          : createWriteStream(outputPath);
        
        this.activeDownloads.set(downloadId, {
          url,
          outputPath,
          startTime: Date.now(),
          resumeFromByte,
          totalSize,
          abortController,
          writeStream
        });

        return new Promise((resolve, reject) => {
          response.data.on('data', (chunk: Buffer) => {
            downloadedSize += chunk.length;
            
            // Update progress
            if (options.progressCallback && totalSize > 0) {
              const now = Date.now();
              if (now - lastProgressUpdate > 1000) { // Update every second
                const percentage = Math.round((downloadedSize / totalSize) * 100);
                const speed = this.calculateSpeed(downloadedSize - resumeFromByte, Date.now() - this.activeDownloads.get(downloadId)?.startTime);
                const eta = this.calculateETA(downloadedSize, totalSize, speed);

                options.progressCallback({
                  percentage,
                  downloaded: downloadedSize,
                  total: totalSize,
                  speed,
                  eta
                });

                // Persist progress for resumability
                options.onPartialProgress?.({
                  downloadId,
                  downloadedBytes: downloadedSize,
                  totalBytes: totalSize,
                  filePath: outputPath,
                  status: 'downloading'
                });

                lastProgressUpdate = now;
              }
            }
          });

          response.data.on('error', (error: Error) => {
            console.error('❌ Download stream error:', error);
            writeStream.destroy();
            this.activeDownloads.delete(downloadId);
            
            // Persist error state
            const paused = (error as any).code === 'ERR_CANCELED' || error.name === 'CanceledError';
            options.onPartialProgress?.({ 
              downloadId, 
              downloadedBytes: this.getPartialFileSize(outputPath), 
              totalBytes: totalSize, 
              filePath: outputPath, 
              status: paused ? 'paused' : 'failed' 
            });
            options.onStatusChange?.({ 
              downloadId, 
              status: paused ? 'paused' : 'failed', 
              error: paused ? undefined : (error as Error).message 
            });
            
            // Handle abort gracefully - don't delete partial file
            if (paused) {
              console.log('⏸️ Download aborted (paused)');
              resolve({
                success: false,
                error: 'Download paused'
              });
            } else {
              reject(error);
            }
          });

          writeStream.on('error', (error: Error) => {
            console.error('❌ Write stream error:', error);
            this.activeDownloads.delete(downloadId);
            reject(error);
          });

          writeStream.on('finish', () => {
            this.activeDownloads.delete(downloadId);
            console.log('✅ Download completed:', outputPath);
            
            // Persist completion state
            options.onPartialProgress?.({ 
              downloadId, 
              downloadedBytes: downloadedSize, 
              totalBytes: totalSize, 
              filePath: outputPath, 
              status: 'completed' 
            });
            options.onStatusChange?.({ 
              downloadId, 
              status: 'completed' 
            });
            
            resolve({
              success: true,
              filePath: outputPath,
              size: downloadedSize
            });
          });

          response.data.pipe(writeStream);
        });

      } catch (error) {
        const errorMsg = (error as Error).message || 'Unknown error';
        console.error(`❌ Download attempt ${attempt} failed:`, errorMsg);
        
        if (attempt === maxRetries) {
          this.activeDownloads.delete(downloadId);
          return {
            success: false,
            error: errorMsg
          };
        }

        // For resume attempts, check if partial file is corrupted
        if (resumeFromByte > 0 && fs.existsSync(outputPath)) {
          const stats = fs.statSync(outputPath);
          if (stats.size < resumeFromByte) {
            console.log('⚠️ Partial file appears corrupted, restarting download');
            fs.unlinkSync(outputPath);
            resumeFromByte = 0;
          }
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
    }

    return {
      success: false,
      error: 'Max retries exceeded'
    };
  }

  private calculateSpeed(downloaded: number, timeElapsed: number): number {
    if (timeElapsed === 0) return 0;
    return Math.round(downloaded / (timeElapsed / 1000)); // bytes per second
  }

  private calculateETA(downloaded: number, total: number, speed: number): number {
    if (speed === 0 || downloaded >= total) return 0;
    return Math.round((total - downloaded) / speed); // seconds
  }

  private extractFilenameFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      let filename = path.basename(pathname);
      
      // If no filename found, generate one
      if (!filename || filename === '/' || !filename.includes('.')) {
        const extension = this.guessExtensionFromUrl(url);
        filename = `download_${Date.now()}.${extension}`;
      }
      
      return this.sanitizeFilename(filename);
    } catch (error) {
      return `download_${Date.now()}.bin`;
    }
  }

  private guessExtensionFromUrl(url: string): string {
    const commonExtensions = [
      'mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm',
      'mp3', 'wav', 'flac', 'aac', 'ogg',
      'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp',
      'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
      'zip', 'rar', '7z', 'tar', 'gz'
    ];

    for (const ext of commonExtensions) {
      if (url.toLowerCase().includes(`.${ext}`)) {
        return ext;
      }
    }

    return 'bin';
  }

  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, '_')
      .trim()
      .substring(0, 200);
  }

  private generateDownloadId(): string {
    return `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getDownloadPath(fileType: string, filename?: string): string {
    // Determine file type from filename
    const type = this.determineFileType(filename || '');
    const basePath = this.downloadPaths.get(type) || this.downloadPaths.get('default')!;
    
    // Create full path
    const fullPath = path.join(process.cwd(), basePath);
    
    // Ensure directory exists
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
    
    return fullPath;
  }

  private determineFileType(filename: string): string {
    const extension = path.extname(filename).toLowerCase();
    
    const typeMap: Record<string, string> = {
      // Video
      '.mp4': 'video', '.avi': 'video', '.mkv': 'video', '.mov': 'video',
      '.wmv': 'video', '.flv': 'video', '.webm': 'video', '.m4v': 'video',
      
      // Audio
      '.mp3': 'audio', '.wav': 'audio', '.flac': 'audio', '.aac': 'audio',
      '.ogg': 'audio', '.wma': 'audio', '.m4a': 'audio',
      
      // Images
      '.jpg': 'image', '.jpeg': 'image', '.png': 'image', '.gif': 'image',
      '.bmp': 'image', '.webp': 'image', '.tiff': 'image', '.svg': 'image',
      
      // Documents
      '.pdf': 'document', '.doc': 'document', '.docx': 'document',
      '.xls': 'document', '.xlsx': 'document', '.ppt': 'document',
      '.pptx': 'document', '.txt': 'document', '.rtf': 'document',
      
      // Archives
      '.zip': 'archive', '.rar': 'archive', '.7z': 'archive',
      '.tar': 'archive', '.gz': 'archive', '.bz2': 'archive'
    };
    
    return typeMap[extension] || 'default';
  }

  organizeFileByPattern(filename: string, patterns: Record<string, string>): string {
    for (const [pattern, targetPath] of Object.entries(patterns)) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(filename)) {
        const fullPath = path.join(process.cwd(), targetPath);
        if (!fs.existsSync(fullPath)) {
          fs.mkdirSync(fullPath, { recursive: true });
        }
        return fullPath;
      }
    }
    
    return this.getDownloadPath('default');
  }

  async validateDownload(filePath: string, expectedSize?: number): Promise<boolean> {
    try {
      if (!fs.existsSync(filePath)) {
        return false;
      }

      const stats = fs.statSync(filePath);
      
      // Check if file is not empty
      if (stats.size === 0) {
        return false;
      }

      // Check expected size if provided
      if (expectedSize && Math.abs(stats.size - expectedSize) > 1024) { // Allow 1KB difference
        console.warn(`Size mismatch: expected ${expectedSize}, got ${stats.size}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error validating download:', error);
      return false;
    }
  }

  async retryFailedDownload(url: string, originalPath: string, options: DownloadOptions): Promise<DownloadResult> {
    console.log('🔄 Retrying failed download:', url);
    
    // Try to resume download instead of restarting
    if (fs.existsSync(originalPath)) {
      const stats = fs.statSync(originalPath);
      if (stats.size > 0) {
        console.log(`📥 Attempting to resume download from ${stats.size} bytes`);
        options.resumeDownload = true;
        return this.downloadDirectUrl(url, options);
      } else {
        // File is empty, remove it
        try {
          fs.unlinkSync(originalPath);
        } catch (error) {
          console.error('Error removing empty file:', error);
        }
      }
    }
    
    return this.downloadDirectUrl(url, options);
  }

  getActiveDownloads(): Array<{ id: string; url: string; outputPath: string; startTime: number; resumeFromByte?: number; totalSize?: number }> {
    return Array.from(this.activeDownloads.entries()).map(([id, info]) => ({
      id,
      ...info
    }));
  }

  cancelDownload(downloadId: string): boolean {
    if (this.activeDownloads.has(downloadId)) {
      this.activeDownloads.delete(downloadId);
      console.log('❌ Download cancelled:', downloadId);
      return true;
    }
    return false;
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatSpeed(bytesPerSecond: number): string {
    return this.formatFileSize(bytesPerSecond) + '/s';
  }

  formatTime(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }

  // Resume functionality
  async resumeDownload(downloadId: string, url: string, outputPath: string, options: DownloadOptions): Promise<DownloadResult> {
    console.log('🔄 Resuming download:', downloadId);
    
    options.resumeDownload = true;
    options.downloadId = downloadId;
    
    return this.downloadDirectUrl(url, options);
  }

  async pauseDownload(downloadId: string): Promise<boolean> {
    const entry = this.activeDownloads.get(downloadId);
    if (entry) {
      console.log('⏸️ Pausing download:', downloadId);
      entry.abortController.abort();
      entry.writeStream.close();
      this.activeDownloads.delete(downloadId);
      return true;
    }
    return false;
  }

  getPartialFileSize(filePath: string): number {
    try {
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        return stats.size;
      }
      return 0;
    } catch (error) {
      console.error('Error checking partial file size:', error);
      return 0;
    }
  }

  isDownloadResumable(filePath: string, totalSize?: number): boolean {
    if (!fs.existsSync(filePath)) return false;
    
    const partialSize = this.getPartialFileSize(filePath);
    if (partialSize === 0) return false;
    
    // If we know the total size, check if partial file is not already complete
    if (totalSize && partialSize >= totalSize) return false;
    
    return true;
  }

  async checkServerSupportsResume(url: string): Promise<boolean> {
    try {
      const response = await axios.head(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      return response.headers['accept-ranges'] === 'bytes';
    } catch (error) {
      console.error('Error checking server resume support:', error);
      return false;
    }
  }

  async initializeAutoResume(
    pending: Array<{ downloadId: string; url: string; filePath: string; totalSize?: number }>,
    optionsFactory: (p: { downloadId: string; url: string; filePath: string; totalSize?: number }) => DownloadOptions
  ): Promise<void> {
    console.log('🔄 Initializing auto-resume for', pending.length, 'downloads...');
    
    for (const p of pending) {
      try {
        const resumable = this.isDownloadResumable(p.filePath, p.totalSize);
        const serverSupports = await this.checkServerSupportsResume(p.url);
        
        if (resumable && serverSupports) {
          console.log(`📥 Auto-resuming download: ${path.basename(p.filePath)}`);
          const opts = { ...optionsFactory(p), resumeDownload: true, downloadId: p.downloadId };
          await this.resumeDownload(p.downloadId, p.url, p.filePath, opts);
        } else {
          console.log(`⚠️ Cannot resume download: ${path.basename(p.filePath)} (resumable: ${resumable}, server supports: ${serverSupports})`);
          optionsFactory(p).onStatusChange?.({ 
            downloadId: p.downloadId, 
            status: 'failed', 
            error: 'Cannot resume - file corrupted or server does not support range requests' 
          });
        }
      } catch (e) {
        console.error(`❌ Failed to auto-resume download ${p.downloadId}:`, (e as Error).message);
        optionsFactory(p).onStatusChange?.({ 
          downloadId: p.downloadId, 
          status: 'failed', 
          error: (e as Error).message 
        });
      }
    }
    
    console.log('✅ Auto-resume initialization complete');
  }
}