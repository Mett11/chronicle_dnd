const fs = require('fs');
let content = fs.readFileSync('src/types/index.ts', 'utf8');

content = content.replace(/  assigneePlayerName\?: string;/g, "  assigneePlayerName?: string;\n  sharedWithDm?: boolean;");
content = content.replace(/  createdAt: string;\n\}/g, "  createdAt: string;\n  isSecret?: boolean;\n  sharedWithDm?: boolean;\n}");

fs.writeFileSync('src/types/index.ts', content);
