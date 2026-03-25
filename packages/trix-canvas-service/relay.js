#!/usr/bin/env node
/**
 * TRIX Canvas AI Relay v2 - 本地中转服务
 * 监听 :8788，把 canvas service 的 /generate 和 /tasks/:id 请求
 * 翻译成 MiniMax/apivyi 的实际 API 格式。
 * 
 * 改进：
 * - MiniMax 支持 aspect_ratio
 * - 视频生成支持 prompt + model
 * - 输出文件本地存储，URL 指向本地
 */

import http from "http";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ===== MiniMax 图片 =====
const MINIMAX_KEY = "sk-cp-zbiOqGC_0d9-sWktYKusN7cksnHJVivu2KcHOPdnTijfSBFDzrNZyafHEmfFkmucWqp6zAiIK55XwAmaYsXUbPUydRQwZrFsS1W9xfq7w8riIUFOHJZ4TrI";
const MINIMAX_URL = "https://api.minimaxi.com/v1/image_generation";

// ===== apivyi 视频 =====
const APIVYI_KEY = "sk-JtPVMNEhTCJcZRST26D74aA421Cc48678526F487A026441c";
const APIVYI_VIDEO_URL = "https://api.apiyi.com/v1/videos";

// ===== 任务存储 =====
const tasks = new Map();
const OUT_DIR = join(__dirname, "outputs");
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

function makeTaskId() {
  return "t_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ===== 解析 prompt 中的参数 =====
function parsePrompt(prompt) {
  // 提取比例
  const aspectMatch = prompt.match(/\[?(1:1|16:9|9:16|3:2|2:3)\]?(?:比例|ratio)?/i);
  const aspect = aspectMatch ? aspectMatch[1] : "1:1";
  
  // 清理 prompt 中的标签
  const cleanPrompt = prompt
    .replace(/\[(日式动漫|吉卜力|写实摄影|赛博朋克|水墨画|写实|动漫)\风格\]/gi, "")
    .replace(/\[(日式动漫风格|吉卜力风格|写实摄影风格|赛博朋克风格|水墨画风格)\]/gi, "")
    .replace(/，\d+:\d+比例/gi, "")
    .replace(/比例[：:]\s*(1:1|16:9|9:16)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  
  return { aspect, cleanPrompt };
}

// ===== MiniMax 生图 ======
async function generateImage(prompt, aspect) {
  const taskId = makeTaskId();
  tasks.set(taskId, { status: "processing", prompt, createdAt: Date.now() });

  (async () => {
    try {
      const resp = await fetch(MINIMAX_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${MINIMAX_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "image-01",
          prompt: prompt,
          aspect_ratio: aspect || "1:1",
          response_format: "base64",
        }),
      });
      const data = await resp.json();
      const imageData = data.data?.image_base64?.[0];
      if (imageData) {
        const imgPath = join(OUT_DIR, `${taskId}.png`);
        const buf = Buffer.from(imageData, "base64");
        writeFileSync(imgPath, buf);
        tasks.set(taskId, {
          status: "completed",
          result: { url: null, urls: [`http://localhost:8788/outputs/${taskId}.png`] },
          createdAt: Date.now(),
        });
        console.log(`[Relay] ✅ 图片完成: ${taskId}`);
      } else {
        console.error(`[Relay] ❌ MiniMax 错误:`, JSON.stringify(data));
        tasks.set(taskId, { status: "failed", error: JSON.stringify(data), createdAt: Date.now() });
      }
    } catch (e) {
      console.error(`[Relay] ❌ 异常:`, e.message);
      tasks.set(taskId, { status: "failed", error: e.message, createdAt: Date.now() });
    }
  })();

  return taskId;
}

