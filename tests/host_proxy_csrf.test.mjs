// 回归测试：使用者回报 ST 后端 console 被 ForbiddenError: Invalid CSRF token 灌爆。
//
// 宿主代理鉴权失败（CSRF token 对不上）时我们会回退直连，直连成功后使用者端
// 完全看不到异常——但每一次追踪请求都会先撞一次代理，于是伺服器 log 每轮加一笔。
// 撞到一次就该整个 session 停用代理。
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';

import { callOpenAICompatible, fetchModelList } from '../scripts/api.js';

const ORIGINAL_FETCH = globalThis.fetch;
const PROXY_DISABLED_KEY = '__bs_biotracker_host_proxy_disabled__';

afterEach(() => {
  if (ORIGINAL_FETCH === undefined) delete globalThis.fetch;
  else globalThis.fetch = ORIGINAL_FETCH;
  delete globalThis[PROXY_DISABLED_KEY];
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.location;
  delete globalThis.SillyTavern;
});

function installBrowserLikeRuntime() {
  // shouldUseHostProxy 要求浏览器环境 + 跨来源 URL
  // isCrossOriginUrl 读的是裸的全域 location，不是 window.location
  globalThis.location = { origin: 'http://localhost:8000', href: 'http://localhost:8000/' };
  globalThis.window = { location: globalThis.location };
  globalThis.document = { cookie: '' };
  globalThis.SillyTavern = { getRequestHeaders: () => ({ 'Content-Type': 'application/json' }) };
}

function makeSettings() {
  return {
    apiUrl: 'https://api.example.com/v1',
    apiKey: 'k',
    model: 'test-model',
    apiTimeoutMs: 5000,
    formattedOutputV4: false,
  };
}

test('宿主代理回 403 CSRF 后，同一 session 不再重复打代理', async () => {
  installBrowserLikeRuntime();
  const hits = { proxy: 0, direct: 0 };
  globalThis.fetch = async (url) => {
    const target = String(url);
    if (target.includes('/api/backends/chat-completions/generate')) {
      hits.proxy += 1;
      return {
        ok: false,
        status: 403,
        async text() { return 'ForbiddenError: Invalid CSRF token. Please refresh the page and try again.'; },
      };
    }
    hits.direct += 1;
    return {
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({ choices: [{ message: { content: JSON.stringify({ tool_calls: [] }) } }] });
      },
    };
  };

  for (let i = 0; i < 5; i += 1) {
    await callOpenAICompatible(makeSettings(), { recent_messages: [] }, 'sys');
  }

  assert.equal(hits.proxy, 1, `代理只该被撞一次，实际 ${hits.proxy} 次`);
  assert.equal(hits.direct, 5, '其余请求应直接走直连');
  assert.equal(globalThis[PROXY_DISABLED_KEY], true, '应标记本 session 停用代理');
});

test('TT status 端点回 200 + error:true 时回退直连，直连失败则透传上游错误', async () => {
  installBrowserLikeRuntime();
  const hits = { proxy: 0, direct: 0 };
  globalThis.fetch = async (url) => {
    const target = String(url);
    if (target.includes('/api/backends/chat-completions/status')) {
      hits.proxy += 1;
      // TauriTavern ai-routes：上游失败也回 200，带 error:true 与 data:{data:[]}
      return {
        ok: true,
        status: 200,
        async text() { return JSON.stringify({ error: true, message: 'Status request failed: connection refused', data: { data: [] } }); },
      };
    }
    hits.direct += 1;
    return {
      ok: false,
      status: 502,
      async text() { return 'Bad Gateway'; },
    };
  };

  await assert.rejects(
    fetchModelList(makeSettings()),
    (error) => {
      // 回退直连后的失败路径也要带上 TT 的上游错误，不能被吞成「没有返回可用模型」
      assert.match(error.message, /connection refused/);
      return true;
    },
  );
  assert.equal(hits.proxy, 1, '代理只该被撞一次');
  assert.equal(hits.direct, 1, '代理 200-with-error 后应回退直连');
});

test('TT status 端点回 200 + error:true，直连成功则拿到模型', async () => {
  installBrowserLikeRuntime();
  const hits = { proxy: 0, direct: 0 };
  globalThis.fetch = async (url) => {
    const target = String(url);
    if (target.includes('/api/backends/chat-completions/status')) {
      hits.proxy += 1;
      return {
        ok: true,
        status: 200,
        async text() { return JSON.stringify({ error: true, message: 'Status request failed', data: { data: [] } }); },
      };
    }
    hits.direct += 1;
    return {
      ok: true,
      status: 200,
      async text() { return JSON.stringify({ data: [{ id: 'model-a' }, { id: 'model-b' }] }); },
    };
  };

  const models = await fetchModelList(makeSettings());
  assert.deepEqual(models, ['model-a', 'model-b']);
  assert.equal(hits.proxy, 1);
  assert.equal(hits.direct, 1);
});

test('TT generate 路由的伪错误 completion 不再被当作模型输出', async () => {
  installBrowserLikeRuntime();
  globalThis.fetch = async (url) => {
    const target = String(url);
    if (target.includes('/api/backends/chat-completions/generate')) {
      return {
        ok: true,
        status: 200,
        async text() {
          // TT buildErrorCompletionPayload 的形状：id 带 tauritavern-error 前缀
          return JSON.stringify({
            id: `tauritavern-error-${Math.floor(Date.now() / 1000)}`,
            object: 'chat.completion',
            choices: [{ index: 0, message: { role: 'assistant', content: '[API Error]\n上游连接失败' }, finish_reason: 'stop' }],
          });
        },
      };
    }
    // 直连回退路径也不该发生——伪 completion 是 ok 的 200，直接在解析层拦
    throw new Error('direct fetch should not be reached');
  };

  await assert.rejects(
    callOpenAICompatible(makeSettings(), { recent_messages: [] }, 'sys'),
    (error) => {
      assert.match(error.message, /上游连接失败|tauritavern-error/);
      return true;
    },
  );
});
