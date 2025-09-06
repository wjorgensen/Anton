import { EventEmitter } from 'events';

interface BufferConfig {
  maxSize: number;           // Maximum buffer size in bytes
  maxLines: number;          // Maximum number of lines
  flushInterval: number;     // Auto-flush interval in milliseconds
  compressionThreshold?: number; // Compress if buffer exceeds this size
}

interface BufferEntry {
  timestamp: number;
  content: string;
  size: number;
  type?: 'stdout' | 'stderr' | 'system';
}

export class BufferManager extends EventEmitter {
  private buffers: Map<string, BufferEntry[]> = new Map();
  private config: BufferConfig;
  private flushTimers: Map<string, NodeJS.Timer> = new Map();
  private stats: Map<string, BufferStats> = new Map();

  constructor(config: Partial<BufferConfig> = {}) {
    super();
    
    this.config = {
      maxSize: config.maxSize || 1024 * 1024,        // 1MB default
      maxLines: config.maxLines || 1000,             // 1000 lines default
      flushInterval: config.flushInterval || 100,    // 100ms default
      compressionThreshold: config.compressionThreshold || 512 * 1024 // 512KB
    };
  }

  /**
   * Add content to a buffer
   */
  add(id: string, content: string, type?: 'stdout' | 'stderr' | 'system'): void {
    if (!this.buffers.has(id)) {
      this.buffers.set(id, []);
      this.stats.set(id, new BufferStats());
      this.startAutoFlush(id);
    }

    const buffer = this.buffers.get(id)!;
    const stats = this.stats.get(id)!;
    const entry: BufferEntry = {
      timestamp: Date.now(),
      content,
      size: Buffer.byteLength(content, 'utf8'),
      type
    };

    buffer.push(entry);
    stats.addEntry(entry);

    // Check if we need to flush
    if (this.shouldFlush(id)) {
      this.flush(id);
    }
  }

  /**
   * Check if buffer should be flushed
   */
  private shouldFlush(id: string): boolean {
    const buffer = this.buffers.get(id);
    const stats = this.stats.get(id);
    
    if (!buffer || !stats) return false;

    // Check size limit
    if (stats.totalBytes >= this.config.maxSize) {
      return true;
    }

    // Check line limit
    if (buffer.length >= this.config.maxLines) {
      return true;
    }

    return false;
  }

  /**
   * Flush a specific buffer
   */
  flush(id: string): string | null {
    const buffer = this.buffers.get(id);
    if (!buffer || buffer.length === 0) return null;

    // Combine all entries
    const content = buffer.map(entry => entry.content).join('');
    
    // Clear the buffer
    this.buffers.set(id, []);
    
    // Reset stats
    const stats = this.stats.get(id);
    if (stats) {
      stats.reset();
    }

    // Emit flush event
    this.emit('flush', {
      id,
      content,
      entryCount: buffer.length,
      totalBytes: Buffer.byteLength(content, 'utf8'),
      timestamp: Date.now()
    });

    return content;
  }

  /**
   * Flush all buffers
   */
  flushAll(): Map<string, string> {
    const flushed = new Map<string, string>();
    
    for (const id of this.buffers.keys()) {
      const content = this.flush(id);
      if (content) {
        flushed.set(id, content);
      }
    }

    return flushed;
  }

  /**
   * Start auto-flush timer for a buffer
   */
  private startAutoFlush(id: string): void {
    if (this.flushTimers.has(id)) return;

    const timer = setInterval(() => {
      const buffer = this.buffers.get(id);
      if (buffer && buffer.length > 0) {
        this.flush(id);
      }
    }, this.config.flushInterval);

    this.flushTimers.set(id, timer);
  }

  /**
   * Stop auto-flush timer for a buffer
   */
  private stopAutoFlush(id: string): void {
    const timer = this.flushTimers.get(id);
    if (timer) {
      clearInterval(timer);
      this.flushTimers.delete(id);
    }
  }

  /**
   * Get buffer content without flushing
   */
  peek(id: string): string | null {
    const buffer = this.buffers.get(id);
    if (!buffer || buffer.length === 0) return null;

    return buffer.map(entry => entry.content).join('');
  }

