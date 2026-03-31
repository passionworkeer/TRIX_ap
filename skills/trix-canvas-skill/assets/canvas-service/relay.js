#!/usr/bin/env node
/**
 * TRIX Canvas Relay — 用于将 Canvas /generate 请求转发到任意 AI 生成服务。
 * 所有配置通过环境变量注入，避免在仓库中存放任何 API key。
 */

import http from "http";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RELAY_PORT = Number(process.env.RELAY_PORT || 8791);
const RELAY_HOST = (process.env.RELAY_HOST || "127.0.0.1").trim() || "127.0.0.1";
const OUT_DIR = join(__dirname, "outputs");
const MAX_BODY_BYTES = Number(process.env.RELAY_MAX_BODY_BYTES || 256 * 1024);
const REQUEST_TIMEOUT_MS = Number(process.env.RELAY_REQUEST_TIMEOUT_MS || 120000);
const TASK_TTL_MS = Number(process.env.RELAY_TASK_TTL_MS || 60 * 60 * 1000);
const ALLOWED_ORIGINS = parseOriginList(process.env.RELAY_ALLOWED_ORIGINS || "");

const IMAGE_API_URL = process.env.IMAGE_API_URL || "";
const IMAGE_API_METHOD = (process.env.IMAGE_API_METHOD || "POST").toUpperCase();
const IMAGE_API_KEY = process.env.IMAGE_API_KEY || "";
const IMAGE_API_MODEL = process.env.IMAGE_API_MODEL || "";

const VIDEO_API_URL = process.env.VIDEO_API_URL || "";
const VIDEO_API_METHOD = (process.env.VIDEO_API_METHOD || "POST").toUpperCase();
const VIDEO_API_KEY = process.env.VIDEO_API_KEY || "";
const VIDEO_API_MODEL = process.env.VIDEO_API_MODEL || "";

const RELAY_OUTPUT_PREFIX = process.env.RELAY_OUTPUT_PREFIX || `http://localhost:${RELAY_PORT}/outputs`;

if (!existsSync(OUT_DIR)) {
  mkdirSync(OUT_DIR, { recursive: true });
}

const tasks = new Map();

