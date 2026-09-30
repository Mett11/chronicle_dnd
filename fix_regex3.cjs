const fs = require('fs');

function fix(filename) {
  let code = fs.readFileSync(filename, 'utf8');
  // I made a mess, let's fix it.
  // The current code has: textBeforeCursor.match(/@([^@[\]\n\r]*)$/)$/);
  // We want to replace it entirely with: textBeforeCursor.match(/@([^@[\]\n\r]*)$/);
  
  code = code.replace(/textBeforeCursor\.match\(\/@[^;]+;/g, "textBeforeCursor.match(/@([^@[\\]\\n\\r]*)$/);");
  fs.writeFileSync(filename, code);
}

fix('src/components/MentionInput.tsx');
fix('src/components/RichTextEditor.tsx');
