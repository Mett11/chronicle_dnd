const fs = require('fs');

const file = fs.readFileSync('src/pages/Calendar.tsx', 'utf8');
const matchFn = file.match(/const matchesDayAndMonth[\s\S]*?return false;\n  \};/);
console.log(matchFn[0]);

