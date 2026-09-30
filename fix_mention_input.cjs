const fs = require('fs');
let content = fs.readFileSync('src/components/MentionInput.tsx', 'utf8');

const targetStr1 = `      const entities = CampaignManager.getEntities();
      const hasMatch = entities.some(e => {`;

const replacement1 = `      const entities = CampaignManager.getEntities().filter(e => {
        if (e.type === 'quest' && e.questScope === 'personal') {
          if (e.assigneePlayerId === player?._id) return true;
          if (e.sharedWithDm && player?.isDm) return true;
          return false;
        }
        return true;
      });
      const hasMatch = entities.some(e => {`;

content = content.replace(targetStr1, replacement1);
content = content.replace(targetStr1, replacement1); // Replace the second occurrence too

fs.writeFileSync('src/components/MentionInput.tsx', content);
