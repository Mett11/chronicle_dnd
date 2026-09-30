const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');
const startIdx = content.indexOf('  app.post(\'/api/ai/semantic-search\', async (req: any, res: any) => {');
const endIdx = content.indexOf('  // Dedicated direct high-res AI image generator endpoint');
if (startIdx !== -1 && endIdx !== -1) {
    content = content.slice(0, startIdx) + content.slice(endIdx);
    fs.writeFileSync('server.ts', content);
}
