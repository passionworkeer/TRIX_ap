/**
 * Connection Manager - 统一的 WebSocket 连接管理
 *
 * 功能：
 * - 连接池管理
 * - 统一的心跳机制
 * - 统一的重连逻辑
 * - 防止重复连接
 * - 自动清理
 */

interface ConnectionOptions {
  heartbeatInterval?: number; // 心跳间隔（ms）
  reconnect?: boolean; // 是否自动重连
  reconnectDelay?: number; // 重连延迟（ms）
  reconnectAttempts?: number; // 最大重连次数
  onMessage?: (data: unknown) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: unknown) => void;
}

interface ConnectionState {
  socket: WebSocket | null;
  url: string;
  isConnected: boolean;
  lastPing: number;
  heartbeatTimer: ReturnType<typeof setInterval> | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  reconnectAttempts: number;
  options: ConnectionOptions;
  listeners: Map<string, Set<(data: unknown) => void>>;
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';

class ConnectionManager {
  private connections = new Map<string, ConnectionState>();
  private isMounted = true; // 防止组件卸载后更新状态

  /**
   * 创建或获取 WebSocket 连接
   */
  connect(id: string, url: string, options: ConnectionOptions = {}): WebSocket | null {
    // 检查是否已存在连接
    if (this.connections.has(id)) {
      const existing = this.connections.get(id)!;
      if (existing.isConnected && existing.socket?.readyState === WebSocket.OPEN) {
        console.log(`[ConnectionManager] 复用现有连接: ${id}`);
        return existing.socket;
      }
      // 连接已断开，清理后重新创建
      this.disconnect(id);
    }

    console.log(`[ConnectionManager] 创建新连接: ${id} -> ${url}`);

    // 创建新连接状态
    const state: ConnectionState = {
      socket: null,
      url,
      isConnected: false,
      lastPing: Date.now(),
      heartbeatTimer: null,
      reconnectTimer: null,
      reconnectAttempts: 0,
      options: {
        heartbeatInterval: 30000,
        reconnect: true,
        reconnectDelay: 2000,
        reconnectAttempts: 10,
        ...options
      },
      listeners: new Map()
    };

    try {
      // 创建 WebSocket 连接
      const socket = new WebSocket(url);
      state.socket = socket;

      // 连接打开
      socket.onopen = () => {
        if (!this.isMounted) return;

        console.log(`[ConnectionManager] 连接成功: ${id}`);
        state.isConnected = true;
        state.reconnectAttempts = 0;
        this.startHeartbeat(id);

        // 触发连接成功事件
        this.emit(id, 'connected', null);
        state.options.onConnected?.();
      };

      // 接收消息
      socket.onmessage = (event) => {
        if (!this.isMounted) return;

        try {
          const data = JSON.parse(event.data);

          // 处理心跳响应
          if (data.type === 'pong') {
            state.lastPing = Date.now();
            return;
          }

          // 触发消息事件
          this.emit(id, 'message', data);
          state.options.onMessage?.(data);
        } catch (error) {
          console.error(`[ConnectionManager] 消息解析错误: ${id}`, error);
        }
      };

      // 连接关闭
      socket.onclose = (event) => {
        if (!this.isMounted) return;

        console.log(`[ConnectionManager] 连接关闭: ${id}, code=${event.code}`);
        state.isConnected = false;
        this.stopHeartbeat(id);

        // 触发断开事件
        this.emit(id, 'disconnected', null);
        state.options.onDisconnected?.();

        // 自动重连
        if (state.options.reconnect && state.reconnectAttempts < (state.options.reconnectAttempts || 10)) {
          this.scheduleReconnect(id);
        }
      };

      // 连接错误
      socket.onerror = (error) => {
        if (!this.isMounted) return;

        console.error(`[ConnectionManager] 连接错误: ${id}`, error);
        this.emit(id, 'error', error);
        state.options.onError?.(error);
      };

      // 保存连接状态
      this.connections.set(id, state);

      return socket;
    } catch (error) {
      console.error(`[ConnectionManager] 创建连接失败: ${id}`, error);
      return null;
    }
  }

  /**
   * 断开指定连接
   */
  disconnect(id: string): void {
    const state = this.connections.get(id);
    if (!state) return;

    console.log(`[ConnectionManager] 断开连接: ${id}`);

    // 停止心跳
    this.stopHeartbeat(id);

    // 清除重连定时器
    if (state.reconnectTimer) {
      clearTimeout(state.reconnectTimer);
      state.reconnectTimer = null;
    }

    // 关闭 WebSocket
    if (state.socket) {
      state.socket.close();
      state.socket = null;
    }

    // 清理状态
    state.isConnected = false;

    // 移除连接
    this.connections.delete(id);
  }

  /**
   * 断开所有连接
   */
  disconnectAll(): void {
    console.log(`[ConnectionManager] 断开所有连接 (${this.connections.size} 个)`);

    this.connections.forEach((_state, id) => {
      this.disconnect(id);
    });

    this.connections.clear();
  }

