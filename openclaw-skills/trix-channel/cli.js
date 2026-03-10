#!/usr/bin/env node
/**
 * TRIX Channel CLI
 *
 * 命令行入口点
 */

const path = require('path');
const { spawn } = require('child_process');

// 获取主程序路径
const mainScript = path.join(__dirname, 'index.js');

// 启动主程序，传递所有参数
const child = spawn(process.execPath, [mainScript, ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: process.cwd(),
  env: process.env
});

child.on('exit', (code) => {
  process.exit(code || 0);
});

child.on('error', (err) => {
  console.error('启动失败:', err);
  process.exit(1);
});

// 处理信号
process.on('SIGINT', () => {
  child.kill('SIGINT');
});

process.on('SIGTERM', () => {
  child.kill('SIGTERM');
});
