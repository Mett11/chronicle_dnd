const fs = require('fs');

function fixRegex(filename) {
  let code = fs.readFileSync(filename, 'utf8');
  
  // We want to replace exactly:
  // textBeforeCursor.match(/@([^@[\]\\n\\r]*)$/);
  // or whatever it is now.
  
  // The correct AST-level string representation for the regex literal /@([^@[\]\n\r]*)$/
  // inside the match call is: textBeforeCursor.match(/@([^@[\]\n\r]*)$/);
  
  code = code.replace(/textBeforeCursor\.match\(\/@[^)]+\)/g, "textBeforeCursor.match(/@([^@[\\]\\n\\r]*)$/)");
  
  fs.writeFileSync(filename, code);
}

fixRegex('src/components/MentionInput.tsx');
fixRegex('src/components/RichTextEditor.tsx');
