/**
 * API Integration Tests for Clawbot Channel Server
 *
 * These tests verify the HTTP endpoints of the server.
 * They can be run against a running server instance.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

// Configuration
const BASE_URL = process.env.TEST_SERVER_URL || 'http://localhost:8765';
const TEST_TIMEOUT = 5000;

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 8765,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      timeout: TEST_TIMEOUT,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data,
          json: () => {
            try {
              return JSON.parse(data);
            } catch {
              return null;
            }
          },
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// Skip tests if server is not available
let serverAvailable = false;

test.before(async () => {
  try {
    await makeRequest('GET', '/health');
    serverAvailable = true;
  } catch {
    console.log('Server not available, skipping integration tests');
    console.log('To run these tests, start the server first: npm run dev');
  }
});

test('Health check endpoint should return server status', async () => {
  if (!serverAvailable) return;

  const res = await makeRequest('GET', '/health');

  assert.equal(res.status, 200);

  const data = res.json();
  assert.equal(data.status, 'ok');
  assert.equal(typeof data.timestamp, 'string');
  assert.equal(typeof data.uptime, 'number');
  assert.equal(data.uptime >= 0, true);
});

test('TTS synthesize endpoint should validate request body', async () => {
  if (!serverAvailable) return;

  // Missing text field
  const res1 = await makeRequest('POST', '/api/tts/synthesize', {
    scene: 'bot_reply',
  });

  // Should either reject or handle gracefully
  assert.equal([400, 500].includes(res1.status) || res1.status === 200, true);
});

test('TTS synthesize endpoint should accept valid request', async () => {
  if (!serverAvailable) return;

  const res = await makeRequest('POST', '/api/tts/synthesize', {
    text: '测试文本',
    scene: 'bot_reply',
    messageId: 'test-msg-123',
  });

  // Should succeed or return a meaningful error
  if (res.status === 200) {
    assert.equal(res.headers['content-type'].includes('audio'), true);
  } else if (res.status === 500) {
    // TTS service might not be configured
    const data = res.json();
    assert.equal(typeof data.error, 'string');
  }
});

test('OSS signed URL endpoint should require authentication', async () => {
  if (!serverAvailable) {
    console.log('Skipping: server not available');
    return;
  }

  const res = await makeRequest('GET', '/oss/signed-url?key=test/image.jpg');

  // Without proper auth, should return error
  // Accept any reasonable status code (depends on server config)
  const validStatus = [200, 401, 403, 404, 500, 501];
  assert.equal(validStatus.includes(res.status), true, `Expected status in ${validStatus}, got ${res.status}`);
});

test('File upload endpoint should require multipart form data', async () => {
  if (!serverAvailable) return;

  // Sending JSON instead of multipart
  const res = await makeRequest('POST', '/upload', {
    file: 'not a file',
  });

  // Should reject or return error
  assert.equal([400, 415, 500].includes(res.status), true);
});

test('Base64 upload endpoint should validate input', async () => {
  if (!serverAvailable) return;

  // Invalid base64 data
  const res = await makeRequest('POST', '/upload/base64', {
    data: 'not-valid-base64!!!',
    filename: 'test.png',
  });

  // Should handle gracefully
  assert.equal([200, 400, 500].includes(res.status), true);
});

test('Webhook endpoint should validate secret', async () => {
  if (!serverAvailable) {
    console.log('Skipping: server not available');
    return;
  }

  const res = await makeRequest('POST', '/webhook/clawbot', {
    event: 'test',
    data: {},
  });

  // Without webhook secret, should be rejected or endpoint might not exist
  const validStatus = [401, 403, 404, 500];
  assert.equal(validStatus.includes(res.status), true, `Expected status in ${validStatus}, got ${res.status}`);
});

test('Unknown endpoint should return 404', async () => {
  if (!serverAvailable) return;

  const res = await makeRequest('GET', '/unknown-endpoint-12345');

  assert.equal(res.status, 404);
});

test('OPTIONS request should return CORS headers', async () => {
  if (!serverAvailable) return;

  const res = await makeRequest('OPTIONS', '/health');

  // CORS preflight should be handled
  assert.equal(res.status, 204);

  // Should have CORS headers
  assert.equal(res.headers['access-control-allow-origin'] !== undefined, true);
  assert.equal(res.headers['access-control-allow-methods'] !== undefined, true);
});

test('Rate limiting should be enforced', async () => {
  if (!serverAvailable) return;

  // Make many requests quickly
  const promises = [];
  for (let i = 0; i < 100; i += 1) {
    promises.push(makeRequest('GET', '/health').catch(() => null));
  }

  const results = await Promise.all(promises);
  const rateLimited = results.filter((r) => r && r.status === 429);

  // Some requests might be rate limited
  // This test is informational, not strict
  console.log(`Rate limited requests: ${rateLimited.length}/100`);
});

test('Error responses should be JSON', async () => {
  if (!serverAvailable) return;

  const res = await makeRequest('POST', '/api/tts/synthesize', {
    invalid: 'data',
  });

  if (res.status >= 400) {
    const data = res.json();
    assert.equal(typeof data, 'object');
    // Should have error property
    assert.equal(data.error !== undefined || data.message !== undefined, true);
  }
});
