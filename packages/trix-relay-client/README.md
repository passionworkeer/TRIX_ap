# @trix-app/relay-client

WebSocket client for OpenClaw Gateway with Ed25519 authentication. Compatible with ClawPilot protocol.

## Features

- **Gateway Client** - Direct WebSocket connection to OpenClaw Gateway
- **Relay Client** - Connection through relay server to reach Gateway
- **Ed25519 Authentication** - Secure device identity and signing
- **Auto Reconnection** - Exponential backoff retry strategy
- **TypeScript** - Full type definitions included
- **Universal** - Works in browser and Node.js environments

## Installation

```bash
npm install @trix-app/relay-client
```

## Quick Start

### Gateway Client

```typescript
import { GatewayClient } from '@trix-app/relay-client';

const client = new GatewayClient();

// Listen to events
client.on('connected', () => {
  console.log('Connected to Gateway!');
});

client.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});

client.on('chat', (params) => {
  console.log('Chat message:', params);
});

// Connect
await client.connect({
  url: 'wss://api.trix3d.com',
  token: 'your-auth-token',
});

// Send request
const response = await client.request('sessions.list');
console.log('Sessions:', response);

// Send notification (no response expected)
client.send('chat.send', {
  sessionId: 'main',
  message: 'Hello!',
});

// Check connection status
console.log('Is connected:', client.isConnected());

// Get device ID
console.log('Device ID:', client.getDeviceId());

// Disconnect
client.disconnect();
```

### Relay Client

```typescript
import { RelayClient } from '@trix-app/relay-client';

const relay = new RelayClient();

relay.on('authenticated', (info) => {
  console.log('Authenticated:', info);
});

// Connect through relay server
await relay.connect({
  server: 'https://relay.example.com',
  gatewayId: 'gateway-123',
  accessCode: 'your-access-code',
});

// Send message to device
await relay.sendToDevice('control.start', {
  sessionId: 'main',
});

relay.disconnect();
```

## API Reference

### GatewayClient

#### `new GatewayClient()`

Creates a new GatewayClient instance.

#### `client.connect(options: GatewayOptions): Promise<void>`

Connect to Gateway server.

**Options:**
```typescript
interface GatewayOptions {
  url: string;           // WebSocket URL (wss://...)
  token?: string;        // Authentication token
  password?: string;     // Alternative auth method
  deviceId?: string;     // Custom device ID
  deviceKey?: string;    // Custom device private key
  reconnect?: boolean;   // Enable auto-reconnect (default: true)
  reconnectAttempts?: number;  // Max reconnect attempts (default: 10)
  reconnectDelay?: number;     // Initial delay in ms (default: 1000)
}
```

#### `client.request<T>(method: string, params?: object): Promise<T>`

Send RPC request and wait for response.

#### `client.send(method: string, params?: object): void`

Send notification (no response expected).

#### `client.disconnect(): void`

Disconnect from Gateway.

#### `client.isConnected(): boolean`

Check if connected and authenticated.

#### `client.getDeviceId(): string | null`

Get current device ID.

#### `client.on<T>(event: string, handler: EventHandler<T>): void`

Subscribe to event.

#### `client.off<T>(event: string, handler: EventHandler<T>): void`

Unsubscribe from event.

#### `client.once<T>(event: string, handler: EventHandler<T>): void`

Subscribe to event (one-time).

### Events

- `connect` - Connected to server
- `disconnect` - Disconnected from server
- `reconnect` - Successfully reconnected
- `reconnect_failed` - Reconnection attempts exhausted
- `error` - Error occurred
- `chat` - Chat message received
- `tick` - Heartbeat tick
- `*` - All events

### RelayClient

Similar API to GatewayClient with additional methods:

#### `relay.connect(options: RelayOptions): Promise<void>`

Connect to relay server.

```typescript
interface RelayOptions {
  server: string;      // Relay server URL
  gatewayId: string;   // Gateway ID to connect
  accessCode: string; // Access code
}
```

#### `relay.sendToDevice(method: string, params?: object): Promise<void>`

Send message to device through relay.

#### `relay.connectGateway(): Promise<void>`

Connect to Gateway through relay.

## Protocol

The client uses JSON-RPC over WebSocket with the following frame types:

### Request Frame
```json
{
  "type": "req",
  "id": "uuid",
  "method": "method.name",
  "params": {}
}
```

### Response Frame
```json
{
  "type": "res",
  "id": "uuid",
  "ok": true,
  "payload": {}
}
```

### Event Frame
```json
{
  "type": "event",
  "event": "event.name",
  "payload": {}
}
```

## Environment Support

### Browser

Uses native Web Crypto API for Ed25519 operations.

### Node.js

Uses Node.js `crypto` module. For server-side usage, you can also use the Node.js-specific crypto functions:

```typescript
import { loadOrCreateDeviceIdentity, buildSignedDevice } from '@trix-app/relay-client';

// Load or create persistent device identity
const identity = loadOrCreateDeviceIdentity();

// Build signed payload
const device = buildSignedDevice(identity, {
  clientId: 'my-client',
  clientMode: 'server',
  role: 'operator',
  scopes: ['operator.read', 'operator.write'],
  signedAtMs: Date.now(),
});
```

## License

MIT