function parseOriginList(raw) {
  return new Set(
    String(raw || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function makeTaskId() {
  return "t_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function parsePrompt(prompt) {
  const aspectMatch = prompt.match(/\[?(1:1|16:9|9:16|3:2|2:3)\]?(?:比例|ratio)?/i);
  const aspect = aspectMatch ? aspectMatch[1] : "1:1";
  const cleaned = prompt
    .replace(/\[(日式动漫|吉卜力|写实摄影|赛博朋克|水墨画|写实|动漫)\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return { aspect, cleaned };
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function setCorsHeaders(req, res) {
  const origin = typeof req.headers.origin === "string" ? req.headers.origin.trim() : "";
  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    return;
  }
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Vary", "Origin");
}

function cleanupExpiredTasks() {
  const now = Date.now();
  for (const [taskId, task] of tasks.entries()) {
    if (now - (task.createdAt || now) > TASK_TTL_MS) {
      tasks.delete(taskId);
    }
  }
}

const cleanupTimer = setInterval(cleanupExpiredTasks, TASK_TTL_MS);
cleanupTimer.unref();

function buildHeaders(apiKey) {
  const headers = {
    "Content-Type": "application/json",
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return headers;
}

async function fetchVendor({ url, method, payload, apiKey }) {
  if (!url) {
    throw new Error("未配置目标 AI 接口地址");
  }
  const response = await fetch(url, {
    method,
    headers: buildHeaders(apiKey),
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    const message = data.error || data.message || `${response.status}`;
    const error = new Error(`上游返回 ${message}`);
    error.payload = data;
    throw error;
  }
  return data;
}

function extractUrls(payload) {
  const cand = [
    payload?.url,
    payload?.urls,
    payload?.data?.url,
    payload?.data?.urls,
    payload?.output?.url,
    payload?.output?.urls,
    payload?.result?.url,
    payload?.result?.urls,
  ];
  const flat = [];
  cand.flat(Infinity).forEach((entry) => {
    if (typeof entry === "string" && entry.trim()) {
      flat.push(entry);
    } else if (Array.isArray(entry)) {
      entry.forEach((item) => {
        if (typeof item === "string" && item.trim()) {
          flat.push(item);
        }
      });
    }
  });
  return [...new Set(flat)];
}

function extractBase64(payload) {
  const base64 = payload?.base64 || payload?.data?.base64;
  if (typeof base64 === "string" && base64.trim()) {
    return base64;
  }
  const arr = payload?.data?.image_base64;
  if (Array.isArray(arr)) {
    return arr.find((item) => typeof item === "string" && item.trim());
  }
  return null;
}

function storeBase64(taskId, base64) {
  const bytes = Buffer.from(base64, "base64");
  const filePath = join(OUT_DIR, `${taskId}.png`);
  writeFileSync(filePath, bytes);
  return `${RELAY_OUTPUT_PREFIX.replace(/\/$/, "")}/${taskId}.png`;
}

async function generateImage(prompt, aspect) {
  const taskId = makeTaskId();
  tasks.set(taskId, { status: "processing", prompt, createdAt: Date.now() });
  const payload = {
    prompt,
    aspect,
    model: IMAGE_API_MODEL,
  };
  try {
    const data = await fetchVendor({
      url: IMAGE_API_URL,
      method: IMAGE_API_METHOD,
      payload,
      apiKey: IMAGE_API_KEY,
    });
    const urls = extractUrls(data);
    const base64 = extractBase64(data);
    const resultUrl = urls[0] || (base64 ? storeBase64(taskId, base64) : null);
    tasks.set(taskId, {
      status: "completed",
      result: { url: resultUrl, urls: resultUrl ? [resultUrl] : [] },
      createdAt: Date.now(),
    });
  } catch (error) {
    tasks.set(taskId, { status: "failed", error: error.message, createdAt: Date.now() });
  }
  return taskId;
}

async function generateVideo(prompt) {
  const taskId = makeTaskId();
  tasks.set(taskId, { status: "processing", prompt, createdAt: Date.now() });
  const payload = {
    prompt,
    model: VIDEO_API_MODEL,
  };
  try {
    const data = await fetchVendor({
      url: VIDEO_API_URL,
      method: VIDEO_API_METHOD,
      payload,
      apiKey: VIDEO_API_KEY,
    });
    const urls = extractUrls(data);
    tasks.set(taskId, {
      status: "completed",
      result: { url: urls[0] || null, urls },
      createdAt: Date.now(),
    });
  } catch (error) {
    tasks.set(taskId, { status: "failed", error: error.message, createdAt: Date.now() });
  }
  return taskId;
}

async function handleGenerate(req, res) {
  let body = "";
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) {
      return sendJson(res, 413, { error: "Request body too large" });
    }
    body += chunk;
  }
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    return sendJson(res, 400, { error: "Invalid JSON body" });
  }
  const prompt = String(payload.prompt || "").trim();
  if (!prompt) {
    return sendJson(res, 400, { error: "prompt is required" });
  }
  const lower = prompt.toLowerCase();
  const isVideo = ["视频", "video", "animate", "animation"].some((term) => lower.includes(term)) && !["图片", "image"].some((term) => lower.includes(term));
  const { aspect, cleaned } = parsePrompt(prompt);
  const taskId = await (isVideo ? generateVideo(cleaned) : generateImage(cleaned, aspect));
  sendJson(res, 200, { task_id: taskId, status: "pending" });
}

function handleTask(req, res) {
  const taskId = req.url.split("/").pop();
  const entry = tasks.get(taskId);
  if (!entry) {
    return sendJson(res, 404, { error: "task not found" });
  }
  const status = entry.status === "processing" ? "processing" : entry.status;
  sendJson(res, 200, {
    status,
    state: entry.status,
    output: entry.result || null,
    error: entry.status === "failed" ? entry.error : null,
  });
}

const server = http.createServer(async (req, res) => {
  const { url, method } = req;
  setCorsHeaders(req, res);
  if (method === "OPTIONS") {
    const origin = typeof req.headers.origin === "string" ? req.headers.origin.trim() : "";
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return sendJson(res, 403, { error: "origin not allowed" });
    }
    res.writeHead(204);
    return res.end();
  }
  if (url === "/generate" && method === "POST") {
    return handleGenerate(req, res);
  }
  if (url?.startsWith("/tasks/") && method === "GET") {
    return handleTask(req, res);
  }
  if (url === "/health" && method === "GET") {
    return sendJson(res, 200, { status: "ok", service: "trix-canvas-relay" });
  }
  sendJson(res, 404, { error: "not found" });
}).on("error", (error) => {
  console.error(error);
  process.exit(1);
});

server.listen(RELAY_PORT, RELAY_HOST, () => {
  console.log(`Canvas relay listening at http://${RELAY_HOST}:${RELAY_PORT}`);
  console.log(`  image -> ${IMAGE_API_URL || "(not configured)"}`);
  console.log(`  video -> ${VIDEO_API_URL || "(not configured)"}`);
});
