const fs = require('fs');
const code = fs.readFileSync('src/pages/Entities.tsx', 'utf8');
const lines = code.split('\n');
console.log(lines.findIndex(l => l.includes('React.useEffect(() => {')));
console.log(lines.findIndex(l => l.includes('const handleOpenEditModal')));
