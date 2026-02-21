#!/bin/bash
# 在服务器上执行此脚本来修复消息格式问题

echo "🔄 开始修复服务器消息格式..."

# 1. 备份原文件
echo "📦 备份原文件..."
cp /opt/clawbot-channel/server.js /opt/clawbot-channel/server.js.backup-$(date +%Y%m%d-%H%M%S)

# 2. 使用 sed 修改文件
echo "🔧 修改消息格式..."
sed -i "666,671c\        // 转发给 Clawbot (TRIX Channel v2.0.0 格式)\n        const botSocket = botSockets.get(pairing.device_id);\n        if (botSocket) {\n          botSocket.emit('app_message', {\n            type: 'chat_message',\n            message: content,\n            msg_id: messageId,\n            sender_device_id: 'mobile_app',\n            content_type: contentType,\n            media_url: mediaUrl\n          });" /opt/clawbot-channel/server.js

# 3. 验证修改
echo "🔍 验证修改..."
echo "修改后的代码："
sed -n '663,678p' /opt/clawbot-channel/server.js

# 4. 重启服务器
echo "🔄 重启服务器..."
pm2 restart clawbot-channel

# 5. 查看日志
echo "📋 查看最新日志..."
sleep 2
pm2 logs clawbot-channel --lines 10 --nostream

echo "✅ 修复完成！"
echo ""
echo "📱 现在可以在手机 App 中发送消息测试"
