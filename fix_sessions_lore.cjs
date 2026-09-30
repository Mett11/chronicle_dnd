const fs = require('fs');
let code = fs.readFileSync('src/pages/Sessions.tsx', 'utf8');

const oldModal = `  const openNewSessionModal = () => {
    setIsEditing(false);
    setSelectedSession(null);
    const nextNum = sessions.length > 0 ? Math.max(...sessions.map((s) => s.number)) + 1 : 1;
    setNumber(nextNum);
    setTitle('');
    setDate(new Date().toISOString().split('T')[0]);
    setLoreDate('');
    setLoreMeta(undefined);
    setRecapText('');
    setSessionImages([]);
    setEventsList([]);
    setIsModalOpen(true);
  };`;

const newModal = `  const openNewSessionModal = () => {
    setIsEditing(false);
    setSelectedSession(null);
    const nextNum = sessions.length > 0 ? Math.max(...sessions.map((s) => s.number)) + 1 : 1;
    setNumber(nextNum);
    setTitle('');
    setDate(new Date().toISOString().split('T')[0]);
    
    // Set default lore date to current campaign date
    const cal = CampaignManager.getCalendar();
    const currentMonth = cal.months[cal.currentMonthIndex] || cal.months[0];
    setLoreDate(\`Giorno \${cal.currentDay} di \${currentMonth.name}, \${cal.currentYear} \${cal.yearSuffix}\`);
    setLoreMeta({
      startDay: cal.currentDay,
      month: currentMonth.name,
      year: cal.currentYear,
    });
    
    setRecapText('');
    setSessionImages([]);
    setEventsList([]);
    setIsModalOpen(true);
  };`;

code = code.replace(oldModal, newModal);
fs.writeFileSync('src/pages/Sessions.tsx', code);
