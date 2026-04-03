const API_BASE = window.location.origin;
const NODE_WIDTH = 228;
const HEADER_HEIGHT = 38;
const PREVIEW_HEIGHT = 148;
const FOOTER_HEIGHT = 72;
const NODE_HEIGHT = HEADER_HEIGHT + PREVIEW_HEIGHT + FOOTER_HEIGHT;
const GRID_STEP = 28;

const WORKFLOW_RECIPES = [
  {
    id: 'short-drama',
    name: '短剧主线',
    description: '对白推进、情绪拉扯、结尾反转。',
    mediaType: 'image',
    aspect: '9:16',
    style: '电影感 写实 戏剧光影',
    storyboard: [
      '女主在地铁站回头，意识到错过了那个人',
      '手机近景，屏幕弹出一句"别再回头"',
      '男主站在雨夜街口，霓虹灯映在车窗与积水上',
      '两人隔着车流远远对视，空气里有迟到的告白'
    ].join('\\n'),
  },
  {
    id: 'mood-board',
    name: '情绪蒙太奇',
    description: '适合先铺气氛，再扩写成完整剧情。',
    mediaType: 'image',
    aspect: '16:9',
    style: '胶片颗粒 冷暖对比 诗意镜头',
    storyboard: [
      '空教室里只有窗边一束光落在桌面',
      '一只手指轻轻擦过旧照片的边缘',
      '风吹起走廊尽头的蓝色窗帘',
      '特写：眼眶发红，但没有掉泪'
    ].join('\\n'),
  },
  {
    id: 'image-to-video',
    name: '图转视频链',
    description: '先出关键帧，再接动态镜头。',
    mediaType: 'video',
    aspect: '9:16',
    style: '真实运动镜头 轻微运镜 景深层次',
    storyboard: [
      'image:: 夜雨中的便利店门口，女孩撑透明伞站住',
      'video:: 镜头从伞尖雨滴缓慢推进到女孩侧脸',
      'video:: 轻微手持镜头，女孩转头看向街对面'
    ].join('\\n'),
  },
  {
    id: 'ad-cut',
    name: '营销转场',
    description: '适合品牌短片或产品剧情广告。',
    mediaType: 'image',
    aspect: '1:1',
    style: '商业质感 干净布光 高级配色',
    storyboard: [
      '产品盒子置于深色金属台面，顶光切出轮廓',
      '手部特写，缓慢打开盒盖，内部灯光亮起',
      '产品悬浮在半空，背景是柔和流动的色带',
      '结尾 LOGO 镜头，文案停留在画面中央'
    ].join('\\n'),
  },
];

function createDefaultCapabilities() {
  return {
    aiConfigured: false,
    requiresAuth: false,
    proxyReachable: false,
    imageGenerateStatus: 'unknown',
    imageGenerateReady: false,
    videoGenerateStatus: 'unknown',
    videoGenerateReady: false,
    imageToVideoStatus: 'unknown',
    imageToVideoReady: false,
    videoExportStatus: 'unknown',
    videoExportReady: false,
    reasons: {
      imageGenerate: '',
      videoGenerate: '',
      imageToVideo: '',
      videoExport: '',
    },
    models: {},
    updatedAt: '',
  };
}

const state = {
  projects: [],
  project: null,
  selectedNodeId: null,
  capabilities: createDefaultCapabilities(),
  ui: {
    projectRailOpen: false,
    canvasActionsOpen: false,
    minimapOpen: false,
    leftPanelOpen: false,
    rightPanelOpen: false,
    queuePanelOpen: false,
  },
  auth: {
    requiresAuth: false,
    authenticated: true,
    pending: false,
  },
  viewport: { scale: 1, tx: 120, ty: 120 },
  dragging: null,
  linking: null,
  panning: null,
  saveQueue: new Map(),
  imageCache: new Map(),
  showEdges: true,
  detailDraft: {
    nodeId: null,
    dirty: false,
  },
  localBatch: {
    running: false,
    sessionIds: [],
    total: 0,
    cancelled: false,
  },
  minimap: {
    worldBounds: null,
  },
};

const elements = {
  topbar: document.getElementById('topbar'),
  workspace: document.getElementById('workspace'),
  workspaceOverlay: document.getElementById('workspaceOverlay'),
  projectRailPopover: document.getElementById('projectRailPopover'),
  projectRailToggleButton: document.getElementById('projectRailToggleButton'),
  projectPills: document.getElementById('projectPills'),
  projectSelect: document.getElementById('project-select'),
  refreshButton: document.getElementById('refreshButton'),
  newProjectButton: document.getElementById('btn-new-project'),
  leftPanelToggleButton: document.getElementById('leftPanelToggleButton'),
  queuePanelToggleButton: document.getElementById('queuePanelToggleButton'),
  rightPanelToggleButton: document.getElementById('rightPanelToggleButton'),
  leftPanelCloseButton: document.getElementById('leftPanelCloseButton'),
  queuePanelCloseButton: document.getElementById('queuePanelCloseButton'),
  rightPanelCloseButton: document.getElementById('rightPanelCloseButton'),
  recipeGrid: document.getElementById('recipeGrid'),
  promptInput: document.getElementById('promptInput'),
  mediaTypeSelect: document.getElementById('mediaTypeSelect'),
  aspectSelect: document.getElementById('aspect-select'),
  styleInput: document.getElementById('styleInput'),
  generateButton: document.getElementById('generateButton'),
  clearDraftButton: document.getElementById('clearDraftButton'),
  createNoteButton: document.getElementById('createNoteButton'),
  createRefButton: document.getElementById('createRefButton'),
  uploadRefButton: document.getElementById('uploadRefButton'),
  draftHint: document.getElementById('draftHint'),
  storyboardInput: document.getElementById('storyboardInput'),
  queueModeSelect: document.getElementById('queueModeSelect'),
  autoArrangeButton: document.getElementById('autoArrangeButton'),
  queueStoryboardButton: document.getElementById('queueStoryboardButton'),
  clearStoryboardButton: document.getElementById('clearStoryboardButton'),
  sessionFilterSelect: document.getElementById('sessionFilterSelect'),
  retryFailedSessionsButton: document.getElementById('retryFailedSessionsButton'),
  batchStatus: document.getElementById('batchStatus'),
  batchHint: document.getElementById('batchHint'),
  nodeCount: document.getElementById('nodeCount'),
  edgeCount: document.getElementById('edgeCount'),
  fileCount: document.getElementById('fileCount'),
  sessionCount: document.getElementById('sessionCount'),
  nodeList: document.getElementById('nodeList'),
  projectName: document.getElementById('projectName'),
  projectMeta: document.getElementById('projectMeta'),
  projectStatus: document.getElementById('projectStatus'),
  selectionStatus: document.getElementById('selectionStatus'),
  queueSummary: document.getElementById('queueSummary'),
  capabilityStatus: document.getElementById('capabilityStatus'),
  exportCapabilityStatus: document.getElementById('exportCapabilityStatus'),
  canvasRightTools: document.getElementById('canvasRightTools'),
  canvasActionToggleButton: document.getElementById('canvasActionToggleButton'),
  canvasActions: document.getElementById('canvasActions'),
  minimapToggleButton: document.getElementById('minimapToggleButton'),
  minimapPanel: document.getElementById('minimapPanel'),
  exportSubtitleButton: document.getElementById('btn-export-subtitle'),
  exportVideoButton: document.getElementById('btn-export-video'),
  focusButton: document.getElementById('focusButton'),
  toggleEdgesButton: document.getElementById('toggleEdgesButton'),
  canvas: document.getElementById('mycanvas'),
  zoomLabel: document.getElementById('zoomLabel'),
  zoomInButton: document.getElementById('zoomInButton'),
  zoomOutButton: document.getElementById('zoomOutButton'),
  fitButton: document.getElementById('fitButton'),
  minimapCanvas: document.getElementById('minimapCanvas'),
  minimapMeta: document.getElementById('minimapMeta'),
  sessionList: document.getElementById('sessionList'),
  fileList: document.getElementById('fileList'),
  detailEmpty: document.getElementById('detailEmpty'),
  detailContent: document.getElementById('detailContent'),
  detailImage: document.getElementById('detailImage'),
  detailVideo: document.getElementById('detailVideo'),
  detailType: document.getElementById('detailType'),
  detailStatus: document.getElementById('detailStatus'),
  detailScene: document.getElementById('detailScene'),
  detailUpdatedAt: document.getElementById('detailUpdatedAt'),
  detailPromptInput: document.getElementById('detailPromptInput'),
  detailMediaTypeSelect: document.getElementById('detailMediaTypeSelect'),
  detailAspectSelect: document.getElementById('detailAspectSelect'),
  detailStyleInput: document.getElementById('detailStyleInput'),
  detailSceneInput: document.getElementById('detailSceneInput'),
  detailStatusSelect: document.getElementById('detailStatusSelect'),
  savePromptButton: document.getElementById('savePromptButton'),
  reusePromptButton: document.getElementById('reusePromptButton'),
  uploadNodeAssetButton: document.getElementById('uploadNodeAssetButton'),
  openMediaButton: document.getElementById('openMediaButton'),
  downloadMediaButton: document.getElementById('downloadMediaButton'),
  regenerateNodeButton: document.getElementById('regenerateNodeButton'),
  copyLinkButton: document.getElementById('copyLinkButton'),
  deleteNodeButton: document.getElementById('deleteNodeButton'),
  assetDropZone: document.getElementById('assetDropZone'),
  openAssetPickerButton: document.getElementById('openAssetPickerButton'),
  referenceUploadInput: document.getElementById('referenceUploadInput'),
  toast: document.getElementById('toast'),
  lightbox: document.getElementById('lightbox'),
  lightboxClose: document.getElementById('lightboxClose'),
  lightboxImage: document.getElementById('lightboxImage'),
  lightboxVideo: document.getElementById('lightboxVideo'),
  lightboxSpinner: document.getElementById('lightboxSpinner'),
  authGate: document.getElementById('authGate'),
  authTokenInput: document.getElementById('authTokenInput'),
  authLoginButton: document.getElementById('authLoginButton'),
  authRetryButton: document.getElementById('authRetryButton'),
  authStatus: document.getElementById('authStatus'),
  nodePopup: document.getElementById('nodePopup'),
  popupClose: document.getElementById('popupClose'),
  popupTitle: document.getElementById('popupTitle'),
  popupImg: document.getElementById('popupImg'),
  popupVideo: document.getElementById('popupVideo'),
  popupMeta: document.getElementById('popupMeta'),
  popupPrompt: document.getElementById('popupPrompt'),
  popupMediaTypeSelect: document.getElementById('popupMediaTypeSelect'),
  popupAspectSelect: document.getElementById('popupAspectSelect'),
  popupDownloadBtn: document.getElementById('popupDownloadBtn'),
  popupRegenerateBtn: document.getElementById('popupRegenerateBtn'),
  popupSaveBtn: document.getElementById('popupSaveBtn'),
  popupSpinner: document.getElementById('popupSpinner'),
};

const ctx = elements.canvas.getContext('2d');
const minimapCtx = elements.minimapCanvas.getContext('2d');

window.__TRIX_CANVAS_DEBUG__ = {
  getMetrics() {
    return {
      nodeWidth: NODE_WIDTH,
      nodeHeight: NODE_HEIGHT,
      headerHeight: HEADER_HEIGHT,
      previewHeight: PREVIEW_HEIGHT,
    };
  },
  getViewport() {
    return { ...state.viewport };
  },
  worldToClient(worldX, worldY) {
    const rect = elements.canvas.getBoundingClientRect();
    return {
      x: rect.left + state.viewport.tx + worldX * state.viewport.scale,
      y: rect.top + state.viewport.ty + worldY * state.viewport.scale,
    };
  },
};

