# SSH 免密登录配置指南

## 服务器信息
- **Host**: trix-server (47.243.55.130)
- **User**: meowdoone

## 步骤 1：手动添加公钥到服务器

### 方法 A：使用 ssh-copy-id（需要输入密码）
```bash
ssh-copy-id -i ~/.ssh/id_ed25519.pub meowdoone@47.243.55.130
```

### 方法 B：手动复制（推荐，如果方法 A 失败）
1. 复制你的公钥：
```bash
cat ~/.ssh/id_ed25519.pub
```

2. 登录到服务器：
```bash
ssh meowdoone@47.243.55.130
```

3. 在服务器上添加公钥：
```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo "你的公钥内容" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
exit
```

## 步骤 2：测试免密登录
```bash
ssh trix-server "echo '免密登录成功！'"
```

## 步骤 3：Claude 使用 SSH
配置完成后，Claude 可以直接使用：
```bash
ssh trix-server "tail -100 /path/to/log"
ssh trix-server "systemctl status clawbot-channel"
```

## Post-Quantum 警告说明
警告信息是提示服务器使用的 SSH 版本较旧，不支持抗量子密码学算法。
这不影响安全使用，只是一个提示。

已在 `~/.ssh/config` 中配置了更安全的算法组合：
- KexAlgorithms: curve25519-sha256 (安全的椭圆曲线算法)
- Ciphers: aes256-gcm, chacha20-poly1305 (强加密)

## 故障排查

### 如果仍然需要密码
1. 检查服务器上的权限：
```bash
ssh trix-server "ls -la ~/.ssh/"
# 应该显示：
# drwx------ 2 meowdoone meowdoone 4096 .ssh/
# -rw------- 1 meowdoone meowdoone xxx authorized_keys
```

2. 检查 SSH 服务日志：
```bash
ssh trix-server "sudo tail -50 /var/log/auth.log"
```

### 如果连接超时
```bash
# 检查服务器是否可达
ping 47.243.55.130

# 检查 SSH 端口是否开放
nc -zv 47.243.55.130 22
```
