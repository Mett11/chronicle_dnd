const fs = require('fs');
let code = fs.readFileSync('src/components/MentionInput.tsx', 'utf8');

code = code.replaceAll('const match = textBeforeCursor.match(/@([^@[\\\\]\\\\n\\\\r]*)$/);', 'const match = textBeforeCursor.match(/@([^@\\\\[\\\\]\\\\n\\\\r]*)$/);');

fs.writeFileSync('src/components/MentionInput.tsx', code);
