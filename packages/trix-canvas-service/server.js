import express from 'express';
import { createServer } from 'http';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.CANVAS_PORT || 8789;
const DATA_DIR = process.env.CANVAS_DATA_DIR || join(__dirname, 'data');
const OUTPUT_DIR = process.env.CANVAS_OUTPUT_DIR || join(__dirname, 'outputs');
const CANVAS_BASE_URL = process.env.CANVAS_BASE_URL || `http://localhost:${PORT}`;

// 确保目录存在
[DATA_DIR, OUTPUT_DIR].forEach(dir => {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
});

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.static(join(__dirname, 'public')));

// 解析额外 headers
function parseExtraHeaders() {
  const headers = {};
  const raw = process.env.AI_EXTRA_HEADERS || '';
  raw.split('\n').filter(Boolean).forEach(line => {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      if (key && val) headers[key] = val;
    }
  });
  return headers;
}

// AI API 请求封装
async function aiRequest(endpoint, body, method = 'POST') {
  const base = process.env.AI_API_BASE;
  if (!base) throw new Error('AI_API_BASE 未配置，请在 .env 中设置');

  const url = `${base.replace(/\/$/, '')}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...parseExtraHeaders(),
  };
  const key = process.env.AI_API_KEY;
  if (key) headers['Authorization'] = `Bearer ${key}`;

  const resp = await fetch(url, {
    method,
    headers,
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`AI API 错误 ${resp.status}: ${text}`);
  }
  return resp.json();
}

// ============================================================
// API 路由
// ============================================================

// GET /api/project/:projectId - 获取项目详情
app.get('/api/project/:projectId', (req, res) => {
  try {
    const projectFile = join(DATA_DIR, `${req.params.projectId}.json`);
    if (!existsSync(projectFile)) {
      return res.status(404).json({ error: '项目不存在' });
    }
    const project = JSON.parse(readFileSync(projectFile, 'utf-8'));

    // 补充每个 session 的文件列表
    project.sessions = (project.sessions || []).map(session => {
      const sessionFile = join(DATA_DIR, 'sessions', `${session.id}.json`);
      if (existsSync(sessionFile)) {
        const sessionData = JSON.parse(readFileSync(sessionFile, 'utf-8'));
        return { ...session, ...sessionData };
      }
      return session;
    });

    res.json({ data: project });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/projects - 列出所有项目（简要信息）
app.get('/api/projects', (req, res) => {
  try {
    const files = readdirSync(DATA_DIR).filter(f => f.endsWith('.json') && !f.startsWith('sessions'));
    const projects = files.map(file => {
      try {
        const data = JSON.parse(readFileSync(join(DATA_DIR, file), 'utf-8'));
        return {
          id: data.id,
          name: data.name || data.id,
          sessionCount: (data.sessions || []).length,
          updatedAt: data.updatedAt,
          createdAt: data.createdAt,
          canvasUrl: `${CANVAS_BASE_URL}/canvas?projectId=${data.id}`,
        };
      } catch { return null; }
    }).filter(Boolean);
    projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    res.json({ data: projects });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/session - 创建会话（提交生成任务）
app.post('/api/session', async (req, res) => {
  try {
    const { message, sessionId, projectId } = req.body;
    if (!message) return res.status(400).json({ error: 'message 不能为空' });

    const now = new Date().toISOString();
    let project, session;

    if (sessionId) {
      // 向已有 session 发消息
      const sessionFile = join(DATA_DIR, 'sessions', `${sessionId}.json`);
      if (!existsSync(sessionFile)) {
        return res.status(404).json({ error: 'session 不存在' });
      }
      session = JSON.parse(readFileSync(sessionFile, 'utf-8'));
      project = JSON.parse(readFileSync(join(DATA_DIR, `${session.projectId}.json`), 'utf-8'));
      session.messages = session.messages || [];
      session.messages.push({ role: 'user', content: message, timestamp: now });
    } else {
      // 新建项目 + 会话
      projectId || (projectId = uuidv4());
      sessionId || (sessionId = uuidv4());
      project = {
        id: projectId,
        name: message.slice(0, 50),
        sessions: [{ id: sessionId, createdAt: now }],
        createdAt: now,
        updatedAt: now,
      };
      session = {
        id: sessionId,
        projectId,
        messages: [{ role: 'user', content: message, timestamp: now }],
        status: 'pending',
        taskId: null,
        createdAt: now,
      };
      // 初始化项目文件
      const projectFile = join(DATA_DIR, `${projectId}.json`);
      writeFileSync(projectFile, JSON.stringify(project, null, 2));
      // 初始化会话文件
      const sessionDir = join(DATA_DIR, 'sessions');
      if (!existsSync(sessionDir)) mkdirSync(sessionDir, { recursive: true });
      writeFileSync(join(sessionDir, `${sessionId}.json`), JSON.stringify(session, null, 2));
    }

    // 调用 AI 生成 API
    let taskId = null;
    let generationResult = null;
    try {
      const result = await aiRequest('/generate', { prompt: message });
      // 通用字段映射（可根据实际 API 调整）
      taskId = result.task_id || result.taskId || result.id || result.data?.task_id || null;
      generationResult = result;
    } catch (e) {
      session.status = 'error';
      session.error = e.message;
    }

    if (taskId) {
      session.status = 'generating';
      session.taskId = taskId;
      session.aiResponse = generationResult;
      session.messages.push({ role: 'assistant', content: `任务已提交: ${taskId}`, timestamp: now });
    }

    // 更新文件
    writeFileSync(join(DATA_DIR, 'sessions', `${sessionId}.json`), JSON.stringify(session, null, 2));
    project.updatedAt = now;
    if (!project.sessions.find(s => s.id === sessionId)) {
      project.sessions.push({ id: sessionId, createdAt: now });
    }
    writeFileSync(join(DATA_DIR, `${project.id}.json`), JSON.stringify(project, null, 2));

    res.json({
      data: {
        projectUuid: project.id,
        sessionId: session.id,
        taskId,
        projectUrl: `${CANVAS_BASE_URL}/canvas?projectId=${project.id}`,
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/session/:sessionId - 查询会话状态
app.get('/api/session/:sessionId', async (req, res) => {
  try {
    const { afterSeq } = req.query;
    const sessionFile = join(DATA_DIR, 'sessions', `${req.params.sessionId}.json`);
    if (!existsSync(sessionFile)) {
      return res.status(404).json({ error: 'session 不存在' });
    }
    const session = JSON.parse(readFileSync(sessionFile, 'utf-8'));

    // 检查 task 状态
    if (session.taskId && session.status === 'generating') {
      try {
        const result = await aiRequest(`/tasks/${session.taskId}`, null, 'GET');
        const status = result.status || result.state || result.progress;
        if (status === 'completed' || status === 'done' || status === 'success') {
          session.status = 'completed';
          session.messages = session.messages || [];
          // 提取结果 URL
          const urls = result.output?.url
            || result.output?.urls
            || result.data?.url
            || result.data?.urls
            || result.images?.map(i => i.url)
            || result.videos?.map(v => v.url)
            || [];
          if (urls.length) {
            session.resultUrls = Array.isArray(urls) ? urls : [urls];
            session.messages.push({
              role: 'assistant',
              content: `生成完成: ${session.resultUrls.join(', ')}`,
              timestamp: new Date().toISOString(),
            });
          }
          writeFileSync(sessionFile, JSON.stringify(session, null, 2));
        } else if (status === 'failed' || status === 'error') {
          session.status = 'error';
          session.error = result.error || result.message || '生成失败';
          writeFileSync(sessionFile, JSON.stringify(session, null, 2));
        }
      } catch { /* 轮询中，允许继续 */ }
    }

    // 增量拉取（afterSeq 以后的 message）
    const messages = (session.messages || []).slice(Number(afterSeq) || 0);
    res.json({
      data: {
        sessionId: session.id,
        projectId: session.projectId,
        status: session.status,
        taskId: session.taskId,
        messages,
        resultUrls: session.resultUrls || [],
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/session/change-project - 切换/创建新项目
app.post('/api/session/change-project', (req, res) => {
  const projectId = uuidv4();
  const now = new Date().toISOString();
  const project = {
    id: projectId,
    name: '新项目',
    sessions: [],
    createdAt: now,
    updatedAt: now,
  };
  const projectFile = join(DATA_DIR, `${projectId}.json`);
  writeFileSync(projectFile, JSON.stringify(project, null, 2));
  res.json({
    data: {
      projectUuid: projectId,
      projectUrl: `${CANVAS_BASE_URL}/canvas?projectId=${projectId}`,
    }
  });
});

// POST /api/file/upload - 上传文件到 OSS
app.post('/api/file/upload', async (req, res) => {
  try {
    const { fileData, filename, mimeType } = req.body;
    const uploadUrl = process.env.UPLOAD_API_URL;
    if (!uploadUrl) throw new Error('UPLOAD_API_URL 未配置');

    const body = { file: fileData, filename, mimeType };
    const headers = {};
    const key = process.env.UPLOAD_API_KEY;
    if (key) headers['Authorization'] = `Bearer ${key}`;

    const resp = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    const result = await resp.json();
    res.json({ data: result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /health - 健康检查
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'trix-canvas' }));

// 兜底：SPA 路由（canvas 页面）
app.get('/canvas', (req, res) => {
  const html = join(__dirname, 'public', 'canvas.html');
  res.type('html').send(readFileSync(html, 'utf-8'));
});

// 兜底 404
app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

const server = createServer(app);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`TRIX Canvas Service 已启动: http://0.0.0.0:${PORT}`);
  console.log(`  - Canvas 页面: http://0.0.0.0:${PORT}/canvas`);
  console.log(`  - 健康检查:    http://0.0.0.0:${PORT}/health`);
  console.log(`  - 数据目录:    ${DATA_DIR}`);
  console.log(`  - 输出目录:    ${OUTPUT_DIR}`);
  if (!process.env.AI_API_BASE) {
    console.warn('⚠️  AI_API_BASE 未配置，请在 .env 中设置');
  }
});
