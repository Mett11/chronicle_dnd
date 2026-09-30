const fs = require('fs');
let content = fs.readFileSync('src/pages/Search.tsx', 'utf8');

const targetNoteFilter = `  const notes = CampaignManager.getNotes().filter((n) => {
    if (!player?.isDm && n.dmOnly && n.author._id !== player?._id) return false;
    if (n.visibility === 'personal' && n.author._id !== player?._id && !player?.isDm) return false;
    return true;
  });`;

const replacementNoteFilter = `  const notes = CampaignManager.getNotes().filter((n) => {
    const isAuthor = n.author._id === player?._id;
    if (isAuthor) return true;
    if (n.visibility === 'personal') {
      if (n.dmOnly && player?.isDm) return true; // Shared with DM
      return false; // Strictly personal
    }
    if (n.dmOnly && !player?.isDm) return false;
    return true;
  });`;

content = content.replace(targetNoteFilter, replacementNoteFilter);

const targetEntityFilter = `  const entities = CampaignManager.getEntities().filter((e) => {
    if (e.type === 'quest' && e.questScope === 'personal' && e.assigneePlayerId !== player?._id && !player?.isDm) {
      return false;
    }
    return true;
  });`;

const replacementEntityFilter = `  const entities = CampaignManager.getEntities().filter((e) => {
    if (e.type === 'quest' && e.questScope === 'personal') {
      if (e.assigneePlayerId === player?._id) return true;
      if (e.sharedWithDm && player?.isDm) return true;
      return false;
    }
    return true;
  });`;

content = content.replace(targetEntityFilter, replacementEntityFilter);

fs.writeFileSync('src/pages/Search.tsx', content);
