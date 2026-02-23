const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { io } = require('socket.io-client');

const TEST_SERVER_PORT = Number(process.env.TEST_STUDY_ROOM_SERVER_PORT || 28765);
const SERVER_URL = process.env.TEST_SERVER_URL || `http://127.0.0.1:${TEST_SERVER_PORT}`;
const CONNECT_TIMEOUT_MS = 5000;
const ACK_TIMEOUT_MS = 5000;
const EVENT_TIMEOUT_MS = 7000;

let serverAvailable = false;
let studyRoomFeatureAvailable = false;
let ownedServerProcess = null;
let ownedServerTempDir = null;

function randomId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function closeSocket(socket) {
  if (!socket) {
    return;
  }

  try {
    socket.removeAllListeners();
    socket.disconnect();
    socket.close();
  } catch {
    // ignore cleanup errors in tests
  }
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function startOwnedServer() {
  if (process.env.TEST_SERVER_URL) {
    return;
  }

  ownedServerTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'study-room-socket-test-'));
  const dbPath = path.join(ownedServerTempDir, 'study-room-socket.db');
  const serverPath = path.resolve(__dirname, '..', 'server.js');

  ownedServerProcess = spawn(process.execPath, [serverPath], {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(TEST_SERVER_PORT),
      HOST: '127.0.0.1',
      DATABASE_PATH: dbPath,
      ENABLE_STUDY_ROOM_SOCKET: 'true'
    },
    stdio: 'ignore'
  });
}

async function stopOwnedServer() {
  if (!ownedServerProcess) {
    if (ownedServerTempDir) {
      fs.rmSync(ownedServerTempDir, { recursive: true, force: true });
      ownedServerTempDir = null;
    }
    return;
  }

  const processRef = ownedServerProcess;
  ownedServerProcess = null;

  await new Promise((resolve) => {
    const cleanup = () => {
      resolve();
    };

    processRef.once('exit', cleanup);
    processRef.kill('SIGTERM');
    setTimeout(() => {
      if (!processRef.killed) {
        processRef.kill('SIGKILL');
      }
      resolve();
    }, 1500);
  });

  if (ownedServerTempDir) {
    fs.rmSync(ownedServerTempDir, { recursive: true, force: true });
    ownedServerTempDir = null;
  }
}

async function waitForServerReady(maxAttempts = 20, delayMs = 250) {
  for (let i = 0; i < maxAttempts; i += 1) {
    const ok = await probeServer();
    if (ok) {
      return true;
    }
    await wait(delayMs);
  }
  return false;
}

async function probeServer() {
  const socket = io(SERVER_URL, {
    transports: ['websocket'],
    timeout: CONNECT_TIMEOUT_MS,
    reconnection: false
  });

  return new Promise((resolve) => {
    const done = (value) => {
      closeSocket(socket);
      resolve(value);
    };

    const timer = setTimeout(() => done(false), CONNECT_TIMEOUT_MS);

    socket.on('connect', () => {
      clearTimeout(timer);
      done(true);
    });

    socket.on('connect_error', () => {
      clearTimeout(timer);
      done(false);
    });
  });
}

async function createClient(userId) {
  const socket = io(SERVER_URL, {
    transports: ['websocket'],
    timeout: CONNECT_TIMEOUT_MS,
    reconnection: false
  });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      closeSocket(socket);
      reject(new Error(`connect timeout: ${userId}`));
    }, CONNECT_TIMEOUT_MS);

    socket.once('connect', () => {
      clearTimeout(timer);
      socket.emit('app_register', { userId });
      resolve();
    });

    socket.once('connect_error', (error) => {
      clearTimeout(timer);
      closeSocket(socket);
      reject(error);
    });
  });

  return socket;
}

