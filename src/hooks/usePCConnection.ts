import { useEffect, useRef, useState, useCallback } from 'react';

// ============================================
// Clawdbot Gateway Protocol Type Definitions
// ============================================

/**
 * Auth Request - Sent immediately after WebSocket connection
 */
interface AuthRequest {
  action: 'auth';
  token: string;
}

/**
 * Auth Response - Expected from server after auth
 */
interface AuthResponse {
  action: 'auth';
  status: 'ok' | 'error';
  error?: string;
}

/**
 * Message Send Request - RPC format for sending user messages
 */
interface MessageSendRequest {
  action: 'message.send';
  params: {
    message: string;
  };
}

/**
 * Message Response - Expected response from server
 */
interface MessageResponse {
  action?: string;
  status?: string;
  result?: string;
  text?: string;
  message?: string;
  error?: string;
}

/**
 * Generic RPC Message
 */
type RPCMessage = AuthRequest | MessageSendRequest;

/**
 * Connection Status
 */
export type ConnectionStatus = 
  | 'DISCONNECTED'   // Not connected
  | 'CONNECTING'     // Connection in progress
  | 'AUTHENTICATING' // Connected, waiting for auth response
  | 'CONNECTED'      // Authenticated and ready
  | 'AUTH_FAILED'    // Authentication failed
  | 'ERROR';         // Connection error

/**
 * Hook return type
 */
interface UsePCConnectionReturn {
  status: ConnectionStatus;
  sendMessage: (text: string) => void;
  lastMessage: string | null;
  connect: () => void;
  disconnect: () => void;
  isConnected: boolean;
}

// ============================================
// Main Hook Implementation
// ============================================

export const usePCConnection = (): UsePCConnectionReturn => {
  const [status, setStatus] = useState<ConnectionStatus>('DISCONNECTED');
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  
  // Read configuration from environment variables
  const WS_URL = import.meta.env.VITE_PC_WEBSOCKET_URL as string;
  const AUTH_TOKEN = import.meta.env.VITE_PC_AUTH_TOKEN as string;

  // Maximum reconnection attempts
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_INTERVAL = 3000; // 3 seconds

  /**
   * Connect to WebSocket server
   */
  const connect = useCallback(() => {
    // Validate configuration
    if (!WS_URL || !AUTH_TOKEN) {
      console.error('❌ TRIX Config Error: Missing VITE_PC_WEBSOCKET_URL or VITE_PC_AUTH_TOKEN');
      setStatus('ERROR');
      return;
    }

    // Prevent duplicate connections
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.warn('⚠️ Already connected');
      return;
    }

    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close();
    }

    setStatus('CONNECTING');
    console.log(`🔌 Connecting to Clawdbot Gateway: ${WS_URL}`);
    
    try {
      const socket = new WebSocket(WS_URL);
      wsRef.current = socket;

      // ============================================
      // 1. CONNECTION ESTABLISHED - SEND AUTH
      // ============================================
      socket.onopen = () => {
        console.log('✅ WebSocket connected, sending authentication...');
        setStatus('AUTHENTICATING');
        
        // Immediately send authentication packet
        const authPacket: AuthRequest = {
          action: 'auth',
          token: AUTH_TOKEN
        };
        
        socket.send(JSON.stringify(authPacket));
        console.log('📤 Auth packet sent:', { action: 'auth', token: '***' });
      };

      // ============================================
      // 2. MESSAGE RECEIVED - HANDLE RESPONSES
      // ============================================
      socket.onmessage = (event) => {
        try {
          const data: MessageResponse | AuthResponse = JSON.parse(event.data);
          console.log('📥 Received from server:', data);

          // Handle authentication response
          if (data.action === 'auth') {
            const authResponse = data as AuthResponse;
            
            if (authResponse.status === 'ok') {
              setStatus('CONNECTED');
              reconnectAttemptsRef.current = 0; // Reset reconnect attempts
              console.log('✅ Authentication successful - Gateway ready');
            } else {
              setStatus('AUTH_FAILED');
              console.error('❌ Authentication failed:', authResponse.error || 'Unknown error');
              socket.close();
            }
            return;
          }

          // Handle normal message responses
          if (data.error) {
            console.error('❌ Server error:', data.error);
            setLastMessage(`Error: ${data.error}`);
            return;
          }

          // Extract message content based on Clawdbot response format
          const content = 
            data.result || 
            data.text || 
            data.message || 
            (typeof data === 'string' ? data : JSON.stringify(data));
          
          setLastMessage(content);
          console.log('💬 Message content:', content);

        } catch (error) {
          console.warn('⚠️ Failed to parse message:', event.data, error);
          // Handle non-JSON messages
          setLastMessage(event.data);
        }
      };

      // ============================================
      // 3. CONNECTION CLOSED
      // ============================================
      socket.onclose = (event) => {
        console.log('🔌 Connection closed:', event.code, event.reason);
        setStatus('DISCONNECTED');
        wsRef.current = null;

        // Implement auto-reconnect logic
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current += 1;
          console.log(`🔄 Reconnecting... (Attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, RECONNECT_INTERVAL);
        } else {
          console.error('❌ Max reconnection attempts reached');
          setStatus('ERROR');
        }
      };

      // ============================================
      // 4. CONNECTION ERROR
      // ============================================
      socket.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setStatus('ERROR');
      };

    } catch (error) {
      console.error('❌ Failed to create WebSocket:', error);
      setStatus('ERROR');
    }
  }, [WS_URL, AUTH_TOKEN]);

  /**
   * Disconnect from WebSocket server
   */
  const disconnect = useCallback(() => {
    console.log('🔌 Disconnecting...');
    
    // Clear reconnection timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Close WebSocket connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setStatus('DISCONNECTED');
    reconnectAttemptsRef.current = 0;
  }, []);

  /**
   * Send message to server using RPC format
   */
  const sendMessage = useCallback((text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('❌ Cannot send message: Not connected');
      return;
    }

    if (status !== 'CONNECTED') {
      console.error('❌ Cannot send message: Not authenticated');
      return;
    }

    // Construct RPC message packet
    const messagePacket: MessageSendRequest = {
      action: 'message.send',
      params: {
        message: text
      }
    };

    console.log('📤 Sending message:', messagePacket);
    wsRef.current.send(JSON.stringify(messagePacket));
  }, [status]);

  // ============================================
  // Auto-connect on mount
  // ============================================
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // ============================================
  // Return hook interface
  // ============================================
  return {
    status,
    sendMessage,
    lastMessage,
    connect,
    disconnect,
    isConnected: status === 'CONNECTED'
  };
};