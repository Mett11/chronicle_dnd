const fs = require('fs');
let content = fs.readFileSync('src/pages/Home.tsx', 'utf8');

const targetStr = `      const isAuthor = authorId && myId && authorId === myId;

      if (!player?.isDm && n.dmOnly && !isAuthor) return false;
      if (n.visibility === 'personal' && !isAuthor && !player?.isDm) return false;
      return true;
    });`;

const replacement = `      const isAuthor = authorId && myId && authorId === myId;

      if (isAuthor) return true;
      if (n.visibility === 'personal') {
        if (n.dmOnly && player?.isDm) return true; // Shared with DM
        return false; // Not author, and either not shared with DM or user is not DM
      }
      if (n.dmOnly && !player?.isDm) return false;
      return true;
    });`;

content = content.replace(targetStr, replacement);
fs.writeFileSync('src/pages/Home.tsx', content);
