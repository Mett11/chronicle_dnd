const fs = require('fs');
let code = fs.readFileSync('src/components/RichTextEditor.tsx', 'utf8');

const regexOld = 'const match = textBeforeCursor.match(/@([^@\\n\\r]*)$/);';
const regexNew = 'const match = textBeforeCursor.match(/@([^@\\\\[\\\\]\\\\n\\\\r]*)$/);';

code = code.replaceAll(regexOld, regexNew);

// Add the space canceling logic
const oldLogic = `    if (match) {
      setMentionQuery({ query: match[1], index: selectionEnd - match[0].length });
    } else {
      setMentionQuery(null);
    }`;

const newLogic = `    if (match) {
      const q = match[1];
      const hasMatch = entities.some(e => {
        const qLower = q.toLowerCase();
        return e.name.toLowerCase().includes(qLower) || (e.aliases && e.aliases.some(a => a.toLowerCase().includes(qLower)));
      });

      if (q.includes(' ') && !hasMatch) {
        setMentionQuery(null);
      } else {
        setMentionQuery({ query: q, index: selectionEnd - match[0].length });
      }
    } else {
      setMentionQuery(null);
    }`;

code = code.replace(oldLogic, newLogic);
fs.writeFileSync('src/components/RichTextEditor.tsx', code);
