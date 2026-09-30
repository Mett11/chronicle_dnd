const fs = require('fs');
let content = fs.readFileSync('src/pages/Search.tsx', 'utf8');

// I will just add the missing </div>
content = content.replace(/    <\/div>\n  \);\n\}\n?$/, '      </div>\n    </div>\n  );\n}\n');
fs.writeFileSync('src/pages/Search.tsx', content);