function anyPanelOpen() {
  return state.ui.leftPanelOpen || state.ui.rightPanelOpen || state.ui.queuePanelOpen;
}

function anyCanvasPopoverOpen() {
  return state.ui.canvasActionsOpen || state.ui.minimapOpen;
}

function closeCanvasPopovers() {
  state.ui.canvasActionsOpen = false;
  state.ui.minimapOpen = false;
  renderPanelState();
}

function closePanels() {
  state.ui.leftPanelOpen = false;
  state.ui.rightPanelOpen = false;
  state.ui.queuePanelOpen = false;
  renderPanelState();
}

function closeProjectRail() {
  state.ui.projectRailOpen = false;
  renderPanelState();
}

function openPanel(panelName) {
  state.ui.projectRailOpen = false;
  state.ui.canvasActionsOpen = false;
  state.ui.minimapOpen = false;
  state.ui.leftPanelOpen = panelName === 'left';
  state.ui.rightPanelOpen = panelName === 'right';
  state.ui.queuePanelOpen = panelName === 'queue';
  renderPanelState();
}

function togglePanel(panelName) {
  const isOpen = (
    (panelName === 'left' && state.ui.leftPanelOpen)
    || (panelName === 'right' && state.ui.rightPanelOpen)
    || (panelName === 'queue' && state.ui.queuePanelOpen)
  );
  if (isOpen) {
    closePanels();
    return;
  }
  openPanel(panelName);
}

function toggleProjectRail() {
  const canOpen = !elements.projectRailToggleButton.hidden;
  if (!canOpen) return;
  state.ui.canvasActionsOpen = false;
  state.ui.minimapOpen = false;
  state.ui.leftPanelOpen = false;
  state.ui.rightPanelOpen = false;
  state.ui.queuePanelOpen = false;
  state.ui.projectRailOpen = !state.ui.projectRailOpen;
  renderPanelState();
}

function toggleCanvasPopover(popoverName) {
  state.ui.projectRailOpen = false;
  state.ui.leftPanelOpen = false;
  state.ui.rightPanelOpen = false;
  state.ui.queuePanelOpen = false;
  if (popoverName === 'actions') {
    state.ui.canvasActionsOpen = !state.ui.canvasActionsOpen;
    state.ui.minimapOpen = false;
  } else {
    state.ui.minimapOpen = !state.ui.minimapOpen;
    state.ui.canvasActionsOpen = false;
  }
  renderPanelState();
}

function renderPanelState() {
  const showProjectRail = state.ui.projectRailOpen && !elements.projectRailToggleButton.hidden;
  const showCanvasActions = state.ui.canvasActionsOpen;
  const showMinimap = state.ui.minimapOpen;
  elements.workspace.classList.toggle('panel-left-open', state.ui.leftPanelOpen);
  elements.workspace.classList.toggle('panel-right-open', state.ui.rightPanelOpen);
  elements.workspace.classList.toggle('panel-queue-open', state.ui.queuePanelOpen);
  elements.workspace.classList.toggle('has-open-panel', anyPanelOpen());
  elements.topbar.classList.toggle('project-rail-open', showProjectRail);
  elements.projectRailPopover.hidden = elements.projectRailToggleButton.hidden;
  elements.projectRailToggleButton.classList.toggle('active', showProjectRail);
  elements.projectRailToggleButton.setAttribute('aria-expanded', String(showProjectRail));
  elements.leftPanelToggleButton.classList.toggle('active', state.ui.leftPanelOpen);
  elements.queuePanelToggleButton.classList.toggle('active', state.ui.queuePanelOpen);
  elements.rightPanelToggleButton.classList.toggle('active', state.ui.rightPanelOpen);
  elements.canvasRightTools.classList.toggle('actions-open', showCanvasActions);
  elements.canvasRightTools.classList.toggle('minimap-open', showMinimap);
  elements.canvasActionToggleButton.classList.toggle('active', showCanvasActions);
  elements.minimapToggleButton.classList.toggle('active', showMinimap);
  elements.leftPanelToggleButton.setAttribute('aria-expanded', String(state.ui.leftPanelOpen));
  elements.queuePanelToggleButton.setAttribute('aria-expanded', String(state.ui.queuePanelOpen));
  elements.rightPanelToggleButton.setAttribute('aria-expanded', String(state.ui.rightPanelOpen));
  elements.canvasActionToggleButton.setAttribute('aria-expanded', String(showCanvasActions));
  elements.minimapToggleButton.setAttribute('aria-expanded', String(showMinimap));
}

function showToast(message, timeout = 2800) {
  elements.toast.textContent = message;
  elements.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => elements.toast.classList.remove('show'), timeout);
}

function runUiAction(task, fallbackMessage = '操作失败') {
  Promise.resolve()
    .then(task)
    .catch((error) => {
      console.error(error);
      showToast(error?.message || fallbackMessage);
    });
}

async function fetchJson(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    if (response.status === 401) {
      state.auth.requiresAuth = true;
      state.auth.authenticated = false;
      updateAuthGate();
    }
    throw new Error(payload.error || payload.detail || `${response.status} ${response.statusText}`);
  }
  return payload;
}

function updateAuthGate() {
  const show = state.auth.requiresAuth && !state.auth.authenticated;
  elements.authGate.hidden = !show;
  elements.authGate.classList.toggle('show', show);
}

function setAuthStatus(message, isError = false) {
  elements.authStatus.textContent = message;
  elements.authStatus.classList.toggle('error', isError);
}

function stripTokenParamFromUrl() {
  const url = new URL(window.location.href);
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
  let changed = false;
  if (url.searchParams.has('token')) {
    url.searchParams.delete('token');
    changed = true;
  }
  if (hashParams.has('token')) {
    hashParams.delete('token');
    url.hash = hashParams.toString() ? `#${hashParams.toString()}` : '';
    changed = true;
  }
  if (!changed) return;
  window.history.replaceState({}, '', url.toString());
}

function hasTokenInHash() {
  const url = new URL(window.location.href);
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
  return hashParams.has('token');
}

async function refreshAuthStatus() {
  const payload = await fetchJson('/api/auth/status');
  state.auth.requiresAuth = Boolean(payload.requiresAuth);
  state.auth.authenticated = Boolean(payload.authenticated);
  updateAuthGate();
  return state.auth;
}

async function loginCanvasWithToken(token) {
  const cleanToken = String(token || '').trim();
  if (!cleanToken) {
    setAuthStatus('请输入访问令牌。', true);
    return false;
  }
  state.auth.pending = true;
  elements.authLoginButton.disabled = true;
  elements.authRetryButton.disabled = true;
  setAuthStatus('正在验证访问令牌…');
  try {
    await fetchJson('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ token: cleanToken }),
    });
    await refreshAuthStatus();
    stripTokenParamFromUrl();
    elements.authTokenInput.value = '';
    setAuthStatus('访问已授权。');
    showToast('已登录 Canvas');
    return true;
  } catch (error) {
    setAuthStatus(error.message || '访问令牌无效。', true);
    throw error;
  } finally {
    state.auth.pending = false;
    elements.authLoginButton.disabled = false;
    elements.authRetryButton.disabled = false;
    updateAuthGate();
  }
}

async function ensureAuthenticated() {
  const url = new URL(window.location.href);
  const legacyTokenInQuery = url.searchParams.get('token') || '';
  const tokenInHash = hasTokenInHash();
  const unsafeTokenLinkDetected = Boolean(legacyTokenInQuery || tokenInHash);
  if (unsafeTokenLinkDetected) {
    stripTokenParamFromUrl();
  }
  await refreshAuthStatus();
  if (!state.auth.requiresAuth || state.auth.authenticated) {
    return;
  }

  if (unsafeTokenLinkDetected) {
    setAuthStatus('检测到不安全的 token 链接，已忽略。请在页面内手动输入访问令牌。', true);
  } else {
    setAuthStatus('需要访问令牌后才能读取项目与媒体。');
  }
  throw new Error('Canvas authentication required');
}

function getData(payload) {
  return payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload;
}

function normalizeCapabilities(payload) {
  const data = getData(payload) || {};
  const defaults = createDefaultCapabilities();
  const reasons = data.reasons && typeof data.reasons === 'object' ? data.reasons : {};
  return {
    ...defaults,
    ...data,
    reasons: {
      ...defaults.reasons,
      ...reasons,
    },
  };
}

function capabilityBadgeClass(status) {
  return status === 'ready' ? 'ready' : status === 'unavailable' ? 'unavailable' : 'unknown';
}

function hasExportableVideoNodes() {
  return Boolean((state.project?.nodes || []).some((node) => (
    node.media_type === 'video'
    && (node.file_id || node.result_url || node.preview_url)
  )));
}

function currentVideoUnavailableReason() {
  const caps = state.capabilities || createDefaultCapabilities();
  if (caps.videoGenerateStatus === 'unavailable' && caps.imageToVideoStatus === 'unavailable') {
    return caps.reasons.imageToVideo || caps.reasons.videoGenerate || '当前后端未配置视频生成';
  }
  return '';
}

function currentVideoExportReason() {
  const caps = state.capabilities || createDefaultCapabilities();
  if (caps.videoExportStatus === 'unavailable') {
    return caps.reasons.videoExport || '视频导出当前不可用';
  }
  if (state.project?.id && !hasExportableVideoNodes()) {
    return '项目内还没有可导出的视频节点';
  }
  return '';
}

function setSelectOptionAvailability(selectElement, value, enabled, reason = '') {
  const option = selectElement?.querySelector(`option[value="${value}"]`);
  if (!option) {
    return;
  }
  option.disabled = !enabled;
  option.title = enabled ? '' : reason;
  if (!enabled && selectElement.value === value) {
    selectElement.value = 'image';
  }
}

function updateCapabilityUi() {
  const caps = state.capabilities || createDefaultCapabilities();
  const videoUnavailableReason = currentVideoUnavailableReason();
  const exportReason = currentVideoExportReason();

  const capabilityStatus = !caps.aiConfigured
    ? 'unavailable'
    : videoUnavailableReason
      ? 'unavailable'
      : caps.imageGenerateStatus === 'ready' && (caps.videoGenerateStatus === 'ready' || caps.imageToVideoStatus === 'ready')
        ? 'ready'
        : 'unknown';
  const capabilityText = !caps.aiConfigured
    ? 'AI 未配置'
    : videoUnavailableReason
      ? 'AI 图片可用 · 视频不可用'
      : caps.imageGenerateStatus === 'ready' && (caps.videoGenerateStatus === 'ready' || caps.imageToVideoStatus === 'ready')
        ? 'AI 图片/视频可用'
        : 'AI 状态待确认';
  elements.capabilityStatus.textContent = capabilityText;
  elements.capabilityStatus.className = `workspace-badge ${capabilityBadgeClass(capabilityStatus)}`;
  elements.capabilityStatus.title = videoUnavailableReason || caps.reasons.imageGenerate || '';

  const exportStatus = exportReason ? 'unavailable' : (caps.videoExportStatus === 'ready' ? 'ready' : 'unknown');
  elements.exportCapabilityStatus.textContent = exportReason ? '视频导出不可用' : '视频导出可用';
  elements.exportCapabilityStatus.className = `workspace-badge ${capabilityBadgeClass(exportStatus)}`;
  elements.exportCapabilityStatus.title = exportReason || caps.reasons.videoExport || '';

  const videoSelectable = !videoUnavailableReason;
  setSelectOptionAvailability(elements.mediaTypeSelect, 'video', videoSelectable, videoUnavailableReason);
  setSelectOptionAvailability(elements.detailMediaTypeSelect, 'video', videoSelectable, videoUnavailableReason);

  elements.exportVideoButton.disabled = Boolean(exportReason);
  elements.exportVideoButton.title = exportReason;
}

