const fs = require('fs');
let content = fs.readFileSync('src/pages/Entities.tsx', 'utf8');

const targetEntityFilter = `    const allowedEntities = entities.filter((e) => {
      if (e.type === 'quest' && e.questScope === 'personal' && e.assigneePlayerId !== player?._id && !player?.isDm) {
        return false;
      }
      return true;
    });`;

const replacementEntityFilter = `    const allowedEntities = entities.filter((e) => {
      if (e.type === 'quest' && e.questScope === 'personal') {
        if (e.assigneePlayerId === player?._id) return true;
        if (e.sharedWithDm && player?.isDm) return true;
        return false;
      }
      return true;
    });`;

content = content.replace(targetEntityFilter, replacementEntityFilter);

// We need to add the UI for sharedWithDm when creating/editing personal quests
// Let's find the newAssigneeId setting and add a new state for newSharedWithDm
