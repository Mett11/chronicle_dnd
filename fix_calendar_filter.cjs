const fs = require('fs');
let content = fs.readFileSync('src/pages/Calendar.tsx', 'utf8');

const targetStr = `      const dayMemories = scrapbook.filter((m) => {
        return matchesLoreDayAndMonth(
          {
            loreDate: m.loreDate,
          },
          day,
          browsingMonthIndex,
          calendar.months
        );
      });`;

const replacement = `      const dayMemories = scrapbook.filter((m) => {
        // Privacy filter
        if (m.isSecret) {
          if (m.authorName !== player?.characterName) {
            // Check if shared with DM
            if (!(player?.isDm && m.sharedWithDm)) {
              return false;
            }
          }
        }
        
        return matchesLoreDayAndMonth(
          {
            loreDate: m.loreDate,
          },
          day,
          browsingMonthIndex,
          calendar.months
        );
      });`;

content = content.replace(targetStr, replacement);
fs.writeFileSync('src/pages/Calendar.tsx', content);
