const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const startIdx = content.indexOf('  // Dedicated direct high-res AI image generator endpoint');
const endIdx = content.indexOf('  // Catch-all for undefined /api routes (prevent falling through to Vite SPA index.html)');

if (startIdx !== -1 && endIdx !== -1) {
    content = content.slice(0, startIdx) + content.slice(endIdx);
    fs.writeFileSync('server.ts', content);
}
