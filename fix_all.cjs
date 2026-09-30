const fs = require('fs');

let mentionInput = fs.readFileSync('src/components/MentionInput.tsx', 'utf8');
mentionInput = mentionInput.replaceAll('match(/@([^@\\\\[\\\\]\\\\n\\\\r]*)$/);', 'match(/@([^@[\\\\]\\\\n\\\\r]*)$/);');
fs.writeFileSync('src/components/MentionInput.tsx', mentionInput);

let richTextEditor = fs.readFileSync('src/components/RichTextEditor.tsx', 'utf8');
richTextEditor = richTextEditor.replaceAll('match(/@([^@\\\\[\\\\]\\\\n\\\\r]*)$/);', 'match(/@([^@[\\\\]\\\\n\\\\r]*)$/);');
fs.writeFileSync('src/components/RichTextEditor.tsx', richTextEditor);

