# 一键修复命令
# 在服务器上直接执行以下命令

# 备份
cp /opt/clawbot-channel/server.js /opt/clawbot-channel/server.js.backup

# 创建新版本的消息转发代码
cat > /tmp/new_message_code.txt << 'EOF'
      // 转发给 Clawbot (TRIX Channel v2.0.0 格式)
      const botSocket = botSockets.get(pairing.device_id);
      if (botSocket) {
        botSocket.emit('app_message', {
          type: 'chat_message',
          message: content,
          msg_id: messageId,
          sender_device_id: 'mobile_app',
          content_type: contentType,
          media_url: mediaUrl
        });
EOF

# 使用 awk 替换文件中的对应部分
awk '
/botSocket\.emit\(.app_message., \{/ {
    # 跳过接下来的4行（原来的emit代码块）
    getline; getline; getline; getline;
    # 插入新代码
    while ((getline line < "/tmp/new_message_code.txt") > 0) {
        print line;
    }
    next;
}
{ print }
' /opt/clawbot-channel/server.js > /opt/clawbot-channel/server.js.new

# 替换原文件
mv /opt/clawbot-channel/server.js.new /opt/clawbot-channel/server.js

# 重启服务器
pm2 restart clawbot-channel

# 查看日志
sleep 2
pm2 logs clawbot-channel --lines 15 --nostream
