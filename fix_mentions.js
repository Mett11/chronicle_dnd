const fs = require('fs');
let code = fs.readFileSync('src/components/MentionInput.tsx', 'utf8');

// fix the bad lines
code = code.replace(/const match = textBeforeCursor\.match\(.*?\);\n/g, '');
code = code.replace(/\]\*\)\$\/\);/g, '');

// now insert the correct lines before `if (match)`
code = code.replace(/if \(match\) \{/g, 'const match = textBeforeCursor.match(/@([^@[\]\\\\n\\\\r]*)$/);\n    if (match) {');

fs.writeFileSync('src/components/MentionInput.tsx', code);