async function loadCapabilities({ suppressErrors = false } = {}) {
  try {
    const response = await fetchJson('/api/capabilities');
    state.capabilities = normalizeCapabilities(response);
  } catch (error) {
    state.capabilities = createDefaultCapabilities();
    if (!suppressErrors) {
      throw error;
    }
  }
  updateCapabilityUi();
  return state.capabilities;
}

function assertVideoCreationAvailable({ requiresImageToVideo = false } = {}) {
  if (requiresImageToVideo && state.capabilities.imageToVideoStatus === 'unavailable') {
    throw new Error(state.capabilities.reasons.imageToVideo || '当前图生视频不可用');
  }
  const reason = currentVideoUnavailableReason();
  if (reason) {
    throw new Error(reason);
  }
}

function assertStoryboardCapabilities(lines) {
  const hasVideoLines = lines.some((item) => item.mediaType === 'video');
  if (!hasVideoLines) {
    return;
  }
  const queueMode = elements.queueModeSelect.value;
  const requiresImageToVideo = queueMode !== 'free';
  if (queueMode === 'chain' && lines[0]?.mediaType === 'video' && !state.selectedNodeId) {
    throw new Error('顺序串联的第一个视频镜头前需要先有一张图片镜头');
  }
  assertVideoCreationAvailable({ requiresImageToVideo });
}

function fmtDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeProject(raw) {
  const project = getData(raw);
  return {
    ...project,
    nodes: (project?.nodes || []).map(normalizeNode),
    edges: (project?.edges || []).map(normalizeEdge),
    files: (project?.files || []).map(normalizeFile),
    sessions: (project?.sessions || []).map(normalizeSession),
  };
}

function normalizeNode(raw) {
  return {
    ...raw,
    id: raw.id,
    x: Number(raw.x || 0),
    y: Number(raw.y || 0),
    media_type: raw.media_type || raw.mediaType || 'image',
    scene_id: raw.scene_id ?? raw.sceneId ?? null,
    style: raw.style || '',
    preview_url: raw.preview_url || raw.previewUrl || raw.result_url || raw.resultUrl || raw.file?.url || null,
    result_url: raw.result_url || raw.resultUrl || raw.file?.url || null,
    parent_node_id: raw.parent_node_id || raw.parentNodeId || null,
    status: raw.status || 'pending',
    prompt: raw.prompt || '',
    updated_at: raw.updated_at || raw.updatedAt || null,
    created_at: raw.created_at || raw.createdAt || null,
    file: raw.file || null,
  };
}

function normalizeEdge(raw) {
  return {
    ...raw,
    id: raw.id,
    source_node_id: raw.source_node_id || raw.sourceNodeId,
    target_node_id: raw.target_node_id || raw.targetNodeId,
    edge_type: raw.edge_type || raw.edgeType || 'scene_order',
  };
}

function normalizeFile(raw) {
  return {
    ...raw,
    id: raw.id,
    filename: raw.filename || 'unnamed',
    url: raw.url || null,
    media_type: raw.media_type || raw.mediaType || 'image',
    created_at: raw.created_at || raw.createdAt || null,
  };
}

function normalizeSession(raw) {
  return {
    ...raw,
    id: raw.id,
    node_id: raw.node_id || raw.nodeId,
    status: raw.status || 'pending',
    media_type: raw.media_type || raw.mediaType || 'image',
    message: raw.message || '',
    updated_at: raw.updated_at || raw.updatedAt || null,
  };
}

function projectGenerating(project) {
  return (project?.sessions || []).some((session) => ['generating', 'pending'].includes(session.status));
}

function selectedNode() {
  return state.project?.nodes.find((node) => node.id === state.selectedNodeId) || null;
}

function selectedSessionCount() {
  return (state.project?.sessions || []).filter((session) => ['generating', 'pending'].includes(session.status)).length;
}

function loadImage(url) {
  if (!url || state.imageCache.has(url) || /\.(mp4|mov|webm)(\?|$)/i.test(url)) {
    return;
  }
  const image = new Image();
  image.onload = () => {
    state.imageCache.set(url, image);
    renderCanvas();
  };
  image.src = new URL(url, API_BASE).toString();
}

function renderRecipeCards() {
  elements.recipeGrid.innerHTML = WORKFLOW_RECIPES.map((recipe) => `
    <button class="recipe-card" type="button" data-recipe-id="${recipe.id}">
      <strong>${escapeHtml(recipe.name)}</strong>
      <span>${escapeHtml(recipe.description)}</span>
    </button>
  `).join('');

  elements.recipeGrid.querySelectorAll('[data-recipe-id]').forEach((button) => {
    button.addEventListener('click', () => applyRecipe(button.dataset.recipeId));
  });
}

function applyRecipe(recipeId) {
  const recipe = WORKFLOW_RECIPES.find((item) => item.id === recipeId);
  if (!recipe) return;
  elements.storyboardInput.value = recipe.storyboard;
  elements.promptInput.value = recipe.storyboard.split('\n')[0] || '';
  elements.mediaTypeSelect.value = recipe.mediaType;
  elements.aspectSelect.value = recipe.aspect;
  elements.styleInput.value = recipe.style;
  updateCapabilityUi();
  showToast(`已载入模板：${recipe.name}`);
}

function updateDraftHint() {
  const node = selectedNode();
  const base = node
    ? `当前父节点：${node.prompt.slice(0, 38) || node.id}。新的结果会从它的下方继续扩展。`
    : '未选择父节点，新镜头会直接追加到当前项目。';
  const videoReason = currentVideoUnavailableReason();
  elements.draftHint.textContent = videoReason ? `${base} 当前视频不可用：${videoReason}` : base;
  elements.selectionStatus.textContent = node
    ? `选中 Scene ${node.scene_id ?? '—'} · ${node.media_type === 'video' ? '视频' : '图片'}`
    : '未选中节点';
}

function updateBatchHint() {
  const mode = elements.queueModeSelect.value;
  const base = mode === 'chain'
    ? '当前模式：顺序串联。每个镜头会自动接在上一个镜头之后。'
    : mode === 'branch'
      ? '当前模式：分支挂载。所有新镜头会连到当前选中的父节点。'
      : '当前模式：独立节点。每个镜头都会作为自由节点加入画布。';
  const videoReason = currentVideoUnavailableReason();
  elements.batchHint.textContent = videoReason ? `${base} 当前视频不可用：${videoReason}` : base;
}

function renderProjects() {
  const projects = state.projects || [];
  elements.projectPills.hidden = projects.length === 0;
  elements.projectRailToggleButton.hidden = projects.length <= 1;
  elements.projectRailToggleButton.textContent = projects.length > 1 ? `项目 ${projects.length}` : '项目轨道';
  if (projects.length <= 1) {
    state.ui.projectRailOpen = false;
  }
  elements.projectSelect.innerHTML = projects.length
    ? projects.map((project) => `<option value="${project.id}" ${project.id === state.project?.id ? 'selected' : ''}>${escapeHtml(project.name)}</option>`).join('')
    : '<option value="">暂无项目</option>';

  elements.projectPills.innerHTML = projects.map((project) => {
    const status = project.sessions.some((item) => item.status === 'error')
      ? 'error'
      : project.sessions.some((item) => item.status === 'generating')
        ? 'generating'
        : project.sessions.length > 0 && project.sessions.every((item) => item.status === 'completed')
          ? 'completed'
          : 'pending';
    return `<button class="pill ${project.id === state.project?.id ? 'active' : ''}" data-project-id="${project.id}" type="button">
      <span class="dot ${status}"></span>${escapeHtml(project.name)}
    </button>`;
  }).join('');

  elements.projectPills.querySelectorAll('[data-project-id]').forEach((button) => {
    button.addEventListener('click', () => selectProject(button.dataset.projectId));
  });
  renderPanelState();
}

function renderStats() {
  const project = state.project;
  const activeSessions = selectedSessionCount();
  elements.nodeCount.textContent = String(project?.nodes.length || 0);
  elements.edgeCount.textContent = String(project?.edges.length || 0);
  elements.fileCount.textContent = String(project?.files.length || 0);
  elements.sessionCount.textContent = String(project?.sessions.length || 0);
  elements.projectName.textContent = project?.name || '未载入项目';
  elements.projectMeta.textContent = project
    ? `${project.nodes.length} 个节点 · ${project.sessions.length} 个 session · 上次更新 ${fmtDate(project.updated_at || project.updatedAt)}`
    : '创建一个项目后，即可在这里像工作流工具一样排队、连线和回看生成结果。';
  elements.projectStatus.textContent = project
    ? (projectGenerating(project) ? '生成中' : '已同步')
    : '空闲';
  elements.queueSummary.textContent = project
    ? (activeSessions > 0 ? `活跃队列 ${activeSessions}` : '队列空闲')
    : '队列空闲';
  elements.queuePanelToggleButton.textContent = activeSessions > 0 ? `队列 ${activeSessions}` : '队列';
  updateCapabilityUi();
}

function renderNodeList() {
  const nodes = [...(state.project?.nodes || [])]
    .sort((left, right) => {
      const leftScene = Number(left.scene_id || 0);
      const rightScene = Number(right.scene_id || 0);
      if (leftScene !== rightScene) return leftScene - rightScene;
      return new Date(left.created_at || 0) - new Date(right.created_at || 0);
    });

  elements.nodeList.innerHTML = nodes.length
    ? nodes.map((node) => {
      const icon = node.style === 'note'
        ? '✎'
        : node.style === 'reference'
          ? '◫'
          : node.media_type === 'video'
            ? '🎬'
            : '🖼️';
      const preview = node.preview_url && !/\.(mp4|mov|webm)(\?|$)/i.test(node.preview_url)
        ? `<img class="node-thumb" src="${new URL(node.preview_url, API_BASE).toString()}" alt="" />`
        : `<div class="node-thumb">${icon}</div>`;
      return `<button class="node-item ${node.id === state.selectedNodeId ? 'active' : ''}" data-node-id="${node.id}" type="button">
        ${preview}
        <div class="node-meta">
          <div class="node-title">${escapeHtml(node.prompt || '未命名节点')}</div>
          <div class="node-sub">${escapeHtml(node.style || (node.media_type === 'video' ? '视频' : '图片'))} · ${escapeHtml(node.status)} · ${fmtDate(node.updated_at)}</div>
        </div>
      </button>`;
    }).join('')
    : '<div class="detail-empty">当前项目还没有节点。先生成一个镜头，或添加一个便签节点开始组织流程。</div>';

  elements.nodeList.querySelectorAll('[data-node-id]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedNodeId = button.dataset.nodeId;
      updateDraftHint();
      renderNodeList();
      renderDetail();
      centerOnSelected();
      renderCanvas();
    });
  });
}