  /**
   * Get buffer statistics
   */
  getStats(id: string): BufferStats | null {
    return this.stats.get(id) || null;
  }

  /**
   * Get all buffer statistics
   */
  getAllStats(): Map<string, BufferStats> {
    return new Map(this.stats);
  }

  /**
   * Clear a specific buffer
   */
  clear(id: string): void {
    this.buffers.delete(id);
    this.stats.delete(id);
    this.stopAutoFlush(id);
  }

  /**
   * Clear all buffers
   */
  clearAll(): void {
    for (const id of this.buffers.keys()) {
      this.clear(id);
    }
  }

  /**
   * Compress buffer content if needed
   */
  compress(content: string): Buffer | string {
    if (Buffer.byteLength(content, 'utf8') < (this.config.compressionThreshold || 0)) {
      return content;
    }

    // Use zlib for compression
    const zlib = require('zlib');
    return zlib.gzipSync(content);
  }

  /**
   * Decompress buffer content
   */
  decompress(content: Buffer | string): string {
    if (typeof content === 'string') {
      return content;
    }

    const zlib = require('zlib');
    return zlib.gunzipSync(content).toString('utf8');
  }

  /**
   * Destroy the buffer manager
   */
  destroy(): void {
    // Clear all timers
    for (const timer of this.flushTimers.values()) {
      clearInterval(timer);
    }
    
    // Flush remaining content
    this.flushAll();
    
    // Clear all data
    this.buffers.clear();
    this.stats.clear();
    this.flushTimers.clear();
    
    // Remove all listeners
    this.removeAllListeners();
  }
}

/**
 * Buffer statistics tracker
 */
class BufferStats {
  totalBytes: number = 0;
  totalEntries: number = 0;
  firstEntryTime: number | null = null;
  lastEntryTime: number | null = null;
  peakSize: number = 0;
  
  addEntry(entry: BufferEntry): void {
    this.totalBytes += entry.size;
    this.totalEntries++;
    
    if (!this.firstEntryTime) {
      this.firstEntryTime = entry.timestamp;
    }
    this.lastEntryTime = entry.timestamp;
    
    if (this.totalBytes > this.peakSize) {
      this.peakSize = this.totalBytes;
    }
  }
  
  reset(): void {
    this.totalBytes = 0;
    this.totalEntries = 0;
    this.firstEntryTime = null;
    this.lastEntryTime = null;
    // Keep peak size for historical reference
  }
  
  getAverageEntrySize(): number {
    return this.totalEntries > 0 ? this.totalBytes / this.totalEntries : 0;
  }
  
  getDuration(): number {
    if (!this.firstEntryTime || !this.lastEntryTime) return 0;
    return this.lastEntryTime - this.firstEntryTime;
  }
  
  getThroughput(): number {
    const duration = this.getDuration();
    return duration > 0 ? this.totalBytes / (duration / 1000) : 0;
  }
}

/**
 * Circular buffer for memory-efficient streaming
 */
export class CircularBuffer {
  private buffer: string[];
  private head: number = 0;
  private tail: number = 0;
  private size: number = 0;
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
    this.buffer = new Array(maxSize);
  }

  push(item: string): void {
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.maxSize;
    
    if (this.size < this.maxSize) {
      this.size++;
    } else {
      // Buffer is full, move head forward
      this.head = (this.head + 1) % this.maxSize;
    }
  }

  toArray(): string[] {
    const result: string[] = [];
    
    if (this.size === 0) return result;
    
    let i = this.head;
    for (let count = 0; count < this.size; count++) {
      result.push(this.buffer[i]);
      i = (i + 1) % this.maxSize;
    }
    
    return result;
  }

  toString(): string {
    return this.toArray().join('');
  }

  clear(): void {
    this.head = 0;
    this.tail = 0;
    this.size = 0;
    this.buffer = new Array(this.maxSize);
  }

  getSize(): number {
    return this.size;
  }

  isFull(): boolean {
    return this.size === this.maxSize;
  }
}