/**
 * TRIX Canvas v2 — AI 分镜画布
 * 节点卡片 + 缩略图 + 提示词 + 右键菜单 + 边类型切换
 */

const API = "";
let graph = null;
let canvas = null;
let currentProject = null;
let nodeMap = {};   // db_id -> lg_node
let edgeMap = {};   // db_id -> lg_link

// ========== 工具函数 ==========

function normalize(p) { return p ? p.replace(/\\/g, "/") : ""; }

function getThumbUrl(data) {
  const tp = normalize(data.thumbnail_path);
  const fp = normalize(data._file && data._file.thumbnail_path);
  const ff = normalize(data._file && data._file.filepath);
  if (tp) return `/media/${tp}`;
  if (fp) return `/media/${fp}`;
  if (ff) return `/media/${ff}`;
  return "";
}

function toast(msg, type) {
  const el = document.createElement("div");
  el.className = "toast " + (type || "");
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

function updateStatus(text) {
  document.getElementById("status-text").textContent = text;
  document.getElementById("node-count").textContent =
    Object.keys(nodeMap).length ? Object.keys(nodeMap).length + " 个节点" : "";
}

// ========== LiteGraph 初始化 ==========

function initGraph() {
  graph = new LGraph();
  canvas = new LGraphCanvas("#mycanvas", graph);
  canvas.background_image = null;
  canvas.render_shadows = false;
  canvas.render_connections_border = false;

  // 节点拖拽结束 -> 保存坐标
  canvas.onNodeMoved = function (node) {
    if (node._dbId) {
      api("/api/nodes/" + node._dbId, {
        method: "PATCH",
        body: JSON.stringify({ x: node.pos[0], y: node.pos[1] }),
      }).catch(function () {});
    }
  };

  // 右键菜单
  canvas.getMenuOptions = function (node) {
    if (!node || !node._dbId) return [];
    var data = node._data || {};
    var items = [];

    items.push({ content: "[Preview] View Image", callback: function () { previewNode(node); } });
    items.push({ content: "[Copy] Copy Prompt", callback: function () { copyPrompt(node); } });
    items.push({ content: "[Edit] Edit Prompt", callback: function () { editPrompt(node); } });
    items.push(null);

    items.push({ content: "[Regen] Regenerate", callback: function () { regenerateNode(node); } });
    items.push({ content: "[Video] Generate Video", callback: function () { generateVideo(node); } });
    items.push(null);

    // Edge type submenu
    items.push({
      content: "[Edge] Edge Type",
      submenu: {
        title: "Edge Type",
        options: [
          { content: "Scene Order (gray)", callback: function () { setOutgoingEdgeType(node, "scene_order"); } },
          { content: "Image->Video (blue)", callback: function () { setOutgoingEdgeType(node, "image_to_video"); } },
          { content: "Reference (yellow)", callback: function () { setOutgoingEdgeType(node, "reference"); } },
        ]
      }
    });

    items.push(null);
    items.push({ content: "[Delete] Delete Node", callback: function () { deleteNode(node); } });
    return items;
  };

  canvas.resize();
  graph.start();
}

// ========== API ==========

function api(path, opts) {
  return fetch(API + path, Object.assign({
    headers: { "Content-Type": "application/json" },
  }, opts || {})).then(function (res) {
    if (!res.ok) return res.text().then(function (t) { throw new Error("API " + res.status + ": " + t); });
    return res.json();
  });
}

// ========== 项目加载 ==========

function loadProjects() {
  return api("/api/projects").then(function (projects) {
    var sel = document.getElementById("project-select");
    sel.innerHTML = '<option value="">-- Select Project --</option>';
    projects.forEach(function (p) {
      var opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      sel.appendChild(opt);
    });
  });
}

function loadProject(id) {
  if (!id) {
    currentProject = null;
    graph.clear();
    nodeMap = {};
    edgeMap = {};
    updateStatus("Ready");
    return Promise.resolve();
  }
  return api("/api/projects/" + id).then(function (project) {
    currentProject = project;
    graph.clear();
    nodeMap = {};
    edgeMap = {};
    renderProject(project);
    updateStatus("Project: " + project.name);
    document.getElementById("btn-export-video").disabled = false;
    document.getElementById("btn-export-subtitle").disabled = false;
  });
}

// ========== 渲染节点图 ==========

function renderProject(project) {
  // 渲染节点
  project.nodes.forEach(function (n) {
    var type = n.media_type === "video" ? "trix/video" : "trix/image";
    var lgNode = LiteGraph.createNode(type);
    lgNode.pos = [n.x || 0, n.y || 0];
    lgNode._dbId = n.id;
    lgNode._data = n;

    // 设置输出端口名称
    if (lgNode.outputs && lgNode.outputs[0]) {
      lgNode.outputs[0].name = "out";
      lgNode.outputs[0].type = n.media_type === "video" ? "video" : "image";
    }
    if (lgNode.inputs && lgNode.inputs[0]) {
      lgNode.inputs[0].name = "in";
      lgNode.inputs[0].type = n.media_type === "video" ? "image" : "image";
    }

    graph.add(lgNode);
    nodeMap[n.id] = lgNode;
  });

  // 渲染连线
  project.edges.forEach(function (e) {
    var src = nodeMap[e.source_node_id];
    var tgt = nodeMap[e.target_node_id];
    if (!src || !tgt) return;
    var link = src.connect(0, tgt, 0);
    if (link) {
      link.color = getEdgeColor(e.edge_type);
      link._edgeType = e.edge_type;
      link._dbId = e.id;
      edgeMap[e.id] = link;
    }
  });

  canvas.draw(true);
}

function getEdgeColor(type) {
  return { scene_order: "#667788", image_to_video: "#4a9eff", reference: "#f0c040" }[type] || "#667788";
}

// ========== 节点类型注册 ==========

function registerNodeTypes() {
  // --- Image Node ---
  function ImageNode() {
    this.addOutput("out", "image");
    this.addInput("in", "image");
    this.size = [320, 310];
    this._dbId = null;
    this._data = {};
  }
  ImageNode.title = "Image";
  ImageNode.title_color = "#4a9eff";
  ImageNode.prototype.onDrawForeground = function (ctx) { drawNodeCard(ctx, this, "image"); };
  LiteGraph.registerNodeType("trix/image", ImageNode);

  // --- Video Node ---
  function VideoNode() {
    this.addOutput("out", "video");
    this.addInput("in", "image");
    this.size = [320, 310];
    this._dbId = null;
    this._data = {};
  }
  VideoNode.title = "Video";
  VideoNode.title_color = "#b04aff";
  VideoNode.prototype.onDrawForeground = function (ctx) { drawNodeCard(ctx, this, "video"); };
  LiteGraph.registerNodeType("trix/video", VideoNode);
}

// ========== 节点卡片渲染 ==========

function drawNodeCard(ctx, node, mediaType) {
  var w = node.size[0];
  var h = node.size[1];
  var data = node._data || {};
  var status = data.status || "pending";
  var prompt = data.prompt || "";
  var sceneId = data.scene_id;
  var thumbUrl = getThumbUrl(data);

  // ---- 背景 ----
  var grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#1c2333");
  grad.addColorStop(1, "#151b28");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 12);
  ctx.fill();

  // ---- 顶部色条 ----
  var barColor = mediaType === "video" ? "#b04aff" : "#4a9eff";
  ctx.fillStyle = barColor;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, 4, [12, 12, 0, 0]);
  ctx.fill();

  // ---- 内容区域 ----
  var pad = 12;
  var thumbH = 170;
  var contentY = pad + 4;

  // 缩略图区域
  ctx.fillStyle = "#0a0e14";
  ctx.beginPath();
  ctx.roundRect(pad, contentY, w - pad * 2, thumbH, 8);
  ctx.fill();

  if (thumbUrl) {
    var img = node._thumbImg;
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(pad, contentY, w - pad * 2, thumbH, 8);
      ctx.clip();

      var iw = img.naturalWidth, ih = img.naturalHeight;
      var tw = w - pad * 2, th = thumbH;
      var scale = Math.max(tw / iw, th / ih);
      var dw = iw * scale, dh = ih * scale;
      var dx = pad + (tw - dw) / 2, dy = contentY + (th - dh) / 2;
      ctx.drawImage(img, dx, dy, dw, dh);
      ctx.restore();
    } else if (!img) {
      var i = new Image();
      i.crossOrigin = "anonymous";
      i.src = thumbUrl;
      i.onload = function () { canvas.draw(true); };
      node._thumbImg = i;
    }
  }

  if (!thumbUrl) {
    ctx.fillStyle = "#333";
    ctx.font = "36px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(mediaType === "video" ? "[VIDEO]" : "[IMG]", w / 2, contentY + thumbH / 2 + 12);
  }

  // ---- 信息区域 ----
  var infoY = contentY + thumbH + 14;

  // Scene 编号 (左侧大字)
  if (sceneId != null) {
    ctx.fillStyle = barColor;
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Scene " + (sceneId + 1), pad, infoY);
  }

  // 状态标签 (右侧彩色胶囊)
  var statusColors = { pending: "#555", generating: "#ffb020", done: "#3ddc84", failed: "#ff5252" };
  var statusLabels = { pending: "WAIT", generating: "GEN...", done: "DONE", failed: "FAIL" };
  var sc = statusColors[status] || "#555";
  var sl = statusLabels[status] || status;

  ctx.font = "bold 11px sans-serif";
  var sw = ctx.measureText(sl).width + 14;
  var sx = w - pad - sw;
  var sy = infoY - 14;
  ctx.fillStyle = sc + "33";
  ctx.beginPath();
  ctx.roundRect(sx, sy, sw, 20, 10);
  ctx.fill();
  ctx.fillStyle = sc;
  ctx.textAlign = "center";
  ctx.fillText(sl, sx + sw / 2, sy + 14);

  // ---- 提示词 (2行) ----
  var promptY = infoY + 22;
  ctx.fillStyle = "#b0bec5";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "left";

  var maxW = w - pad * 2;
  var lines = wrapText(ctx, prompt, maxW, 2);
  lines.forEach(function (line, idx) {
    ctx.fillText(line, pad, promptY + idx * 17);
  });
}

