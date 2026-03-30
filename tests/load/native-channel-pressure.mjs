import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';

const serviceUrl = (process.env.TRIX_SERVICE_URL || 'http://127.0.0.1:8788').replace(/\/$/, '');
const serviceToken = process.env.TRIX_SERVICE_TOKEN || 'trix-local-e2e-token';
const imagePath = process.env.TRIX_PRESSURE_IMAGE || path.resolve(process.cwd(), 'src/assets/roles/role1/AvatarHead.png');

const scenarioConfig = {
  fanoutConversations: Number(process.env.TRIX_PRESSURE_FANOUT_CONVS || 8),
  burstCount: Number(process.env.TRIX_PRESSURE_BURST_COUNT || 8),
  imageConversations: Number(process.env.TRIX_PRESSURE_IMAGE_CONVS || 3),
  idempotencyBurst: Number(process.env.TRIX_PRESSURE_IDEMPOTENCY_BURST || 10),
  rateLimitRequests: Number(process.env.TRIX_PRESSURE_RATE_LIMIT_REQUESTS || 125),
  replyTimeoutMs: Number(process.env.TRIX_PRESSURE_REPLY_TIMEOUT_MS || 120000),
  pollIntervalMs: Number(process.env.TRIX_PRESSURE_POLL_INTERVAL_MS || 1500),
};

const runTag = process.env.TRIX_PRESSURE_RUN_TAG || randomId('run');

function now() {
  return Date.now();
}

function randomId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

function summarizeDurations(values) {
  if (!values.length) {
    return {
      count: 0,
      minMs: null,
      maxMs: null,
      avgMs: null,
      p50Ms: null,
      p95Ms: null,
    };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, value) => acc + value, 0);
  const percentile = (ratio) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))];
  return {
    count: sorted.length,
    minMs: Math.round(sorted[0]),
    maxMs: Math.round(sorted[sorted.length - 1]),
    avgMs: Math.round(sum / sorted.length),
    p50Ms: Math.round(percentile(0.5)),
    p95Ms: Math.round(percentile(0.95)),
  };
}

async function requestJson(url, options = {}) {
  const started = performance.now();
  const response = await fetch(url, options);
  const elapsedMs = performance.now() - started;
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return {
    ok: response.ok,
    status: response.status,
    elapsedMs,
    text,
    json,
  };
}

async function createPairing(label, forwardedIp) {
  const result = await requestJson(`${serviceUrl}/api/pairings`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${serviceToken}`,
      ...(forwardedIp ? { 'x-forwarded-for': forwardedIp } : {}),
    },
    body: JSON.stringify({
      accountId: 'default',
      label,
    }),
  });

  if (!result.ok || !result.json?.code) {
    throw new Error(`createPairing failed: ${result.status} ${result.text}`);
  }

  return {
    ...result.json,
    elapsedMs: result.elapsedMs,
  };
}

async function claimPairing(code, clientId, deviceName, forwardedIp) {
  const result = await requestJson(`${serviceUrl}/api/pairings/${encodeURIComponent(code)}/claim`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(forwardedIp ? { 'x-forwarded-for': forwardedIp } : {}),
    },
    body: JSON.stringify({
      clientId,
      deviceName,
    }),
  });

  if (!result.ok || !result.json?.conversationId || !result.json?.clientToken) {
    throw new Error(`claimPairing failed: ${result.status} ${result.text}`);
  }

  return {
    ...result.json,
    elapsedMs: result.elapsedMs,
  };
}

async function fetchServiceConversation(conversationId) {
  const result = await requestJson(`${serviceUrl}/api/service/conversations/${encodeURIComponent(conversationId)}`, {
    headers: {
      authorization: `Bearer ${serviceToken}`,
    },
  });

  if (!result.ok || !result.json?.conversation) {
    throw new Error(`fetchServiceConversation failed: ${result.status} ${result.text}`);
  }

  return result.json;
}

async function uploadAttachment(conversationId, clientToken, fileName, mimeType, buffer) {
  const started = performance.now();
  const response = await fetch(`${serviceUrl}/api/uploads`, {
    method: 'POST',
    headers: {
      'content-type': mimeType,
      'x-file-name': encodeURIComponent(fileName),
      'x-mime-type': mimeType,
      'x-attachment-kind': 'image',
      'x-trix-conversation-id': conversationId,
      'x-trix-client-token': clientToken,
    },
    body: buffer,
  });
  const elapsedMs = performance.now() - started;
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  if (!response.ok || !json?.attachment?.id) {
    throw new Error(`uploadAttachment failed: ${response.status} ${text}`);
  }
  return {
    attachmentId: json.attachment.id,
    elapsedMs,
  };
}

async function sendUserMessage({ conversationId, clientToken, text, uploadedAttachmentIds = [], headers = {} }) {
  const localId = randomId('local');
  const result = await requestJson(`${serviceUrl}/api/messages`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${clientToken}`,
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({
      conversationId,
      clientToken,
      text,
      localId,
      attachments: [],
      uploadedAttachmentIds,
      metadata: {
        clientMessageId: localId,
        declaredContentType: uploadedAttachmentIds.length > 0 ? 'mixed' : 'text',
      },
    }),
  });

  return {
    localId,
    ...result,
  };
}