function renderSessionList() {
  const allSessions = [...(state.project?.sessions || [])]
    .sort((left, right) => new Date(right.updated_at || 0) - new Date(left.updated_at || 0));
  const sessionFilter = elements.sessionFilterSelect.value || 'all';
  const sessions = sessionFilter === 'all'
    ? allSessions
    : allSessions.filter((session) => session.status === sessionFilter);

  elements.batchStatus.textContent = state.localBatch.running
    ? `排队中 ${completedBatchCount()}/${state.localBatch.total}`
    : '空闲';

  elements.sessionList.innerHTML = sessions.length
    ? sessions.map((session) => `
      <button class="session-item" type="button" data-session-id="${session.id}" data-node-id="${session.node_id || ''}">
        <div class="session-meta">
          <div class="session-title">${escapeHtml(session.message || '未命名 session')}</div>
          <div class="session-sub">${session.media_type === 'video' ? '视频' : '图片'} · ${fmtDate(session.updated_at)}</div>
        </div>
        <div class="session-status ${escapeHtml(session.status)}">${escapeHtml(session.status)}</div>
      </button>
    `).join('')
    : '<div class="detail-empty">当前筛选条件下没有任务。</div>';

  elements.sessionList.querySelectorAll('[data-session-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const nodeId = button.dataset.nodeId;
      if (nodeId) {
        state.selectedNodeId = nodeId;
        updateDraftHint();
        renderNodeList();
        renderDetail();
        centerOnSelected();
        renderCanvas();
      }
    });
  });
}

function renderFileList() {
  const files = [...(state.project?.files || [])]
    .sort((left, right) => new Date(right.created_at || 0) - new Date(left.created_at || 0));

  elements.fileList.innerHTML = files.length
    ? files.map((file) => `
      <button class="file-item" type="button" data-file-url="${escapeHtml(file.url || '')}" data-media-type="${escapeHtml(file.media_type)}">
        <div class="file-meta">
          <div class="file-title">${escapeHtml(file.filename)}</div>
          <div class="file-sub">${fmtDate(file.created_at)} · ${escapeHtml(file.url || '')}</div>
        </div>
        <div class="file-tag">${file.media_type === 'video' ? 'video' : 'image'}</div>
      </button>
    `).join('')
    : '<div class="detail-empty">当前项目还没有文件结果。</div>';

  elements.fileList.querySelectorAll('[data-file-url]').forEach((button) => {
    button.addEventListener('click', () => {
      const url = button.dataset.fileUrl;
      if (!url) return;
      openLightbox(new URL(url, API_BASE).toString(), button.dataset.mediaType === 'video');
    });
  });
}

function renderDetail() {
  const node = selectedNode();
  elements.rightPanelToggleButton.textContent = node ? '检查器 已选' : '检查器';
  if (!node) {
    elements.detailEmpty.hidden = false;
    elements.detailContent.hidden = true;
    state.detailDraft = { nodeId: null, dirty: false };
    return;
  }

  elements.detailEmpty.hidden = true;
  elements.detailContent.hidden = false;
  elements.detailType.textContent = node.style || (node.media_type === 'video' ? '视频镜头' : '图片镜头');
  elements.detailStatus.textContent = node.status;
  elements.detailScene.textContent = node.scene_id ?? '—';
  elements.detailUpdatedAt.textContent = fmtDate(node.updated_at || node.created_at);
  const detailInputs = [
    elements.detailPromptInput,
    elements.detailMediaTypeSelect,
    elements.detailAspectSelect,
    elements.detailStyleInput,
    elements.detailSceneInput,
    elements.detailStatusSelect,
  ];
  const preserveDraft = state.detailDraft.dirty
    && state.detailDraft.nodeId === node.id
    && detailInputs.includes(document.activeElement);
  if (!preserveDraft) {
    elements.detailPromptInput.value = node.prompt || '';
    elements.detailMediaTypeSelect.value = node.media_type || 'image';
    elements.detailAspectSelect.value = node.aspect || 'origin';
    elements.detailStyleInput.value = node.style || '';
    elements.detailSceneInput.value = node.scene_id ?? '';
    elements.detailStatusSelect.value = node.status || 'pending';
    state.detailDraft = { nodeId: node.id, dirty: false };
  }

  const preview = node.preview_url;
  const isVideo = node.media_type === 'video' || /\.(mp4|mov|webm)(\?|$)/i.test(preview || '');
  elements.detailImage.hidden = true;
  elements.detailVideo.hidden = true;
  elements.detailImage.removeAttribute('src');
  elements.detailVideo.removeAttribute('src');
  if (preview) {
    const absolute = new URL(preview, API_BASE).toString();
    if (isVideo) {
      elements.detailVideo.hidden = false;
      elements.detailVideo.src = absolute;
    } else {
      elements.detailImage.hidden = false;
      elements.detailImage.src = absolute;
    }
  }
}

function worldPointFromCanvas(clientX, clientY) {
  const rect = elements.canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left - state.viewport.tx) / state.viewport.scale,
    y: (clientY - rect.top - state.viewport.ty) / state.viewport.scale,
  };
}

function currentWorldCenter() {
  const rect = elements.canvas.getBoundingClientRect();
  return {
    x: (rect.width / 2 - state.viewport.tx) / state.viewport.scale,
    y: (rect.height / 2 - state.viewport.ty) / state.viewport.scale,
  };
}

function hitNode(x, y) {
  const nodes = state.project?.nodes || [];
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index];
    if (x >= node.x && x <= node.x + NODE_WIDTH && y >= node.y && y <= node.y + NODE_HEIGHT) {
      return node;
    }
  }
  return null;
}

function inputPort(node) {
  return { x: node.x + NODE_WIDTH / 2, y: node.y };
}

function outputPort(node) {
  return { x: node.x + NODE_WIDTH / 2, y: node.y + NODE_HEIGHT };
}

function hitPort(x, y, type = 'output') {
  const nodes = state.project?.nodes || [];
  const radius = 12;
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index];
    const port = type === 'input' ? inputPort(node) : outputPort(node);
    const distance = Math.hypot(x - port.x, y - port.y);
    if (distance <= radius) {
      return node;
    }
  }
  return null;
}

function edgeTypeForNodes(source, target) {
  if (target?.style === 'reference') return 'reference';
  if (source?.media_type === 'image' && target?.media_type === 'video') return 'image_to_video';
  return 'story_branch';
}

async function createEdgeBetweenNodes(sourceNodeId, targetNodeId) {
  if (!state.project?.id || !sourceNodeId || !targetNodeId || sourceNodeId === targetNodeId) {
    return;
  }
  const exists = (state.project.edges || []).some((edge) => (
    edge.source_node_id === sourceNodeId && edge.target_node_id === targetNodeId
  ));
  if (exists) {
    showToast('这条连线已存在');
    return;
  }
  const source = state.project.nodes.find((node) => node.id === sourceNodeId);
  const target = state.project.nodes.find((node) => node.id === targetNodeId);
  await fetchJson('/api/edges', {
    method: 'POST',
    body: JSON.stringify({
      projectId: state.project.id,
      sourceNodeId,
      targetNodeId,
      edgeType: edgeTypeForNodes(source, target),
    }),
  });
  await loadProject(state.project.id, { preserveSelection: true });
  showToast('连线已创建');
}

function updateZoomLabel() {
  elements.zoomLabel.textContent = `${Math.round(state.viewport.scale * 100)}%`;
}

