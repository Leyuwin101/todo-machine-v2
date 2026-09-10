const http = require('http'), fs = require('fs'), path = require('path');
const root = __dirname;
http.createServer((q, s) => {
  let u = decodeURIComponent(q.url.split('?')[0]);
  if (u === '/') u = '/index.html';
  const fp = path.join(root, u);
  fs.readFile(fp, (e, d) => {
    if (e) { s.writeHead(404); s.end('not found'); return; }
    const m = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'};
    s.writeHead(200, {'Content-Type': m[path.extname(fp)] || 'application/octet-stream'});
    s.end(d);
  });
}).listen(8090, () => console.log('up'));
