// ============================================
// Native WebSocket Handler for OpenClaw Plugin
// Path: /ws?role=agent&accountId=xxx&serviceToken=xxx
// ============================================
import { WebSocketServer } from 'ws';
import { store } from '../services/MemoryStore.js';
import { messageDB, initDatabase } from '../services/SQLiteStore.js';

let _httpServer = null;
let _wss = null;
let _serviceToken = null;
let _adminToken = null;

function setTokens(serviceToken, adminToken) {
    _serviceToken = serviceToken;
    _adminToken = adminToken;
}

/**
 * Create and attach native WebSocket server to an existing HTTP server.
 * Intercepts /ws?role=agent upgrades before other handlers see them.
 */
function createNativeAgentWebSocketServer(httpServer, serviceToken, adminToken) {
    _serviceToken = serviceToken;
    _adminToken = adminToken;
    _httpServer = httpServer;

    _wss = new WebSocketServer({ noServer: true });

    _wss.on('connection', (ws, request) => {
        const url = new URL(request.url, `http://${request.headers.host}`);
        const role = url.searchParams.get('role');
        const accountId = url.searchParams.get('accountId') || 'default';
        const serviceTokenParam = url.searchParams.get('serviceToken');
        const adminTokenParam = url.searchParams.get('adminToken');

        if (role !== 'agent') {
            ws.close(4001, 'Invalid role');
            return;
        }

        const validToken = _serviceToken || _adminToken;
        const providedToken = serviceTokenParam || adminTokenParam;
        if (!providedToken || providedToken !== validToken) {
            console.log(`[NativeAgentWS] Invalid token for accountId=${accountId}`);
            ws.close(4001, 'Invalid service token');
            return;
        }

        console.log(`[NativeAgentWS] Agent connected: accountId=${accountId}`);

        // Save connection: accountId -> Set<ws>
        if (!store.nativeAgentConnections.has(accountId)) {
            store.nativeAgentConnections.set(accountId, new Set());
        }
        store.nativeAgentConnections.get(accountId).add(ws);

        // Send connected acknowledgement
        ws.send(JSON.stringify({
            type: 'connected',
            payload: { role: 'agent', accountId, agentOnline: true },
        }));

        ws.on('message', (data) => {
            try {
                const envelope = JSON.parse(data.toString());
                console.log(`[NativeAgentWS] Message from ${accountId}: ${envelope.type}`);
            } catch (err) {
                console.error(`[NativeAgentWS] Parse error from ${accountId}:`, err.message);
            }
        });

        ws.on('ping', () => ws.pong());

        ws.on('close', (code) => {
            console.log(`[NativeAgentWS] Agent disconnected: accountId=${accountId} code=${code}`);
            const conns = store.nativeAgentConnections.get(accountId);
            if (conns) {
                conns.delete(ws);
                if (conns.size === 0) store.nativeAgentConnections.delete(accountId);
            }
        });

        ws.on('error', (err) => {
            console.error(`[NativeAgentWS] Error for ${accountId}:`, err.message);
        });
    });

    // Attach upgrade handler
    httpServer.on('upgrade', (request, socket, head) => {
        const url = new URL(request.url, `http://${request.headers.host}`);
        if (url.pathname === '/ws' && url.searchParams.get('role') === 'agent') {
            _wss.handleUpgrade(request, socket, head, (ws) => {
                _wss.emit('connection', ws, request);
            });
        }
        // All other upgrades handled by Socket.IO
    });

    console.log('[NativeAgentWS] Native WebSocket server attached to HTTP server at /ws?role=agent');
}

/**
 * Broadcast a message.created envelope to all native agent connections for an accountId.
 * Returns true if at least one agent received the message.
 */
function broadcastToAgent(accountId, envelope) {
    const conns = store.nativeAgentConnections.get(accountId);
    if (!conns || conns.size === 0) return false;
    const payload = JSON.stringify(envelope);
    let sent = false;
    for (const ws of conns) {
        if (ws.readyState === 1 /* OPEN */) {
            ws.send(payload);
            sent = true;
        }
    }
    return sent;
}

export { createNativeAgentWebSocketServer, broadcastToAgent, setTokens };
