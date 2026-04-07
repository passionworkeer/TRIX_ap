#!/usr/bin/env node
/**
 * TRIX Canvas Service (Node 24 兼容版)
 * 端口: 8791 → 转发到本地 relay (8788) → APIyi
 */
import express from 'express';
import { createServer } from 'http';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 8791;
const DATA_DIR = join(__dirname, 'data_8791');
const OUTPUT_DIR = join(__dirname, 'outputs_8791');
const AI_API_BASE = 'http://localhost:8788';
const CANVAS_BASE_URL = `http://localhost:${PORT}`;

[DATA_DIR, OUTPUT_DIR, join(DATA_DIR, 'sessions')].forEach(d => {
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
});

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.static(join(__dirname, 'public')));
app.get('/test', (_, r) => r.sendFile(join(__dirname, 'public', 'test.html')));

// ─── AI 请求封装 ───
async function aiRequest(endpoint, body, method = 'POST') {
  const url = `${AI_API_BASE.replace(/\/$/, '')}${endpoint}`;
  const headers = { 'Content-Type': 'application/json' };
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

// ─── 路由 ───
app.get('/health', (_, res) => res.json({ status: 'ok', service: 'trix-canvas-8791' }));

// 列出项目
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

// 获取项目
app.get('/api/project/:projectId', (req, res) => {
  try {
    const projectFile = join(DATA_DIR, `${req.params.projectId}.json`);
    if (!existsSync(projectFile)) return res.status(404).json({ error: '项目不存在' });
    const project = JSON.parse(readFileSync(projectFile, 'utf-8'));
    project.sessions = (project.sessions || []).map(session => {
      const sf = join(DATA_DIR, 'sessions', `${session.id}.json`);
      if (existsSync(sf)) return { ...session, ...JSON.parse(readFileSync(sf, 'utf-8')) };
      return session;
    });
    res.json({ data: project });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 创建会话/提交任务
app.post('/api/session', async (req, res) => {
  try {
    const { message, sessionId, projectId } = req.body;
    if (!message) return res.status(400).json({ error: 'message 不能为空' });

    const now = new Date().toISOString();
    let project, session;

    if (sessionId) {
      const sessionFile = join(DATA_DIR, 'sessions', `${sessionId}.json`);
      if (!existsSync(sessionFile)) return res.status(404).json({ error: 'session 不存在' });
      session = JSON.parse(readFileSync(sessionFile, 'utf-8'));
      project = JSON.parse(readFileSync(join(DATA_DIR, `${session.projectId}.json`), 'utf-8'));
      session.messages = session.messages || [];
      session.messages.push({ role: 'user', content: message, timestamp: now });
    } else {
      const newProjectId = projectId || uuidv4();
      const newSessionId = uuidv4();
      project = {
        id: newProjectId,
        name: message.slice(0, 50),
        sessions: [{ id: newSessionId, createdAt: now }],
        createdAt: now,
        updatedAt: now,
      };
      session = {
        id: newSessionId,
        projectId: newProjectId,
        messages: [{ role: 'user', content: message, timestamp: now }],
        status: 'pending',
        taskId: null,
        createdAt: now,
      };
      writeFileSync(join(DATA_DIR, `${newProjectId}.json`), JSON.stringify(project, null, 2));
      writeFileSync(join(DATA_DIR, 'sessions', `${newSessionId}.json`), JSON.stringify(session, null, 2));
    }

    let taskId = null;
    try {
      const result = await aiRequest('/generate', { prompt: message });
      taskId = result.task_id || result.taskId || result.id || null;
      if (taskId) {
        session.status = 'generating';
        session.taskId = taskId;
        session.messages.push({ role: 'assistant', content: `任务已提交: ${taskId}`, timestamp: now });
      } else {
        session.status = 'error';
        session.error = '未返回 taskId';
      }
    } catch (e) {
      session.status = 'error';
      session.error = e.message;
    }

    writeFileSync(join(DATA_DIR, 'sessions', `${session.id}.json`), JSON.stringify(session, null, 2));
    project.updatedAt = now;
    writeFileSync(join(DATA_DIR, `${project.id}.json`), JSON.stringify(project, null, 2));

    res.json({
      data: {
        projectUuid: project.id,
        sessionId: session.id,
        taskId: taskId || '',
        projectUrl: `${CANVAS_BASE_URL}/canvas?projectId=${project.id}`,
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 查询会话状态
app.get('/api/session/:sessionId', async (req, res) => {
  try {
    const { afterSeq } = req.query;
    const sessionFile = join(DATA_DIR, 'sessions', `${req.params.sessionId}.json`);
    if (!existsSync(sessionFile)) return res.status(404).json({ error: 'session 不存在' });
    const session = JSON.parse(readFileSync(sessionFile, 'utf-8'));

    if (session.taskId && session.status === 'generating') {
      try {
        const result = await aiRequest(`/tasks/${session.taskId}`, null, 'GET');
        const status = result.status || result.state || result.progress;
        if (status === 'completed' || status === 'done' || status === 'success') {
          session.status = 'completed';
          const urls = result.output?.url
            || result.output?.urls
            || (Array.isArray(result.output) ? result.output.map(o => o.url || o) : [])
            || [];
          session.resultUrls = Array.isArray(urls) ? urls.filter(Boolean) : [urls].filter(Boolean);
          if (session.resultUrls.length) {
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
      } catch { /* 轮询中 */ }
    }

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

// 切换项目
app.post('/api/session/change-project', (req, res) => {
  const projectId = uuidv4();
  const now = new Date().toISOString();
  const project = { id: projectId, name: '新项目', sessions: [], createdAt: now, updatedAt: now };
  writeFileSync(join(DATA_DIR, `${projectId}.json`), JSON.stringify(project, null, 2));
  res.json({ data: { projectUuid: projectId, projectUrl: `${CANVAS_BASE_URL}/canvas?projectId=${projectId}` } });
});

// SPA 路由
app.get('/canvas', (req, res) => {
  const html = join(__dirname, 'public', 'canvas.html');
  res.type('html').send(readFileSync(html, 'utf-8'));
});

app.use((req, res) => res.status(404).json({ error: '接口不存在' }));

createServer(app).listen(PORT, '0.0.0.0', () => {
  console.log(`✅ TRIX Canvas 8791 已启动: http://localhost:${PORT}`);
  console.log(`   Canvas: http://localhost:${PORT}/canvas`);
  console.log(`   Relay:  http://localhost:8788 → APIyi`);
});
