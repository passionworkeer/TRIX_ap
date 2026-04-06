import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import db from './db.js';

const DATA_ROOT = resolve(process.env.CANVAS_DATA_DIR || './data');

// Track migration statistics
const stats = { success: 0, failed: 0, skipped: 0 };

/**
 * Extract user_id from a JSON data object.
 * Checks userId first, then user_id, falls back to 'default_user'.
 */
function extractUserId(data) {
  return data?.userId ?? data?.user_id ?? 'default_user';
}

/**
 * Safely read and parse a JSON file, returning { data, error }.
 */
function safeReadJson(dir, file) {
  try {
    const raw = readFileSync(join(dir, file), 'utf8');
    const data = JSON.parse(raw);
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

console.log(`Starting migration from: ${DATA_ROOT}`);

const insertProject = db.prepare(`
  INSERT OR REPLACE INTO projects (id, user_id, name, script_text, created_at, updated_at)
  VALUES (@id, @user_id, @name, @script_text, @created_at, @updated_at)
`);
const insertNode = db.prepare(`
  INSERT OR REPLACE INTO nodes (id, user_id, project_id, session_id, file_id, parent_node_id, scene_id, media_type, x, y, prompt, status, aspect, style, task_id, result_url, error, created_at, updated_at)
  VALUES (@id, @user_id, @project_id, @session_id, @file_id, @parent_node_id, @scene_id, @media_type, @x, @y, @prompt, @status, @aspect, @style, @task_id, @result_url, @error, @created_at, @updated_at)
`);
const insertEdge = db.prepare(`
  INSERT OR REPLACE INTO edges (id, user_id, project_id, source_node_id, target_node_id, edge_type, created_at, updated_at)
  VALUES (@id, @user_id, @project_id, @source_node_id, @target_node_id, @edge_type, @created_at, @updated_at)
`);
const insertFile = db.prepare(`
  INSERT OR REPLACE INTO files (id, user_id, project_id, node_id, filename, stored_filename, mime_type, media_type, prompt, scene_id, size, source_url, url, created_at, updated_at)
  VALUES (@id, @user_id, @project_id, @node_id, @filename, @stored_filename, @mime_type, @media_type, @prompt, @scene_id, @size, @source_url, @url, @created_at, @updated_at)
`);
const insertSession = db.prepare(`
  INSERT OR REPLACE INTO sessions (id, user_id, project_id, node_id, parent_node_id, message, media_type, aspect, style, status, task_id, upstream_status, result_urls, messages, error, last_polled_at, created_at, updated_at)
  VALUES (@id, @user_id, @project_id, @node_id, @parent_node_id, @message, @media_type, @aspect, @style, @status, @task_id, @upstream_status, @result_urls, @messages, @error, @last_polled_at, @created_at, @updated_at)
`);

db.transaction(() => {
  const readDir = (dir) => existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.json')) : [];
  const readFile = (dir, file) => JSON.parse(readFileSync(join(dir, file), 'utf8'));

  // 1. Projects
  const projectDir = join(DATA_ROOT, 'projects');
  readDir(projectDir).forEach(f => {
    const { data: p, error } = safeReadJson(projectDir, f);
    if (error) {
      console.error(`[PROJECTS] Failed to read ${f}: ${error.message}`);
      stats.failed++;
      return;
    }
    const user_id = extractUserId(p);
    insertProject.run({
      id: p.id,
      user_id,
      name: p.name || 'Untitled',
      script_text: p.script_text || null,
      created_at: p.created_at || new Date().toISOString(),
      updated_at: p.updated_at || new Date().toISOString()
    });
    stats.success++;
  });

  // 2. Nodes
  const nodeDir = join(DATA_ROOT, 'nodes');
  readDir(nodeDir).forEach(f => {
    const { data: n, error } = safeReadJson(nodeDir, f);
    if (error) {
      console.error(`[NODES] Failed to read ${f}: ${error.message}`);
      stats.failed++;
      return;
    }
    const user_id = extractUserId(n);
    insertNode.run({
      id: n.id,
      user_id,
      project_id: n.project_id,
      session_id: n.session_id || null,
      file_id: n.file_id || null,
      parent_node_id: n.parent_node_id || null,
      scene_id: n.scene_id || null,
      media_type: n.media_type || 'image',
      x: n.x || 0,
      y: n.y || 0,
      prompt: n.prompt || null,
      status: n.status || 'queued',
      aspect: n.aspect || null,
      style: n.style || null,
      task_id: n.task_id || null,
      result_url: n.result_url || null,
      error: n.error || null,
      created_at: n.created_at || new Date().toISOString(),
      updated_at: n.updated_at || new Date().toISOString()
    });
    stats.success++;
  });

  // 3. Edges
  const edgeDir = join(DATA_ROOT, 'edges');
  readDir(edgeDir).forEach(f => {
    const { data: e, error } = safeReadJson(edgeDir, f);
    if (error) {
      console.error(`[EDGES] Failed to read ${f}: ${error.message}`);
      stats.failed++;
      return;
    }
    const user_id = extractUserId(e);
    insertEdge.run({
      id: e.id,
      user_id,
      project_id: e.project_id,
      source_node_id: e.source_node_id,
      target_node_id: e.target_node_id,
      edge_type: e.edge_type || 'scene_order',
      created_at: e.created_at || new Date().toISOString(),
      updated_at: e.updated_at || new Date().toISOString()
    });
    stats.success++;
  });

  // 4. Files
  const fileDir = join(DATA_ROOT, 'files');
  readDir(fileDir).forEach(f => {
    const { data: file, error } = safeReadJson(fileDir, f);
    if (error) {
      console.error(`[FILES] Failed to read ${f}: ${error.message}`);
      stats.failed++;
      return;
    }
    const user_id = extractUserId(file);
    insertFile.run({
      id: file.id,
      user_id,
      project_id: file.project_id,
      node_id: file.node_id || null,
      filename: file.filename || null,
      stored_filename: file.stored_filename || null,
      mime_type: file.mimeType || file.mime_type || null,
      media_type: file.mediaType || file.media_type || null,
      prompt: file.prompt || null,
      scene_id: file.scene_id || null,
      size: file.size || null,
      source_url: file.source_url || file.external_url || null,
      url: file.url || null,
      created_at: file.created_at || new Date().toISOString(),
      updated_at: file.updated_at || new Date().toISOString()
    });
    stats.success++;
  });

  // 5. Sessions
  const sessionDir = join(DATA_ROOT, 'sessions');
  readDir(sessionDir).forEach(f => {
    const { data: s, error } = safeReadJson(sessionDir, f);
    if (error) {
      console.error(`[SESSIONS] Failed to read ${f}: ${error.message}`);
      stats.failed++;
      return;
    }
    const user_id = extractUserId(s);
    insertSession.run({
      id: s.id || s.sessionId, // support sessionId fallback
      user_id,
      project_id: s.projectId || s.project_id, // fallbacks
      node_id: s.nodeId || s.node_id || null,
      parent_node_id: s.parentNodeId || s.parent_node_id || null,
      message: s.message || null,
      media_type: s.mediaType || s.media_type || 'image',
      aspect: s.aspect || null,
      style: s.style || null,
      status: s.status || 'queued',
      task_id: s.taskId || s.task_id || null,
      upstream_status: s.upstreamStatus || null,
      result_urls: s.resultUrls ? JSON.stringify(s.resultUrls) : null,
      messages: s.messages ? JSON.stringify(s.messages) : null,
      error: s.error || null,
      last_polled_at: s.lastPolledAt || null,
      created_at: s.createdAt || s.created_at || new Date().toISOString(),
      updated_at: s.updatedAt || s.updated_at || new Date().toISOString()
    });
    stats.success++;
  });

})();

console.log(`Migration complete. Success: ${stats.success} | Failed: ${stats.failed} | Skipped: ${stats.skipped}`);
