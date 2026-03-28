const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const distDir = path.join(__dirname, 'dist');
const port = 8097;

const contentTypes = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain; charset=utf-8',
    '.wasm': 'application/wasm',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg'
};

const safeResolve = (requestPath) => {
    const pathname = decodeURIComponent(requestPath.split('?')[0]);
    const normalized = pathname === '/' ? '/index.html' : pathname;
    const resolved = path.resolve(path.join(distDir, `.${normalized}`));
    if (!resolved.startsWith(distDir)) {
        return null;
    }

    return resolved;
};

const sendFile = (response, filePath) => {
    fs.readFile(filePath, (error, data) => {
        if (error) {
            response.writeHead(500);
            response.end('Internal Server Error');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        response.writeHead(200, {
            'Content-Type': contentTypes[ext] || 'application/octet-stream',
            'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable'
        });
        response.end(data);
    });
};

http.createServer((request, response) => {
    const resolvedPath = safeResolve(request.url || '/');
    if (!resolvedPath) {
        response.writeHead(403);
        response.end('Forbidden');
        return;
    }

    fs.stat(resolvedPath, (error, stats) => {
        if (!error && stats.isFile()) {
            sendFile(response, resolvedPath);
            return;
        }

        sendFile(response, path.join(distDir, 'index.html'));
    });
}).listen(port, '127.0.0.1', () => {
    console.log(`Serving Jellyfin web client at http://127.0.0.1:${port}`);
});
