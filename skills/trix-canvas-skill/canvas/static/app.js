/**
 * TRIX Canvas — Web UI 交互逻辑
 * 基于 litegraph.js 渲染节点图
 */

const API = "";
let graph = null;
let canvas = null;
let currentProject = null;
let nodeMap = {};   // db_id → lg_node
let edgeMap = {};   // db_id → lg_link

// ========== LiteGraph 初始化 ==========

function initGraph() {
  graph = new LGraph();
  canvas = new LGraphCanvas("#mycanvas", graph);
  canvas.background_image = null;
  canvas.render_shadows = false;
  canvas.render_connections_border = false;

  // 节点拖拽结束 → 保存坐标
  canvas.onNodeMoved = function (node) {
    if (node.id && node._dbId) {
      patchNode(node._dbId, { x: node.pos[0], y: node.pos[1] }).catch(() => {});
    }
  };

  // 右键菜单拦截
  canvas.getMenuOptions = function (node) {
    if (!node || !node._dbId) return [];
    return [
      { content: "🔍 查看大图", callback: () => previewNode(node) },
      { content: "📋 复制提示词", callback: () => copyPrompt(node) },
      null,
      { content: "🔄 重新生成", callback: () => regenerateNode(node) },
      { content: "🗑️ 删除节点", callback: () => deleteNode(node) },
    ];
  };

  canvas.resize();
  graph.start();
}

// ========== 节点类型注册 ==========

function registerNodeTypes() {
  // 图片节点
  function ImageNode() {
    this.addOutput("out", "image");
    this.addInput("in", "image");
    this.size = [240, 200];
    this._dbId = null;
    this._data = {};
  }
  ImageNode.title = "Image";
  ImageNode.title_color = "#4a9eff";
  ImageNode.prototype.onDrawForeground = function (ctx) {
    drawNodeCard(ctx, this, "image");
  };
  LiteGraph.registerNodeType("trix/image", ImageNode);

  // 视频节点
  function VideoNode() {
    this.addOutput("out", "video");
    this.addInput("in", "image");
    this.size = [240, 200];
    this._dbId = null;
    this._data = {};
  }
  VideoNode.title = "Video";
  VideoNode.title_color = "#b04aff";
  VideoNode.prototype.onDrawForeground = function (ctx) {
    drawNodeCard(ctx, this, "video");
  };
  LiteGraph.registerNodeType("trix/video", VideoNode);
}

// ========== 节点卡片渲染 ==========

function drawNodeCard(ctx, node, mediaType) {
  const w = node.size[0];
  const h = node.size[1];
  const data = node._data || {};
  const status = data.status || "pending";
  const prompt = data.prompt || "";
  const thumbUrl = getThumbUrl(data);

  // 背景
  ctx.fillStyle = "#1e2742";
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 6);
  ctx.fill();

  // 状态颜色边框
  const statusColors = {
    pending: "#555",
    generating: "#4a9eff",
    done: "#4aff9e",
    failed: "#ff4a4a",
  };
  ctx.strokeStyle = statusColors[status] || "#555";
  ctx.lineWidth = 2;
  ctx.stroke();

  // 缩略图区域
  const thumbH = 100;
  ctx.fillStyle = "#111";
  ctx.fillRect(4, 4, w - 8, thumbH);

  if (thumbUrl) {
    const img = node._thumbImg;
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, 4, 4, w - 8, thumbH);
    } else if (!img) {
      const i = new Image();
      i.crossOrigin = "anonymous";
      i.src = thumbUrl;
      i.onload = () => canvas.draw(true);
      node._thumbImg = i;
    }
  } else {
    ctx.fillStyle = "#444";
    ctx.font = "28px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(mediaType === "video" ? "🎬" : "🖼️", w / 2, thumbH / 2 + 16);
  }

  // 提示词
  ctx.fillStyle = "#ccc";
  ctx.font = "11px sans-serif";
  ctx.textAlign = "left";
  const promptY = thumbH + 16;
  const truncated = prompt.length > 40 ? prompt.slice(0, 40) + "…" : prompt;
  ctx.fillText(truncated, 8, promptY);

  // 状态标签
  const statusLabels = {
    pending: "⏳ 等待",
    generating: "⚡ 生成中",
    done: "✅ 完成",
    failed: "❌ 失败",
  };
  const badgeY = promptY + 18;
  ctx.fillStyle = statusColors[status] || "#555";
  ctx.font = "bold 10px sans-serif";
  ctx.fillText(statusLabels[status] || status, 8, badgeY);

  // 类型标签
  ctx.fillStyle = mediaType === "video" ? "#b04aff" : "#4a9eff";
  ctx.textAlign = "right";
  ctx.fillText(mediaType.toUpperCase(), w - 8, badgeY);

  // scene_id
  if (data.scene_id != null) {
    ctx.fillStyle = "#666";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`镜头 ${data.scene_id}`, 8, badgeY + 16);
  }
}

