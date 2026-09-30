const fs = require('fs');
let content = fs.readFileSync('src/components/AiImageGeneratorModal.tsx', 'utf8');

const replacement = `  const generateWithServer = async (prompt: string, modelChoice: string, ar: string, curSeed: number) => {
    let width = 1024;
    let height = 1024;
    if (ar === 'portrait') {
      width = 768;
      height = 1024;
    } else if (ar === 'landscape') {
      width = 1024;
      height = 576;
    } else if (ar === 'map') {
      width = 1024;
      height = 768;
    }

    const targetModel = modelChoice === 'turbo' ? 'turbo' : modelChoice === 'sdxl' ? 'sdxl' : 'flux';
    const url = \`https://image.pollinations.ai/prompt/\${encodeURIComponent(prompt)}?width=\${width}&height=\${height}&seed=\${curSeed}&nologo=true&enhance=false&model=\${targetModel}\`;

    const res = await fetch(url, {
      headers: {
        'Accept': 'image/webp,image/png,image/jpeg,*/*'
      }
    });

    if (!res.ok) {
      throw new Error(\`Errore server di rendering (\${res.status})\`);
    }

    const blob = await res.blob();
    return URL.createObjectURL(blob);
  };`;

const startIdx = content.indexOf('  // Direct server generation');
const endIdx = content.indexOf('  // Main Prompt Constructor');

if (startIdx !== -1 && endIdx !== -1) {
    content = content.slice(0, startIdx) + replacement + '\n\n' + content.slice(endIdx);
    fs.writeFileSync('src/components/AiImageGeneratorModal.tsx', content);
}