// ===== apivyi 视频 ======
async function generateVideo(prompt) {
  const taskId = makeTaskId();
  tasks.set(taskId, { status: "processing", prompt, createdAt: Date.now() });

  (async () => {
    try {
      console.log(`[Relay] 📹 提交视频生成任务: ${prompt.slice(0, 50)}`);
      const resp = await fetch(APIVYI_VIDEO_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${APIVYI_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ prompt, model: "veo-3.1-fast" }),
      });
      const text = await resp.text();
      let videoTaskId = null;
      try {
        const d = JSON.parse(text);
        videoTaskId = d.id || d.task_id || d.video_task_id;
      } catch {}

      if (videoTaskId) {
        console.log(`[Relay] 📹 视频任务ID: ${videoTaskId}，开始轮询...`);
        for (let i = 0; i < 60; i++) {
          await new Promise(r => setTimeout(r, 10000));
          try {
            const sr = await fetch(`${APIVYI_VIDEO_URL}/${videoTaskId}`, {
              headers: { "Authorization": `Bearer ${APIVYI_KEY}` },
            });
            const sd = await sr.json();
            const st = sd.status || sd.state;
            if (st === "completed" || st === "done") {
              const videoUrl = sd.output?.url || sd.video?.url || sd.url;
              tasks.set(taskId, {
                status: "completed",
                result: { url: videoUrl, urls: videoUrl ? [videoUrl] : [] },
                createdAt: Date.now(),
              });
              console.log(`[Relay] ✅ 视频完成: ${taskId}`);
              return;
            } else if (st === "failed" || st === "error") {
              console.error(`[Relay] ❌ 视频失败:`, JSON.stringify(sd));
              tasks.set(taskId, { status: "failed", error: JSON.stringify(sd), createdAt: Date.now() });
              return;
            } else {
              console.log(`[Relay] ⏳ 视频生成中... (${i+1}/60) status: ${st}`);
            }
          } catch (e) { console.error(`[Relay] ❌ 轮询异常:`, e.message); }
        }
        tasks.set(taskId, { status: "failed", error: "video timeout", createdAt: Date.now() });
      } else {
        console.error(`[Relay] ❌ 无视频taskId: ${text.slice(0, 200)}`);
        tasks.set(taskId, { status: "failed", error: `no video task id: ${text.slice(0, 200)}`, createdAt: Date.now() });
      }
    } catch (e) {
      console.error(`[Relay] ❌ 视频异常:`, e.message);
      tasks.set(taskId, { status: "failed", error: e.message, createdAt: Date.now() });
    }
  })();

  return taskId;
}

// ===== HTTP Server ======
const hostname = "0.0.0.0";
const port = 8788;

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${hostname}:${port}`);
  const pathname = url.pathname;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  try {
    if (pathname === "/generate" && req.method === "POST") {
      let body = "";
      for await (const chunk of req) body += chunk;
      const { prompt, aspect } = JSON.parse(body);
      if (!prompt) return sendJson(res, 400, { error: "prompt is required" });

      const lower = prompt.toLowerCase();
      const isVideo = ["视频", "动画", "video", "animate"].some(k => lower.includes(k))
        && !["图片", "image", "生成一张", "生成一个"].some(k => lower.includes(k));

      // 解析比例
      const { aspect: parsedAspect, cleanPrompt } = parsePrompt(prompt);
      const finalAspect = aspect || parsedAspect;

      console.log(`[Relay] ${isVideo ? "📹 视频" : "🖼️ 图片"} | 比例: ${finalAspect} | ${cleanPrompt.slice(0, 50)}`);

      const taskId = isVideo
        ? await generateVideo(cleanPrompt)
        : await generateImage(cleanPrompt, finalAspect);
      sendJson(res, 200, { task_id: taskId, status: "pending" });

    } else if (pathname.match(/^\/tasks\/(.+)$/) && req.method === "GET") {
      const taskId = pathname.match(/^\/tasks\/(.+)$/)[1];
      const task = tasks.get(taskId);
      if (!task) return sendJson(res, 404, { error: "task not found" });
      sendJson(res, 200, {
        status: task.status === "completed" ? "completed"
               : task.status === "failed" ? "failed" : "processing",
        state: task.status,
        output: task.result || null,
        error: task.status === "failed" ? task.error : null,
      });

    } else if (pathname === "/health") {
      sendJson(res, 200, { status: "ok", service: "trix-canvas-relay-v2" });

    } else if (pathname.startsWith("/outputs/") && req.method === "GET") {
      const filename = pathname.slice("/outputs/".length);
      const imgPath = join(OUT_DIR, filename);
      if (existsSync(imgPath)) {
        const buf = readFileSync(imgPath);
        res.writeHead(200, { "Content-Type": "image/png" });
        res.end(buf);
      } else {
        res.writeHead(404); res.end("not found");
      }

    } else {
      sendJson(res, 404, { error: "not found" });
    }
  } catch (e) {
    console.error(`[Relay] ❌ 处理异常:`, e.message);
    sendJson(res, 500, { error: e.message });
  }
}

http.createServer(handleRequest).listen(port, hostname, () => {
  console.log(`✅ TRIX Canvas Relay v2 已启动: http://${hostname}:${port}`);
  console.log(`   /generate POST  → 提交生成任务`);
  console.log(`   /tasks/:id GET  → 查询任务状态`);
  console.log(`   /outputs/* GET  → 访问生成的图片`);
  console.log(`   /health GET    → 健康检查`);
  console.log(`   MiniMax: image-01 (aspect_ratio 支持 1:1/16:9/9:16)`);
  console.log(`   apivyi: veo-3.1-fast (视频)`);
});
