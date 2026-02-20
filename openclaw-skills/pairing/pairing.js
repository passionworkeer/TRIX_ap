"use strict";
/**
 * OpenClaw Pairing Skill
 * 生成配对码和二维码，用于手机App配对
 *
 * 使用方法：
 * 1. 在OpenClaw中输入: "生成配对码" 或 "pairing code"
 * 2. OpenClaw会通过服务器生成6位配对码
 * 3. 手机App输入配对码完成配对
 *
 * ✅ 修复: 使用 Socket.IO 连接到 clawbot-channel 服务器
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.metadata = void 0;
exports.generatePairingCode = generatePairingCode;
exports.generateQRCode = generateQRCode;
exports.listActivePairings = listActivePairings;
const socket_io_client_1 = require("socket.io-client");
// Socket 连接
let socket = null;
const SERVER_URL = process.env.CLAWBOT_SERVER_URL || 'http://m.jmtrick.com:8765';
/**
 * 获取或创建 Socket 连接
 */
function getSocket() {
    return new Promise((resolve, reject) => {
        if (socket && socket.connected) {
            return resolve(socket);
        }
        // 创建新连接
        socket = (0, socket_io_client_1.io)(SERVER_URL, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });
        socket.on('connect', () => {
            console.log('[PairingSkill] ✅ 已连接到服务器:', SERVER_URL);
            resolve(socket);
        });
        socket.on('connect_error', (err) => {
            console.error('[PairingSkill] ❌ 连接失败:', err);
            reject(new Error(`无法连接到服务器: ${err.message}`));
        });
        socket.on('disconnect', () => {
            console.log('[PairingSkill] ⚠️  已断开连接');
        });
        // 连接超时
        setTimeout(() => {
            if (!socket?.connected) {
                reject(new Error('连接超时'));
            }
        }, 5000);
    });
}
/**
 * 生成配对码（通过服务器）
 */
async function generatePairingCode() {
    try {
        const sock = await getSocket();
        return new Promise((resolve, reject) => {
            // 生成设备ID（使用进程ID或固定标识）
            const deviceId = `clawbot_${process.pid || 'default'}`;
            sock.emit('bot_request_pairing', { deviceId }, (response) => {
                if (response.success) {
                    console.log('[PairingSkill] ✅ 配对码已生成:', response.pairingCode);
                    resolve({
                        success: true,
                        code: response.pairingCode,
                        expiresAt: response.expiresAt,
                        message: `配对码: ${response.pairingCode}\n有效期: 5分钟\n请在手机App中输入此配对码`
                    });
                }
                else {
                    console.error('[PairingSkill] ❌ 生成失败:', response.error);
                    reject(new Error(response.error || '生成配对码失败'));
                }
            });
            // 超时处理
            setTimeout(() => {
                reject(new Error('请求超时，请检查服务器连接'));
            }, 5000);
        });
    }
    catch (error) {
        console.error('[PairingSkill] ❌ 生成配对码错误:', error);
        return {
            success: false,
            error: error.message || '无法连接到服务器'
        };
    }
}
/**
 * 生成二维码Token（通过服务器）
 */
async function generateQRCode() {
    try {
        const sock = await getSocket();
        return new Promise((resolve, reject) => {
            const deviceId = `clawbot_${process.pid || 'default'}`;
            sock.emit('bot_request_pairing', { deviceId }, (response) => {
                if (response.success) {
                    // 生成二维码URL（手机App扫描此URL）
                    const qrUrl = `trix://pair/${response.pairingToken}`;
                    console.log('[PairingSkill] ✅ 二维码已生成');
                    resolve({
                        success: true,
                        token: response.pairingToken,
                        qrUrl,
                        expiresAt: response.expiresAt,
                        message: `二维码已生成\nToken: ${response.pairingToken}\n有效期: 5分钟\n请在手机App中扫描二维码`
                    });
                }
                else {
                    console.error('[PairingSkill] ❌ 生成失败:', response.error);
                    reject(new Error(response.error || '生成二维码失败'));
                }
            });
            // 超时处理
            setTimeout(() => {
                reject(new Error('请求超时，请检查服务器连接'));
            }, 5000);
        });
    }
    catch (error) {
        console.error('[PairingSkill] ❌ 生成二维码错误:', error);
        return {
            success: false,
            error: error.message || '无法连接到服务器'
        };
    }
}
/**
 * 查看当前服务器连接状态
 */
async function listActivePairings() {
    try {
        const sock = await getSocket();
        return new Promise((resolve) => {
            if (sock.connected) {
                resolve({
                    success: true,
                    connected: true,
                    serverUrl: SERVER_URL,
                    message: '已连接到服务器，可以生成配对码'
                });
            }
            else {
                resolve({
                    success: false,
                    connected: false,
                    message: '未连接到服务器'
                });
            }
        });
    }
    catch (error) {
        return {
            success: false,
            connected: false,
            error: error.message
        };
    }
}
// 技能元数据
exports.metadata = {
    name: 'pairing',
    description: '生成配对码和二维码，用于手机App配对（通过服务器）',
    version: '2.0.0',
    author: 'TRIX Team'
};