function wrapText(ctx, text, maxWidth, maxLines) {
  if (!text) return [];
  var lines = [];
  var current = "";
  for (var i = 0; i < text.length; i++) {
    var test = current + text[i];
    if (ctx.measureText(test).width > maxWidth) {
      lines.push(current);
      current = text[i];
      if (lines.length >= maxLines) {
        lines[lines.length - 1] += "...";
        return lines;
      }
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// ========== 节点操作 ==========

function patchNode(dbId, data) {
  return api("/api/nodes/" + dbId, { method: "PATCH", body: JSON.stringify(data) });
}

function previewNode(node) {
  var data = node._data || {};
  var url = getThumbUrl(data);
  if (!url) return toast("No preview available", "error");

  // 对于原始文件，用 filepath 而不是 thumbnail
  var origUrl = "";
  if (data._file && data._file.filepath) {
    origUrl = "/media/" + normalize(data._file.filepath);
  } else if (data.thumbnail_path) {
    origUrl = "/media/" + normalize(data.thumbnail_path);
  }

  var modal = document.getElementById("preview-modal");
  var img = document.getElementById("preview-img");
  var info = document.getElementById("preview-info");
  img.src = origUrl || url;
  info.innerHTML = "<b>Scene " + (data.scene_id != null ? data.scene_id + 1 : "?") + "</b><br>"
    + (data.prompt || "No prompt") + "<br>"
    + "<small>Status: " + (data.status || "unknown") + " | Size: " + (data._file ? data._file.filename : "N/A") + "</small>";
  modal.classList.remove("hidden");
}

function copyPrompt(node) {
  var prompt = (node._data || {}).prompt || "";
  if (!prompt) return toast("No prompt", "error");
  navigator.clipboard.writeText(prompt).then(function () {
    toast("Prompt copied!", "success");
  });
}

function editPrompt(node) {
  var data = node._data || {};
  var newPrompt = prompt("Edit prompt:", data.prompt || "");
  if (newPrompt === null) return;
  patchNode(node._dbId, { prompt: newPrompt }).then(function (updated) {
    node._data = updated;
    canvas.draw(true);
    toast("Prompt updated", "success");
  }).catch(function (e) { toast("Update failed: " + e.message, "error"); });
}

function regenerateNode(node) {
  if (!node._dbId) return;
  api("/api/nodes/" + node._dbId + "/regenerate", { method: "POST" }).then(function () {
    node._data.status = "pending";
    canvas.draw(true);
    toast("Marked for regeneration", "success");
  }).catch(function (e) { toast("Regen failed: " + e.message, "error"); });
}

function generateVideo(node) {
  if (!node._dbId) return;
  toast("Video generation started...", "success");
  // TODO: integrate with AI video API
  patchNode(node._dbId, { media_type: "video" }).then(function (updated) {
    node._data = updated;
    canvas.draw(true);
    toast("Node type changed to video", "success");
  }).catch(function (e) { toast("Failed: " + e.message, "error"); });
}

function deleteNode(node) {
  if (!node._dbId) return;
  if (!confirm("Delete this node?")) return;
  api("/api/nodes/" + node._dbId, { method: "DELETE" }).then(function () {
    graph.remove(node);
    delete nodeMap[node._dbId];
    canvas.draw(true);
    toast("Node deleted", "success");
  }).catch(function (e) { toast("Delete failed: " + e.message, "error"); });
}

// ========== 边操作 ==========

function setOutgoingEdgeType(node, edgeType) {
  // 找到该节点的出边，修改类型
  var colors = { scene_order: "#667788", image_to_video: "#4a9eff", reference: "#f0c040" };
  for (var dbId in edgeMap) {
    var link = edgeMap[dbId];
    if (link.origin_id === node.id) {
      link.color = colors[edgeType] || "#667788";
      link._edgeType = edgeType;
      // 也更新后端
      api("/api/edges/" + dbId, { method: "DELETE" }).then(function () {}).catch(function () {});
    }
  }
  canvas.draw(true);
  toast("Edge type: " + edgeType, "success");
}

// ========== 导出 ==========

function enableExportButtons(enabled) {
  document.getElementById("btn-export-video").disabled = !enabled;
  document.getElementById("btn-export-subtitle").disabled = !enabled;
}

function exportVideo() {
  if (!currentProject) return;
  window.open(API + "/api/projects/" + currentProject.id + "/export/video", "_blank");
}

function exportSubtitle() {
  if (!currentProject) return;
  api("/api/projects/" + currentProject.id + "/export/subtitle").then(function (data) {
    toast("Subtitle exported: " + data.srt, "success");
    window.open(API + "/media/" + data.srt, "_blank");
    window.open(API + "/media/" + data.script, "_blank");
  }).catch(function (e) { toast("Export failed: " + e.message, "error"); });
}

// ========== 新建项目 ==========

function createNewProject() {
  var name = prompt("Project name:", "Short Film Project");
  if (!name) return;
  api("/api/projects", {
    method: "POST",
    body: JSON.stringify({ name: name, script_text: "" }),
  }).then(function (project) {
    loadProjects().then(function () {
      document.getElementById("project-select").value = project.id;
      loadProject(project.id);
    });
    toast("Project created!", "success");
  }).catch(function (e) { toast("Create failed: " + e.message, "error"); });
}

// ========== 轮询 ==========

function startPolling() {
  setInterval(function () {
    if (!currentProject) return;
    api("/api/projects/" + currentProject.id).then(function (project) {
      project.nodes.forEach(function (n) {
        var lgNode = nodeMap[n.id];
        if (!lgNode) return;
        if (lgNode._data.status !== n.status) {
          lgNode._data = n;
          lgNode._thumbImg = null;
          canvas.draw(true);
        }
      });
    }).catch(function () {});
  }, 5000);
}

// ========== 初始化 ==========

document.addEventListener("DOMContentLoaded", function () {
  initGraph();
  registerNodeTypes();

  document.getElementById("project-select").addEventListener("change", function (e) {
    loadProject(e.target.value);
  });
  document.getElementById("btn-new-project").addEventListener("click", createNewProject);
  document.getElementById("btn-reload").addEventListener("click", function () {
    if (currentProject) loadProject(currentProject.id);
    else loadProjects();
  });
  document.getElementById("btn-export-video").addEventListener("click", exportVideo);
  document.getElementById("btn-export-subtitle").addEventListener("click", exportSubtitle);

  // 预览弹窗关闭
  document.getElementById("preview-close").addEventListener("click", function () {
    document.getElementById("preview-modal").classList.add("hidden");
  });
  var backdrop = document.querySelector(".preview-backdrop");
  if (backdrop) backdrop.addEventListener("click", function () {
    document.getElementById("preview-modal").classList.add("hidden");
  });

  loadProjects().catch(function (e) { toast("Load failed: " + e.message, "error"); });
  startPolling();
});
