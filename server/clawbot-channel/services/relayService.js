/**
 * Relay Service - 模仿 ClawPilot 中继服务器
 *
 * 提供：
 * - 设备注册 (relay/register)
 * - 刷新 AccessCode (relay/accesscode)
 * - WebSocket 中继连接
 */

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// 内存存储（生产环境应该用数据库）
const registeredDevices = new Map();
const activeConnections = new Map();

class RelayService {
  constructor() {
    this.secret = process.env.RELAY_SECRET || crypto.randomBytes(32).toString('hex');
  }

  /**
   * 注册新设备
   */
  async register(displayName) {
    const gatewayId = uuidv4();
    const relaySecret = crypto.randomBytes(32).toString('hex');
    const accessCode = this.generateAccessCode();

    const device = {
      gatewayId,
      relaySecret,
      accessCode,
      displayName: displayName || 'TRIX Device',
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
    };

    registeredDevices.set(gatewayId, device);

    console.log(`[Relay] Device registered: ${gatewayId} (${displayName})`);

    return {
      gatewayId,
      relaySecret,
      accessCode,
    };
  }

  /**
   * 验证设备凭据
   */
  async verifyCredentials(gatewayId, relaySecret) {
    const device = registeredDevices.get(gatewayId);
    if (!device) {
      return { valid: false, error: 'Device not found' };
    }

    if (device.relaySecret !== relaySecret) {
      return { valid: false, error: 'Invalid credentials' };
    }

    // 更新最后活跃时间
    device.lastSeenAt = Date.now();

    return { valid: true, device };
  }

  /**
   * 刷新 AccessCode
   */
  async refreshAccessCode(gatewayId, relaySecret) {
    const result = await this.verifyCredentials(gatewayId, relaySecret);
    if (!result.valid) {
      throw new Error(result.error);
    }

    const device = result.device;
    device.accessCode = this.generateAccessCode();
    device.lastSeenAt = Date.now();

    registeredDevices.set(gatewayId, device);

    return { accessCode: device.accessCode };
  }

  /**
   * 验证 AccessCode（用于 WebSocket 连接）
   */
  async verifyAccessCode(gatewayId, accessCode) {
    const device = registeredDevices.get(gatewayId);
    if (!device) {
      return { valid: false, error: 'Device not found' };
    }

    if (device.accessCode !== accessCode) {
      return { valid: false, error: 'Invalid access code' };
    }

    device.lastSeenAt = Date.now();

    return { valid: true, device };
  }

  /**
   * 生成 AccessCode (6位字母数字)
   */
  generateAccessCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 避免混淆字符
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * 获取设备信息
   */
  getDevice(gatewayId) {
    return registeredDevices.get(gatewayId);
  }

  /**
   * 列出所有设备
   */
  listDevices() {
    return Array.from(registeredDevices.values()).map(d => ({
      gatewayId: d.gatewayId,
      displayName: d.displayName,
      createdAt: d.createdAt,
      lastSeenAt: d.lastSeenAt,
    }));
  }

  /**
   * 移除设备
   */
  removeDevice(gatewayId) {
    const device = registeredDevices.get(gatewayId);
    if (device) {
      registeredDevices.delete(gatewayId);
      console.log(`[Relay] Device removed: ${gatewayId}`);
      return true;
    }
    return false;
  }

  /**
   * 存储活动连接
   */
  addConnection(gatewayId, socket) {
    activeConnections.set(gatewayId, socket);
    console.log(`[Relay] Connection added: ${gatewayId}, total: ${activeConnections.size}`);
  }

  /**
   * 移除活动连接
   */
  removeConnection(gatewayId) {
    activeConnections.delete(gatewayId);
    console.log(`[Relay] Connection removed: ${gatewayId}, total: ${activeConnections.size}`);
  }

  /**
   * 获取设备连接
   */
  getConnection(gatewayId) {
    return activeConnections.get(gatewayId);
  }

  /**
   * 向设备发送消息
   */
  sendToDevice(gatewayId, message) {
    const socket = activeConnections.get(gatewayId);
    if (socket && socket.readyState === 1) { // WebSocket.OPEN
      socket.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  /**
   * 广播消息到所有连接
   */
  broadcast(message) {
    for (const [gatewayId, socket] of activeConnections) {
      if (socket.readyState === 1) {
        socket.send(JSON.stringify(message));
      }
    }
  }
}

module.exports = new RelayService();
