const fs = require('fs');
let content = fs.readFileSync('src/pages/Entities.tsx', 'utf8');

// There are duplicate sharedWithDm lines due to the previous replace
content = content.replace(
  "sharedWithDm: formType === 'quest' && newQuestScope === 'personal' ? newSharedWithDm : undefined,\n        sharedWithDm:",
  "sharedWithDm:"
);
content = content.replace(
  "sharedWithDm: formType === 'quest' && newQuestScope === 'personal' ? newSharedWithDm : undefined,\n        sharedWithDm:",
  "sharedWithDm:"
);

fs.writeFileSync('src/pages/Entities.tsx', content);
