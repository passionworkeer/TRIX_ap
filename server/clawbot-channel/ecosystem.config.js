module.exports = {
  apps: [{
    name: 'clawbot-channel',
    script: './server.js',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '2048M',  // 2GB 内存限制
    env: {
      NODE_ENV: 'production',
      PORT: 8765
    },
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    // 自动重启
    autorestart: true,
    // 崩溃后延迟重启（减少频繁重启）
    restart_delay: 5000,
    // 最大重启次数（减少无限重启）
    max_restarts: 5,
    // 最小运行时间
    min_uptime: '30s'
  }]
};