function getThumbUrl(data) {
  if (data.thumbnail_path) return `/media/${data.thumbnail_path}`;
  if (data._file && data._file.thumbnail_path) return `/media/${data._file.thumbnail_path}`;
  if (data._file && data._file.filepath) return `/media/${data._file.filepath}`;
  return "";
}

// ========== API 操作 ==========

async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API ${res.status}: ${err}`);
  }
  return res.json();
}

async function loadProjects() {
  const projects = await api("/api/projects");
  const sel = document.getElementById("project-select");
  sel.innerHTML = '<option value="">— 选择项目 —</option>';
  for (const p of projects) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    sel.appendChild(opt);
  }
}

async function loadProject(id) {
  if (!id) {
    currentProject = null;
    graph.clear();
    nodeMap = {};
    edgeMap = {};
    updateStatus("就绪");
    return;
  }
  currentProject = await api(`/api/projects/${id}`);
  graph.clear();
  nodeMap = {};
  edgeMap = {};
  renderProject(currentProject);
  updateStatus(`项目: ${currentProject.name}`);
  enableExportButtons(true);
}

function renderProject(project) {
  // 渲染节点
  for (const n of project.nodes) {
    const type = n.media_type === "video" ? "trix/video" : "trix/image";
    const lgNode = LiteGraph.createNode(type);
    lgNode.pos = [n.x || 0, n.y || 0];
    lgNode._dbId = n.id;
    lgNode._data = n;
    graph.add(lgNode);
    nodeMap[n.id] = lgNode;
  }

  // 渲染连线
  for (const e of project.edges) {
    const src = nodeMap[e.source_node_id];
    const tgt = nodeMap[e.target_node_id];
    if (!src || !tgt) continue;

    const color = getEdgeColor(e.edge_type);
    const link = src.connect(0, tgt, 0);
    if (link) {
      link.color = color;
      edgeMap[e.id] = link;
    }
  }

  canvas.draw(true);
}

function getEdgeColor(type) {
  const colors = {
    scene_order: "#888888",
    image_to_video: "#4a9eff",
    reference: "#f0c040",
  };
  return colors[type] || "#888888";
}

// ========== 节点操作 ==========

async function patchNode(dbId, data) {
  return api(`/api/nodes/${dbId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

async function regenerateNode(node) {
  if (!node._dbId) return;
  try {
    await api(`/api/nodes/${node._dbId}/regenerate`, { method: "POST" });
    node._data.status = "pending";
    canvas.draw(true);
    toast("已标记为待重新生成", "success");
  } catch (e) {
    toast("重生成失败: " + e.message, "error");
  }
}

async function deleteNode(node) {
  if (!node._dbId) return;
  if (!confirm("确定删除该节点？")) return;
  try {
    await api(`/api/nodes/${node._dbId}`, { method: "DELETE" });
    graph.remove(node);
    delete nodeMap[node._dbId];
    canvas.draw(true);
    toast("节点已删除", "success");
  } catch (e) {
    toast("删除失败: " + e.message, "error");
  }
}

function previewNode(node) {
  const data = node._data || {};
  const url = getThumbUrl(data);
  if (!url) return toast("无预览", "error");
  const modal = document.getElementById("preview-modal");
  const img = document.getElementById("preview-img");
  const info = document.getElementById("preview-info");
  img.src = url;
  info.textContent = data.prompt || "";
  modal.classList.remove("hidden");
}

function copyPrompt(node) {
  const prompt = (node._data || {}).prompt || "";
  if (!prompt) return toast("无提示词", "error");
  navigator.clipboard.writeText(prompt).then(() => {
    toast("已复制提示词", "success");
  });
}

// ========== 导出 ==========

function enableExportButtons(enabled) {
  document.getElementById("btn-export-video").disabled = !enabled;
  document.getElementById("btn-export-subtitle").disabled = !enabled;
}

function exportVideo() {
  if (!currentProject) return;
  window.open(`${API}/api/projects/${currentProject.id}/export/video`, "_blank");
}

async function exportSubtitle() {
  if (!currentProject) return;
  try {
    const data = await api(`/api/projects/${currentProject.id}/export/subtitle`);
    toast(`字幕已导出: ${data.srt}`, "success");
    // 下载文件
    window.open(`${API}/media/${data.srt}`, "_blank");
    window.open(`${API}/media/${data.script}`, "_blank");
  } catch (e) {
    toast("导出失败: " + e.message, "error");
  }
}

// ========== 新建项目 ==========

async function createNewProject() {
  const name = prompt("项目名称:", "短剧项目");
  if (!name) return;
  try {
    const project = await api("/api/projects", {
      method: "POST",
      body: JSON.stringify({ name, script_text: "" }),
    });
    await loadProjects();
    document.getElementById("project-select").value = project.id;
    await loadProject(project.id);
    toast("项目创建成功", "success");
  } catch (e) {
    toast("创建失败: " + e.message, "error");
  }
}

// ========== 工具函数 ==========

function updateStatus(text) {
  document.getElementById("status-text").textContent = text;
  const count = Object.keys(nodeMap).length;
  document.getElementById("node-count").textContent = count ? `${count} 个节点` : "";
}

function toast(msg, type = "") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ========== 轮询刷新 ==========

function startPolling() {
  setInterval(async () => {
    if (!currentProject) return;
    try {
      const project = await api(`/api/projects/${currentProject.id}`);
      for (const n of project.nodes) {
        const lgNode = nodeMap[n.id];
        if (!lgNode) continue;
        if (lgNode._data.status !== n.status) {
          lgNode._data = n;
          lgNode._thumbImg = null; // 重置缩略图缓存
          canvas.draw(true);
        }
      }
    } catch {}
  }, 5000);
}

// ========== 初始化 ==========

document.addEventListener("DOMContentLoaded", () => {
  initGraph();
  registerNodeTypes();

  // 事件绑定
  document.getElementById("project-select").addEventListener("change", (e) => {
    loadProject(e.target.value);
  });
  document.getElementById("btn-new-project").addEventListener("click", createNewProject);
  document.getElementById("btn-reload").addEventListener("click", () => {
    if (currentProject) loadProject(currentProject.id);
    else loadProjects();
  });
  document.getElementById("btn-export-video").addEventListener("click", exportVideo);
  document.getElementById("btn-export-subtitle").addEventListener("click", exportSubtitle);

  // 预览弹窗关闭
  document.getElementById("preview-close").addEventListener("click", () => {
    document.getElementById("preview-modal").classList.add("hidden");
  });
  document.querySelector(".preview-backdrop")?.addEventListener("click", () => {
    document.getElementById("preview-modal").classList.add("hidden");
  });

  // 加载项目列表
  loadProjects().catch((e) => toast("加载项目失败: " + e.message, "error"));
  startPolling();
});
