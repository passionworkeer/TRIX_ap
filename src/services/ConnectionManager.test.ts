/**
 * ConnectionManager Tests
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ConnectionManager, type ConnectionOptions, type ConnectionStatus } from './ConnectionManager';

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState: number = MockWebSocket.CONNECTING;
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
  }

  send = vi.fn();
  close = vi.fn();

  // Helper methods to trigger events
  triggerOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }

  triggerClose(code = 1000) {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close', { code }));
  }

  triggerMessage(data: unknown) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }));
  }

  triggerError(error?: Event) {
    this.onerror?.(error || new Event('error'));
  }
}

// Store original WebSocket and replace with mock
let originalWebSocket: typeof WebSocket;

beforeEach(() => {
  originalWebSocket = globalThis.WebSocket;
  globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
});

afterEach(() => {
  globalThis.WebSocket = originalWebSocket;
});

describe('ConnectionManager', () => {
  let manager: ConnectionManager;

  beforeEach(() => {
    manager = new ConnectionManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('connect', () => {
    it('should create a new WebSocket connection', () => {
      const socket = manager.connect('test-1', 'ws://example.com/ws');

      expect(socket).toBeDefined();
      expect(socket).toBeInstanceOf(MockWebSocket);
    });

    it('should return existing socket if already connected', () => {
      const socket1 = manager.connect('test-1', 'ws://example.com/ws');
      // First connect creates socket but not yet connected
      // Trigger connection open
      (socket1 as MockWebSocket).triggerOpen();

      // Second connect should return the same socket since it's now connected
      const socket2 = manager.connect('test-1', 'ws://example.com/ws');

      expect(socket1).toBe(socket2);
    });

    it('should accept custom connection options', () => {
      const options: ConnectionOptions = {
        heartbeatInterval: 5000,
        reconnect: false,
        reconnectDelay: 1000,
        reconnectAttempts: 5,
      };

      manager.connect('test-1', 'ws://example.com/ws', options);
      // Connection should be created with options (we verify by state)
      const status = manager.getStatus('test-1');
      expect(status).toBeDefined();
    });

    it('should trigger onConnected callback', () => {
      const onConnected = vi.fn();
      const socket = manager.connect('test-1', 'ws://example.com/ws', {
        onConnected,
      });

      // Simulate connection open
      (socket as MockWebSocket).triggerOpen();

      expect(onConnected).toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('should disconnect existing connection', () => {
      const socket = manager.connect('test-1', 'ws://example.com/ws');
      (socket as MockWebSocket).triggerOpen();

      manager.disconnect('test-1');

      const status = manager.getStatus('test-1');
      expect(status).toBe('disconnected');
    });

    it('should not throw when disconnecting non-existent connection', () => {
      expect(() => {
        manager.disconnect('non-existent');
      }).not.toThrow();
    });
  });

  describe('disconnectAll', () => {
    it('should disconnect all connections', () => {
      manager.connect('test-1', 'ws://example1.com/ws');
      manager.connect('test-2', 'ws://example2.com/ws');

      const socket1 = manager.connect('test-1', 'ws://example1.com/ws');
      const socket2 = manager.connect('test-2', 'ws://example2.com/ws');
      (socket1 as MockWebSocket).triggerOpen();
      (socket2 as MockWebSocket).triggerOpen();

      manager.disconnectAll();

      expect(manager.getConnectionIds().length).toBe(0);
    });
  });

  describe('send', () => {
    it('should send JSON data when connected', () => {
      const socket = manager.connect('test-1', 'ws://example.com/ws');
      (socket as MockWebSocket).triggerOpen();

      const result = manager.send('test-1', { type: 'test', data: 'hello' });

      expect(result).toBe(true);
      expect(socket.send).toHaveBeenCalledWith(JSON.stringify({ type: 'test', data: 'hello' }));
    });

    it('should send string data as-is', () => {
      const socket = manager.connect('test-1', 'ws://example.com/ws');
      (socket as MockWebSocket).triggerOpen();

      const result = manager.send('test-1', 'plain text');

      expect(result).toBe(true);
      expect(socket.send).toHaveBeenCalledWith('plain text');
    });

    it('should return false when not connected', () => {
      manager.connect('test-1', 'ws://example.com/ws');
      // Don't trigger open

      const result = manager.send('test-1', { type: 'test' });

      expect(result).toBe(false);
    });

    it('should return false for non-existent connection', () => {
      const result = manager.send('non-existent', { type: 'test' });

      expect(result).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should return disconnected for non-existent connection', () => {
      const status = manager.getStatus('non-existent');

      expect(status).toBe('disconnected');
    });

    it('should return connecting when WebSocket is connecting', () => {
      manager.connect('test-1', 'ws://example.com/ws');

      const status = manager.getStatus('test-1');

      expect(status).toBe('connecting');
    });

    it('should return connected when WebSocket is open', () => {
      const socket = manager.connect('test-1', 'ws://example.com/ws');
      (socket as MockWebSocket).triggerOpen();

      const status = manager.getStatus('test-1');

      expect(status).toBe('connected');
    });
  });

  describe('isConnected', () => {
    it('should return false for non-existent connection', () => {
      expect(manager.isConnected('non-existent')).toBe(false);
    });

    it('should return true when connected', () => {
      const socket = manager.connect('test-1', 'ws://example.com/ws');
      (socket as MockWebSocket).triggerOpen();

      expect(manager.isConnected('test-1')).toBe(true);
    });

    it('should return false when not connected', () => {
      manager.connect('test-1', 'ws://example.com/ws');
      // Don't trigger open

      expect(manager.isConnected('test-1')).toBe(false);
    });
  });

  describe('event handling', () => {
    it('should add and trigger message listener', () => {
      const onMessage = vi.fn();
      const socket = manager.connect('test-1', 'ws://example.com/ws');
      manager.on('test-1', 'message', onMessage);
      (socket as MockWebSocket).triggerOpen();

      (socket as MockWebSocket).triggerMessage({ type: 'test', data: 'hello' });

      expect(onMessage).toHaveBeenCalledWith({ type: 'test', data: 'hello' });
    });

    it('should add and trigger connected listener', () => {
      const onConnected = vi.fn();
      // First connect to create the connection
      const socket = manager.connect('test-1', 'ws://example.com/ws');
      // Then add listener - listener should be added to existing connection
      manager.on('test-1', 'connected', onConnected);

      // Trigger connection open
      (socket as MockWebSocket).triggerOpen();

      expect(onConnected).toHaveBeenCalledWith(null);
    });

    it('should add and trigger disconnected listener', () => {
      const onDisconnected = vi.fn();
      const socket = manager.connect('test-1', 'ws://example.com/ws');
      manager.on('test-1', 'disconnected', onDisconnected);
      (socket as MockWebSocket).triggerOpen();

      (socket as MockWebSocket).triggerClose();

      expect(onDisconnected).toHaveBeenCalledWith(null);
    });

    it('should add and trigger error listener', () => {
      const onError = vi.fn();
      const socket = manager.connect('test-1', 'ws://example.com/ws');
      manager.on('test-1', 'error', onError);

      (socket as MockWebSocket).triggerError();

      expect(onError).toHaveBeenCalled();
    });

    it('should remove listener', () => {
      const onMessage = vi.fn();
      const socket = manager.connect('test-1', 'ws://example.com/ws');
      manager.on('test-1', 'message', onMessage);
      manager.off('test-1', 'message', onMessage);
      (socket as MockWebSocket).triggerOpen();

      (socket as MockWebSocket).triggerMessage({ type: 'test' });

      expect(onMessage).not.toHaveBeenCalled();
    });

    it('should remove all listeners', () => {
      const onMessage1 = vi.fn();
      const onMessage2 = vi.fn();
      const socket = manager.connect('test-1', 'ws://example.com/ws');
      manager.on('test-1', 'message', onMessage1);
      manager.on('test-1', 'message', onMessage2);
      manager.removeAllListeners('test-1');
      (socket as MockWebSocket).triggerOpen();

      (socket as MockWebSocket).triggerMessage({ type: 'test' });

      expect(onMessage1).not.toHaveBeenCalled();
      expect(onMessage2).not.toHaveBeenCalled();
    });
  });

  describe('heartbeat', () => {
    it('should start heartbeat on connection', () => {
      vi.useFakeTimers();
      const socket = manager.connect('test-1', 'ws://example.com/ws', {
        heartbeatInterval: 1000,
      });
      (socket as MockWebSocket).triggerOpen();

      // Advance timer to trigger heartbeat
      vi.advanceTimersByTime(1000);

      expect(socket.send).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('reconnection', () => {
    it('should schedule reconnect on connection close', () => {
      vi.useFakeTimers();
      const socket = manager.connect('test-1', 'ws://example.com/ws', {
        reconnect: true,
        reconnectDelay: 1000,
      });
      (socket as MockWebSocket).triggerOpen();

      const onReconnecting = vi.fn();
      manager.on('test-1', 'reconnecting', onReconnecting);

      (socket as MockWebSocket).triggerClose();

      // Advance timer to trigger reconnect
      vi.advanceTimersByTime(1000);

      expect(onReconnecting).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('should not reconnect when reconnect is disabled', () => {
      vi.useFakeTimers();
      const socket = manager.connect('test-1', 'ws://example.com/ws', {
        reconnect: false,
      });
      (socket as MockWebSocket).triggerOpen();

      const onReconnecting = vi.fn();
      manager.on('test-1', 'reconnecting', onReconnecting);

      (socket as MockWebSocket).triggerClose();

      // Advance timer
      vi.advanceTimersByTime(2000);

      expect(onReconnecting).not.toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('getConnectionIds', () => {
    it('should return all connection IDs', () => {
      manager.connect('test-1', 'ws://example1.com/ws');
      manager.connect('test-2', 'ws://example2.com/ws');

      const ids = manager.getConnectionIds();

      expect(ids).toContain('test-1');
      expect(ids).toContain('test-2');
      expect(ids.length).toBe(2);
    });

    it('should return empty array when no connections', () => {
      const ids = manager.getConnectionIds();

      expect(ids).toEqual([]);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      manager.connect('test-1', 'ws://example1.com/ws');
      const socket2 = manager.connect('test-2', 'ws://example2.com/ws');
      (socket2 as MockWebSocket).triggerOpen();

      const stats = manager.getStats();

      expect(stats.total).toBe(2);
      expect(stats.connected).toBe(1);
      expect(stats.disconnected).toBe(1);
    });

    it('should return zero stats when no connections', () => {
      const stats = manager.getStats();

      expect(stats.total).toBe(0);
      expect(stats.connected).toBe(0);
      expect(stats.disconnected).toBe(0);
    });
  });

  describe('destroy', () => {
    it('should destroy all connections', () => {
      manager.connect('test-1', 'ws://example1.com/ws');
      manager.connect('test-2', 'ws://example2.com/ws');

      manager.destroy();

      expect(manager.getConnectionIds().length).toBe(0);
    });

    it('should prevent new connections after destroy', () => {
      manager.destroy();

      const socket = manager.connect('test-1', 'ws://example.com/ws');

      // After destroy, isMounted is false, so socket events won't trigger
      expect(manager.isConnected('test-1')).toBe(false);
    });
  });

  describe('message handling', () => {
    it('should handle pong response for heartbeat', () => {
      vi.useFakeTimers();
      const socket = manager.connect('test-1', 'ws://example.com/ws', {
        heartbeatInterval: 1000,
      });
      (socket as MockWebSocket).triggerOpen();

      // Advance timer to trigger heartbeat
      vi.advanceTimersByTime(1000);

      // Should send ping message - check it was called with JSON string containing type: 'ping'
      expect(socket.send).toHaveBeenCalled();
      const sentData = (socket.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const parsed = JSON.parse(sentData);
      expect(parsed.type).toBe('ping');
      expect(parsed.timestamp).toBeDefined();

      // Receive pong response
      (socket as MockWebSocket).triggerMessage({ type: 'pong' });

      // Advance to next heartbeat interval
      vi.advanceTimersByTime(1000);

      // Should not close due to timeout
      expect(manager.isConnected('test-1')).toBe(true);

      vi.useRealTimers();
    });

    it('should trigger onMessage callback', () => {
      const onMessage = vi.fn();
      const socket = manager.connect('test-1', 'ws://example.com/ws', {
        onMessage,
      });
      (socket as MockWebSocket).triggerOpen();

      (socket as MockWebSocket).triggerMessage({ type: 'custom', data: 'test' });

      expect(onMessage).toHaveBeenCalledWith({ type: 'custom', data: 'test' });
    });

    it('should handle JSON parse error gracefully', () => {
      const onMessage = vi.fn();
      const socket = manager.connect('test-1', 'ws://example.com/ws', {
        onMessage,
      });
      (socket as MockWebSocket).triggerOpen();

      // Trigger message with invalid JSON (raw string that can't be parsed)
      // We need to bypass the JSON.stringify in triggerMessage
      // So let's directly call onmessage with a raw string that is invalid JSON
      const mockEvent = new MessageEvent('message', { data: 'not valid json {broken' });
      socket.onmessage?.(mockEvent);

      // onMessage should not be called because JSON parsing failed
      expect(onMessage).not.toHaveBeenCalled();
    });
  });
});
