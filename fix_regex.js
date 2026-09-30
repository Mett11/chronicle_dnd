const fs = require('fs');
let code = fs.readFileSync('src/components/MentionInput.tsx', 'utf8');
code = code.replace(/match\(\/@\(\[\^@\\\[\\\]\]\*\)\$\/\)/g, 'match(/@([^@[\]\\n\\r]*)$/)');
fs.writeFileSync('src/components/MentionInput.tsx', code);