async function sendServiceMessage({ accountId = 'default', conversationId, text, idempotencyKey }) {
  return requestJson(`${serviceUrl}/api/service/messages`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${serviceToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      accountId,
      conversationId,
      message: {
        text,
        idempotencyKey,
      },
    }),
  });
}

async function waitForOutboundMessages(conversationId, baselineOutboundCount, expectedAdditionalCount, timeoutMs) {
  const deadline = now() + timeoutMs;
  const startedAt = now();
  while (now() < deadline) {
    const payload = await fetchServiceConversation(conversationId);
    const outboundMessages = payload.messages.filter((message) => message.direction === 'outbound');
    if (outboundMessages.length >= baselineOutboundCount + expectedAdditionalCount) {
      return {
        ok: true,
        elapsedMs: now() - startedAt,
        outboundCount: outboundMessages.length,
        messages: payload.messages,
      };
    }
    await new Promise((resolve) => setTimeout(resolve, scenarioConfig.pollIntervalMs));
  }

  const payload = await fetchServiceConversation(conversationId);
  const outboundMessages = payload.messages.filter((message) => message.direction === 'outbound');
  return {
    ok: false,
    elapsedMs: timeoutMs,
    outboundCount: outboundMessages.length,
    messages: payload.messages,
  };
}

function buildForwardedIp(seed) {
  const hash = crypto.createHash('sha1').update(`${runTag}:${seed}`).digest();
  return `198.51.${hash[0] ?? 1}.${hash[1] ?? 1}`;
}

async function provisionConversation(label) {
  const scopedLabel = `${runTag}-${label}`;
  const forwardedIp = buildForwardedIp(label);
  const pairing = await createPairing(scopedLabel, forwardedIp);
  const claim = await claimPairing(pairing.code, randomId('client'), scopedLabel, forwardedIp);
  const snapshot = await fetchServiceConversation(claim.conversationId);
  const baselineOutboundCount = snapshot.messages.filter((message) => message.direction === 'outbound').length;
  return {
    label: scopedLabel,
    forwardedIp,
    pairing,
    claim,
    baselineOutboundCount,
  };
}

async function runFanoutStatusScenario() {
  const sessions = await Promise.all(
    Array.from({ length: scenarioConfig.fanoutConversations }, (_, index) =>
      provisionConversation(`fanout-${index + 1}`),
    ),
  );

  const startedAt = now();
  const sends = await Promise.all(
    sessions.map((session) =>
      (sendUserMessage({
        conversationId: session.claim.conversationId,
        clientToken: session.claim.clientToken,
        text: '/status',
      }))
        .then((result) => ({ ok: result.ok, status: result.status, elapsedMs: result.elapsedMs, session, text: result.text }))
        .catch((error) => ({ ok: false, status: 0, elapsedMs: 0, session, text: String(error) })),
    ),
  );

  const waits = await Promise.all(
    sessions.map((session) =>
      waitForOutboundMessages(
        session.claim.conversationId,
        session.baselineOutboundCount,
        1,
        scenarioConfig.replyTimeoutMs,
      ),
    ),
  );

  const sendLatencies = sends.filter((entry) => entry.ok).map((entry) => entry.elapsedMs);
  const replyLatencies = waits.filter((entry) => entry.ok).map((entry) => entry.elapsedMs);

  return {
    scenario: 'fanout_status',
    startedAt,
    totalSessions: sessions.length,
    sendSuccess: sends.filter((entry) => entry.ok).length,
    sendFailure: sends.filter((entry) => !entry.ok).length,
    replySuccess: waits.filter((entry) => entry.ok).length,
    replyFailure: waits.filter((entry) => !entry.ok).length,
    sendLatency: summarizeDurations(sendLatencies),
    replyLatency: summarizeDurations(replyLatencies),
    failures: sends.filter((entry) => !entry.ok).map((entry) => ({
      label: entry.session.label,
      status: entry.status,
      text: entry.text,
    })),
  };
}

