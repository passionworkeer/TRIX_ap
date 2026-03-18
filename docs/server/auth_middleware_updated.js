// ============================================
// 认证中间件
// ============================================
import { verifyToken } from '../utils/helpers.js';
import { store } from '../services/MemoryStore.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load config from state.json to get serviceToken
function loadServiceToken() {
    try {
        const configPath = path.join(__dirname, '../../.trix-native-channel/state.json');
        if (fs.existsSync(configPath)) {
            const state = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            return state.serviceToken;
        }
    } catch (e) { /* ignore */ }
    return null;
}

const JWT_SECRET = process.env.JWT_SECRET || 'trix-native-secret-change-in-production';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'admin-token-change-me';
const SERVICE_TOKEN = loadServiceToken() || ADMIN_TOKEN; // fallback to adminToken if no serviceToken

/**
 * 验证 Plugin Token (Socket.IO)
 */
export function authenticatePlugin(req, res, next) {
    const token = req.headers['x-plugin-token'];
    if (!token) {
        return res.status(401).json({ success: false, error: 'INVALID_TOKEN', message: 'Missing plugin token' });
    }
    const payload = verifyToken(token, JWT_SECRET);
    if (!payload) {
        return res.status(401).json({ success: false, error: 'TOKEN_EXPIRED', message: 'Invalid or expired token' });
    }
    const device = store.devices.get(payload.deviceId);
    if (!device || device.status !== 'active') {
        return res.status(401).json({ success: false, error: 'DEVICE_NOT_FOUND', message: 'Device not found or inactive' });
    }
    req.device = device;
    req.tokenPayload = payload;
    next();
}

/**
 * 验证 Service Token (Bearer token，用于 OpenClaw Plugin HTTP API)
 * Accepts: Authorization: Bearer <serviceToken>
 *         OR: x-trix-admin-token: <adminToken>
 */
export function authenticateServiceToken(req, res, next) {
    // Check Authorization: Bearer header first
    const authHeader = req.headers['authorization'];
    let token = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7);
    }
    // Also accept x-trix-admin-token for backward compat
    if (!token) {
        token = req.headers['x-trix-admin-token'];
    }

    if (!token) {
        return res.status(401).json({ success: false, error: 'INVALID_TOKEN', message: 'Missing service token' });
    }

    const validToken = SERVICE_TOKEN || ADMIN_TOKEN;
    if (token !== validToken) {
        return res.status(401).json({ success: false, error: 'INVALID_TOKEN', message: 'Invalid service token' });
    }

    next();
}

/**
 * 验证 Admin Token
 */
export function authenticateAdmin(req, res, next) {
    const adminToken = req.headers['x-trix-admin-token'];
    if (!adminToken) {
        return res.status(401).json({ success: false, error: 'INVALID_TOKEN', message: 'Missing admin token' });
    }
    if (adminToken !== ADMIN_TOKEN) {
        return res.status(401).json({ success: false, error: 'INVALID_TOKEN', message: 'Invalid admin token' });
    }
    next();
}

/**
 * 验证配对码
 */
export function validatePairingCode(req, res, next) {
    const code = req.params.code;
    if (!code || code.length !== 6) {
        return res.status(400).json({ success: false, error: 'INVALID_CODE', message: 'Invalid pairing code' });
    }
    next();
}