function boundsForNodes(nodes) {
  if (!nodes.length) {
    return { minX: 0, minY: 0, maxX: 1200, maxY: 900, width: 1200, height: 900 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  nodes.forEach((node) => {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + NODE_WIDTH);
    maxY = Math.max(maxY, node.y + NODE_HEIGHT);
  });
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function fitCanvas() {
  const nodes = state.project?.nodes || [];
  const rect = elements.canvas.getBoundingClientRect();
  if (!nodes.length || !rect.width || !rect.height) {
    state.viewport.scale = 1;
    state.viewport.tx = 120;
    state.viewport.ty = 120;
    updateZoomLabel();
    renderCanvas();
    return;
  }

  const bounds = boundsForNodes(nodes);
  const padding = 120;
  const scaleX = (rect.width - padding) / Math.max(bounds.width, 1);
  const scaleY = (rect.height - padding) / Math.max(bounds.height, 1);
  state.viewport.scale = Math.max(0.35, Math.min(1.25, Math.min(scaleX, scaleY)));
  state.viewport.tx = rect.width / 2 - (bounds.minX + bounds.width / 2) * state.viewport.scale;
  state.viewport.ty = rect.height / 2 - (bounds.minY + bounds.height / 2) * state.viewport.scale;
  updateZoomLabel();
  renderCanvas();
}

function centerOnSelected() {
  const node = selectedNode();
  if (!node) return;
  const rect = elements.canvas.getBoundingClientRect();
  state.viewport.tx = rect.width / 2 - (node.x + NODE_WIDTH / 2) * state.viewport.scale;
  state.viewport.ty = rect.height / 2 - (node.y + NODE_HEIGHT / 2) * state.viewport.scale;
  updateZoomLabel();
  renderCanvas();
}

function drawGrid(width, height) {
  ctx.fillStyle = '#081015';
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(state.viewport.tx, state.viewport.ty);
  ctx.scale(state.viewport.scale, state.viewport.scale);

  const view = {
    x: -state.viewport.tx / state.viewport.scale,
    y: -state.viewport.ty / state.viewport.scale,
    width: width / state.viewport.scale,
    height: height / state.viewport.scale,
  };

  const startX = Math.floor((view.x - 800) / GRID_STEP) * GRID_STEP;
  const endX = Math.ceil((view.x + view.width + 800) / GRID_STEP) * GRID_STEP;
  const startY = Math.floor((view.y - 800) / GRID_STEP) * GRID_STEP;
  const endY = Math.ceil((view.y + view.height + 800) / GRID_STEP) * GRID_STEP;

  for (let x = startX; x <= endX; x += GRID_STEP) {
    ctx.beginPath();
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
    ctx.strokeStyle = x % (GRID_STEP * 4) === 0 ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.03)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  for (let y = startY; y <= endY; y += GRID_STEP) {
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
    ctx.strokeStyle = y % (GRID_STEP * 4) === 0 ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.03)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.restore();
}

function drawPort(x, y, fill) {
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(8,16,21,.95)';
  ctx.stroke();
}

function normalizeCornerRadius(radius, width, height) {
  const limit = Math.max(0, Math.min(width, height) / 2);
  const values = Array.isArray(radius) ? radius : [radius];
  const source = values.length ? values : [0];
  const pick = (index) => {
    const raw = Number(source[index]);
    return Number.isFinite(raw)
      ? Math.max(0, Math.min(raw, limit))
      : 0;
  };
  if (source.length === 1) {
    const value = pick(0);
    return [value, value, value, value];
  }
  if (source.length === 2) {
    return [pick(0), pick(1), pick(0), pick(1)];
  }
  if (source.length === 3) {
    return [pick(0), pick(1), pick(2), pick(1)];
  }
  return [pick(0), pick(1), pick(2), pick(3)];
}

function roundRectPath(targetCtx, x, y, width, height, radius) {
  const [topLeft, topRight, bottomRight, bottomLeft] = normalizeCornerRadius(radius, width, height);
  targetCtx.beginPath();
  if (typeof targetCtx.roundRect === 'function') {
    targetCtx.roundRect(x, y, width, height, [topLeft, topRight, bottomRight, bottomLeft]);
    return;
  }
  targetCtx.moveTo(x + topLeft, y);
  targetCtx.lineTo(x + width - topRight, y);
  targetCtx.quadraticCurveTo(x + width, y, x + width, y + topRight);
  targetCtx.lineTo(x + width, y + height - bottomRight);
  targetCtx.quadraticCurveTo(x + width, y + height, x + width - bottomRight, y + height);
  targetCtx.lineTo(x + bottomLeft, y + height);
  targetCtx.quadraticCurveTo(x, y + height, x, y + height - bottomLeft);
  targetCtx.lineTo(x, y + topLeft);
  targetCtx.quadraticCurveTo(x, y, x + topLeft, y);
  targetCtx.closePath();
}

function drawEdge(edge, nodesById) {
  const source = nodesById.get(edge.source_node_id);
  const target = nodesById.get(edge.target_node_id);
  if (!source || !target) return;
  const startX = source.x + NODE_WIDTH / 2;
  const startY = source.y + NODE_HEIGHT;
  const endX = target.x + NODE_WIDTH / 2;
  const endY = target.y;
  const curve = Math.max(80, Math.abs(endY - startY) * 0.4);

  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.bezierCurveTo(startX, startY + curve, endX, endY - curve, endX, endY);
  ctx.strokeStyle = edge.edge_type === 'image_to_video'
    ? 'rgba(255,181,92,.82)'
    : edge.edge_type === 'reference'
      ? 'rgba(127,198,255,.65)'
      : 'rgba(57,208,179,.55)';
  ctx.lineWidth = edge.edge_type === 'reference' ? 1.5 : 2.4;
  ctx.stroke();
}

function drawEdgePreview(sourceNode, toX, toY) {
  const start = outputPort(sourceNode);
  const endX = toX;
  const endY = toY;
  const curve = Math.max(80, Math.abs(endY - start.y) * 0.4);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.bezierCurveTo(start.x, start.y + curve, endX, endY - curve, endX, endY);
  ctx.strokeStyle = 'rgba(99,102,241,.82)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawNode(node) {
  const selected = node.id === state.selectedNodeId;
  const image = node.preview_url ? state.imageCache.get(node.preview_url) : null;
  const isUtilityNode = node.style === 'note' || node.style === 'reference' || (node.status === 'draft' && !node.preview_url);

  ctx.save();
  ctx.translate(node.x, node.y);

  roundRectPath(ctx, 0, 0, NODE_WIDTH, NODE_HEIGHT, 22);
  ctx.fillStyle = isUtilityNode
    ? 'rgba(20,30,38,.96)'
    : 'rgba(13,20,26,.97)';
  ctx.fill();

  ctx.lineWidth = selected ? 2.8 : 1.2;
  ctx.strokeStyle = selected
    ? 'rgba(57,208,179,.9)'
    : isUtilityNode
      ? 'rgba(127,198,255,.22)'
      : 'rgba(255,255,255,.08)';
  ctx.stroke();

  const headerGradient = ctx.createLinearGradient(0, 0, NODE_WIDTH, 0);
  if (node.media_type === 'video') {
    headerGradient.addColorStop(0, 'rgba(255,181,92,.24)');
    headerGradient.addColorStop(1, 'rgba(255,255,255,.03)');
  } else if (isUtilityNode) {
    headerGradient.addColorStop(0, 'rgba(127,198,255,.22)');
    headerGradient.addColorStop(1, 'rgba(255,255,255,.03)');
  } else {
    headerGradient.addColorStop(0, 'rgba(57,208,179,.2)');
    headerGradient.addColorStop(1, 'rgba(255,255,255,.03)');
  }
  ctx.fillStyle = headerGradient;
  roundRectPath(ctx, 0, 0, NODE_WIDTH, HEADER_HEIGHT, [22, 22, 0, 0]);
  ctx.fill();

  ctx.fillStyle = '#eef6fa';
  ctx.font = '700 12px "Avenir Next","PingFang SC",sans-serif';
  const headerLabel = node.style === 'note'
    ? '✎ 便签节点'
    : node.style === 'reference'
      ? '◫ 参考节点'
      : node.media_type === 'video'
        ? '🎬 Video Node'
        : '🖼️ Image Node';
  ctx.fillText(headerLabel, 14, 24);

  drawPort(NODE_WIDTH / 2, 0, node.media_type === 'video' ? 'rgba(255,181,92,.95)' : 'rgba(57,208,179,.95)');
  drawPort(NODE_WIDTH / 2, NODE_HEIGHT, node.style === 'reference' ? 'rgba(127,198,255,.95)' : 'rgba(57,208,179,.95)');

  ctx.beginPath();
  ctx.arc(NODE_WIDTH - 18, 18, 6, 0, Math.PI * 2);
  ctx.fillStyle = node.status === 'completed'
    ? '#82e293'
    : node.status === 'error'
      ? '#ff6e6e'
      : node.status === 'generating'
        ? '#ffb55c'
        : '#7b90a0';
  ctx.fill();

  const previewY = HEADER_HEIGHT;
  if (image) {
    ctx.save();
    roundRectPath(ctx, 10, previewY + 10, NODE_WIDTH - 20, PREVIEW_HEIGHT - 20, 16);
    ctx.clip();
    ctx.drawImage(image, 10, previewY + 10, NODE_WIDTH - 20, PREVIEW_HEIGHT - 20);
    ctx.restore();
  } else {
    const previewGradient = ctx.createLinearGradient(10, previewY + 10, NODE_WIDTH - 10, previewY + PREVIEW_HEIGHT - 10);
    previewGradient.addColorStop(0, isUtilityNode ? 'rgba(127,198,255,.16)' : 'rgba(57,208,179,.15)');
    previewGradient.addColorStop(1, node.media_type === 'video' ? 'rgba(255,181,92,.18)' : 'rgba(255,255,255,.04)');
    ctx.fillStyle = previewGradient;
    roundRectPath(ctx, 10, previewY + 10, NODE_WIDTH - 20, PREVIEW_HEIGHT - 20, 16);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.78)';
    ctx.font = '700 34px "Avenir Next","PingFang SC",sans-serif';
    ctx.textAlign = 'center';
    const symbol = node.style === 'note'
      ? '✎'
      : node.style === 'reference'
        ? '◫'
        : node.media_type === 'video'
          ? '▶'
          : '▣';
    ctx.fillText(symbol, NODE_WIDTH / 2, previewY + PREVIEW_HEIGHT / 2 + 12);
    ctx.textAlign = 'left';
  }

  ctx.fillStyle = '#eef6fa';
  ctx.font = '700 13px "Avenir Next","PingFang SC",sans-serif';
  wrapText((node.prompt || '未填写提示词').slice(0, 56), 16, HEADER_HEIGHT + PREVIEW_HEIGHT + 24, NODE_WIDTH - 32, 18, 2);

  ctx.fillStyle = '#8ea5b3';
  ctx.font = '11px "Avenir Next","PingFang SC",sans-serif';
  const footerText = `Scene ${node.scene_id ?? '—'} · ${node.style || node.status}`;
  ctx.fillText(footerText, 16, NODE_HEIGHT - 18);
  ctx.restore();
}

function wrapText(text, x, y, maxWidth, lineHeight, maxLines) {
  const chars = String(text || '').split('');
  let line = '';
  let lineIndex = 0;
  chars.forEach((char, index) => {
    const testLine = line + char;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, y + lineIndex * lineHeight);
      line = char;
      lineIndex += 1;
      if (lineIndex >= maxLines) {
        ctx.fillText(`${line.slice(0, Math.max(0, line.length - 1))}…`, x, y + lineIndex * lineHeight);
        line = '';
      }
    } else {
      line = testLine;
    }
    if (index === chars.length - 1 && line) {
      ctx.fillText(line, x, y + lineIndex * lineHeight);
    }
  });
}

function renderMinimap() {
  const width = elements.minimapCanvas.width;
  const height = elements.minimapCanvas.height;
  minimapCtx.clearRect(0, 0, width, height);
  minimapCtx.fillStyle = 'rgba(6,11,15,.96)';
  minimapCtx.fillRect(0, 0, width, height);

  const nodes = state.project?.nodes || [];
  elements.minimapMeta.textContent = `${nodes.length} nodes`;

  if (!nodes.length) {
    minimapCtx.fillStyle = 'rgba(141,163,177,.8)';
    minimapCtx.font = '12px sans-serif';
    minimapCtx.fillText('No nodes', 84, 66);
    return;
  }

  const bounds = boundsForNodes(nodes);
  const padding = 12;
  const scale = Math.min(
    (width - padding * 2) / Math.max(bounds.width, 1),
    (height - padding * 2) / Math.max(bounds.height, 1)
  );
  const offsetX = (width - bounds.width * scale) / 2 - bounds.minX * scale;
  const offsetY = (height - bounds.height * scale) / 2 - bounds.minY * scale;

  state.minimap.worldBounds = { bounds, scale, offsetX, offsetY };

  nodes.forEach((node) => {
    minimapCtx.fillStyle = node.id === state.selectedNodeId
      ? '#39d0b3'
      : node.media_type === 'video'
        ? '#ffb55c'
        : node.style === 'reference'
          ? '#7fc6ff'
          : 'rgba(255,255,255,.58)';
    minimapCtx.fillRect(
      offsetX + node.x * scale,
      offsetY + node.y * scale,
      Math.max(8, NODE_WIDTH * scale),
      Math.max(8, NODE_HEIGHT * scale)
    );
  });

  const viewWorld = {
    x: -state.viewport.tx / state.viewport.scale,
    y: -state.viewport.ty / state.viewport.scale,
    width: elements.canvas.width / state.viewport.scale,
    height: elements.canvas.height / state.viewport.scale,
  };
  minimapCtx.strokeStyle = 'rgba(255,255,255,.95)';
  minimapCtx.lineWidth = 1.5;
  minimapCtx.strokeRect(
    offsetX + viewWorld.x * scale,
    offsetY + viewWorld.y * scale,
    viewWorld.width * scale,
    viewWorld.height * scale
  );
}

function renderCanvas() {
  const rect = elements.canvas.getBoundingClientRect();
  const width = Math.max(480, Math.floor(rect.width || elements.canvas.parentElement.clientWidth));
  const height = Math.max(420, Math.floor(rect.height || elements.canvas.parentElement.clientHeight));
  if (elements.canvas.width !== width || elements.canvas.height !== height) {
    elements.canvas.width = width;
    elements.canvas.height = height;
  }

  drawGrid(width, height);
  ctx.save();
  ctx.translate(state.viewport.tx, state.viewport.ty);
  ctx.scale(state.viewport.scale, state.viewport.scale);

  const nodes = state.project?.nodes || [];
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  if (state.showEdges) {
    (state.project?.edges || []).forEach((edge) => drawEdge(edge, nodesById));
  }
  if (state.linking?.sourceNodeId) {
    const sourceNode = nodesById.get(state.linking.sourceNodeId);
    if (sourceNode) {
      drawEdgePreview(sourceNode, state.linking.toX, state.linking.toY);
    }
  }
  nodes.forEach((node) => {
    if (node.preview_url) loadImage(node.preview_url);
    drawNode(node);
  });
  ctx.restore();
  renderMinimap();
}

function isTypingTarget(target) {
  if (!target) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

function parseStoryboardLines(input, defaultMediaType) {
  return input
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const lowered = line.toLowerCase();
      if (lowered.startsWith('video::')) {
        return { mediaType: 'video', prompt: line.slice(7).trim() };
      }
      if (lowered.startsWith('image::')) {
        return { mediaType: 'image', prompt: line.slice(7).trim() };
      }
      return { mediaType: defaultMediaType, prompt: line };
    })
    .filter((item) => item.prompt);
}

async function loadProjects() {
  const response = await fetchJson('/api/projects');
  state.projects = (getData(response) || []).map(normalizeProject);
  renderProjects();
}