  /**
   * 发送消息
   */
  send(id: string, data: unknown): boolean {
    const state = this.connections.get(id);
    if (!state || !state.isConnected || !state.socket) {
      console.warn(`[ConnectionManager] 无法发送消息，连接未就绪: ${id}`);
      return false;
    }

    try {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      state.socket.send(message);
      return true;
    } catch (error) {
      console.error(`[ConnectionManager] 发送消息失败: ${id}`, error);
      return false;
    }
  }

  /**
   * 获取连接状态
   */
  getStatus(id: string): ConnectionStatus {
    const state = this.connections.get(id);
    if (!state) return 'disconnected';
    if (!state.socket) return 'disconnected';

    switch (state.socket.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return state.isConnected ? 'connected' : 'connecting';
      case WebSocket.CLOSING:
        return 'disconnected';
      case WebSocket.CLOSED:
        return 'disconnected';
      default:
        return 'disconnected';
    }
  }

  /**
   * 是否已连接
   */
  isConnected(id: string): boolean {
    const state = this.connections.get(id);
    return state?.isConnected === true && state.socket?.readyState === WebSocket.OPEN;
  }

  /**
   * 添加事件监听器
   */
  on(id: string, event: string, callback: (data: unknown) => void): void {
    const state = this.connections.get(id);
    if (!state) {
      console.warn(`[ConnectionManager] 连接不存在: ${id}`);
      return;
    }

    if (!state.listeners.has(event)) {
      state.listeners.set(event, new Set());
    }
    state.listeners.get(event)!.add(callback);
  }

  /**
   * 移除事件监听器
   */
  off(id: string, event: string, callback: (data: unknown) => void): void {
    const state = this.connections.get(id);
    if (!state) return;

    const listeners = state.listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  /**
   * 移除所有监听器
   */
  removeAllListeners(id: string): void {
    const state = this.connections.get(id);
    if (!state) return;

    state.listeners.clear();
  }

  /**
   * 触发事件
   */
  private emit(id: string, event: string, data: unknown): void {
    const state = this.connections.get(id);
    if (!state) return;

    const listeners = state.listeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[ConnectionManager] 事件回调错误 (${id}:${event}):`, error);
        }
      });
    }
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(id: string): void {
    const state = this.connections.get(id);
    if (!state) return;

    // 停止现有心跳
    this.stopHeartbeat(id);

    // 启动新心跳
    state.heartbeatTimer = setInterval(() => {
      if (!this.isMounted || !state.isConnected) return;

      // 检查连接超时
      const timeSinceLastPong = Date.now() - state.lastPing;
      const timeoutThreshold = (state.options.heartbeatInterval || 30000) * 2;

      if (timeSinceLastPong > timeoutThreshold) {
        console.warn(`[ConnectionManager] 心跳超时: ${id}，重新连接`);
        state.socket?.close();
        return;
      }

      // 发送心跳
      this.send(id, { type: 'ping', timestamp: Date.now() });
    }, state.options.heartbeatInterval || 30000);
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(id: string): void {
    const state = this.connections.get(id);
    if (!state || !state.heartbeatTimer) return;

    clearInterval(state.heartbeatTimer);
    state.heartbeatTimer = null;
  }

  /**
   * 安排重连
   */
  private scheduleReconnect(id: string): void {
    const state = this.connections.get(id);
    if (!state) return;

    state.reconnectAttempts++;
    const delay = Math.min(
      (state.options.reconnectDelay || 2000) * Math.pow(1.5, state.reconnectAttempts - 1),
      30000
    );

    console.log(`[ConnectionManager] 安排重连: ${id}, 尝试 ${state.reconnectAttempts}/${state.options.reconnectAttempts}, 延迟 ${delay}ms`);

    this.emit(id, 'reconnecting', { attempt: state.reconnectAttempts, delay });

    state.reconnectTimer = setTimeout(() => {
      if (this.isMounted && this.connections.has(id)) {
        console.log(`[ConnectionManager] 开始重连: ${id}`);
        this.connect(id, state.url, state.options);
      }
    }, delay);
  }

  /**
   * 销毁连接管理器
   */
  destroy(): void {
    this.isMounted = false;
    this.disconnectAll();
  }

  /**
   * 获取所有连接 ID
   */
  getConnectionIds(): string[] {
    return Array.from(this.connections.keys());
  }

  /**
   * 获取连接统计
   */
  getStats(): { total: number; connected: number; disconnected: number } {
    let connected = 0;
    let disconnected = 0;

    this.connections.forEach((_state, id) => {
      if (this.isConnected(id)) {
        connected++;
      } else {
        disconnected++;
      }
    });

    return {
      total: this.connections.size,
      connected,
      disconnected
    };
  }
}

// 导出单例
const connectionManager = new ConnectionManager();

export default connectionManager;
export { ConnectionManager, type ConnectionOptions, type ConnectionStatus };
