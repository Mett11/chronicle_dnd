const fs = require('fs');
let code = fs.readFileSync('src/pages/Calendar.tsx', 'utf8');

const targetLogic = code.match(/\/\/ All events occurring in the active browsing month[\s\S]*?\}, \[allStorylineEvents, activeBrowsingMonth\]\);/);
if (targetLogic) {
  code = code.replace(targetLogic[0], '');
  fs.writeFileSync('src/pages/Calendar.tsx', code);
  console.log("Success removed");
} else {
  console.log("Failed to find target");
}