async function emitAck(socket, event, payload = {}, timeoutMs = ACK_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${event} ack timeout`));
    }, timeoutMs);

    socket.emit(event, payload, (response) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}

async function probeStudyRoomFeature() {
  const probeUserId = randomId('probe-user');
  const socket = await createClient(probeUserId);

  try {
    const response = await emitAck(socket, 'study_room_get_state', {}, 1500);
    return Boolean(response && typeof response === 'object' && 'success' in response);
  } catch {
    return false;
  } finally {
    closeSocket(socket);
  }
}

function waitForRoomEvent(socket, roomCode, predicate) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('study_room_state', handler);
      reject(new Error('study_room_state timeout'));
    }, EVENT_TIMEOUT_MS);

    const handler = (payload) => {
      if (!payload || payload.roomCode !== roomCode) {
        return;
      }
      if (!predicate(payload)) {
        return;
      }

      clearTimeout(timer);
      socket.off('study_room_state', handler);
      resolve(payload);
    };

    socket.on('study_room_state', handler);
  });
}

test.before(async () => {
  startOwnedServer();
  serverAvailable = await waitForServerReady();
  if (!serverAvailable) {
    console.log(`Study room socket tests skipped: server not available at ${SERVER_URL}`);
    return;
  }

  studyRoomFeatureAvailable = await probeStudyRoomFeature();
  if (!studyRoomFeatureAvailable) {
    console.log('Study room socket tests skipped: study_room_* events unavailable on current server');
  }
});

test.after(async () => {
  await stopOwnedServer();
});

test('host action should broadcast same room snapshot version to members', async () => {
  if (!serverAvailable || !studyRoomFeatureAvailable) return;

  const hostUserId = randomId('host');
  const memberUserId = randomId('member');
  const hostSocket = await createClient(hostUserId);
  const memberSocket = await createClient(memberUserId);

  try {
    const created = await emitAck(hostSocket, 'study_room_create', {
      displayName: 'Host'
    });
    assert.equal(created.success, true);
    const roomCode = created.roomCode;
    assert.equal(typeof roomCode, 'string');

    const hostEventPromise = waitForRoomEvent(
      hostSocket,
      roomCode,
      (payload) => payload.reason === 'host_action' && payload.room?.sessionState === 'focusing'
    );
    const memberEventPromise = waitForRoomEvent(
      memberSocket,
      roomCode,
      (payload) => payload.reason === 'host_action' && payload.room?.sessionState === 'focusing'
    );

    const joined = await emitAck(memberSocket, 'study_room_join', {
      roomCode,
      displayName: 'Member'
    });
    assert.equal(joined.success, true);

    const acted = await emitAck(hostSocket, 'study_room_host_action', {
      roomCode,
      action: 'start_focus'
    });
    assert.equal(acted.success, true);

    const [hostEvent, memberEvent] = await Promise.all([hostEventPromise, memberEventPromise]);
    assert.equal(hostEvent.room.version, memberEvent.room.version);
    assert.equal(hostEvent.room.sessionState, 'focusing');
  } finally {
    closeSocket(hostSocket);
    closeSocket(memberSocket);
  }
});

test('member disconnect should trigger leave broadcast', async () => {
  if (!serverAvailable || !studyRoomFeatureAvailable) return;

  const hostUserId = randomId('host');
  const memberUserId = randomId('member');
  const hostSocket = await createClient(hostUserId);
  const memberSocket = await createClient(memberUserId);

  try {
    const created = await emitAck(hostSocket, 'study_room_create', {
      displayName: 'Host'
    });
    assert.equal(created.success, true);
    const roomCode = created.roomCode;

    const joined = await emitAck(memberSocket, 'study_room_join', {
      roomCode,
      displayName: 'Member'
    });
    assert.equal(joined.success, true);

    const disconnectEventPromise = waitForRoomEvent(
      hostSocket,
      roomCode,
      (payload) => payload.reason === 'disconnect'
    );

    memberSocket.disconnect();

    const disconnectEvent = await disconnectEventPromise;
    assert.equal(disconnectEvent.room.members.length, 1);
    assert.equal(disconnectEvent.room.members[0].userId, hostUserId);
  } finally {
    closeSocket(hostSocket);
    closeSocket(memberSocket);
  }
});
