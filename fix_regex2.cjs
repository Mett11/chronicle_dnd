const fs = require('fs');

function fixFile(filename) {
  let code = fs.readFileSync(filename, 'utf8');
  
  // We want to replace ANY broken regex inside textBeforeCursor.match(...)
  // with: textBeforeCursor.match(/@([^@[\]\n\r]*)$/)
  
  code = code.replace(/textBeforeCursor\.match\(\/@[^)]+\)/g, "textBeforeCursor.match(/@([^@[\\]\\\\n\\\\r]*)$/)");
  // Wait, in JS, inside a string literal, to get /@([^@[\]\n\r]*)$/
  // We need to write: `textBeforeCursor.match(/@([^@[\\]\\n\\r]*)$/)`
  // Actually, let's just write the exact string:
  let correctString = "textBeforeCursor.match(/@([^@\\[\\]\\n\\r]*)$/)";
  
  // Let's test the regex directly in JS!
  // /@([^@[\]\n\r]*)$/
  
}
