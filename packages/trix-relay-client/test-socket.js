/**
 * Simple test for Socket.IO connection to relay service
 */

import { io } from 'socket.io-client';

const SERVER_URL = process.env.SERVER_URL || 'http://47.243.55.130:8765';

async function test() {
  console.log('Testing Socket.IO connection to:', SERVER_URL);

  // Test connection to main namespace
  const socket = io(SERVER_URL, {
    transports: ['websocket'],
    timeout: 5000,
  });

  socket.on('connect', () => {
    console.log('Connected to main namespace:', socket.id);
    socket.disconnect();
  });

  socket.on('connect_error', (err) => {
    console.error('Connection error:', err.message);
  });

  socket.on('disconnect', () => {
    console.log('Disconnected');
  });

  // Test connection to /relay namespace
  console.log('\nTesting /relay namespace...');
  const relaySocket = io(`${SERVER_URL}/relay`, {
    transports: ['websocket'],
    timeout: 5000,
  });

  relaySocket.on('connect', () => {
    console.log('Connected to /relay namespace:', relaySocket.id);

    // Try to authenticate
    relaySocket.emit('auth', {
      gatewayId: 'test-device',
      accessCode: 'test-code',
    }, (response) => {
      console.log('Auth response:', response);
      relaySocket.disconnect();
    });
  });

  relaySocket.on('connect_error', (err) => {
    console.error('/relay connection error:', err.message);
  });

  // Wait for tests to complete
  await new Promise(resolve => setTimeout(resolve, 10000));
  console.log('\nTests complete');
}

test().catch(console.error);
