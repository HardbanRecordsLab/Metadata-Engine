console.log('[Extension] Background Service Worker loaded');

async function handleAnalyzeFile(data) {
  try {
    const base = 'https://metadata.hardbanrecordslab.online';
    const res = await fetch(`${base}/api/worker_status`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
    const status = await res.json();
    return { ok: true, status, passthrough: data ?? null };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  try {
    if (request?.action === 'analyzeFile') {
      handleAnalyzeFile(request.data)
        .then(r => sendResponse({ success: r.ok, data: r.ok ? r : null, error: r.ok ? null : r.error }))
        .catch(err => sendResponse({ success: false, error: err?.message || String(err) }));
      return true;
    }
    if (request?.action === 'ping') {
      sendResponse({ pong: true, ts: Date.now() });
      return;
    }
    sendResponse({ success: false, error: 'Unknown action' });
  } catch (err) {
    sendResponse({ success: false, error: err?.message || String(err) });
  }
});

setInterval(() => {
  console.log('[Extension] Background heartbeat');
}, 60000);
