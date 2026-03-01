console.log('[Extension] Content script loaded:', globalThis.location && globalThis.location.href);

globalThis.addEventListener('message', (event) => {
  if (event.source !== globalThis) return;
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'METADATA_ANALYZE_REQUEST') {
    chrome.runtime.sendMessage(
      { action: 'analyzeFile', data: data.payload },
      (response) => {
      globalThis.postMessage({ type: 'METADATA_ANALYZE_RESPONSE', data: response }, '*');
      }
    );
  }

  if (data.type === 'METADATA_PING') {
    chrome.runtime.sendMessage({ action: 'ping' }, (response) => {
      globalThis.postMessage({ type: 'METADATA_PONG', data: response }, '*');
    });
  }
});