async function loadProject(projectId, { preserveSelection = true } = {}) {
  const response = await fetchJson(`/api/projects/${projectId}`);
  state.project = normalizeProject(response);
  if (!preserveSelection || !state.project.nodes.some((node) => node.id === state.selectedNodeId)) {
    state.selectedNodeId = state.project.nodes[0]?.id || null;
  }
  reconcileLocalBatch();
  renderProjects();
  renderStats();
  renderNodeList();
  renderSessionList();
  renderFileList();
  renderDetail();
  updateDraftHint();
  updateBatchHint();
  renderCanvas();
}

async function selectProject(projectId) {
  if (!projectId) return;
  state.ui.projectRailOpen = false;
  state.ui.canvasActionsOpen = false;
  state.ui.minimapOpen = false;
  renderPanelState();
  history.replaceState({}, '', `?projectId=${projectId}`);
  await loadProject(projectId, { preserveSelection: true });
}

async function reloadProjectsAndSelection() {
  await loadProjects();
  const projectId = new URLSearchParams(window.location.search).get('projectId');
  if (projectId) {
    await selectProject(projectId);
  } else if (state.projects[0]?.id) {
    await selectProject(state.projects[0].id);
  }
}

async function ensureProject() {
  if (state.project?.id) return state.project.id;
  const response = await fetchJson('/api/session/change-project', { method: 'POST' });
  const created = getData(response);
  await loadProjects();
  await selectProject(created.projectUuid || created.projectId);
  return state.project?.id;
}

async function createProject() {
  const response = await fetchJson('/api/session/change-project', { method: 'POST' });
  const created = getData(response);
  await loadProjects();
  await selectProject(created.projectUuid || created.projectId);
  fitCanvas();
  showToast('已创建新项目');
}

async function submitSession({ message, mediaType, aspect, style, parentNodeId }) {
  const projectId = await ensureProject();
  const payload = await fetchJson('/api/session', {
    method: 'POST',
    body: JSON.stringify({
      projectId,
      message,
      mediaType,
      aspect,
      style,
      parentNodeId: parentNodeId || null,
    }),
  });
  return getData(payload);
}

async function generateNode() {
  const message = elements.promptInput.value.trim();
  if (!message) {
    showToast('先写一个提示词');
    return;
  }
  if (elements.mediaTypeSelect.value === 'video') {
    assertVideoCreationAvailable({ requiresImageToVideo: Boolean(state.selectedNodeId) });
  }
  elements.generateButton.disabled = true;
  try {
    const created = await submitSession({
      message,
      mediaType: elements.mediaTypeSelect.value,
      aspect: elements.aspectSelect.value,
      style: elements.styleInput.value.trim(),
      parentNodeId: state.selectedNodeId || null,
    });
    elements.promptInput.value = '';
    state.selectedNodeId = created.nodeId || state.selectedNodeId;
    await loadProject(created.projectId || state.project?.id, { preserveSelection: true });
    centerOnSelected();
    showToast('任务已提交到画布');
  } finally {
    elements.generateButton.disabled = false;
  }
}

function completedBatchCount() {
  if (!state.localBatch.sessionIds.length || !state.project) return 0;
  const sessions = state.project.sessions.filter((session) => state.localBatch.sessionIds.includes(session.id));
  return sessions.filter((session) => ['completed', 'error'].includes(session.status)).length;
}

function reconcileLocalBatch() {
  if (!state.localBatch.sessionIds.length || !state.project) {
    state.localBatch.running = false;
    return;
  }
  const done = completedBatchCount();
  state.localBatch.running = done < state.localBatch.total;
}

async function queueStoryboard() {
  const lines = parseStoryboardLines(elements.storyboardInput.value, elements.mediaTypeSelect.value);
  if (!lines.length) {
    showToast('先在批量脚本里写至少一个镜头');
    return;
  }
  assertStoryboardCapabilities(lines);

  const queueMode = elements.queueModeSelect.value;
  elements.queueStoryboardButton.disabled = true;
  state.localBatch = { running: true, sessionIds: [], total: lines.length };
  elements.batchStatus.textContent = `排队中 0/${lines.length}`;

  try {
    let parentNodeId = queueMode === 'free' ? null : state.selectedNodeId;
    let currentProjectId = await ensureProject();

    for (const item of lines) {
      const created = await submitSession({
        message: item.prompt,
        mediaType: item.mediaType,
        aspect: elements.aspectSelect.value,
        style: elements.styleInput.value.trim(),
        parentNodeId,
      });
      currentProjectId = created.projectId || currentProjectId;
      if (created.sessionId) {
        state.localBatch.sessionIds.push(created.sessionId);
      }
      if (queueMode === 'chain') {
        parentNodeId = created.nodeId || parentNodeId;
      }
      if (queueMode === 'free') {
        parentNodeId = null;
      }
    }

    await loadProject(currentProjectId, { preserveSelection: true });
    showToast(`已排队 ${lines.length} 个镜头`);
  } finally {
    elements.queueStoryboardButton.disabled = false;
  }
}

async function retryFailedSessions() {
  if (!state.project?.id) return;
  const failedSessions = (state.project.sessions || []).filter((session) => session.status === 'error');
  if (!failedSessions.length) {
    showToast('当前没有失败任务');
    return;
  }
  if (failedSessions.some((session) => session.media_type === 'video')) {
    assertVideoCreationAvailable({
      requiresImageToVideo: failedSessions.some((session) => session.media_type === 'video' && session.parent_node_id),
    });
  }

  elements.retryFailedSessionsButton.disabled = true;
  try {
    for (const session of failedSessions) {
      const node = state.project.nodes.find((item) => item.id === session.node_id);
      await submitSession({
        message: session.message || node?.prompt || 'retry task',
        mediaType: session.media_type || node?.media_type || 'image',
        aspect: node?.aspect || 'origin',
        style: node?.style || '',
        parentNodeId: node?.parent_node_id || null,
      });
    }
    await loadProject(state.project.id, { preserveSelection: true });
    showToast(`已重试 ${failedSessions.length} 个失败任务`);
  } finally {
    elements.retryFailedSessionsButton.disabled = false;
  }
}

async function createUtilityNode(kind) {
  const projectId = await ensureProject();
  const worldCenter = currentWorldCenter();
  const prompt = kind === 'note'
    ? '便签：在这里记录剧情方向 / 镜头备注'
    : '参考：上传素材后可手动关联到此节点';
  const payload = await fetchJson('/api/nodes', {
    method: 'POST',
    body: JSON.stringify({
      projectId,
      mediaType: 'image',
      x: Math.round(worldCenter.x - NODE_WIDTH / 2),
      y: Math.round(worldCenter.y - NODE_HEIGHT / 2),
      prompt,
      status: 'draft',
      style: kind,
    }),
  });
  const node = normalizeNode(payload);
  if (state.selectedNodeId) {
    await fetchJson('/api/edges', {
      method: 'POST',
      body: JSON.stringify({
        projectId,
        sourceNodeId: state.selectedNodeId,
        targetNodeId: node.id,
        edgeType: kind === 'reference' ? 'reference' : 'story_branch',
      }),
    });
  }
  state.selectedNodeId = node.id;
  await loadProject(projectId, { preserveSelection: true });
  centerOnSelected();
  showToast(kind === 'note' ? '已添加便签节点' : '已添加参考节点');
  return selectedNode();
}

async function fileToBase64(file) {
  const buffer = await file.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function inferUploadMediaType(file) {
  const type = String(file?.type || '').toLowerCase();
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('image/')) return 'image';
  return /\.(mp4|mov|webm)$/i.test(file?.name || '') ? 'video' : 'image';
}

async function ensureUploadTargetNode() {
  let targetNode = selectedNode();
  if (!targetNode) {
    targetNode = await createUtilityNode('reference');
  }
  if (!targetNode?.id) {
    throw new Error('无法确定素材挂载节点');
  }
  return targetNode;
}

async function uploadReferenceAsset(file, options = {}) {
  if (!file) return;
  const projectId = await ensureProject();
  const targetNode = options.targetNode || await ensureUploadTargetNode();
  const payload = {
    projectId,
    nodeId: targetNode.id,
    fileData: await fileToBase64(file),
    filename: file.name || 'upload',
    mimeType: file.type || undefined,
    mediaType: inferUploadMediaType(file),
    prompt: targetNode.prompt || '',
  };
  await fetchJson('/api/upload', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return { projectId, targetNodeId: targetNode.id };
}

async function uploadReferenceFiles(files) {
  const uploadList = Array.from(files || []).filter(Boolean);
  if (!uploadList.length) return;
  const targetNode = await ensureUploadTargetNode();
  const total = uploadList.length;
  for (let index = 0; index < total; index += 1) {
    const file = uploadList[index];
    await uploadReferenceAsset(file, { targetNode });
    elements.batchStatus.textContent = `素材上传 ${index + 1}/${total}`;
  }
  await loadProject(state.project.id, { preserveSelection: true });
  centerOnSelected();
  showToast(total === 1 ? `已上传素材：${uploadList[0].name}` : `已上传 ${total} 个素材`);
}

async function saveNodePosition(node) {
  if (!node) return;
  const existing = state.saveQueue.get(node.id);
  const nextPosition = { x: node.x, y: node.y };
  if (existing) {
    existing.next = nextPosition;
    return existing.promise;
  }
  const entry = { next: null, promise: null };
  const flush = async (position) => {
    await fetchJson(`/api/nodes/${node.id}`, {
      method: 'PATCH',
      body: JSON.stringify(position),
    });
    if (entry.next) {
      const latest = entry.next;
      entry.next = null;
      await flush(latest);
    }
  };
  entry.promise = flush(nextPosition).finally(() => state.saveQueue.delete(node.id));
  state.saveQueue.set(node.id, entry);
  await entry.promise;
}

async function savePrompt() {
  const node = selectedNode();
  if (!node) return;
  const prompt = elements.detailPromptInput.value.trim();
  const mediaType = elements.detailMediaTypeSelect.value || 'image';
  const aspect = elements.detailAspectSelect.value || 'origin';
  const style = elements.detailStyleInput.value.trim();
  const status = elements.detailStatusSelect.value || 'pending';
  const sceneValue = elements.detailSceneInput.value.trim();
  const sceneId = sceneValue ? Number(sceneValue) : null;
  const patch = {
    prompt,
    mediaType,
    aspect,
    style,
    status,
  };
  if (sceneValue) {
    patch.sceneId = Number.isFinite(sceneId) ? Math.max(1, Math.round(sceneId)) : node.scene_id ?? 1;
  }
  await fetchJson(`/api/nodes/${node.id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  state.detailDraft = { nodeId: node.id, dirty: false };
  await loadProject(state.project.id, { preserveSelection: true });
  showToast('节点参数已保存');
}

async function deleteSelectedNode() {
  const node = selectedNode();
  if (!node) return;
  await fetchJson(`/api/nodes/${node.id}`, { method: 'DELETE' });
  state.selectedNodeId = null;
  await loadProject(state.project.id, { preserveSelection: false });
  showToast('节点已删除');
}

async function exportSubtitle() {
  if (!state.project?.id) return;
  const result = await fetchJson(`/api/projects/${state.project.id}/export/subtitle`);
  showToast(`字幕已导出: ${result.srt}`);
  if (result.srt_url) {
    window.open(new URL(result.srt_url, API_BASE).toString(), '_blank', 'noopener');
  }
}

async function exportVideo() {
  if (!state.project?.id) return;
  const exportReason = currentVideoExportReason();
  if (exportReason) {
    throw new Error(exportReason);
  }
  const aspect = elements.aspectSelect.value || 'origin';
  const result = await fetchJson(`/api/projects/${state.project.id}/export/video?aspect=${encodeURIComponent(aspect)}`);
  showToast(`视频已导出: ${result.path}`);
  if (result.url) {
    window.open(new URL(result.url, API_BASE).toString(), '_blank', 'noopener');
  }
}

async function autoArrangeNodes() {
  if (!state.project?.nodes.length) return;
  const sorted = [...state.project.nodes].sort((left, right) => {
    const leftScene = Number(left.scene_id || 0);
    const rightScene = Number(right.scene_id || 0);
    if (leftScene !== rightScene) return leftScene - rightScene;
    return new Date(left.created_at || 0) - new Date(right.created_at || 0);
  });

  const sceneStacks = new Map();
  const updates = sorted.map((node, index) => {
    const scene = Number(node.scene_id || index + 1);
    const rowBase = node.media_type === 'video' ? 1 : (node.style === 'note' || node.style === 'reference' ? 2 : 0);
    const stackKey = `${scene}:${rowBase}`;
    const stackIndex = sceneStacks.get(stackKey) || 0;
    sceneStacks.set(stackKey, stackIndex + 1);
    return {
      id: node.id,
      x: 120 + stackIndex * (NODE_WIDTH + 20),
      y: 120 + (scene - 1) * (NODE_HEIGHT + 60),
    };
  });

  await Promise.all(updates.map((item) => fetchJson(`/api/nodes/${item.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ x: item.x, y: item.y }),
  })));
  await loadProject(state.project.id, { preserveSelection: true });
  fitCanvas();
  showToast('已自动布局节点');
}