async function runBurstSameConversationScenario() {
  const session = await provisionConversation('burst-status');
  const before = await fetchServiceConversation(session.claim.conversationId);
  const baselineOutboundCount = before.messages.filter((message) => message.direction === 'outbound').length;

  const sends = await Promise.all(
    Array.from({ length: scenarioConfig.burstCount }, (_, index) =>
      (sendUserMessage({
        conversationId: session.claim.conversationId,
        clientToken: session.claim.clientToken,
        text: '/status',
      }))
        .then((result) => ({ ok: result.ok, status: result.status, elapsedMs: result.elapsedMs, text: result.text, ordinal: index + 1 }))
        .catch((error) => ({ ok: false, status: 0, elapsedMs: 0, text: String(error) })),
    ),
  );

  const waited = await waitForOutboundMessages(
    session.claim.conversationId,
    baselineOutboundCount,
    scenarioConfig.burstCount,
    scenarioConfig.replyTimeoutMs,
  );

  const finalConversation = await fetchServiceConversation(session.claim.conversationId);
  const outboundMessages = finalConversation.messages.filter((message) => message.direction === 'outbound');

  return {
    scenario: 'burst_same_conversation_status',
    runTag,
    totalRequests: scenarioConfig.burstCount,
    sendSuccess: sends.filter((entry) => entry.ok).length,
    sendFailure: sends.filter((entry) => !entry.ok).length,
    sendLatency: summarizeDurations(sends.filter((entry) => entry.ok).map((entry) => entry.elapsedMs)),
    observedNewOutbound: outboundMessages.length - baselineOutboundCount,
    replyGoalReached: waited.ok,
    waitElapsedMs: waited.elapsedMs,
  };
}

async function runImageFanoutScenario() {
  const fileBuffer = await fs.readFile(imagePath);
  const fileName = path.basename(imagePath);
  const sessions = await Promise.all(
    Array.from({ length: scenarioConfig.imageConversations }, (_, index) =>
      provisionConversation(`image-${index + 1}`),
    ),
  );

  const uploads = await Promise.all(
    sessions.map((session) =>
      uploadAttachment(
        session.claim.conversationId,
        session.claim.clientToken,
        fileName,
        'image/png',
        fileBuffer,
      ).then((result) => ({ ok: true, ...result, session }))
        .catch((error) => ({ ok: false, error: String(error), session })),
    ),
  );

  const sends = await Promise.all(
    uploads.map((upload) => {
      if (!upload.ok) {
        return Promise.resolve({ ok: false, status: 0, elapsedMs: 0, text: upload.error, session: upload.session });
      }
      return sendUserMessage({
        conversationId: upload.session.claim.conversationId,
        clientToken: upload.session.claim.clientToken,
        text: '请描述这张图片',
        uploadedAttachmentIds: [upload.attachmentId],
      }).then((result) => ({ ok: result.ok, status: result.status, elapsedMs: result.elapsedMs, text: result.text, session: upload.session }))
        .catch((error) => ({ ok: false, status: 0, elapsedMs: 0, text: String(error), session: upload.session }));
    }),
  );

  const waits = await Promise.all(
    sessions.map((session) =>
      waitForOutboundMessages(
        session.claim.conversationId,
        session.baselineOutboundCount,
        1,
        scenarioConfig.replyTimeoutMs,
      ),
    ),
  );

  return {
    scenario: 'image_fanout',
    totalSessions: sessions.length,
    uploadSuccess: uploads.filter((entry) => entry.ok).length,
    uploadFailure: uploads.filter((entry) => !entry.ok).length,
    sendSuccess: sends.filter((entry) => entry.ok).length,
    sendFailure: sends.filter((entry) => !entry.ok).length,
    replySuccess: waits.filter((entry) => entry.ok).length,
    replyFailure: waits.filter((entry) => !entry.ok).length,
    uploadLatency: summarizeDurations(uploads.filter((entry) => entry.ok).map((entry) => entry.elapsedMs)),
    sendLatency: summarizeDurations(sends.filter((entry) => entry.ok).map((entry) => entry.elapsedMs)),
    replyLatency: summarizeDurations(waits.filter((entry) => entry.ok).map((entry) => entry.elapsedMs)),
  };
}

