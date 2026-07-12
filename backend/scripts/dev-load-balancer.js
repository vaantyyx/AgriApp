// Round-robins HTTP + WebSocket traffic across several already-running
// server.js instances — a pure-Node stand-in for the nginx.conf reverse
// proxy at the repo root, for developers who want to try the multi-instance
// setup locally without installing Docker/Nginx.
//
// Usage: node scripts/dev-load-balancer.js [listenPort] [targetPort1,targetPort2,...]
//   node scripts/dev-load-balancer.js 8080 3095,3096,3097
import http from 'node:http';
import httpProxy from 'http-proxy';

const LISTEN_PORT = parseInt(process.argv[2] || '8080', 10);
const TARGETS = (process.argv[3] || '3095,3096,3097')
  .split(',')
  .map(p => `http://127.0.0.1:${p.trim()}`);

const proxy = httpProxy.createProxyServer({ ws: true });
proxy.on('error', (err, req, res) => {
  console.error('Proxy error:', err.message);
  if (res && !res.headersSent) res.writeHead(502).end('Bad gateway');
});

let next = 0;
function pickTarget() {
  const target = TARGETS[next % TARGETS.length];
  next += 1;
  return target;
}

const server = http.createServer((req, res) => {
  proxy.web(req, res, { target: pickTarget(), xfwd: true });
});

// Socket.IO's WebSocket upgrade — this is the part a plain http-proxy config
// (or a naive reverse proxy without upgrade handling) silently breaks.
server.on('upgrade', (req, socket, head) => {
  proxy.ws(req, socket, head, { target: pickTarget(), xfwd: true });
});

server.listen(LISTEN_PORT, () => {
  console.log(`Dev load balancer listening on :${LISTEN_PORT}, round-robin -> ${TARGETS.join(', ')}`);
});
