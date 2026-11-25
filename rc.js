#!/usr/bin/env node
// Drive Recordly's Electron renderer over CDP.
// Usage: node rc.js '<js expression>'  [windowTypeSubstring]
const http = require('http');

const expr = process.argv[2];
const want = process.argv[3] || '';

http.get('http://127.0.0.1:9333/json/list', (r) => {
  let d = '';
  r.on('data', (c) => (d += c));
  r.on('end', () => {
    const pages = JSON.parse(d).filter((x) => x.type === 'page');
    const t = want ? pages.find((p) => (p.url || '').includes(want)) : pages[0];
    if (!t) {
      console.error('no page matching: ' + want);
      console.error('available: ' + pages.map((p) => p.url).join('\n           '));
      process.exit(1);
    }
    const ws = new WebSocket(t.webSocketDebuggerUrl);
    ws.onopen = () =>
      ws.send(
        JSON.stringify({
          id: 1,
          method: 'Runtime.evaluate',
          params: { expression: expr, awaitPromise: true, returnByValue: true },
        })
      );
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id !== 1) return;
      const res = m.result || {};
      if (res.exceptionDetails) {
        console.error('EXCEPTION: ' + JSON.stringify(res.exceptionDetails.exception || res.exceptionDetails));
      } else {
        console.log(JSON.stringify(res.result && res.result.value, null, 2));
      }
      ws.close();
      process.exit(0);
    };
    ws.onerror = (e) => {
      console.error('ws error', e.message);
      process.exit(1);
    };
  });
}).on('error', (e) => {
  console.error('Recordly CDP not reachable on 9333: ' + e.message);
  process.exit(1);
});
