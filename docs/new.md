针对 OpenClaw 源码固定且无法随意修改的限制，社区（参考 GitHub Issue #3280 关于 Custom Pluggable Messaging Providers 的讨论）以及官方文档推荐的标准解法是：不侵入核心源码，而是利用 OpenClaw 官方自带的本地 WebChat WebSocket 接口（默认端口 18789）结合“外置 Adapter (适配器)”模式来实现。

这种方案的底层逻辑与 OpenClaw 官方的 Web UI 和 CLI 工具与本地 Gateway 通信的原理完全一致。我们将通过一个轻量级适配器，将本地的 OpenClaw 安全地桥接到你的云端长连接服务中，实现类似 WhatsApp Web 版的“配对码”长连接验证机制。

以下是完整的三端（云端 Broker、PC 适配器、手机 App）落地代码和实现文档：

第一层：云端路由与配对大厅 (TRIX Cloud Broker)
部署在你的服务器 m.jmtrick.com 上，作为连接枢纽。它负责生成配对码、颁发长效设备 Token，并在 App 和 PC 之间路由消息。

JavaScript
// server.js (部署于云端服务器)
const WebSocket = require('ws');
const crypto = require('crypto');

const wss = new WebSocket.Server({ port: 8080 }); // Nginx 代理到 wss://m.jmtrick.com/broker

const pairingSessions = new Map(); // 存放等待配对的 PC (Code -> WS)
const activeTokens = new Map();    // 存放合法的长效 Token (Token -> UserId)
const pcConnections = new Map();   // 存放已认证的 PC 连接 (UserId -> WS)
const appConnections = new Map();  // 存放手机 App 连接 (UserId -> WS)

// 生成 6 位大写配对码
const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

wss.on('connection', (ws, req) => {
    const urlParams = new URLSearchParams(req.url.split('?')[1]);
    const action = urlParams.get('action');
    const token = urlParams.get('token');
    const appUserId = urlParams.get('userId');

    // ================= 1. PC 端请求新配对 =================
    if (action === 'request_pairing') {
        const code = generateCode();
        pairingSessions.set(code, ws);
        ws.send(JSON.stringify({ type: 'pairing_code', code }));
        ws.on('close', () => pairingSessions.delete(code));
        return;
    }

    // ================= 2. PC 端携带长效 Token 自动重连 =================
    if (token) {
        const userId = activeTokens.get(token); // 生产环境建议查 Supabase 数据库
        if (!userId) return ws.send(JSON.stringify({ type: 'auth_failed' }));
        
        ws.userId = userId;
        pcConnections.set(userId, ws);
        console.log(`💻 PC 端已连接 (UserId: ${userId})`);
    }

    // ================= 3. 手机 App 接入 =================
    if (appUserId) {
        appConnections.set(appUserId, ws);
        console.log(`📱 App 端已连接 (UserId: ${appUserId})`);
    }

    // ================= 消息路由逻辑 =================
    ws.on('message', (message) => {
        const data = JSON.parse(message);

        // App 提交配对码
        if (data.type === 'submit_pairing_code') {
            const pcWs = pairingSessions.get(data.code.toUpperCase());
            if (pcWs && pcWs.readyState === WebSocket.OPEN) {
                const newToken = crypto.randomBytes(32).toString('hex');
                activeTokens.set(newToken, appUserId);
                
                pcConnections.set(appUserId, pcWs);
                pcWs.userId = appUserId;
                
                // 下发 Token 给 PC 端让其永久保存
                pcWs.send(JSON.stringify({ type: 'pairing_success', token: newToken, userId: appUserId }));
                ws.send(JSON.stringify({ type: 'pairing_success_app' })); // 通知 App
                pairingSessions.delete(data.code.toUpperCase());
            } else {
                ws.send(JSON.stringify({ type: 'error', msg: '配对码无效' }));
            }
        }

        // App -> PC (发送消息给 OpenClaw)
        if (data.type === 'app_message' && appUserId) {
            const targetPc = pcConnections.get(appUserId);
            if (targetPc) targetPc.send(JSON.stringify(data));
        }

        // PC -> App (OpenClaw 的回复转发给 App)
        if (data.type === 'bot_response' && ws.userId) {
            const targetApp = appConnections.get(ws.userId);
            if (targetApp) targetApp.send(JSON.stringify(data));
            // 此处可调用 Supabase API 将消息落库，以防 App 在后台被杀
        }
    });

    ws.on('close', () => {
        if (ws.userId) pcConnections.delete(ws.userId);
        if (appUserId) appConnections.delete(appUserId);
    });
});
第二层：PC 适配器守护进程 (TRIX Adapter)
这是运行在用户电脑上的 Node.js 脚本（可使用 pkg 打包成独立 exe/macOS 应用程序）。
核心亮点： 官方机制要求本地 WebSocket 必须带有鉴权 Token。此脚本通过调用官方命令 openclaw config get gateway.auth.token 自动获取 Token，彻底免去用户的配置负担。

