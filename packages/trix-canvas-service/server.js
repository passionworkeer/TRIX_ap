import express from 'express';
import { createServer } from 'http';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname, extname, resolve } from 'path';
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

// GET /api/projects - 列出所有项目（Canvas Skill 模型）
app.get('/api/projects', (req, res) => {
  try {
    if (!existsSync(PROJECTS_DIR)) { mkdirSync(PROJECTS_DIR, { recursive: true }); }
    const files = readdirSync(PROJECTS_DIR).filter(f => f.endsWith('.json'));
    const projects = files.map(file => {
      try {
        const data = JSON.parse(readFileSync(join(PROJECTS_DIR, file), 'utf-8'));
        return {
          id: data.id,
          name: data.name || data.id,
          nodeCount: (data.nodes || []).length,
          edgeCount: (data.edges || []).length,
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

// ============================================================
// Canvas Skill API — 项目/节点/连线模型（补充 session API）
// ============================================================

// Canvas Skill 存储路径（与 session API 的 DATA_DIR 分开）
// resolve() 正确处理 Windows 绝对路径
const CANVAS_DATA_DIR = resolve(__dirname, '..', '..', 'skills', 'trix-canvas-skill', 'canvas', 'data_8791');
const FILES_DIR = join(CANVAS_DATA_DIR, 'files');
const PROJECTS_DIR = join(CANVAS_DATA_DIR, 'projects');
const NODES_DIR = join(CANVAS_DATA_DIR, 'nodes');
const EDGES_DIR = join(CANVAS_DATA_DIR, 'edges');

[CANVAS_DATA_DIR, FILES_DIR, PROJECTS_DIR, NODES_DIR, EDGES_DIR].forEach(d => {
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
});

// 简化存储读写
function readJson(dir, id) {
  const file = join(dir, `${id}.json`);
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf-8')) : null;
}
function writeJson(dir, id, data) {
  writeFileSync(join(dir, `${id}.json`), JSON.stringify(data, null, 2));
}
function listJson(dir) {
  return readdirSync(dir).filter(f => f.endsWith('.json')).map(f => {
    try { return JSON.parse(readFileSync(join(dir, f), 'utf-8')); }
    catch { return null; }
  }).filter(Boolean);
}

// POST /api/projects — 创建项目
app.post('/api/projects', (req, res) => {
  try {
    const { name = 'Untitled', script_text = '' } = req.body || {};
    const id = Date.now().toString();
    const now = new Date().toISOString();
    const project = { id, name, script_text, nodes: [], edges: [], createdAt: now, updatedAt: now };
    writeJson(PROJECTS_DIR, id, project);
    res.json({ id, name, createdAt: now, updatedAt: now });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/projects/:id — 获取项目详情
app.get('/api/projects/:id', (req, res) => {
  try {
    const project = readJson(PROJECTS_DIR, req.params.id);
    if (!project) return res.status(404).json({ error: '项目不存在' });
    res.json({ data: project });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/projects/:id/files — 项目文件列表
app.get('/api/projects/:id/files', (req, res) => {
  try {
    const project = readJson(PROJECTS_DIR, req.params.id);
    if (!project) return res.status(404).json({ error: '项目不存在' });
    const files = listJson(FILES_DIR).filter(f => f.projectId == req.params.id);
    res.json({ data: files });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/upload — 上传文件
// 支持 multipart/form-data（浏览器）或 JSON {fileData, filename, ...}（Python skill）
app.post('/api/upload', (req, res) => {
  try {
    let fileData, filename, mimeType, projectId, prompt, mediaType, sceneId;

    const ct = req.headers['content-type'] || '';
    if (ct.includes('multipart/form-data')) {
      // 解析 multipart（Node 原生不支持，换 JSON base64 方案）
      return res.status(400).json({ error: '请使用 JSON 格式上传：{fileData(base64),filename,mimeType,projectId}' });
    } else {
      // JSON 格式：fileData 为 base64 字符串
      const body = req.body || {};
      const b64 = body.fileData || body.file_data;
      if (!b64) return res.status(400).json({ error: '缺少 fileData 字段' });
      fileData = Buffer.from(b64, body.filename?.endsWith('.mp4') ? 'base64' : 'base64');
      filename = body.filename || 'upload';
      mimeType = body.mimeType || body.mime_type || 'application/octet-stream';
      projectId = body.projectId || body.project_id;
      prompt = body.prompt || '';
      mediaType = body.mediaType || body.media_type || 'image';
      sceneId = body.sceneId != null ? body.sceneId : (body.scene_id != null ? body.scene_id : null);
    }

    const id = Date.now().toString();
    const ext = filename.split('.').pop();
    const safeName = `${id}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = join(FILES_DIR, safeName);
    writeFileSync(filePath, fileData);

    const fileMeta = {
      id,
      projectId: projectId ? String(projectId) : null,
      filename,
      storedFilename: safeName,
      mimeType,
      mediaType,
      prompt,
      sceneId,
      size: fileData.length,
      url: `/media/files/${safeName}`,
      createdAt: new Date().toISOString(),
    };
    writeJson(FILES_DIR, id, fileMeta);

    // 关联到项目
    if (projectId) {
      const project = readJson(PROJECTS_DIR, String(projectId));
      if (project) {
        if (!project.fileIds) project.fileIds = [];
        if (!project.fileIds.includes(id)) project.fileIds.push(id);
        project.updatedAt = new Date().toISOString();
        writeJson(PROJECTS_DIR, String(projectId), project);
      }
    }

    res.json({ id, ...fileMeta });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/nodes — 创建节点
app.post('/api/nodes', (req, res) => {
  try {
    const { project_id, file_id, scene_id, media_type, x, y, prompt, status, task_id } = req.body || {};
    const id = Date.now().toString();
    const node = {
      id: Number(id),
      projectId: project_id ? String(project_id) : null,
      fileId: file_id != null ? Number(file_id) : null,
      sceneId: scene_id != null ? Number(scene_id) : null,
      mediaType: media_type || 'image',
      x: Number(x) || 0,
      y: Number(y) || 0,
      prompt: prompt || '',
      status: status || 'pending',
      taskId: task_id || '',
      createdAt: new Date().toISOString(),
    };
    writeJson(NODES_DIR, id, node);

    if (node.projectId) {
      const project = readJson(PROJECTS_DIR, node.projectId);
      if (project) {
        if (!project.nodes) project.nodes = [];
        project.nodes.push(node);
        project.updatedAt = new Date().toISOString();
        writeJson(PROJECTS_DIR, node.projectId, project);
      }
    }

    res.json({ id: Number(id), ...node });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/nodes/:id — 更新节点
app.patch('/api/nodes/:id', (req, res) => {
  try {
    const node = readJson(NODES_DIR, req.params.id);
    if (!node) return res.status(404).json({ error: '节点不存在' });
    const updated = { ...node, ...req.body, id: node.id };
    writeJson(NODES_DIR, req.params.id, updated);

    if (updated.projectId) {
      const project = readJson(PROJECTS_DIR, updated.projectId);
      if (project && project.nodes) {
        const idx = project.nodes.findIndex(n => n.id === node.id);
        if (idx >= 0) project.nodes[idx] = updated;
        project.updatedAt = new Date().toISOString();
        writeJson(PROJECTS_DIR, updated.projectId, project);
      }
    }

    res.json({ data: updated });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/edges — 创建连线
app.post('/api/edges', (req, res) => {
  try {
    const { project_id, source_node_id, target_node_id, edge_type } = req.body || {};
    if (!source_node_id || !target_node_id) {
      return res.status(400).json({ error: 'source_node_id 和 target_node_id 不能为空' });
    }
    // 校验节点存在
    const src = readJson(NODES_DIR, String(source_node_id));
    const tgt = readJson(NODES_DIR, String(target_node_id));
    if (!src) return res.status(404).json({ error: `源节点 ${source_node_id} 不存在` });
    if (!tgt) return res.status(404).json({ error: `目标节点 ${target_node_id} 不存在` });
    const id = Date.now().toString();
    const edge = {
      id: Number(id),
      projectId: project_id ? String(project_id) : null,
      sourceNodeId: Number(source_node_id),
      targetNodeId: Number(target_node_id),
      edgeType: edge_type || 'scene_order',
      createdAt: new Date().toISOString(),
    };
    writeJson(EDGES_DIR, id, edge);

    if (edge.projectId) {
      const project = readJson(PROJECTS_DIR, edge.projectId);
      if (project) {
        if (!project.edges) project.edges = [];
        project.edges.push(edge);
        project.updatedAt = new Date().toISOString();
        writeJson(PROJECTS_DIR, edge.projectId, project);
      }
    }

    res.json({ id: Number(id), ...edge });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 媒体文件访问（与 Python skill 的 /media/ 路径一致）
// 自定义媒体文件服务（express.static 有 Windows 路径兼容问题）
app.get('/media/files/:filename', (req, res) => {
  const filename = req.params.filename.replace(/[^a-zA-Z0-9._-]/g, '');
  const filePath = join(FILES_DIR, filename);
  if (!existsSync(filePath)) return res.status(404).json({ error: '文件不存在' });
  res.sendFile(filePath);
});

// ============================================================
// 原有路由（兜底 404 之前）
// ============================================================

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
  console.log(`  - Canvas Skill 数据: ${CANVAS_DATA_DIR}`);
  console.log(`  - 输出目录:    ${OUTPUT_DIR}`);
  if (!process.env.AI_API_BASE) {
    console.warn('⚠️  AI_API_BASE 未配置，请在 .env 中设置');
  }
});