async function downloadNodeMedia(node) {
  if (!node?.result_url) return;
  const url = new URL(node.result_url, API_BASE).toString();
  const isVideo = node.media_type === 'video' || /\.(mp4|mov|webm)(\?|$)/i.test(url);
  const ext = isVideo ? 'mp4' : 'png';
  const filename = `scene${node.scene_id || 'x'}.${ext}`;
  try {
    const opts = {};
    if (state.auth.token) opts.headers = { 'X-Canvas-Token': state.auth.token };
    const resp = await fetch(url, opts);
    if (!resp.ok) throw new Error(resp.status);
    const blob = await resp.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
    showToast('已开始下载: ' + filename);
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

// Popup state: which node is being edited in the popup
let popupNode = null;

function openNodePopup(node) {
  popupNode = node;
  const scene = node.scene_id ? `Scene ${node.scene_id}` : '节点详情';
  const label = node.prompt || node.label || '';
  const shortLabel = label.length > 30 ? label.slice(0, 30) + '…' : label;
  elements.popupTitle.textContent = shortLabel || scene;

  // Full prompt: try file.prompt (original generation prompt) first, fall back to node.prompt
  const fullPrompt = node.file?.prompt || node.prompt || '';
  elements.popupPrompt.value = fullPrompt;
  elements.popupMediaTypeSelect.value = node.media_type || 'image';
  elements.popupAspectSelect.value = node.aspect || 'origin';

  const preview = node.preview_url || node.result_url;
  const isVideo = node.media_type === 'video' || (preview && /\.(mp4|mov|webm)(\?|$)/i.test(preview));
  elements.popupImg.hidden = true;
  elements.popupVideo.hidden = true;
  elements.popupImg.removeAttribute('src');
  elements.popupVideo.removeAttribute('src');
  if (preview) {
    const abs = new URL(preview, API_BASE).toString();
    if (isVideo) {
      elements.popupVideo.hidden = false;
      elements.popupVideo.src = abs;
    } else {
      elements.popupImg.hidden = false;
      elements.popupImg.src = abs;
    }
  }
  elements.popupMeta.textContent = `Scene ${node.scene_id ?? '—'} · ${node.status || '—'}`;
  if (elements.popupSpinner) elements.popupSpinner.hidden = true;
  elements.nodePopup.classList.add('show');
}

function closeNodePopup() {
  elements.nodePopup.classList.remove('show');
  popupNode = null;
}

function openLightbox(url, isVideo) {
  if (!url) return;
  elements.lightbox.classList.add('show');
  elements.lightboxImage.hidden = true;
  elements.lightboxVideo.hidden = true;
  elements.lightboxSpinner.hidden = false;
  const hideSpinner = () => { elements.lightboxSpinner.hidden = true; };
  if (isVideo) {
    elements.lightboxVideo.hidden = false;
    elements.lightboxVideo.src = url;
    elements.lightboxVideo.oncanplay = hideSpinner;
  } else {
    elements.lightboxImage.hidden = false;
    elements.lightboxImage.src = url;
    elements.lightboxImage.onload = hideSpinner;
  }
}

function closeLightbox() {
  elements.lightbox.classList.remove('show');
  elements.lightboxSpinner.hidden = true;
  elements.lightboxImage.hidden = true;
  elements.lightboxImage.onload = null;
  elements.lightboxImage.removeAttribute('src');
  elements.lightboxVideo.hidden = true;
  elements.lightboxVideo.oncanplay = null;
  elements.lightboxVideo.pause();
  elements.lightboxVideo.removeAttribute('src');
}

function pointerToMinimapWorld(clientX, clientY) {
  const rect = elements.minimapCanvas.getBoundingClientRect();
  const localX = clientX - rect.left;
  const localY = clientY - rect.top;
  const map = state.minimap.worldBounds;
  if (!map) return null;
  return {
    x: (localX - map.offsetX) / map.scale,
    y: (localY - map.offsetY) / map.scale,
  };
}

function panViewportToWorldCenter(worldX, worldY) {
  const rect = elements.canvas.getBoundingClientRect();
  state.viewport.tx = rect.width / 2 - worldX * state.viewport.scale;
  state.viewport.ty = rect.height / 2 - worldY * state.viewport.scale;
  renderCanvas();
}

elements.projectSelect.addEventListener('change', () => selectProject(elements.projectSelect.value));
elements.projectRailToggleButton.addEventListener('click', (event) => {
  event.stopPropagation();
  toggleProjectRail();
});
elements.canvasActionToggleButton.addEventListener('click', (event) => {
  event.stopPropagation();
  toggleCanvasPopover('actions');
});
elements.minimapToggleButton.addEventListener('click', (event) => {
  event.stopPropagation();
  toggleCanvasPopover('minimap');
});
elements.leftPanelToggleButton.addEventListener('click', () => togglePanel('left'));
elements.queuePanelToggleButton.addEventListener('click', () => togglePanel('queue'));
elements.rightPanelToggleButton.addEventListener('click', () => togglePanel('right'));
elements.leftPanelCloseButton.addEventListener('click', closePanels);
elements.queuePanelCloseButton.addEventListener('click', closePanels);
elements.rightPanelCloseButton.addEventListener('click', closePanels);
elements.workspaceOverlay.addEventListener('click', closePanels);
document.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Node)) return;
  if (state.ui.projectRailOpen && !elements.projectRailToggleButton.contains(target) && !elements.projectRailPopover.contains(target)) {
    closeProjectRail();
  }
  if (anyCanvasPopoverOpen() && !elements.canvasRightTools.contains(target)) {
    closeCanvasPopovers();
  }
});
elements.refreshButton.addEventListener('click', async () => {
  runUiAction(async () => {
    await loadCapabilities({ suppressErrors: true });
    await loadProjects();
    if (state.project?.id) {
      await loadProject(state.project.id, { preserveSelection: true });
    }
    showToast('已刷新');
  }, '刷新失败');
});
elements.newProjectButton.addEventListener('click', () => runUiAction(createProject, '创建项目失败'));
elements.generateButton.addEventListener('click', () => runUiAction(generateNode, '生成失败'));
elements.clearDraftButton.addEventListener('click', () => {
  elements.promptInput.value = '';
  elements.styleInput.value = '';
});
elements.createNoteButton.addEventListener('click', () => runUiAction(() => createUtilityNode('note'), '添加便签失败'));
elements.createRefButton.addEventListener('click', () => runUiAction(() => createUtilityNode('reference'), '添加参考节点失败'));
elements.uploadRefButton.addEventListener('click', () => elements.referenceUploadInput.click());
elements.openAssetPickerButton.addEventListener('click', () => elements.referenceUploadInput.click());
elements.queueModeSelect.addEventListener('change', updateBatchHint);
elements.queueStoryboardButton.addEventListener('click', () => runUiAction(queueStoryboard, '批量排队失败'));
elements.clearStoryboardButton.addEventListener('click', () => {
  elements.storyboardInput.value = '';
});
elements.sessionFilterSelect.addEventListener('change', renderSessionList);
elements.retryFailedSessionsButton.addEventListener('click', () => runUiAction(retryFailedSessions, '重试失败'));
elements.autoArrangeButton.addEventListener('click', () => runUiAction(autoArrangeNodes, '自动布局失败'));
elements.exportSubtitleButton.addEventListener('click', () => runUiAction(exportSubtitle, '导出字幕失败'));
elements.exportVideoButton.addEventListener('click', () => runUiAction(exportVideo, '导出视频失败'));
elements.focusButton.addEventListener('click', centerOnSelected);
elements.toggleEdgesButton.addEventListener('click', () => {
  state.showEdges = !state.showEdges;
  elements.toggleEdgesButton.textContent = state.showEdges ? '隐藏连线' : '显示连线';
  renderCanvas();
});
elements.savePromptButton.addEventListener('click', savePrompt);
elements.reusePromptButton.addEventListener('click', () => {
  const node = selectedNode();
  if (!node) return;
  elements.promptInput.value = node.prompt || '';
  elements.mediaTypeSelect.value = node.media_type || 'image';
  showToast('已载入到草稿');
});
elements.uploadNodeAssetButton.addEventListener('click', () => elements.referenceUploadInput.click());
elements.openMediaButton.addEventListener('click', () => {
  const node = selectedNode();
  if (!node?.preview_url) return;
  openLightbox(new URL(node.preview_url, API_BASE).toString(), node.media_type === 'video');
});
elements.copyLinkButton.addEventListener('click', async () => {
  const node = selectedNode();
  if (!node?.preview_url) return;
  await navigator.clipboard.writeText(new URL(node.preview_url, API_BASE).toString());
  showToast('已复制结果链接');
});
elements.deleteNodeButton.addEventListener('click', deleteSelectedNode);

elements.downloadMediaButton.addEventListener('click', () => {
  const node = selectedNode();
  if (!node) {
    showToast('请先选中一个节点', true);
    return;
  }
  downloadNodeMedia(node);
});

