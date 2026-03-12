/**
 * GatewayContext
 *
 * React context for Gateway state management
 */

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import gatewayClient from '../services/GatewayClient';
import { logger } from '../utils/logger';

interface GatewayState {
  connected: boolean;
  paired: boolean;
  deviceId: string | null;
  gatewayUrl: string | null;
}

interface GatewayContextValue extends GatewayState {
  connect: (url: string, token?: string, password?: string) => Promise<void>;
  disconnect: () => void;
  pairWithCode: (code: string) => Promise<{ success: boolean; error?: string }>;
  checkPairingStatus: () => Promise<{ paired: boolean; deviceId?: string; deviceName?: string }>;
}

const GatewayContext = createContext<GatewayContextValue | null>(null);

interface GatewayProviderProps {
  children: ReactNode;
  defaultUrl?: string;
}

export function GatewayProvider({ children, defaultUrl }: GatewayProviderProps) {
  const [state, setState] = useState<GatewayState>({
    connected: false,
    paired: false,
    deviceId: null,
    gatewayUrl: defaultUrl || null,
  });

  // Set up event listeners
  useEffect(() => {
    const handleConnect = () => {
      logger.gateway.info('[GatewayContext] Connected');
      setState(prev => ({
        ...prev,
        connected: true,
        deviceId: gatewayClient.getDeviceId(),
      }));
    };

    const handleDisconnect = () => {
      logger.gateway.info('[GatewayContext] Disconnected');
      setState(prev => ({
        ...prev,
        connected: false,
      }));
    };

    const handleError = (error: unknown) => {
      logger.gateway.error('[GatewayContext] Error:', error);
    };

    gatewayClient.on('connect', handleConnect);
    gatewayClient.on('disconnect', handleDisconnect);
    gatewayClient.on('error', handleError);

    // Check initial connection status
    if (gatewayClient.isConnected()) {
      setState(prev => ({
        ...prev,
        connected: true,
        deviceId: gatewayClient.getDeviceId(),
      }));
    }

    return () => {
      gatewayClient.off('connect', handleConnect);
      gatewayClient.off('disconnect', handleDisconnect);
      gatewayClient.off('error', handleError);
    };
  }, []);

  /**
   * Connect to Gateway
   */
  const connect = useCallback(async (url: string, token?: string, password?: string) => {
    logger.gateway.info('[GatewayContext] Connecting to:', url);

    try {
      await gatewayClient.connect({
        url,
        token,
        password,
      });

      setState(prev => ({
        ...prev,
        gatewayUrl: url,
        connected: true,
        deviceId: gatewayClient.getDeviceId(),
      }));
    } catch (error) {
      logger.gateway.error('[GatewayContext] Connect failed:', error);
      throw error;
    }
  }, []);

  /**
   * Disconnect from Gateway
   */
  const disconnect = useCallback(() => {
    logger.gateway.info('[GatewayContext] Disconnecting');
    gatewayClient.disconnect();
    setState(prev => ({
      ...prev,
      connected: false,
    }));
  }, []);

  /**
   * Pair with code (via server relay)
   */
  const pairWithCode = useCallback(async (_code: string) => {
    // This would typically go through the server
    // For now, we'll just return a placeholder
    try {
      // TODO: Implement pairing via server
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }, []);

  /**
   * Check pairing status (via server relay)
   */
  const checkPairingStatus = useCallback(async () => {
    // This would typically go through the server
    // For now, we'll just return the current status
    return {
      paired: state.paired,
      deviceId: state.deviceId || undefined,
    };
  }, [state.paired, state.deviceId]);

  const value: GatewayContextValue = {
    ...state,
    connect,
    disconnect,
    pairWithCode,
    checkPairingStatus,
  };

  return (
    <GatewayContext.Provider value={value}>
      {children}
    </GatewayContext.Provider>
  );
}

/**
 * Hook to use Gateway context
 */
export function useGateway(): GatewayContextValue {
  const context = useContext(GatewayContext);
  if (!context) {
    throw new Error('useGateway must be used within a GatewayProvider');
  }
  return context;
}

/**
 * Hook to check if Gateway is connected
 */
export function useGatewayConnected(): boolean {
  const { connected } = useGateway();
  return connected;
}

/**
 * Hook to get Gateway client instance
 */
export function useGatewayClient() {
  const { connected, connect, disconnect } = useGateway();
  return {
    client: gatewayClient,
    connected,
    connect,
    disconnect,
  };
}

export default GatewayContext;