async function runServiceIdempotencyScenario() {
  const session = await provisionConversation('service-idempotency');
  const idempotencyKey = randomId('idem');
  const before = await fetchServiceConversation(session.claim.conversationId);
  const baselineOutboundCount = before.messages.filter((message) => message.direction === 'outbound').length;

  const results = await Promise.all(
    Array.from({ length: scenarioConfig.idempotencyBurst }, () =>
      sendServiceMessage({
        conversationId: session.claim.conversationId,
        text: 'idempotent outbound',
        idempotencyKey,
      }),
    ),
  );

  const after = await fetchServiceConversation(session.claim.conversationId);
  const outboundWithKey = after.messages.filter((message) =>
    message.direction === 'outbound' && message.metadata?.idempotencyKey === idempotencyKey,
  );

  return {
    scenario: 'service_idempotency',
    requests: scenarioConfig.idempotencyBurst,
    httpSuccess: results.filter((entry) => entry.ok).length,
    httpFailure: results.filter((entry) => !entry.ok).length,
    responseLatency: summarizeDurations(results.filter((entry) => entry.ok).map((entry) => entry.elapsedMs)),
    newOutboundCount: after.messages.filter((message) => message.direction === 'outbound').length - baselineOutboundCount,
    idempotentOutboundCount: outboundWithKey.length,
  };
}

async function runRateLimitScenario() {
  const fakeConversationId = 'conv_rate_limit_probe';
  const fakeClientToken = 'invalid-client-token';
  const forwardedIp = buildForwardedIp('rate-limit-probe');
  const results = await Promise.all(
    Array.from({ length: scenarioConfig.rateLimitRequests }, (_, index) =>
      sendUserMessage({
        conversationId: fakeConversationId,
        clientToken: fakeClientToken,
        text: `rate-limit-probe-${index + 1}`,
        headers: {
          'x-forwarded-for': forwardedIp,
        },
      }).then((result) => ({
        ok: result.ok,
        status: result.status,
        elapsedMs: result.elapsedMs,
        text: result.text,
      })).catch((error) => ({
        ok: false,
        status: 0,
        elapsedMs: 0,
        text: String(error),
      })),
    ),
  );

  const byStatus = results.reduce((acc, entry) => {
    const key = String(entry.status);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    scenario: 'rate_limit_user_messages',
    runTag,
    requests: scenarioConfig.rateLimitRequests,
    byStatus,
    latency: summarizeDurations(results.map((entry) => entry.elapsedMs).filter(Boolean)),
  };
}

async function collectStateSummary() {
  const filePath = path.resolve(process.cwd(), '.trix-local-e2e/state.json');
  const raw = await fs.readFile(filePath, 'utf8');
  const state = JSON.parse(raw);
  return {
    conversations: state.conversations.length,
    messages: state.messages.length,
    uploads: state.uploads.length,
    sizeBytes: Buffer.byteLength(raw),
  };
}

async function main() {
  const startedAt = new Date().toISOString();
  const initialState = await collectStateSummary();

  const scenarios = [];
  scenarios.push(await runFanoutStatusScenario());
  scenarios.push(await runBurstSameConversationScenario());
  scenarios.push(await runImageFanoutScenario());
  scenarios.push(await runServiceIdempotencyScenario());
  scenarios.push(await runRateLimitScenario());

  const finalState = await collectStateSummary();
  const report = {
    runTag,
    startedAt,
    finishedAt: new Date().toISOString(),
    serviceUrl,
    config: scenarioConfig,
    initialState,
    finalState,
    scenarios,
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