elements.regenerateNodeButton.addEventListener('click', async () => {
  const node = selectedNode();
  if (!node) return;
  const prompt = elements.detailPromptInput.value.trim() || node.prompt;
  if (!prompt) {
    showToast('节点没有提示词，无法生成', true);
    return;
  }
  elements.regenerateNodeButton.disabled = true;
  try {
    const created = await submitSession({
      message: prompt,
      mediaType: elements.detailMediaTypeSelect.value || node.media_type || 'image',
      aspect: elements.detailAspectSelect.value || node.aspect || 'origin',
      style: elements.detailStyleInput.value.trim() || node.style || '',
      parentNodeId: node.parent_node_id || null,
    });
    await loadProject(created.projectId || state.project.id, { preserveSelection: true });
    showToast('已提交重新生成任务');
  } catch (err) {
    showToast('生成失败: ' + (err.message || err), true);
  } finally {
    elements.regenerateNodeButton.disabled = false;
  }
});
elements.zoomInButton.addEventListener('click', () => {
  state.viewport.scale = Math.min(3.4, state.viewport.scale * 1.12);
  updateZoomLabel();
  renderCanvas();
});
elements.zoomOutButton.addEventListener('click', () => {
  state.viewport.scale = Math.max(0.35, state.viewport.scale / 1.12);
  updateZoomLabel();
  renderCanvas();
});
elements.fitButton.addEventListener('click', fitCanvas);
elements.lightboxClose.addEventListener('click', closeLightbox);
elements.lightbox.addEventListener('click', (event) => {
  if (event.target === elements.lightbox) closeLightbox();
});
elements.detailImage.addEventListener('click', () => {
  const node = selectedNode();
  if (node?.preview_url) {
    openLightbox(new URL(node.preview_url, API_BASE).toString(), false);
  }
});
elements.detailVideo.addEventListener('dblclick', () => {
  const node = selectedNode();
  if (node?.preview_url) {
    openLightbox(new URL(node.preview_url, API_BASE).toString(), true);
  }
});
elements.authLoginButton.addEventListener('click', async () => {
  try {
    await loginCanvasWithToken(elements.authTokenInput.value);
    if (state.auth.authenticated) {
      await reloadProjectsAndSelection();
    }
  } catch {
    // Status is already surfaced inline.
  }
});
elements.authRetryButton.addEventListener('click', async () => {
  try {
    await refreshAuthStatus();
    if (state.auth.authenticated) {
      setAuthStatus('访问已授权。');
      await reloadProjectsAndSelection();
    } else {
      setAuthStatus('仍未授权，请输入访问令牌。');
    }
  } catch (error) {
    setAuthStatus(error.message || '无法检测鉴权状态。', true);
  }
});
elements.detailPromptInput.addEventListener('input', () => {
  const node = selectedNode();
  if (!node) return;
  state.detailDraft = { nodeId: node.id, dirty: true };
});
[
  elements.detailMediaTypeSelect,
  elements.detailAspectSelect,
  elements.detailStyleInput,
  elements.detailSceneInput,
  elements.detailStatusSelect,
].forEach((input) => {
  const eventName = input?.tagName === 'SELECT' ? 'change' : 'input';
  input?.addEventListener(eventName, () => {
    const node = selectedNode();
    if (!node) return;
    state.detailDraft = { nodeId: node.id, dirty: true };
  });
});
elements.referenceUploadInput.addEventListener('change', async (event) => {
  const files = Array.from(event.target.files || []);
  event.target.value = '';
  if (!files.length) return;
  try {
    await uploadReferenceFiles(files);
  } catch (error) {
    showToast(error.message || '素材上传失败');
  }
});
['dragenter', 'dragover'].forEach((eventName) => {
  elements.assetDropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    event.stopPropagation();
    elements.assetDropZone.classList.add('dragover');
  });
});
['dragleave', 'dragend', 'drop'].forEach((eventName) => {
  elements.assetDropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (eventName !== 'drop') {
      elements.assetDropZone.classList.remove('dragover');
    }
  });
});
elements.assetDropZone.addEventListener('drop', async (event) => {
  elements.assetDropZone.classList.remove('dragover');
  const files = Array.from(event.dataTransfer?.files || []).filter((file) => {
    const type = String(file.type || '');
    return type.startsWith('image/') || type.startsWith('video/');
  });
  if (!files.length) {
    showToast('仅支持图片或视频素材');
    return;
  }
  try {
    await uploadReferenceFiles(files);
  } catch (error) {
    showToast(error.message || '素材上传失败');
  }
});
elements.authTokenInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    elements.authLoginButton.click();
  }
});

elements.minimapCanvas.addEventListener('pointerdown', (event) => {
  const world = pointerToMinimapWorld(event.clientX, event.clientY);
  if (!world) return;
  panViewportToWorldCenter(world.x, world.y);
});

elements.canvas.addEventListener('pointerdown', (event) => {
  const point = worldPointFromCanvas(event.clientX, event.clientY);
  const sourcePortNode = hitPort(point.x, point.y, 'output');
  if (sourcePortNode) {
    state.selectedNodeId = sourcePortNode.id;
    state.linking = {
      sourceNodeId: sourcePortNode.id,
      toX: point.x,
      toY: point.y,
    };
    elements.canvas.setPointerCapture(event.pointerId);
    renderNodeList();
    renderDetail();
    updateDraftHint();
    renderCanvas();
    return;
  }
  const node = hitNode(point.x, point.y);
  elements.canvas.setPointerCapture(event.pointerId);
  if (node) {
    // Click on preview area → open node popup
    const inPreview = point.y >= node.y + HEADER_HEIGHT
      && point.y <= node.y + HEADER_HEIGHT + PREVIEW_HEIGHT;
    if (inPreview) {
      state.selectedNodeId = node.id;
      renderNodeList();
      renderDetail();
      openNodePopup(node);
      renderCanvas();
      return;
    }
    state.selectedNodeId = node.id;
    state.dragging = {
      nodeId: node.id,
      offsetX: point.x - node.x,
      offsetY: point.y - node.y,
      moved: false,
    };
    renderNodeList();
    renderDetail();
    updateDraftHint();
    renderCanvas();
  } else {
    state.selectedNodeId = null;
    state.panning = { startX: event.clientX, startY: event.clientY };
    renderNodeList();
    renderDetail();
    updateDraftHint();
    renderCanvas();
  }
});

elements.canvas.addEventListener('pointermove', (event) => {
  if (state.dragging && state.project) {
    const nodeIndex = state.project.nodes.findIndex((item) => item.id === state.dragging.nodeId);
    if (nodeIndex >= 0) {
      const point = worldPointFromCanvas(event.clientX, event.clientY);
      const node = state.project.nodes[nodeIndex];
      node.x = Math.max(0, Math.round(point.x - state.dragging.offsetX));
      node.y = Math.max(0, Math.round(point.y - state.dragging.offsetY));
      state.project.nodes[nodeIndex] = normalizeNode(node);
      state.dragging.moved = true;
      renderCanvas();
      renderNodeList();
    }
  } else if (state.panning) {
    state.viewport.tx += event.clientX - state.panning.startX;
    state.viewport.ty += event.clientY - state.panning.startY;
    state.panning = { startX: event.clientX, startY: event.clientY };
    renderCanvas();
  } else {
    const point = worldPointFromCanvas(event.clientX, event.clientY);
    elements.canvas.style.cursor = hitNode(point.x, point.y) ? 'pointer' : 'grab';
  }
});

elements.canvas.addEventListener('pointerup', async (event) => {
  if (state.dragging) {
    const node = state.project?.nodes.find((item) => item.id === state.dragging.nodeId);
    const moved = state.dragging.moved;
    state.dragging = null;
    if (node && moved) {
      await saveNodePosition(node);
      showToast('节点位置已保存');
    }
  } else if (state.panning) {
    state.panning = null;
  }
  elements.canvas.releasePointerCapture(event.pointerId);
});

elements.canvas.addEventListener('dblclick', (event) => {
  const point = worldPointFromCanvas(event.clientX, event.clientY);
  const node = hitNode(point.x, point.y);
  if (node?.preview_url) {
    openLightbox(new URL(node.preview_url, API_BASE).toString(), node.media_type === 'video');
  }
});

elements.canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  const delta = event.deltaY > 0 ? 0.9 : 1.1;
  state.viewport.scale = Math.max(0.35, Math.min(3.5, state.viewport.scale * delta));
  updateZoomLabel();
  renderCanvas();
}, { passive: false });

window.addEventListener('resize', renderCanvas);
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (anyPanelOpen()) {
      event.preventDefault();
      closePanels();
      return;
    }
    if (state.ui.projectRailOpen) {
      event.preventDefault();
      closeProjectRail();
      return;
    }
    if (anyCanvasPopoverOpen()) {
      event.preventDefault();
      closeCanvasPopovers();
      return;
    }
  }
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
    event.preventDefault();
    generateNode();
    return;
  }
  if (event.shiftKey && event.key === 'Enter') {
    event.preventDefault();
    queueStoryboard();
    return;
  }
  if (isTypingTarget(event.target)) return;
  if (event.key === '0') {
    event.preventDefault();
    fitCanvas();
  } else if (event.key.toLowerCase() === 'f') {
    event.preventDefault();
    centerOnSelected();
  } else if (event.key.toLowerCase() === 'a') {
    event.preventDefault();
    autoArrangeNodes();
  } else if (event.key.toLowerCase() === 'n') {
    event.preventDefault();
    createUtilityNode('note');
  } else if ((event.key === 'Backspace' || event.key === 'Delete') && selectedNode()) {
    event.preventDefault();
    deleteSelectedNode();
  }
});

// ── Node Popup ──────────────────────────────────────────────
elements.popupClose.addEventListener('click', closeNodePopup);
elements.nodePopup.addEventListener('click', (event) => {
  if (event.target === elements.nodePopup) closeNodePopup();
});

elements.popupDownloadBtn.addEventListener('click', () => {
  if (popupNode) downloadNodeMedia(popupNode);
});

elements.popupSaveBtn.addEventListener('click', async () => {
  if (!popupNode) return;
  const text = elements.popupPrompt.value.trim();
  if (!text) { showToast('提示词为空', true); return; }
  try {
    await navigator.clipboard.writeText(text);
    showToast('提示词已复制到剪贴板');
  } catch {
    // Fallback: select the textarea for manual copy
    elements.popupPrompt.select();
    document.execCommand('copy');
    showToast('提示词已复制到剪贴板');
  }
});

elements.popupRegenerateBtn.addEventListener('click', async () => {
  if (!popupNode) return;
  const prompt = elements.popupPrompt.value.trim();
  if (!prompt) {
    showToast('提示词为空，无法生成', true);
    return;
  }

  // Show spinner overlay while regenerating
  if (elements.popupSpinner) elements.popupSpinner.hidden = false;
  elements.popupRegenerateBtn.disabled = true;

  try {
    // Save prompt first
    await fetchJson(`/api/nodes/${popupNode.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        prompt,
        mediaType: elements.popupMediaTypeSelect.value,
        aspect: elements.popupAspectSelect.value,
      }),
    });
    // Then submit new generation
    const created = await submitSession({
      message: prompt,
      mediaType: elements.popupMediaTypeSelect.value,
      aspect: elements.popupAspectSelect.value,
      style: popupNode.style || '',
      parentNodeId: popupNode.parent_node_id || null,
    });
    showToast('重新生成任务已提交');
    closeNodePopup();
    await loadProject(created.projectId || state.project.id, { preserveSelection: true });
  } catch (err) {
    showToast('生成失败: ' + (err.message || err), true);
  } finally {
    if (elements.popupSpinner) elements.popupSpinner.hidden = true;
    elements.popupRegenerateBtn.disabled = false;
  }
});

async function bootstrap() {
  renderRecipeCards();
  renderPanelState();
  updateZoomLabel();
  updateBatchHint();
  await ensureAuthenticated();
  await loadCapabilities({ suppressErrors: true });
  await loadProjects();
  const projectId = new URLSearchParams(window.location.search).get('projectId');
  if (projectId) {
    await selectProject(projectId);
  } else if (state.projects[0]?.id) {
    await selectProject(state.projects[0].id);
  } else {
    renderProjects();
    renderStats();
    renderNodeList();
    renderSessionList();
    renderFileList();
    renderDetail();
    updateDraftHint();
    renderCanvas();
  }

  setInterval(async () => {
    if (!state.project?.id) return;
    try {
      if (projectGenerating(state.project) || state.localBatch.running) {
        await loadProject(state.project.id, { preserveSelection: true });
        await loadProjects();
      }
    } catch {
      // Ignore background polling errors to keep interaction responsive.
    }
  }, 3500);
}

bootstrap().catch((error) => {
  console.error(error);
  if (error.message !== 'Canvas authentication required') {
    showToast(error.message || '初始化失败');
  }
});
