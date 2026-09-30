const fs = require('fs');
let code = fs.readFileSync('src/pages/Sessions.tsx', 'utf8');

const oldModal = `  const openEditSessionModal = (sess: Session) => {
    setSelectedSession(sess);
    setNumber(sess.number);
    setTitle(sess.title);
    setDate(sess.date);
    setLoreDate(sess.loreDate || '');
    setRecapText(`;

const newModal = `  const openEditSessionModal = (sess: Session) => {
    setSelectedSession(sess);
    setNumber(sess.number);
    setTitle(sess.title);
    setDate(sess.date);
    setLoreDate(sess.loreDate || '');
    setLoreMeta({
      startDay: sess.loreStartDay || 1,
      endDay: sess.loreEndDay,
      month: sess.loreMonth || '',
      year: sess.loreYear || 1492,
    });
    setRecapText(`;

code = code.replace(oldModal, newModal);
fs.writeFileSync('src/pages/Sessions.tsx', code);