JavaScript
// trix-adapter.js (运行在用户的 PC 上)
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CONFIG_PATH = path.join(__dirname, 'trix-auth.json');
const CLOUD_URL = 'wss://m.jmtrick.com/broker';

let localWs = null;
let cloudWs = null;

// ================= 获取本地 OpenClaw 官方 Token =================
function getOpenClawToken() {
    try {
        // 利用官方 CLI 直接提取本机 Gateway Token
        return execSync('openclaw config get gateway.auth.token').toString().trim();
    } catch (e) {
        console.error('❌ 无法获取 OpenClaw Token，请确保已运行 openclaw onboard');
        process.exit(1);
    }
}

// ================= 连接本地 OpenClaw (代理官方 WebChat 协议) =================
function connectLocal() {
    if (localWs) return;
    const token = getOpenClawToken();
    localWs = new WebSocket(`ws://127.0.0.1:18789?token=${token}`);

    localWs.on('open', () => console.log('🟢 [Local] 已安全连接本地 OpenClaw Gateway'));
    
    localWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        // 将 OpenClaw 的回复发送给云端
        if (cloudWs?.readyState === WebSocket.OPEN) {
            cloudWs.send(JSON.stringify({ type: 'bot_response', payload: msg }));
        }
    });

    localWs.on('close', () => {
        localWs = null;
        setTimeout(connectLocal, 3000); // 顽强重连
    });
}

// ================= 连接云端 Broker =================
function connectCloud() {
    const auth = fs.existsSync(CONFIG_PATH) ? JSON.parse(fs.readFileSync(CONFIG_PATH)) : null;
    const wsUrl = auth?.token ? `${CLOUD_URL}?token=${auth.token}` : `${CLOUD_URL}?action=request_pairing`;

    cloudWs = new WebSocket(wsUrl);

    cloudWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'pairing_code') {
            console.log('\n======================================');
            console.log('📱 请在 TRIX App 中输入配对码建立长连接：');
            console.log(`       ${msg.code}       `); 
            console.log('======================================\n');
        }

        if (msg.type === 'pairing_success') {
            console.log('🎉 配对成功！本地设备已与云端长久绑定。');
            fs.writeFileSync(CONFIG_PATH, JSON.stringify({ token: msg.token, userId: msg.userId }));
            connectLocal(); // 配对成功后才激活本地连接
        }

        if (msg.type === 'app_message' && localWs?.readyState === WebSocket.OPEN) {
            // 将 App 的文本消息按照 OpenClaw WebChat 的格式转发
            localWs.send(JSON.stringify({ type: 'chat', text: msg.content }));
        }

        if (msg.type === 'auth_failed') {
            fs.unlinkSync(CONFIG_PATH);
            console.error('❌ Token 失效，请重新运行程序以配对。');
            process.exit(1);
        }
    });

    // 心跳保活：这是对抗网络波动的关键
    setInterval(() => { if (cloudWs.readyState === WebSocket.OPEN) cloudWs.ping(); }, 15000);

    cloudWs.on('close', () => setTimeout(connectCloud, 5000));
}

// 启动入口
if (fs.existsSync(CONFIG_PATH)) connectLocal(); // 已授权直接连本地
connectCloud();
第三层：TRIX 移动端 App
在你的 src/services/clawbotPairingService.ts 和 Context 状态中，将请求地址指向云端 Broker。App 层面只需做到“按需连接、断网恢复拉取”即可。

TypeScript
// 1. 在 Pairing.tsx 中提交配对码
const submitPairingCode = (code: string) => {
    cloudWs.send(JSON.stringify({
        type: 'submit_pairing_code',
        code: code
    }));
};

// 2. 发送消息给 PC 端
const sendMessageToClawbot = (text: string) => {
    cloudWs.send(JSON.stringify({
        type: 'app_message',
        content: text
    }));
};
为什么这套方案能完美生效？
符合官方约束： 不改一行 OpenClaw 源码。我们利用 openclaw config get gateway.auth.token 获取权限，并连接 18789 端口，这与官方文档中 WebUI 扩展和第三方客户端集成的标准做法完全一致。

穿越内网屏障： PC 适配器是作为客户端主动向 m.jmtrick.com 发起 WebSocket 连接的。这意味着用户不需要配置公网 IP、不需要搞 Ngrok，在任何校园网/家庭路由器下都能实现穿透。

彻底解决杀后台问题： 手机 App 杀后台无所谓，因为真正的长连接是维持在云端 Broker 和 PC Adapter 之间的。手机随时唤醒，随时与云端恢复同步。