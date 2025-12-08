/**
 * 序列化服务
 * 使用 Web Worker 在后台线程中执行 JSON 序列化，避免阻塞主线程
 * 
 * 用于处理大型项目数据的序列化操作，防止 UI 冻结
 * 
 * ✅ 性能优化：
 * - 添加超时机制，防止长时间阻塞
 * - 添加请求取消功能
 * - 优化错误处理
 */

// ✅ 性能优化：序列化超时时间（毫秒）
const SERIALIZATION_TIMEOUT = 10000; // 10 秒超时

interface WorkerResponse {
  id: string;
  success: boolean;
  result?: string;
  error?: string;
}

interface PendingRequest {
  resolve: (value: string) => void;
  reject: (reason: any) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

class SerializationService {
  private worker: Worker | null = null;
  private pendingRequests: Map<string, PendingRequest>;
  private counter: number = 0;
  // ✅ 性能优化：跟踪是否正在序列化，防止并发序列化
  private isSerializing: boolean = false;
  private serializeQueue: Array<{ data: any; resolve: (value: string) => void; reject: (reason: any) => void }> = [];

  constructor() {
    this.pendingRequests = new Map();
    this.initWorker();
  }

  private initWorker(): void {
    try {
      // 创建 Worker，使用与 transformersWorker 相同的方式
      this.worker = new Worker(
        new URL('../workers/serializationWorker.ts', import.meta.url),
        { type: 'module' }
      );
    } catch (error) {
      console.error('[SerializationService] 创建 Worker 失败:', error);
      this.worker = null;
      return;
    }

    this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const { id, success, result, error } = e.data;
      const request = this.pendingRequests.get(id);

      if (request) {
        // ✅ 清除超时定时器
        clearTimeout(request.timeoutId);
        
        if (success && result !== undefined) {
          request.resolve(result);
        } else {
          request.reject(new Error(error || 'Serialization failed'));
        }
        this.pendingRequests.delete(id);
      }
      
      // ✅ 处理队列中的下一个请求
      this.isSerializing = false;
      this.processQueue();
    };

    this.worker.onerror = (error) => {
      console.error('[SerializationService] Worker 错误:', error);
      
      // 拒绝所有待处理的请求
      this.pendingRequests.forEach(request => {
        clearTimeout(request.timeoutId);
        request.reject(new Error('Worker crashed'));
      });
      this.pendingRequests.clear();
      
      // ✅ 尝试重新初始化 Worker
      this.worker = null;
      this.isSerializing = false;
      
      // 延迟重新初始化，避免快速重复失败
      setTimeout(() => {
        this.initWorker();
        this.processQueue();
      }, 1000);
    };
  }

  // ✅ 性能优化：处理序列化队列
  private processQueue(): void {
    if (this.isSerializing || this.serializeQueue.length === 0) {
      return;
    }

    const next = this.serializeQueue.shift();
    if (next) {
      this.doSerialize(next.data)
        .then(next.resolve)
        .catch(next.reject);
    }
  }

  // ✅ 实际执行序列化
  private async doSerialize(data: any): Promise<string> {
    // 如果 Worker 不可用，回退到主线程序列化
    if (!this.worker) {
      console.warn('[SerializationService] Worker 不可用，使用主线程序列化');
      // ✅ 使用 requestIdleCallback 延迟到空闲时执行，减少主线程阻塞
      return new Promise((resolve) => {
        if ('requestIdleCallback' in window) {
          (window as any).requestIdleCallback(() => {
            resolve(JSON.stringify(data));
          }, { timeout: 1000 });
        } else {
          setTimeout(() => resolve(JSON.stringify(data)), 0);
        }
      });
    }

    this.isSerializing = true;
    const id = `req_${++this.counter}_${Date.now()}`;
    
    return new Promise((resolve, reject) => {
      // ✅ 设置超时
      const timeoutId = setTimeout(() => {
        const request = this.pendingRequests.get(id);
        if (request) {
          this.pendingRequests.delete(id);
          this.isSerializing = false;
          console.warn('[SerializationService] 序列化超时，回退到主线程');
          // 超时后回退到主线程序列化
          try {
            resolve(JSON.stringify(data));
          } catch (e) {
            reject(e);
          }
          this.processQueue();
        }
      }, SERIALIZATION_TIMEOUT);

      this.pendingRequests.set(id, { resolve, reject, timeoutId });
      
      try {
        this.worker!.postMessage({
          id,
          type: 'stringify',
          data
        });
      } catch (error) {
        clearTimeout(timeoutId);
        this.pendingRequests.delete(id);
        this.isSerializing = false;
        reject(error);
        this.processQueue();
      }
    });
  }

  public async serialize(data: any): Promise<string> {
    // ✅ 性能优化：如果正在序列化，加入队列
    if (this.isSerializing) {
      return new Promise((resolve, reject) => {
        this.serializeQueue.push({ data, resolve, reject });
      });
    }

    return this.doSerialize(data);
  }

  // ✅ 清除待处理的序列化请求（用于取消操作）
  public clearPending(): void {
    this.serializeQueue = [];
  }

  public terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingRequests.forEach(request => {
      clearTimeout(request.timeoutId);
    });
    this.pendingRequests.clear();
    this.serializeQueue = [];
    this.isSerializing = false;
  }
}

// 导出单例实例

export const serializationService = new SerializationService();
